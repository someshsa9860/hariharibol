// Walks the admin Scenes feature end to end: the worker's processor (in this process, against the real Postgres and
// Redis) and the admin API (a copy started on its own port). Run it with Postgres and Redis up and the permissions
// seeded (`npm run seed`):
//
//   npm run test:scenes
//
// Nothing here can reach a model provider or S3. The "model" is a stub, the bucket is a temporary folder
// (SOURCE_LOCAL_DIR) holding a fake canto 1 of three chapters (Hindi meanings for two of them), and the API copy is
// given a key that is not real. The script refuses to run while a worker is connected to the scenes queue, because
// that worker would pick up the runs it creates.
//
// What it checks is the part that fails quietly: that a chapter ends up in the file the page says it does, with the
// name and the shape it promises; that tokens are counted on the row and in the token calculator; that a run survives
// every way it can stop (credit gone, the key refused, the provider busy, a bad answer, Cancel) and ends in the state
// the page tells the admin; that a chapter already written is not written again unless asked; and that the API gives
// only the right people the page.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { DelayedError } from 'bullmq';

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { scenes } from '../config/scenes.js';
import env from '../config/env.js';
import * as authService from '../services/auth.js';
import * as service from '../services/scenes.js';
import * as tally from '../services/ai/token-tally.js';
import { queues } from '../jobs/index.js';
import { processRun, realDeps } from '../jobs/processors/scenes.js';
import { createLimiter, indexKey, sceneKey } from '../utils/scenes.js';
import { FatalApiError } from './lib/claude-translate-client.js';
import { chapterKey } from './lib/claude-translate-source.js';
import { langChapterKey } from './lib/claude-translate-store.js';

const PORT = 4400 + (Date.now() % 90);
const BASE = `http://localhost:${PORT}`;
const DEVICE = 'scenes-e2e-device';
const STAMP = Date.now();
const MODEL = `e2e-model-${STAMP}`;
const queue = queues.scenes;

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}
const section = (title) => console.log(`\n${title}`);

/* ---------- a fake canto 1 ---------- */

function writeJson(dir, key, body) {
  mkdirSync(dirname(join(dir, key)), { recursive: true });
  writeFileSync(join(dir, key), JSON.stringify(body, null, 2));
}

/** Chapters 1 and 2 have Hindi meanings (chapter 2 for two of its three verses); chapter 3 has none. */
function writeCanto(dir) {
  for (const ch of [1, 2, 3]) {
    const verses = [1, 2, 3].map((n) => ({
      verseId: `2.1.${ch}.${n}`, chapterNumber: ch, verseNumber: n, verseNumberEnd: null, cantoNumber: 1, bookNumber: 2,
      commentaries: [{ translatorSlug: 'prabhupada', type: 'translation', language: 'en', text: `English ${ch}.${n}` }],
    }));
    writeJson(dir, chapterKey(100 + ch, 'srimad-bhagavatam'), { meta: { chapterName: `Chapter ${ch} name`, chapterNumber: ch, cantoNumber: 1 }, verses });
    if (ch === 3) continue;
    writeJson(dir, langChapterKey('hi', 100 + ch, 'srimad-bhagavatam'), {
      meta: {},
      verses: verses
        .filter((v) => !(ch === 2 && v.verseNumber === 3))
        .map((v) => ({ verseId: v.verseId, commentaries: [{ translatorSlug: 'prabhupada', type: 'translation', language: 'hi', text: `हिंदी अर्थ ${ch}.${v.verseNumber}` }] })),
    });
  }
}

/* ---------- a stand-in for the model ---------- */

