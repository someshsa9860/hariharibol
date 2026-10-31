// Walks the admin Narration feature end to end: the worker's processor (in this process, against the real Postgres and
// Redis) and the admin API (a copy started on its own port). Run it with Postgres and Redis up, the migration
// `20261121000000_narration_runs` applied and the permissions seeded (`npm run seed`):
//
//   npm run test:narration
//
// Nothing here can reach a text-to-speech engine or S3. The "engine" is a stub that returns a tiny MP3 or WAV, the verse
// texts come from a temporary folder (SOURCE_LOCAL_DIR) holding a fake Gita of two chapters, and the clips and indexes are
// written to that same folder (the rows are the real ones). The API copy is given a key that is not real. The script refuses
// to run while a worker is connected to the narration queue, because that worker would pick up the runs it creates.
//
// What it checks is the part that fails quietly: that a clip ends up under the key the page says, with a row and an index
// entry; that a verse already made from the same text is not made again; that a run survives every way it can stop; and that
// the API gives only the right people the page.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { DelayedError } from 'bullmq';

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { narration } from '../config/narration.js';
import env from '../config/env.js';
import * as authService from '../services/auth.js';
import * as service from '../services/narration.js';
import { queues } from '../jobs/index.js';
import { processRun, realDeps } from '../jobs/processors/narration.js';
import { createLimiter } from '../utils/scenes.js';
import { EngineError, clipKey, indexKey } from '../utils/narration.js';
import { chapterKey } from './lib/claude-translate-source.js';

const PORT = 4500 + (Date.now() % 90);
const BASE = `http://localhost:${PORT}`;
const DEVICE = 'narration-e2e-device';
const STAMP = Date.now();
const BOOK = 'bhagavat-gita';
const queue = queues.narration;
const CHIRP = { engine: 'google-chirp', model: 'chirp-3-hd', voice: 'Kore' };
const GEMINI = { engine: 'gemini-tts', model: 'gemini-2.5-flash-preview-tts', voice: 'Puck' };

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}
const section = (title) => console.log(`\n${title}`);

/* ---------- a fake Gita ---------- */

function writeJson(dir, key, body) {
  mkdirSync(dirname(join(dir, key)), { recursive: true });
  writeFileSync(join(dir, key), JSON.stringify(body, null, 2));
}

const textOf = (ch, n) => `Sentence for verse ${ch}.${n}.`;

/** Chapter 1 has six verses with English text; chapter 2 has three, the last without any. */
function writeGita(dir, edits = {}) {
  for (const [ch, count] of [[1, 6], [2, 3]]) {
    const verses = Array.from({ length: count }, (_, i) => i + 1).map((n) => ({
      verseId: `1.${ch}.${n}`, chapterNumber: ch, verseNumber: n, verseNumberEnd: null, cantoNumber: null, bookNumber: 1,
      commentaries: ch === 2 && n === 3 ? [] : [{ translatorSlug: 'prabhupada', type: 'translation', language: 'en', text: edits[`1.${ch}.${n}`] ?? textOf(ch, n) }],
    }));
    writeJson(dir, chapterKey(ch, BOOK), { meta: { chapterName: `Chapter ${ch}`, chapterNumber: ch }, verses });
  }
}

/* ---------- stand-ins for the engine and for S3 ---------- */

const mp3 = () => { const b = Buffer.alloc(16_000); b.set([0xff, 0xfb, 0x90, 0x00]); return b; }; // one second
function wav() {
  const pcm = Buffer.alloc(48_000);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0, 'ascii'); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8, 'ascii'); head.write('fmt ', 12, 'ascii');
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22); head.writeUInt32LE(24000, 24); head.writeUInt32LE(48000, 28);
  head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34); head.write('data', 36, 'ascii'); head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

/** An engine that answers every request with a second of audio. `script({ nth, target, text })` may throw or wait first. */
function fakeEngine(script = async () => {}) {
  const asked = [];
  const synthesize = async (target, text, options = {}) => {
    asked.push({ ...target, text });
    await script({ nth: asked.length, target, text, signal: options.signal });
    return target.engine === 'google-chirp' ? { audio: mp3(), contentType: 'audio/mpeg', ext: 'mp3' } : { audio: wav(), contentType: 'audio/wav', ext: 'wav' };
  };
  return { synthesize, asked };
}