/** Answers with a storyboard covering the verse references it finds in the request. `script(ctx)` may throw or wait first. */
function fakeModel(script = async () => {}) {
  const asked = [];
  let signal = null;
  const makeAsk = (options) => {
    signal = options.signal;
    return async (request) => {
      const refs = [...request.user.matchAll(/^\[([^\]]+)\]/gm)].map((m) => m[1]);
      asked.push({ refs, user: request.user, schema: request.schema, maxTokens: request.maxTokens, model: options.model, provider: options.provider });
      await script({ nth: asked.length, refs, signal });
      return {
        data: {
          chapterTitle: 'शीर्षक', summary: 'सार', style: 'Painterly', characters: [{ name: 'Suta', look: 'An old sage' }],
          scenes: refs.map((ref, i) => ({ title: `दृश्य ${i + 1}`, verseRefs: [ref], setting: 'Naimisharanya', visualPrompt: `Suta speaks, scene ${ref}`, camera: 'wide', mood: 'calm', narration: 'कथा', dialogues: [{ speaker: 'Suta', line: 'सुनिए' }], sound: 'flute', durationSec: 8 })),
        },
        usage: { inputTokens: 1000, outputTokens: 400, cacheReadTokens: 0, cacheWriteTokens: 0 },
        costUsd: 0,
        stopReason: 'STOP',
      };
    };
  };
  return { makeAsk, asked };
}

const made = { runs: [], users: [], roles: [] };
let jobCount = 0;
const fastLimiter = () => createLimiter({ rpm: 1000, tpm: 10_000_000 });
const deps = (model) => ({ ...realDeps, apiKey: () => 'e2e-not-a-real-key', makeAsk: model.makeAsk, limiter: fastLimiter });

async function newRun(extra = {}) {
  const jobId = `e2e-${STAMP}-${(jobCount += 1)}`;
  const row = await prisma.sceneRun.create({
    data: { model: MODEL, chapters: [101, 102, 103], status: 'QUEUED', statusMessage: 'Waiting for the worker.', jobId, requestedByName: 'e2e', ...extra },
  });
  made.runs.push(row.id);
  return row;
}

/** Works a run the way the worker would; a run that pauses to retry later throws DelayedError, which is the answer. */
async function work(row, model) {
  const job = { id: row.jobId, data: { runId: row.id }, moveToDelayed: async () => {} };
  try {
    return await processRun(job, 'token', deps(model));
  } catch (err) {
    if (err instanceof DelayedError) return { delayed: true };
    throw err;
  }
}
const fresh = (row) => prisma.sceneRun.findUnique({ where: { id: row.id } });

async function tokenWith(slugs, label) {
  const permissions = await prisma.permission.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
  if (permissions.length !== slugs.length) throw new Error(`Not all of ${slugs.join(', ')} exist. Run \`npm run seed\`.`);
  const role = await prisma.role.create({ data: { slug: `e2e-${STAMP}-${label}`, name: `E2E ${label}`, permissions: { create: permissions.map((p) => ({ permissionId: p.id })) } } });
  made.roles.push(role.id);
  const user = await prisma.user.create({ data: { email: `scenes-${STAMP}-${label}@example.test`, name: `E2E ${label}`, roleId: role.id, authProvider: 'GOOGLE', providerUserId: `scenes-${STAMP}-${label}` } });
  made.users.push(user.id);
  return (await authService.issueSession(user, DEVICE)).accessToken;
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-device-id': DEVICE, 'x-platform': 'ios', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data, error: json?.error };
}

async function waitForApi() {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return true;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  return false;
}

async function counted() {
  const row = (await tally.today()).find((r) => r.provider === 'gemini' && r.model === MODEL);
  return { inputTokens: row?.inputTokens ?? 0, outputTokens: row?.outputTokens ?? 0, calls: row?.calls ?? 0 };
}

/* ---------- the script ---------- */

async function main() {
  if (env.isProduction) {
    console.error('\nThis script writes rows; it does not run against production.\n');
    process.exit(1);
  }
  if ((await queue.getWorkers()).length) {
    console.error('\nA worker is connected to the scenes queue. Stop it first — it would work the runs this script makes.\n');
    process.exit(1);
  }
  const busy = await prisma.sceneRun.count({ where: { status: { in: ['QUEUED', 'RUNNING', 'PAUSED'] } } });
  if (busy) {
    console.error(`\n${busy} scene run(s) are active in this database. Finish or cancel them first.\n`);
    process.exit(1);
  }

  const dir = mkdtempSync(join(tmpdir(), 'scenes-e2e-'));
  process.env.SOURCE_LOCAL_DIR = dir;
  writeCanto(dir);
  const saved = { heartbeatMs: scenes.heartbeatMs, unknownRetryMs: scenes.unknownRetryMs, retryBaseMs: scenes.retryBaseMs };
  scenes.heartbeatMs = 100;
  let api = null;
  const apiLog = [];
  const file = (ch) => {
    const path = join(dir, sceneKey(ch));
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  };
  const index = () => (existsSync(join(dir, indexKey())) ? JSON.parse(readFileSync(join(dir, indexKey()), 'utf8')) : null);

  try {
    section('A run that writes a canto');
    {
      const model = fakeModel();
      const row = await newRun();
      const result = await work(row, model);
      const after = await fresh(row);
      check('it completes', result.completed === true && after.status === 'COMPLETED', JSON.stringify(result));
      check('two chapters written, the one with no Hindi skipped', after.doneChapters === 2 && after.skippedChapters === 1 && after.totalChapters === 3, `${after.doneChapters}/${after.skippedChapters}/${after.totalChapters}`);
      check('one request per chapter, asked of the run’s provider and model', model.asked.length === 2 && model.asked.every((a) => a.provider === 'gemini' && a.model === MODEL));
      check('the request carries the Hindi meaning of each verse, by reference', model.asked[0].refs.join() === '1.1.1,1.1.2,1.1.3' && model.asked[0].user.includes('[1.1.2] हिंदी अर्थ 1.2'), model.asked[0].refs.join());
      check('a verse with no Hindi is left out and said so', model.asked[1].refs.join() === '1.2.1,1.2.2' && (await service.readFeed(row.id)).some((l) => /1 verse\(s\) have no Hindi/.test(l.text)));
      const one = file(101);
      check('the file is sk-1-ch-1.json under scenes/', one?.meta.file === 'sk-1-ch-1.json' && existsSync(join(dir, 'json/srimad-bhagavatam/scenes/sk-1-ch-1.json')));
      check('it holds the scenes, covering every verse in order', one?.scenes.length === 3 && one.scenes.map((s) => s.verseRefs[0]).join() === '1.1.1,1.1.2,1.1.3' && one.scenes[0].number === 1);
      check('and how it was made', one?.meta.provider === 'gemini' && one.meta.model === MODEL && one.meta.sourceLanguage === 'hi' && one.meta.usage.inputTokens === 1000 && one.meta.runId === row.id && one.meta.chapterName === 'Chapter 1 name');
      check('the chapter missing a Hindi verse says which', file(102)?.meta.missingHindi.join() === '1.2.3');
      check('the chapter with no Hindi has no file', file(103) === null);
      check('the index lists the two written', Object.keys(index()?.chapters ?? {}).join() === '101,102' && index().chapters[101].scenes === 3);
      check('tokens are on the row', after.inputTokens === 2000 && after.outputTokens === 800 && after.calls === 2, `${after.inputTokens}/${after.outputTokens}/${after.calls}`);
      const day = await counted();
      check('and in the token calculator under gemini and the model', day.inputTokens === 2000 && day.outputTokens === 800 && day.calls === 2, JSON.stringify(day));
      check('the feed has a line for each chapter', (await service.readFeed(row.id)).filter((l) => l.level === 'success').length >= 2);
    }

    section('A chapter already written');
    {
      const model = fakeModel();
      check('is not asked for again', (await service.chaptersToWrite('srimad-bhagavatam', [101, 102, 103], false)).join() === '103');
      const row = await newRun({ chapters: [101, 102] });
      const result = await work(row, model);
      check('so a run for only written chapters finishes at once without a request', result.completed === true && model.asked.length === 0 && (await fresh(row)).totalChapters === 0);
      const again = fakeModel();
      const forced = await newRun({ chapters: [101], force: true });
      await work(forced, again);
      check('unless it is written again on purpose', again.asked.length === 1 && (await fresh(forced)).doneChapters === 1);
      check('and the earlier file is kept as a backup', readdirBackup(dir));
    }

    section('A queue of runs');
    {
      const first = await newRun({ chapters: [101], force: true });
      await sleep(20);
      const later = await newRun({ chapters: [102], force: true });
      const model = fakeModel();
      const early = await work(later, model);
      check('a run waits while an earlier one is queued', early.delayed === true && model.asked.length === 0 && (await fresh(later)).status === 'QUEUED');
      await work(first, fakeModel());
      const after = await work(later, model);
      check('and starts once the earlier one has finished', after.completed === true && model.asked.length === 1 && (await fresh(later)).status === 'COMPLETED');
    }

    section('Every way a run can stop');
    {
      const run = (extra) => newRun({ chapters: [101], force: true, ...extra });

      let row = await run();
      let result = await work(row, fakeModel(async () => { throw Object.assign(new FatalApiError('API key not valid', 401), { provider: 'gemini' }); }));
      let after = await fresh(row);
      check('a refused key pauses it until a person fixes it', after.status === 'PAUSED' && after.pauseReason === 'auth' && after.resumeAt === null && /GEMINI_API_KEY/.test(after.statusMessage), `${after.pauseReason}: ${after.statusMessage}`);

      row = await run();
      result = await work(row, fakeModel(async () => { throw Object.assign(new Error('quota'), { status: 429, provider: 'gemini' }); }));
      after = await fresh(row);
      check('a provider’s limit (even one that says “quota”) pauses it and it tries again by itself', result.delayed === true && after.status === 'PAUSED' && after.pauseReason === 'rate_limit' && after.resumeAt && after.retriesInARow === 1, `${after.pauseReason} ${after.resumeAt}`);

      // A run paused to retry by itself holds its place in the queue; this one is done with.
      await prisma.sceneRun.update({ where: { id: row.id }, data: { status: 'CANCELLED' } });

      row = await run();
      result = await work(row, fakeModel(async () => { throw Object.assign(new FatalApiError('spend limit reached, billing', 402), { provider: 'gemini' }); }));
      after = await fresh(row);
      check('no credit pauses it for a person', after.status === 'PAUSED' && after.pauseReason === 'credit' && !after.resumeAt);

      row = await run();
      const bad = fakeModel();
      const worse = { ...bad, makeAsk: (o) => { const ask = bad.makeAsk(o); return async (r) => { const out = await ask(r); out.data.scenes = out.data.scenes.slice(0, 1); return out; }; } };
      result = await work(row, worse);
      after = await fresh(row);
      check('an answer that skips verses is asked for again, then the run fails on that chapter', after.status === 'FAILED' && after.errorChapter === 101 && bad.asked.length === scenes.invalidTries && /not in any scene/.test(after.statusMessage), `${bad.asked.length} ${after.statusMessage}`);
      check('and the second request told the model what was wrong', /Your last answer had these problems/.test(bad.asked[1].user));
      check('what the failed asks cost is still counted', after.calls === scenes.invalidTries && after.inputTokens === 1000 * scenes.invalidTries);

      row = await run({ chapters: [101, 102] });
      const cancelModel = fakeModel(async ({ nth }) => { if (nth === 1) await prisma.sceneRun.update({ where: { id: row.id }, data: { cancelRequested: true } }); await sleep(600); });
      result = await work(row, cancelModel);
      after = await fresh(row);
      check('Cancel stops it after the chapter in progress, which is kept', after.status === 'CANCELLED' && result.cancelled === true && after.doneChapters <= 1, `${after.status} ${after.doneChapters}`);

      const missingKey = await newRun({ chapters: [101], force: true });
      const noKey = { ...deps(fakeModel()), apiKey: () => '' };
      await processRun({ id: missingKey.jobId, data: { runId: missingKey.id }, moveToDelayed: async () => {} }, 't', noKey).catch(() => {});
      after = await fresh(missingKey);
      check('a server with no key pauses the run and names the setting', after.status === 'PAUSED' && after.pauseReason === 'config' && /GEMINI_API_KEY/.test(after.statusMessage), after.statusMessage);

      const stale = await newRun();
      const other = await work({ ...stale, jobId: 'some-other-job' }, fakeModel());
      check('a job the row does not name does nothing', other.skipped === 'superseded by another job');
    }

    section('The admin API');
    {
      await prisma.sceneRun.deleteMany({ where: { id: { in: made.runs } } });
      made.runs.length = 0;

      api = spawn(process.execPath, ['server.js'], {
        cwd: join(import.meta.dirname, '..'),
        env: { ...process.env, PORT: String(PORT), SOURCE_LOCAL_DIR: dir, GEMINI_API_KEY: 'e2e-not-a-real-key', SCENES_GEMINI_MODEL: MODEL, SCENES_RPM: '7', SCENES_TPM: '123456', AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: '' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      api.stdout.on('data', (c) => apiLog.push(String(c)));
      api.stderr.on('data', (c) => apiLog.push(String(c)));
      if (!(await waitForApi())) {
        console.error(apiLog.join('').slice(-2000));
        throw new Error('the API copy did not start');
      }

      const reader = await tokenWith(['scenes.read'], 'reader');
      const runner = await tokenWith(['scenes.read', 'scenes.run'], 'runner');
      const nobody = await tokenWith(['reel.read'], 'nobody');
      await redis.del(`rl:write:${made.users[1]}`, `rl:read:${made.users[1]}`);

      check('someone without the permission is refused', (await call('GET', '/api/admin/scenes/overview', { token: nobody })).status === 403);
      check('and so is someone signed out', (await call('GET', '/api/admin/scenes/overview')).status === 403);

      const overview = await call('GET', '/api/admin/scenes/overview', { token: reader });
      const s = overview.data?.settings;
      check('overview: gemini, the configured model and limits', overview.status === 200 && s.defaultProvider === 'gemini' && s.model === MODEL && s.limits.rpm === 7 && s.limits.tpm === 123456, JSON.stringify(s));
      check('overview: key and bucket are green, no worker', s.apiKeyConfigured && s.storage.ok && s.workerOnline === false, JSON.stringify(s?.storage));
      check('overview: it says where files go and what they are called', s.outputFolder === 'json/srimad-bhagavatam/scenes/' && s.fileExample === 'sk-1-ch-1.json');
      check('overview: today’s tokens for this model are shown', overview.data.usage.today.calls >= 0);

      const chapters = await call('GET', '/api/admin/scenes/chapters', { token: reader });
      const c101 = chapters.data?.chapters.find((c) => c.id === 101);
      check('chapters: all 335, the two written marked', chapters.status === 200 && chapters.data.total === 335 && chapters.data.written === 2 && c101.written && c101.scenes === 3 && c101.label === '1.1', JSON.stringify(chapters.data?.written));

      const estimate = await call('GET', '/api/admin/scenes/estimate?chapters=101,102,103', { token: reader });
      check('estimate: one chapter left to write, a request for it', estimate.status === 200 && estimate.data.willWrite === 1 && estimate.data.alreadyWritten === 2 && estimate.data.requests === 1, JSON.stringify(estimate.data));
      const estimateForce = await call('GET', '/api/admin/scenes/estimate?chapters=101,102&force=true', { token: reader });
      check('estimate: with “write again” it counts the written ones', estimateForce.data?.willWrite === 2 && estimateForce.data.inputTokens > 0, JSON.stringify(estimateForce.data));

      const out = await call('GET', '/api/admin/scenes/output/101', { token: reader });
      check('output: the scenes and the text to copy', out.status === 200 && out.data.scenes.length === 3 && out.data.promptText.includes('Scene 3') && out.data.scenes[0].promptText.startsWith('Style: Painterly'), String(out.status));
      const raw = await call('GET', '/api/admin/scenes/output/101/file', { token: reader });
      check('file: exactly what is stored, without the copy text', raw.status === 200 && raw.data.meta.file === 'sk-1-ch-1.json' && raw.data.promptText === undefined);
      check('output: a chapter not written is a 404', (await call('GET', '/api/admin/scenes/output/103', { token: reader })).status === 404);
      check('output: a chapter the book does not have is a 400', (await call('GET', '/api/admin/scenes/output/1199', { token: reader })).status === 400);

      check('a reader cannot start a run', (await call('POST', '/api/admin/scenes/runs', { token: reader, body: { chapters: [103] } })).status === 403);
      check('nothing to write is not a run', (await call('POST', '/api/admin/scenes/runs', { token: runner, body: { chapters: [101, 102] } })).status === 409);
      const started = await call('POST', '/api/admin/scenes/runs', { token: runner, body: { chapters: [103] } });
      check('starting queues a run for gemini and the configured model', started.status === 201 && started.data.status === 'QUEUED' && started.data.provider === 'gemini' && started.data.model === MODEL && started.data.progress.total === 0, JSON.stringify(started.data));
      if (started.data?.id) made.runs.push(started.data.id);
      const second = await call('POST', '/api/admin/scenes/runs', { token: runner, body: { chapters: [103], force: true } });
      check('a second run is queued behind the first, not refused', second.status === 201 && second.data.status === 'QUEUED', String(second.status));
      if (second.data?.id) made.runs.push(second.data.id);
      const waiting = await call('POST', `/api/admin/scenes/runs/${second.data.id}/cancel`, { token: runner });
      check('and a queued run can be removed', waiting.status === 200 && waiting.data.status === 'CANCELLED');
      const got = await call('GET', `/api/admin/scenes/runs/${started.data.id}`, { token: reader });
      check('the run and its feed can be read', got.status === 200 && got.data.feed?.some((l) => /Queued by/.test(l.text)), JSON.stringify(got).slice(0, 300));
      check('Resume refuses a run that is waiting', (await call('POST', `/api/admin/scenes/runs/${started.data.id}/resume`, { token: runner })).status === 409);
      const cancelled = await call('POST', `/api/admin/scenes/runs/${started.data.id}/cancel`, { token: runner });
      check('Cancel on a waiting run ends it at once', cancelled.status === 200 && cancelled.data.status === 'CANCELLED');
      const list = await call('GET', '/api/admin/scenes/runs?status=CANCELLED', { token: reader });
      check('the list shows it', list.status === 200 && list.data.some((r) => r.id === started.data.id));
    }
  } finally {
    scenes.heartbeatMs = saved.heartbeatMs;
    api?.kill('SIGTERM');
    for (const id of made.runs) {
      const row = await prisma.sceneRun.findUnique({ where: { id } }).catch(() => null);
      if (row?.jobId) await queue.getJob(row.jobId).then((job) => job?.remove()).catch(() => {});
      await redis.del(`${scenes.feedKey}:${id}`).catch(() => {});
    }
    await prisma.auditLog.deleteMany({ where: { entityId: { in: made.runs } } }).catch(() => {});
    await prisma.sceneRun.deleteMany({ where: { id: { in: made.runs } } }).catch(() => {});
    await prisma.deviceSession?.deleteMany?.({ where: { userId: { in: made.users } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: made.users } } }).catch(() => {});
    await prisma.role.deleteMany({ where: { id: { in: made.roles } } }).catch(() => {});
    // The tokens this script counted, taken back out of today's tally.
    await redis.hdel(tally.keyOf(new Date()), `gemini|${MODEL}|in`, `gemini|${MODEL}|out`, `gemini|${MODEL}|calls`).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed) console.log(apiLog.join('').split('\n').filter((l) => /error|warn/i.test(l)).slice(-15).join('\n'));
  await prisma.$disconnect();
  await queue.close();
  process.exit(failed ? 1 : 0);
}

/** Was the file backed up before being replaced? (json-backup-<date>/…) */
function readdirBackup(dir) {
  const day = new Date().toISOString().slice(0, 10);
  return existsSync(join(dir, `json-backup-${day}`, sceneKey(101)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