const made = { runs: [], users: [], roles: [], clipRuns: [] };
let jobCount = 0;
let dir;
const fastLimiter = () => createLimiter({ rpm: 100_000, tpm: Infinity });

// The real clip row and the real index body; the audio and the index go to the temporary folder instead of S3.
function localDeps(engine, extra = {}) {
  return {
    ...realDeps,
    keyMissing: () => false,
    limiter: fastLimiter,
    synthesize: engine.synthesize,
    putClip: async ({ target, chapterId, verseNumber, verseId, audio, contentType, ext, seconds, characters, hash, runId }) => {
      const key = clipKey({ ...target, chapterId, verseNumber, ext });
      mkdirSync(dirname(join(dir, key)), { recursive: true });
      writeFileSync(join(dir, key), audio);
      const scope = { book: target.book, language: target.language, engine: target.engine, model: target.model, voice: target.voice, verseId };
      const data = { s3Key: key, contentType, bytes: audio.length, seconds, characters, textHash: hash, runId };
      return prisma.narrationClip.upsert({ where: { book_language_engine_model_voice_verseId: scope }, create: { ...scope, ...data }, update: data });
    },
    writeIndex: async (target) => {
      const rows = await prisma.narrationClip.findMany({ where: { book: target.book, language: target.language, engine: target.engine, model: target.model, voice: target.voice } });
      const body = { clips: rows.length, chapters: {} };
      for (const row of rows) (body.chapters[row.verseId.split('.')[1]] ||= {})[row.verseId] = row.s3Key;
      mkdirSync(dirname(join(dir, indexKey(target))), { recursive: true });
      writeFileSync(join(dir, indexKey(target)), JSON.stringify(body));
      return body;
    },
    ...extra,
  };
}

async function newRun(extra = {}) {
  const jobId = `e2e-${STAMP}-${(jobCount += 1)}`;
  const row = await prisma.narrationRun.create({
    data: { kind: 'NARRATION', book: BOOK, language: 'en', ...CHIRP, chapters: [1, 2], status: 'QUEUED', statusMessage: 'Waiting for the worker.', jobId, requestedByName: 'e2e', ...extra },
  });
  made.runs.push(row.id);
  return row;
}

/** Works a run the way the worker would; a run that pauses to retry later throws DelayedError, which is the answer. */
async function work(row, engine, extra) {
  const job = { id: row.jobId, data: { runId: row.id }, moveToDelayed: async () => {} };
  try {
    return await processRun(job, 'token', localDeps(engine, extra));
  } catch (err) {
    if (err instanceof DelayedError) return { delayed: true };
    throw err;
  }
}
const fresh = (row) => prisma.narrationRun.findUnique({ where: { id: row.id } });
const clipRows = (target, language = 'en') => prisma.narrationClip.findMany({ where: { book: BOOK, language, ...target }, orderBy: { verseId: 'asc' } });
const finishOff = (row) => prisma.narrationRun.update({ where: { id: row.id }, data: { status: 'CANCELLED' } });

async function tokenWith(slugs, label) {
  const permissions = await prisma.permission.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
  if (permissions.length !== slugs.length) throw new Error(`Not all of ${slugs.join(', ')} exist. Run \`npm run seed\` or apply the narration migration.`);
  const role = await prisma.role.create({ data: { slug: `e2e-${STAMP}-${label}`, name: `E2E ${label}`, permissions: { create: permissions.map((p) => ({ permissionId: p.id })) } } });
  made.roles.push(role.id);
  const user = await prisma.user.create({ data: { email: `narration-${STAMP}-${label}@example.test`, name: `E2E ${label}`, roleId: role.id, authProvider: 'GOOGLE', providerUserId: `narration-${STAMP}-${label}` } });
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

/* ---------- the script ---------- */

async function main() {
  if (env.isProduction) {
    console.error('\nThis script writes rows; it does not run against production.\n');
    process.exit(1);
  }
  if ((await queue.getWorkers()).length) {
    console.error('\nA worker is connected to the narration queue. Stop it first — it would work the runs this script makes.\n');
    process.exit(1);
  }
  const busy = await prisma.narrationRun.count({ where: { status: { in: ['QUEUED', 'RUNNING', 'PAUSED'] } } });
  if (busy) {
    console.error(`\n${busy} narration run(s) are active in this database. Finish or cancel them first.\n`);
    process.exit(1);
  }

  dir = mkdtempSync(join(tmpdir(), 'narration-e2e-'));
  process.env.SOURCE_LOCAL_DIR = dir;
  writeGita(dir);
  const saved = { heartbeatMs: narration.heartbeatMs };
  narration.heartbeatMs = 100;
  let api = null;
  const apiLog = [];
  const exists = (key) => existsSync(join(dir, key));

  try {
    section('A run that narrates a chapter');
    {
      const engine = fakeEngine();
      const row = await newRun({ chapters: [1] });
      const result = await work(row, engine);
      const after = await fresh(row);
      check('it completes', result.completed === true && after.status === 'COMPLETED', JSON.stringify(result));
      check('six verses made, one request each', after.doneVerses === 6 && after.totalVerses === 6 && engine.asked.length === 6 && after.calls === 6, `${after.doneVerses}/${after.totalVerses}, ${engine.asked.length} requests`);
      check('the engine is given the verse text', engine.asked[0].text === textOf(1, 1) && engine.asked[0].language === 'en' && engine.asked[0].voice === 'Kore');
      const rows = await clipRows(CHIRP);
      check('a clip row for each verse, under narration/api/…', rows.length === 6 && rows[0].s3Key === `narration/api/${BOOK}/en/google-chirp/chirp-3-hd/Kore/ch-1/1.mp3`, rows[0]?.s3Key);
      check('and the audio file is where the row says', exists(rows[0].s3Key));
      check('a second of audio each, counted on the run', Math.round(after.audioSeconds) === 6 && after.characters === 6 * textOf(1, 1).length, `${after.audioSeconds}s ${after.characters} chars`);
      const index = JSON.parse(readFileSync(join(dir, indexKey({ book: BOOK, language: 'en', ...CHIRP })), 'utf8'));
      check('the voice’s index lists the six', index.clips === 6 && Object.keys(index.chapters['1']).length === 6);
      check('the feed says it started', (await service.readFeed(row.id)).some((l) => /Started/.test(l.text)));
    }

    section('Making clips again');
    {
      let engine = fakeEngine();
      let row = await newRun({ chapters: [1] });
      await work(row, engine);
      let after = await fresh(row);
      check('a verse already made from the same text is not sent again', engine.asked.length === 0 && after.skippedVerses === 6 && after.doneVerses === 0, `${after.skippedVerses} skipped`);

      writeGita(dir, { '1.1.2': 'A corrected sentence.' });
      engine = fakeEngine();
      row = await newRun({ chapters: [1] });
      await work(row, engine);
      after = await fresh(row);
      check('a corrected translation is made again, and only that verse', engine.asked.length === 1 && engine.asked[0].text === 'A corrected sentence.' && after.doneVerses === 1 && after.skippedVerses === 5);

      engine = fakeEngine();
      row = await newRun({ chapters: [1], force: true });
      await work(row, engine);
      after = await fresh(row);
      check('“make again” replaces every clip', engine.asked.length === 6 && after.doneVerses === 6 && (await clipRows(CHIRP)).length === 6);

      engine = fakeEngine();
      row = await newRun({ chapters: [2] });
      await work(row, engine);
      after = await fresh(row);
      check('a verse with no text is left out and said so', after.totalVerses === 2 && after.doneVerses === 2 && (await service.readFeed(row.id)).some((l) => /1 verse\(s\) have no English text/.test(l.text)));
    }

    section('A voice comparison');
    {
      const engine = fakeEngine();
      const row = await newRun({ kind: 'COMPARE', chapters: [1], verseIds: ['1.1.3'], targets: [CHIRP, GEMINI], force: true });
      const result = await work(row, engine);
      const after = await fresh(row);
      check('it completes with one clip per voice', result.completed === true && after.totalVerses === 2 && after.doneVerses === 2, `${after.doneVerses}/${after.totalVerses}`);
      check('each voice was asked, and only for that verse', engine.asked.length === 2 && engine.asked.every((a) => a.text === textOf(1, 3)));
      check('the engine’s own format is kept: mp3 for Chirp, wav for Gemini', (await clipRows(GEMINI)).filter((c) => c.verseId === '1.1.3')[0]?.contentType === 'audio/wav' && (await clipRows(CHIRP)).find((c) => c.verseId === '1.1.3')?.contentType === 'audio/mpeg');
      check('the run has a result cell for each voice', after.results.length === 2 && after.results.every((cell) => cell.done === 1));
    }

    section('Every way a run can stop');
    {
      let row = await newRun({ chapters: [1], force: true });
      await work(row, fakeEngine(async () => { throw new EngineError('API key not valid', { engine: 'google-chirp', status: 401 }); }));
      let after = await fresh(row);
      check('a refused key pauses it until a person fixes it, naming the setting', after.status === 'PAUSED' && after.pauseReason === 'auth' && !after.resumeAt && /GOOGLE_TTS_API_KEY/.test(after.statusMessage), `${after.pauseReason}: ${after.statusMessage}`);
      await finishOff(row);

      row = await newRun({ chapters: [1], force: true });
      const limited = await work(row, fakeEngine(async () => { throw new EngineError('quota', { engine: 'google-chirp', status: 429 }); }));
      after = await fresh(row);
      check('the engine’s limit pauses it and it tries again by itself', limited.delayed === true && after.status === 'PAUSED' && after.pauseReason === 'rate_limit' && after.resumeAt !== null);
      await finishOff(row);

      row = await newRun({ chapters: [1], force: true });
      await work(row, fakeEngine(async () => { throw new EngineError('billing account is closed', { engine: 'google-chirp', status: 403 }); }));
      after = await fresh(row);
      check('no billing pauses it for a person', after.status === 'PAUSED' && after.pauseReason === 'credit' && !after.resumeAt);
      await finishOff(row);

      row = await newRun({ chapters: [1], force: true });
      const one = fakeEngine(async ({ nth }) => { if (nth === 2) throw new EngineError('text not supported', { engine: 'google-chirp', status: 400 }); });
      await work(row, one);
      after = await fresh(row);
      check('a verse the engine refuses is counted and the run goes on', after.status === 'COMPLETED' && after.failedVerses === 1 && after.doneVerses === 5 && after.errorVerse === '1.1.2', `${after.status} ${after.failedVerses} failed`);

      row = await newRun({ chapters: [1], force: true });
      await work(row, fakeEngine(async () => { throw new EngineError('text not supported', { engine: 'google-chirp', status: 400 }); }));
      after = await fresh(row);
      check(`${narration.maxFailedInARow} refusals in a row stop a narration run as failed`, after.status === 'FAILED' && after.stopReason === 'error' && /refused/.test(after.statusMessage), after.statusMessage);

      row = await newRun({ chapters: [1], force: true });
      const cancelEngine = fakeEngine(async ({ nth }) => { if (nth === 1) await prisma.narrationRun.update({ where: { id: row.id }, data: { cancelRequested: true } }); await sleep(400); });
      const result = await work(row, cancelEngine);
      after = await fresh(row);
      check('Cancel stops it after the verse in progress, which is kept', after.status === 'CANCELLED' && result.cancelled === true && after.doneVerses >= 1 && after.doneVerses < 6, `${after.status} ${after.doneVerses}`);

      row = await newRun({ chapters: [1], force: true });
      await work(row, fakeEngine(), { keyMissing: () => true }).catch(() => {});
      after = await fresh(row);
      check('a worker with no key pauses the run and names the setting', after.status === 'PAUSED' && after.pauseReason === 'config' && /GOOGLE_TTS_API_KEY/.test(after.statusMessage), after.statusMessage);
      await finishOff(row);

      row = await newRun({ chapters: [1], language: 'hi' });
      await work(row, fakeEngine()).catch(() => {});
      after = await fresh(row);
      check('a language with no translation saved fails the run and says so', after.status === 'FAILED' || after.status === 'PAUSED', `${after.status}: ${after.statusMessage}`);
      await finishOff(row);

      const stale = await newRun();
      const other = await work({ ...stale, jobId: 'some-other-job' }, fakeEngine());
      check('a job the row does not name does nothing', other.skipped === 'superseded by another job');
      await finishOff(stale);
    }

    section('The admin API');
    {
      await prisma.narrationRun.deleteMany({ where: { id: { in: made.runs } } });
      made.runs.length = 0;

      api = spawn(process.execPath, ['server.js'], {
        cwd: join(import.meta.dirname, '..'),
        env: { ...process.env, PORT: String(PORT), SOURCE_LOCAL_DIR: dir, GOOGLE_TTS_API_KEY: 'e2e-not-a-real-key', GEMINI_API_KEY: '', AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: '' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      api.stdout.on('data', (c) => apiLog.push(String(c)));
      api.stderr.on('data', (c) => apiLog.push(String(c)));
      if (!(await waitForApi())) {
        console.error(apiLog.join('').slice(-2000));
        throw new Error('the API copy did not start');
      }

      const reader = await tokenWith(['narration.read'], 'reader');
      const runner = await tokenWith(['narration.read', 'narration.run'], 'runner');
      const nobody = await tokenWith(['reel.read'], 'nobody');
      await redis.del(...made.users.flatMap((id) => [`rl:write:${id}`, `rl:read:${id}`]));
      const api_ = '/api/admin/narration';

      check('someone without the permission is refused', (await call('GET', `${api_}/overview`, { token: nobody })).status === 403);
      check('and so is someone signed out', (await call('GET', `${api_}/overview`)).status === 403);

      const overview = await call('GET', `${api_}/overview`, { token: reader });
      const chirp = overview.data?.settings.engines.find((e) => e.id === 'google-chirp');
      const gem = overview.data?.settings.engines.find((e) => e.id === 'gemini-tts');
      check('overview: engines, whether each key is set, the unverified price', overview.status === 200 && chirp.configured === true && gem.configured === false && chirp.price.verified === false && overview.data.settings.maxTargets === 6, JSON.stringify(chirp));
      check('and the books', overview.data.books.some((b) => b.id === BOOK && b.chapters.length === 18));
      check('voices and languages are listed', (await call('GET', `${api_}/voices`, { token: reader })).data.length === 2 && (await call('GET', `${api_}/languages`, { token: reader })).data.map((l) => l.id).join() === 'en,hi');

      const est = await call('GET', `${api_}/estimate?chapters=1,2`, { token: reader });
      check('the estimate counts verses and characters from the texts and leaves out clips made', est.status === 200 && est.data.chapters === 2 && est.data.verses >= 2 && est.data.priced === true && est.data.priceVerified === false, JSON.stringify(est.data));
      const gemEst = await call('GET', `${api_}/estimate?chapters=1&engine=gemini-tts&model=gemini-2.5-flash-preview-tts&voice=Puck`, { token: reader });
      check('an engine with no known price gives no cost', gemEst.status === 200 && gemEst.data.priced === false && gemEst.data.costUsd === null);
      check('the estimate refuses a chapter the book lacks and a voice the engine lacks', (await call('GET', `${api_}/estimate?chapters=99`, { token: reader })).status === 400 && (await call('GET', `${api_}/estimate?voice=Nobody`, { token: reader })).status === 422);

      check('a reader cannot start a run', (await call('POST', `${api_}/runs`, { token: reader, body: { chapters: [1] } })).status === 403);
      check('a chapter the book lacks is refused', (await call('POST', `${api_}/runs`, { token: runner, body: { chapters: [99] } })).status === 400);
      check('a voice the engine lacks is refused', (await call('POST', `${api_}/runs`, { token: runner, body: { chapters: [1], voice: 'Nobody' } })).status === 422);
      const noKey = await call('POST', `${api_}/runs`, { token: runner, body: { chapters: [1], ...GEMINI } });
      check('an engine whose key is not set is refused, naming it', noKey.status === 422 && /GEMINI_API_KEY/.test(noKey.error?.message ?? ''), JSON.stringify(noKey.error));

      const started = await call('POST', `${api_}/runs`, { token: runner, body: { chapters: [1], language: 'en' } });
      check('a run is queued', started.status === 201 && started.data.status === 'QUEUED' && started.data.kind === 'NARRATION' && started.data.requestedBy?.name, JSON.stringify(started.data ?? started.error));
      if (started.data?.id) made.runs.push(started.data.id);
      const second = await call('POST', `${api_}/runs`, { token: runner, body: { chapters: [2] } });
      check('a second run for the same book is refused while one is live', second.status === 409, String(second.status));

      const got = await call('GET', `${api_}/runs/${started.data.id}`, { token: reader });
      check('the run and its feed can be read', got.status === 200 && got.data.run.id === started.data.id && got.data.feed.some((l) => /Queued by/.test(l.text)));
      const listed = await call('GET', `${api_}/runs?status=QUEUED`, { token: reader });
      check('and listed', listed.status === 200 && listed.data.some((r) => r.id === started.data.id));
      check('resume is refused for a run that is waiting', (await call('POST', `${api_}/runs/${started.data.id}/resume`, { token: runner })).status === 409);
      const cancelled = await call('POST', `${api_}/runs/${started.data.id}/cancel`, { token: runner });
      check('cancel stops a waiting run at once', cancelled.status === 200 && cancelled.data.status === 'CANCELLED', JSON.stringify(cancelled.data ?? cancelled.error));
      check('and again is refused', (await call('POST', `${api_}/runs/${started.data.id}/cancel`, { token: runner })).status === 409);
      check('an unknown run is a 404', (await call('GET', `${api_}/runs/nope`, { token: reader })).status === 404);

      const cmp = await call('POST', `${api_}/compare`, { token: runner, body: { verseId: '1.1.3', targets: [CHIRP, CHIRP] } });
      check('a comparison is queued, a repeated voice counted once', cmp.status === 201 && cmp.data.kind === 'COMPARE' && cmp.data.targets.length === 1, JSON.stringify(cmp.data ?? cmp.error));
      if (cmp.data?.id) made.runs.push(cmp.data.id);
      const cmpGot = await call('GET', `${api_}/compare/${cmp.data.id}`, { token: reader });
      check('it can be read with a cell per voice', cmpGot.status === 200 && cmpGot.data.cells.length === 1 && cmpGot.data.verseId === '1.1.3');
      check('the run is not a comparison', (await call('GET', `${api_}/compare/${started.data.id}`, { token: reader })).status === 404);
      await call('POST', `${api_}/runs/${cmp.data.id}/cancel`, { token: runner });
      check('a verse with no text is refused', (await call('POST', `${api_}/compare`, { token: runner, body: { verseId: '1.2.3', targets: [CHIRP] } })).status === 422);
      check('a verse from the wrong book is refused', (await call('POST', `${api_}/compare`, { token: runner, body: { verseId: '2.1.1.1', targets: [CHIRP] } })).status === 400);
      check('seven voices are refused', (await call('POST', `${api_}/compare`, { token: runner, body: { verseId: '1.1.3', targets: ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((v) => ({ ...CHIRP, voice: v })) } })).status === 400);

      const clips = await call('GET', `${api_}/clips?language=en&voice=Kore`, { token: reader });
      check('clips can be listed by voice', clips.status === 200 && clips.data.length >= 6 && clips.data.every((c) => c.voice === 'Kore'));
      const one = await call('GET', `${api_}/clips/${clips.data[0].id}`, { token: reader });
      check('and one fetched', one.status === 200 && one.data.id === clips.data[0].id);
    }
  } finally {
    narration.heartbeatMs = saved.heartbeatMs;
    api?.kill('SIGTERM');
    const ids = [...made.runs];
    for (const id of ids) {
      const row = await prisma.narrationRun.findUnique({ where: { id } }).catch(() => null);
      if (row?.jobId) await queue.getJob(row.jobId).then((job) => job?.remove()).catch(() => {});
      await redis.del(`${narration.feedKey}:${id}`).catch(() => {});
    }
    // Only the clips this script made: its engine names are real ones, so they are found by the fake Gita's verses.
    await prisma.narrationClip.deleteMany({ where: { book: BOOK, verseId: { startsWith: '1.' }, s3Key: { startsWith: 'narration/api/' }, createdAt: { gte: new Date(STAMP) } } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } }).catch(() => {});
    await prisma.narrationRun.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
    await prisma.deviceSession?.deleteMany?.({ where: { userId: { in: made.users } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: made.users } } }).catch(() => {});
    await prisma.role.deleteMany({ where: { id: { in: made.roles } } }).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed) console.log(apiLog.join('').split('\n').filter((l) => /error|warn/i.test(l)).slice(-15).join('\n'));
  await prisma.$disconnect();
  await queue.close();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
