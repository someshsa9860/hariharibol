// Walks the admin Translations feature end to end: the worker's processor (in this process, against the
// real Postgres and Redis) and the admin API (a copy started on its own port). Run it with Postgres and
// Redis up:
//
//   npm run test:translation
//
// Nothing here can reach a model provider or S3. The "model" is a stub, the bucket is a temporary folder
// (SOURCE_LOCAL_DIR) holding a fake Gita of 18 chapters × 2 verses, and the API copy is given a key that
// is not real. The script refuses to run if a worker is connected to the translation queue, because that
// worker would pick up the runs it creates.
//
// What it is checking is the part that fails quietly: that a run survives every way it can stop — credit
// gone, Anthropic overloaded, a bad answer, Cancel, a worker shutdown, a lost background job — and ends up
// in the state the page tells the admin, with every counter right and every saved verse kept. And that
// a version is honoured: a language already translated under the current one is not started again, a new
// one translates what Claude made under the old one, and a translator's own text is never replaced.
//
// The Import route is walked here only as far as it can be without writing: who may call it, what it
// refuses, its lock, and a preview. Its fake Gita is book number 1 — the real Gita in a dev database — so
// the real writes are `npm run test:translation-import`'s, on throwaway books.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import Redis from 'ioredis';
import { DelayedError, Worker } from 'bullmq';

import { prisma } from '../config/database.js';
import { bullConnection, redis } from '../config/redis.js';
import { translation } from '../config/translation.js';
import env from '../config/env.js';
import * as authService from '../services/auth.js';
import * as service from '../services/translation.js';
import { JOBS, queues } from '../jobs/index.js';
import { abortActiveRuns, processRun, realDeps } from '../jobs/processors/translation.js';
import { FatalApiError, RefusalError } from './lib/claude-translate-client.js';
import { chapterKey, saChapterKey } from './lib/claude-translate-source.js';
import { checkpointKey, langChapterKey } from './lib/claude-translate-store.js';

const PORT = 4300 + (Date.now() % 90);
const BASE = `http://localhost:${PORT}`;
const DEVICE = 'translation-e2e-device';
const STAMP = Date.now();
const VERSION = `e2e-${STAMP}`;
const queue = queues.translation;
const IMPORT_LOCK = 'translation:import:bhagavat-gita:ml'; // what the Import route holds while it runs, for the one language these checks name

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}
const section = (title) => console.log(`\n${title}`);
const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);

/* ---------- a fake Gita ---------- */

const NATIVE = { hi: 'भगवान', mr: 'भगवंत', bn: 'ভগবান', ta: 'பகவான்', te: 'భగవంతుడు', kn: 'ಭಗವಂತ', ml: 'ഭഗവാൻ' };

/** Every word becomes a word in the language's script; numbers and punctuation stay. */
function fake(text, lang) {
  return text.split(/(\s+)/).map((tok) => {
    if (/^\s*$/.test(tok)) return tok;
    const [, pre, core, post] = tok.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
    return /\d/.test(core) || !core ? tok : `${pre}${NATIVE[lang]}${post}`;
  }).join('');
}

const ENGLISH = {
  1: {
    translation: 'Dhṛtarāṣṭra said: O Sañjaya, what did my sons and the sons of Pāṇḍu do on the sacred field of Kurukṣetra?',
    purport: ['Bhagavad-gītā is the widely read theistic science summarized in the Gītā-māhātmya (Bg. 2.47) (the glorification of the Gītā).', 'It is said there that one should read Bhagavad-gītā very scrutinizingly with the help of a person who is a devotee of Śrī Kṛṣṇa.'],
    words: [{ word: 'dhṛtarāṣṭraḥ uvāca', meaning: 'King Dhṛtarāṣṭra said' }, { word: 'dharma-kṣetre', meaning: 'in the place of pilgrimage' }],
    lines: ['dharmakṣetre kurukṣetre samavetā yuyutsavaḥ .', 'māmakāḥ pāṇḍavāścaiva kimakurvata sañjaya ||1-1||'],
  },
  2: {
    translation: 'Sañjaya said: O King, after looking over the army arranged in military formation by the sons of Pāṇḍu, King Duryodhana went to his teacher and spoke these words.',
    purport: [],
    words: [{ word: 'sañjayaḥ uvāca', meaning: 'Sañjaya said' }, { word: 'rājan', meaning: 'O King' }],
    lines: ['sañjaya uvāca .', 'dṛṣṭvā tu pāṇḍavānīkaṃ vyūḍhaṃ duryodhanastadā ||1-2||'],
  },
};

function writeJson(dir, key, body) {
  mkdirSync(dirname(join(dir, key)), { recursive: true });
  writeFileSync(join(dir, key), JSON.stringify(body, null, 2));
}

/** 18 chapters × 2 verses of English (Prabhupāda's rows beside another translator's, which must never be sent) and Sanskrit. */
function writeGita(dir) {
  for (let ch = 1; ch <= 18; ch += 1) {
    const verses = [1, 2].map((n) => ({
      verseId: `1.${ch}.${n}`, chapterNumber: ch, verseNumber: n, verseNumberEnd: null, cantoNumber: null, bookNumber: 1, globalVerseNumber: (ch - 1) * 2 + n,
      transliteration: ENGLISH[n].lines.join('\n'),
      commentaries: [
        { translatorSlug: 'sivananda', type: 'translation', language: 'en', displayOrder: 1, text: 'SIVANANDA-MARKER' },
        { translatorSlug: 'prabhupada', type: 'translation', language: 'en', displayOrder: 1, text: ENGLISH[n].translation },
        ...(ENGLISH[n].purport.length ? [{ translatorSlug: 'prabhupada', type: 'purport', language: 'en', displayOrder: 2, text: ENGLISH[n].purport.join('\n') }] : []),
      ],
    }));
    writeJson(dir, chapterKey(ch), {
      meta: { bookNumber: 1, bookSlug: 'bhagavat-gita', language: 'en', chapterNumber: ch, cantoNumber: null, chapterName: `अध्याय ${ch}`, totalVerses: 2, chapterTitleEn: `Chapter ${ch}` },
      verses,
    });
    writeJson(dir, saChapterKey(ch), {
      meta: {},
      verses: [1, 2].map((n) => ({ verseId: `1.${ch}.${n}`, sanskrit: 'SANSKRIT-MARKER', transliteration: ENGLISH[n].lines.join('\n'), wordMeanings: ENGLISH[n].words })),
    });
  }
}

const readSaved = (dir, lang, ch) => {
  const file = join(dir, langChapterKey(lang, ch));
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
};

/* ---------- a stand-in for Claude ---------- */

/**
 * `script(ctx)` runs before each answer and may wait or throw. The answer is a faithful, perfectly scored
 * rendering of the verse. `asked` is every verse it was asked for, in order.
 */
function fakeClaude(script = async () => {}, costUsd = 0.5) {
  const asked = [];
  let signal = null;
  const makeAsk = (options) => {
    signal = options.signal;
    return async ({ user, schema }) => {
      if (signal?.aborted) throw new Error('aborted');
      const ref = user.match(/Bhagavad-gītā (\S+)/)[1];
      asked.push(ref);
      await script({ ref, asked, signal });
      const en = ENGLISH[Number(ref.split('.')[1])];
      const data = {};
      for (const lang of Object.keys(schema.properties)) {
        data[lang] = {
          transliteration: en.lines.map((l) => fake(l, lang)),
          translation: fake(en.translation, lang),
          purport: en.purport.map((p) => fake(p, lang)),
          wordMeanings: en.words.map((w) => ({ word: fake(w.word, lang), meaning: fake(w.meaning, lang) })),
          correctness: { translation: 3, transliteration: 3, wordMeanings: 3, purport: 3 },
          note: '',
        };
      }
      return { data, usage: { inputTokens: 100, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 1 }, costUsd, stopReason: 'end_turn' };
    };
  };
  return { makeAsk, asked };
}

const depsWith = (claude) => ({ ...realDeps, apiKey: () => 'e2e-not-a-real-key', makeAsk: claude.makeAsk });

/* ---------- runs and jobs, the way the API makes them ---------- */

const made = { runs: [], users: [], jobs: [], roles: [] };
let jobCount = 0;

/** A signed-in user whose role holds exactly `slugs`, for finding where one permission ends and the next begins. → their access token */
async function tokenWith(slugs, label) {
  const permissions = await prisma.permission.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
  if (permissions.length !== slugs.length) throw new Error(`Not all of ${slugs.join(', ')} exist. Has the migration run?`);
  const role = await prisma.role.create({
    data: { slug: `e2e-${STAMP}-${label}`, name: `E2E ${label}`, permissions: { create: permissions.map((p) => ({ permissionId: p.id })) } },
  });
  made.roles.push(role.id);
  const user = await prisma.user.create({
    data: { email: `${VERSION}-${label}@example.test`, name: `E2E ${label}`, roleId: role.id, authProvider: 'GOOGLE', providerUserId: `${VERSION}-${label}` },
  });
  made.users.push(user.id);
  return (await authService.issueSession(user, DEVICE)).accessToken;
}

async function newRun(language, extra = {}) {
  const jobId = `e2e-${STAMP}-${(jobCount += 1)}`;
  const row = await prisma.translationRun.create({
    data: {
      language, version: VERSION, model: 'claude-sonnet-5-5', chapters: [2], status: 'QUEUED', statusMessage: 'Waiting for the worker.',
      jobId, requestedById: null, requestedByName: 'e2e', ...extra,
    },
  });
  made.runs.push(row.id);
  return row;
}

/** A BullMQ job as far as the processor can tell: an id, data, and a way to be moved to "delayed". */
function fakeJob(row) {
  const job = { id: row.jobId, data: { runId: row.id }, delayedTo: null, moveToDelayed: async (ts) => { job.delayedTo = ts; } };
  return job;
}

/** Runs the processor once, as the worker would; reports what it returned, or that it handed the job back as delayed. */
async function work(row, claude) {
  const job = fakeJob(row);
  try {
    const result = await processRun(job, 'token', depsWith(claude));
    return { result, job, delayed: false, row: await prisma.translationRun.findUnique({ where: { id: row.id } }) };
  } catch (err) {
    if (!(err instanceof DelayedError)) throw err;
    return { result: null, job, delayed: true, row: await prisma.translationRun.findUnique({ where: { id: row.id } }) };
  }
}

const reload = (id) => prisma.translationRun.findUnique({ where: { id } });
const resumeRow = (id, extra = {}) =>
  prisma.translationRun.update({
    where: { id },
    data: { status: 'QUEUED', pauseReason: null, statusMessage: 'Resumed.', stopReason: null, errorVerseId: null, resumeAt: null, retriesInARow: 0, cancelRequested: false, finishedAt: null, ...extra },
  });

/** Ends whatever the scenarios above left waiting, rows and jobs both, so the next section starts from nothing. */
async function settle() {
  await prisma.translationRun.updateMany({ where: { id: { in: made.runs }, status: { in: ['QUEUED', 'PAUSED', 'RUNNING'] } }, data: { status: 'CANCELLED', finishedAt: new Date() } });
  const rows = await prisma.translationRun.findMany({ where: { id: { in: made.runs } }, select: { jobId: true } });
  for (const id of [...made.jobs.splice(0), ...rows.map((r) => r.jobId).filter(Boolean)]) await queue.getJob(id).then((job) => job?.remove()).catch(() => {});
}

/* ---------- HTTP ---------- */

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-device-id': DEVICE, 'x-platform': 'ios', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // no body
  }
  return { status: res.status, json, data: json?.data };
}

async function waitForApi() {
  for (let i = 0; i < 80; i += 1) {
    const res = await fetch(`${BASE}/health`).catch(() => null);
    if (res?.ok) return true;
    await sleep(250);
  }
  return false;
}

/* ---------- the script ---------- */

async function main() {
  if (env.isProduction) {
    console.error('\nThis script writes rows; it does not run against production.\n');
    process.exit(1);
  }
  const workers = await queue.getWorkers();
  if (workers.length) {
    console.error('\nA worker is connected to the translation queue. Stop it first — it would work the runs this script makes.\n');
    process.exit(1);
  }
  const busy = await prisma.translationRun.count({ where: { status: { in: ['QUEUED', 'RUNNING', 'PAUSED'] } } });
  if (busy) {
    console.error(`\n${busy} translation run(s) are active in this database. Finish or cancel them first; this script must start from none.\n`);
    process.exit(1);
  }
  const admin = await prisma.user.findFirst({ where: { role: { slug: 'super_admin' } } });
  if (!admin) {
    console.error('\nNeed a super_admin. Run `npm run seed` and `npm run promote-admin` first.\n');
    process.exit(1);
  }

  const dir = mkdtempSync(join(tmpdir(), 'translation-e2e-'));
  process.env.SOURCE_LOCAL_DIR = dir; // the processor and the services in this process; the API copy gets it below
  writeGita(dir);

  const subscriber = new Redis(env.REDIS_URL);
  const heard = [];
  await subscriber.subscribe('ws:permission');
  subscriber.on('message', (_channel, text) => heard.push(JSON.parse(text)));

  let api = null;
  let realWorker = null;
  let importsStartedAt = null;
  const apiLog = [];
  const saved = { heartbeatMs: translation.heartbeatMs, unknownRetryMs: translation.unknownRetryMs, retryBaseMs: translation.retryBaseMs };
  translation.heartbeatMs = 100; // Cancel and shutdown are noticed on a heartbeat; the real 5 s would only slow the test

  try {
    /* -- 1. a whole run ------------------------------------------------------------------------ */
    section('A run that goes well');
    {
      const row = await newRun('mr');
      const claude = fakeClaude();
      const out = await work(row, claude);
      check('it completes', out.row.status === 'COMPLETED', out.row.status);
      check('both verses were asked for, once each', same(claude.asked, ['2.1', '2.2']), claude.asked.join(' '));
      check('the counters are the truth', out.row.doneVerses === 2 && out.row.totalVerses === 2 && out.row.score3 === 2 && out.row.score1 === 0 && out.row.score2 === 0, JSON.stringify({ d: out.row.doneVerses, t: out.row.totalVerses, s3: out.row.score3 }));
      check('calls and cost are counted once per call, not once per verse', out.row.calls === 2 && out.row.costMicros === 1_000_000, `${out.row.calls} calls, ${out.row.costMicros} micros`);
      check('tokens are summed', out.row.inputTokens === 200 && out.row.outputTokens === 400, `${out.row.inputTokens}/${out.row.outputTokens}`);
      check('it records when it started and ended, and no verse is left "current"', out.row.startedAt && out.row.finishedAt && out.row.currentVerseId === null);
      check('the pause fields are clear', out.row.pauseReason === null && out.row.resumeAt === null);

      const file = readSaved(dir, 'mr', 2);
      const verse = file?.verses?.find((v) => v.verseId === '1.2.1');
      check('the Marathi chapter file is where the English one sits, named by language', Boolean(file) && file.meta?.language === 'mr');
      check('each verse carries the version, model and score', verse?.aiTranslation?.version === VERSION && verse.aiTranslation.model === 'claude-sonnet-5-5' && verse.aiTranslation.correctness === 3);
      check('the translator is Prabhupāda, in Marathi', verse?.commentaries?.some((c) => c.translatorSlug === 'prabhupada' && c.language === 'mr' && c.type === 'translation' && c.text.includes(NATIVE.mr)));
      check('another translator\'s English never reached the answer', !JSON.stringify(file).includes('SIVANANDA-MARKER'));

      const checkpoint = JSON.parse(readFileSync(join(dir, checkpointKey(VERSION)), 'utf8'));
      check('the pipeline left its checkpoint finished (not "running")', checkpoint.running === false && checkpoint.runner === 'admin-worker');

      const feed = await service.readFeed(row.id, 50);
      check('the activity feed has the story, newest first', feed.length >= 4 && feed[0].text.includes('verses translated') && feed.at(-1).text === 'Started.', feed.map((l) => l.text).join(' | '));
      check('the feed lines name their verse', feed.some((l) => l.kind === 'verse' && l.verseId === '1.2.2'));

      await sleep(200);
      const states = heard.filter((m) => m.event === 'translation.run' && m.payload.id === row.id).map((m) => m.payload.status);
      check('the websocket was told RUNNING and then COMPLETED, to people who may read translations', states.includes('RUNNING') && states.at(-1) === 'COMPLETED' && heard.every((m) => m.permission === 'translation.read'), states.join('>'));
      check('and every verse reached the activity channel', heard.filter((m) => m.event === 'translation.activity' && m.payload.runId === row.id && m.payload.kind === 'verse').length === 2);

      // Run it again: nothing is left, so nothing is asked and nothing is spent.
      const again = await newRun('mr');
      const claude2 = fakeClaude();
      const second = await work(again, claude2);
      check('a second run over the same chapter has nothing to do', second.row.status === 'COMPLETED' && claude2.asked.length === 0 && second.row.totalVerses === 0 && second.row.stopReason === 'finished', `${second.row.status} asked=${claude2.asked.length}`);
    }

    /* -- 2. credit runs out in the middle --------------------------------------------------------- */
    section('Credit runs out half way');
    {
      const row = await newRun('hi');
      const broke = fakeClaude(async ({ asked }) => {
        if (asked.length === 2) throw new FatalApiError('Your credit balance is too low to access the Anthropic API.', 400);
      });
      const out = await work(row, broke);
      check('the run is PAUSED for credit, not failed', out.row.status === 'PAUSED' && out.row.pauseReason === 'credit', `${out.row.status}/${out.row.pauseReason}`);
      check('it does not retry by itself — a person must add credit', out.row.resumeAt === null && !out.delayed && out.job.delayedTo === null);
      check('the message tells the admin what to do', /credit/i.test(out.row.statusMessage) && /Resume/.test(out.row.statusMessage));
      check('the first verse is kept and counted', out.row.doneVerses === 1 && readSaved(dir, 'hi', 2)?.verses?.length === 1);
      check('the verse that failed was paid for nothing and counted as none', out.row.score3 === 1 && out.row.errorVerseId === null);

      await resumeRow(row.id);
      const topped = fakeClaude();
      const resumed = await work(await reload(row.id), topped);
      check('after Resume it asks only for the verse that is missing', same(topped.asked, ['2.2']), topped.asked.join(' '));
      check('and completes with both verses', resumed.row.status === 'COMPLETED' && resumed.row.doneVerses === 2 && readSaved(dir, 'hi', 2).verses.length === 2, `${resumed.row.status} ${resumed.row.doneVerses}`);
      check('attempts are counted across the pause', resumed.row.attempts === 2, String(resumed.row.attempts));
      check('the cost adds up across the pause', resumed.row.costMicros === 1_000_000, String(resumed.row.costMicros));
    }

    /* -- 3. Anthropic is overloaded ---------------------------------------------------------------- */
    section('Anthropic is overloaded');
    {
      const row = await newRun('ta');
      const overloaded = fakeClaude(async () => { throw Object.assign(new Error('Overloaded'), { status: 529 }); });
      const out = await work(row, overloaded);
      check('the job is handed back to the queue as delayed', out.delayed && out.job.delayedTo > Date.now() + 60_000, `delayed=${out.delayed}`);
      check('the run is PAUSED with a time to try again', out.row.status === 'PAUSED' && out.row.pauseReason === 'unavailable' && out.row.resumeAt > new Date(), `${out.row.status}/${out.row.pauseReason}`);
      check('the retry is counted', out.row.retriesInARow === 1);

      // The queue brings the same job back when the delay is over.
      const healthy = fakeClaude();
      const back = await work(await reload(row.id), healthy);
      check('when the job comes back the run finishes by itself', back.row.status === 'COMPLETED' && back.row.doneVerses === 2, back.row.status);
      check('and the retry counter starts over', back.row.retriesInARow === 0);
    }

    /* -- 4. an unforeseen error, a bad key, a refusal --------------------------------------------- */
    section('Other ways to stop');
    {
      const row = await newRun('bn');
      const bug = fakeClaude(async () => { throw new TypeError("Cannot read properties of undefined (reading 'x')"); });
      const first = await work(row, bug);
      check('an unforeseen error is retried quietly first', first.delayed && first.row.status === 'PAUSED' && first.row.pauseReason === 'error', `${first.row.status}/${first.row.pauseReason}`);
      const second = await work(await reload(row.id), bug);
      const third = await work(await reload(row.id), bug);
      check('and after two retries it is FAILED with the message', !second.delayed === false && third.row.status === 'FAILED' && /Cannot read properties/.test(third.row.statusMessage), `${third.row.status}: ${third.row.statusMessage}`);
      check('a FAILED run is not left holding a pause time', third.row.resumeAt === null && third.row.finishedAt !== null);

      const keyRow = await newRun('te');
      const badKey = await work(keyRow, fakeClaude(async () => { throw new FatalApiError('invalid x-api-key', 401); }));
      check('a rejected API key pauses for a person', badKey.row.status === 'PAUSED' && badKey.row.pauseReason === 'auth' && badKey.row.resumeAt === null && !badKey.delayed);

      const refuseRow = await newRun('kn');
      const refused = await work(refuseRow, fakeClaude(async () => { throw new RefusalError('refusal'); }));
      check('a refusal FAILS the run and says so', refused.row.status === 'FAILED' && /declined/.test(refused.row.statusMessage), refused.row.statusMessage);

      // No key on the worker at all.
      const noKeyRow = await newRun('ml');
      const noKey = await processRun(fakeJob(noKeyRow), 't', { ...depsWith(fakeClaude()), apiKey: () => '' }).catch((err) => err);
      const noKeyAfter = await reload(noKeyRow.id);
      check('a worker without an API key pauses with a config reason', noKey?.paused === 'config' && noKeyAfter.status === 'PAUSED' && noKeyAfter.pauseReason === 'config', `${noKeyAfter.status}/${noKeyAfter.pauseReason}`);
    }

    /* -- 5. a spending limit ----------------------------------------------------------------------- */
    section('A spending limit');
    {
      const row = await newRun('mr', { chapters: [3, 4], budgetMicros: 800_000 });
      const out = await work(row, fakeClaude());
      check('the run pauses when its budget is reached', out.row.status === 'PAUSED' && out.row.pauseReason === 'budget', `${out.row.status}/${out.row.pauseReason}`);
      check('having stopped on a verse boundary, with what it did kept', out.row.doneVerses === 2 && out.row.costMicros === 1_000_000, `${out.row.doneVerses} verses, ${out.row.costMicros} micros`);
      check('and the message names the limit', /\$0\.80/.test(out.row.statusMessage), out.row.statusMessage);

      await resumeRow(row.id, { budgetMicros: 5_000_000 });
      const more = fakeClaude();
      const resumed = await work(await reload(row.id), more);
      check('with a bigger budget it finishes the other chapter', resumed.row.status === 'COMPLETED' && resumed.row.doneVerses === 4 && same(more.asked, ['4.1', '4.2']), `${resumed.row.status} asked ${more.asked.join(' ')}`);
      check('the whole run cost is the sum of its parts', resumed.row.costMicros === 2_000_000, String(resumed.row.costMicros));
    }

    /* -- 6. a verse limit -------------------------------------------------------------------------- */
    section('A verse limit');
    {
      const row = await newRun('hi', { chapters: [5], verseLimit: 1 });
      const claude = fakeClaude();
      const out = await work(row, claude);
      check('it translates that many and completes', out.row.status === 'COMPLETED' && out.row.stopReason === 'limit' && out.row.doneVerses === 1 && claude.asked.length === 1, `${out.row.status}/${out.row.stopReason}`);
      check('the total shown is what it set out to do', out.row.totalVerses === 1);
      await resumeRow(row.id).catch(() => {});
      const again = await newRun('hi', { chapters: [5], verseLimit: 1 });
      const claude2 = fakeClaude();
      await work(again, claude2);
      check('a second limited run does the next verse', same(claude2.asked, ['5.2']), claude2.asked.join(' '));
    }

    /* -- 7. cancel while it works ------------------------------------------------------------------ */
    section('Cancel while it works');
    {
      const row = await newRun('ta', { chapters: [6] });
      let started;
      const reachedFirstVerse = new Promise((resolve) => { started = resolve; });
      const slow = fakeClaude(async ({ signal, asked }) => {
        if (asked.length === 1) {
          started();
          await new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')));
            setTimeout(resolve, 20_000);
          });
        }
      });
      const working = work(row, slow);
      await reachedFirstVerse;
      await prisma.translationRun.update({ where: { id: row.id }, data: { cancelRequested: true } });
      const out = await working;
      check('the run is CANCELLED within a heartbeat or two', out.row.status === 'CANCELLED' && out.row.finishedAt !== null, out.row.status);
      check('nothing was saved for the verse that was cut off', (readSaved(dir, 'ta', 6)?.verses?.length ?? 0) === 0);
      check('the feed says it was cancelled', (await service.readFeed(row.id, 20)).some((l) => /Cancelled/.test(l.text)));
      check('the checkpoint is not left saying "running"', JSON.parse(readFileSync(join(dir, checkpointKey(VERSION)), 'utf8')).running === false);

      // Cancel pressed before the job even started.
      const early = await newRun('ta', { chapters: [6], cancelRequested: true });
      const claude = fakeClaude();
      const cancelled = await work(early, claude);
      check('a run cancelled before it started never calls Claude', cancelled.row.status === 'CANCELLED' && claude.asked.length === 0);
    }

    /* -- 8. the worker shuts down ----------------------------------------------------------------- */
    section('The worker shuts down');
    {
      const row = await newRun('hi', { chapters: [7] });
      let started;
      const reachedFirstVerse = new Promise((resolve) => { started = resolve; });
      const slow = fakeClaude(async ({ signal, asked }) => {
        if (asked.length === 2) {
          started();
          await new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')));
            setTimeout(resolve, 20_000);
          });
        }
      });
      const working = work(row, slow);
      await reachedFirstVerse;
      const count = abortActiveRuns('shutdown');
      const out = await working;
      check('shutdown stopped exactly the one run in flight', count === 1, String(count));
      check('the job is handed back to the queue', out.delayed && out.job.delayedTo >= Date.now() - 1000 && out.job.delayedTo < Date.now() + 10_000);
      check('the run is QUEUED again, with what it had done', out.row.status === 'QUEUED' && out.row.doneVerses === 1, `${out.row.status} ${out.row.doneVerses}`);
      check('and it is not marked failed or cancelled', out.row.finishedAt === null && out.row.stopReason === null);

      const next = fakeClaude();
      const resumed = await work(await reload(row.id), next);
      check('the next worker carries on from the verse after', resumed.row.status === 'COMPLETED' && same(next.asked, ['7.2']), `${resumed.row.status} ${next.asked.join(' ')}`);
    }

    /* -- 9. a killed worker, a stale job, a lost job --------------------------------------------------- */
    section('Crashes and stale jobs');
    {
      // The previous worker was killed with the checkpoint still saying it was running.
      const killed = await newRun('mr', { chapters: [8] });
      const checkpointFile = join(dir, checkpointKey(VERSION));
      const before = JSON.parse(readFileSync(checkpointFile, 'utf8'));
      writeFileSync(checkpointFile, JSON.stringify({ ...before, running: true, runner: 'admin-worker', heartbeatAt: new Date().toISOString() }));
      const out = await work(killed, fakeClaude());
      check('our own killed run is picked up, not mistaken for another process', out.row.status === 'COMPLETED', `${out.row.status}: ${out.row.statusMessage}`);

      // The command-line script is writing this version.
      const blocked = await newRun('hi', { chapters: [9] });
      const mid = JSON.parse(readFileSync(checkpointFile, 'utf8'));
      writeFileSync(checkpointFile, JSON.stringify({ ...mid, running: true, runner: 'pid 424242', heartbeatAt: new Date().toISOString() }));
      const refusal = await work(blocked, fakeClaude());
      check('while the command line is working the same version the run waits and tries again', refusal.delayed && refusal.row.pauseReason === 'busy', `${refusal.row.status}/${refusal.row.pauseReason}`);
      writeFileSync(checkpointFile, JSON.stringify({ ...mid, running: false }));

      // A job that is not the one the row names does nothing.
      const stale = await newRun('ta', { chapters: [10] });
      const claude = fakeClaude();
      const staleResult = await processRun({ id: 'some-older-job', data: { runId: stale.id }, moveToDelayed: async () => {} }, 't', depsWith(claude));
      check('a superseded job is skipped without touching the run', /superseded/.test(staleResult.skipped) && claude.asked.length === 0 && (await reload(stale.id)).status === 'QUEUED');

      // A job for a run that has ended.
      const ended = await newRun('ta', { chapters: [10], status: 'CANCELLED' });
      const endedResult = await processRun(fakeJob(ended), 't', depsWith(claude));
      check('a job for a finished run is skipped', endedResult.skipped === 'cancelled' && claude.asked.length === 0);

      // A job for a row that is gone.
      const gone = await processRun({ id: 'x', data: { runId: 'no-such-run' }, moveToDelayed: async () => {} }, 't', depsWith(claude));
      check('a job for a deleted run is skipped', Boolean(gone.skipped));

      // Redis lost the job: the safety net puts the run back on the queue.
      const lost = await newRun('kn', { chapters: [11] });
      const young = await newRun('ml', { chapters: [11] });
      await prisma.translationRun.update({ where: { id: lost.id }, data: { updatedAt: new Date(Date.now() - 5 * 60_000) } });
      const requeued = await service.reconcileRuns();
      const lostAfter = await reload(lost.id);
      check('reconcile re-queues a run whose job is missing', requeued.includes(lost.id) && lostAfter.jobId !== lost.jobId && lostAfter.status === 'QUEUED');
      const newJob = await queue.getJob(lostAfter.jobId);
      if (newJob) made.jobs.push(newJob.id);
      check('the new job is really on the queue, for that run', Boolean(newJob) && newJob.data.runId === lost.id);
      check('a run younger than half a minute is left alone', !requeued.includes(young.id) && (await reload(young.id)).jobId === young.jobId);
    }

    /* -- 10. a real BullMQ worker --------------------------------------------------------------- */
    section('Through a real BullMQ worker');
    {
      // Everything above hands the processor a stand-in job. This is the queue itself: the delay it is
      // given, the job coming back by itself, and Resume bringing a delayed job forward.
      await settle();
      const claudes = new Map();
      realWorker = new Worker(
        'translation',
        (job, token) => processRun(job, token, depsWith(claudes.get(job.data.runId))),
        { connection: bullConnection, concurrency: 1 },
      );
      realWorker.on('error', (err) => console.log('    [worker] error', err.message));
      await realWorker.waitUntilReady();
      const enqueue = async (row, claude) => {
        claudes.set(row.id, claude);
        await queue.add(JOBS.TRANSLATION_RUN, { runId: row.id }, { jobId: row.jobId });
        made.jobs.push(row.jobId);
      };
      const until = async (id, test, ms = 20_000) => {
        const stop = Date.now() + ms;
        let row = await reload(id);
        while (!test(row) && Date.now() < stop) {
          await sleep(150);
          row = await reload(id);
        }
        return row;
      };

      // Overloaded once, with a short wait: the job is delayed by the queue and comes back on its own.
      translation.retryBaseMs = 400;
      const flaky = await newRun('mr', { chapters: [12] });
      const overloadedOnce = fakeClaude(async ({ asked }) => {
        if (asked.length === 1) throw Object.assign(new Error('Overloaded'), { status: 529 });
      });
      await enqueue(flaky, overloadedOnce);
      const paused = await until(flaky.id, (r) => r.status === 'PAUSED' || r.status === 'COMPLETED');
      check('the queue holds the job back while Anthropic recovers', paused.status === 'PAUSED' && paused.pauseReason === 'unavailable' && paused.resumeAt > new Date(), paused.status);
      const retried = await until(flaky.id, (r) => r.status === 'COMPLETED');
      check('and brings it back, and the run finishes without anyone touching it', retried.status === 'COMPLETED' && retried.doneVerses === 2 && retried.retriesInARow === 0, `${retried.status} ${retried.doneVerses}`);
      check('the failed verse was asked again, then the next', same(overloadedOnce.asked, ['12.1', '12.1', '12.2']), overloadedOnce.asked.join(' '));

      // A long wait that a person cuts short with Resume.
      translation.retryBaseMs = 10 * 60_000;
      const waiting = await newRun('hi', { chapters: [13] });
      const overloadedAgain = fakeClaude(async ({ asked }) => {
        if (asked.length === 1) throw Object.assign(new Error('Overloaded'), { status: 529 });
      });
      await enqueue(waiting, overloadedAgain);
      const sleepy = await until(waiting.id, (r) => r.status === 'PAUSED');
      const delayedJob = await queue.getJob(sleepy.jobId);
      check('a ten-minute wait is a delayed job', sleepy.status === 'PAUSED' && (await delayedJob?.getState()) === 'delayed' && sleepy.resumeAt > new Date(Date.now() + 5 * 60_000));
      await resumeRow(waiting.id);
      await service.ensureRunJob(await reload(waiting.id));
      const woken = await until(waiting.id, (r) => r.status === 'COMPLETED');
      check('Resume brings the same job forward and the run finishes at once', woken.status === 'COMPLETED' && woken.jobId === sleepy.jobId, `${woken.status}`);
      translation.retryBaseMs = saved.retryBaseMs;

      // Credit gone: the queue must not retry this by itself.
      const broke = await newRun('ta', { chapters: [14] });
      const noCredit = fakeClaude(async () => { throw new FatalApiError('Your credit balance is too low', 400); });
      await enqueue(broke, noCredit);
      const stuck = await until(broke.id, (r) => r.status === 'PAUSED');
      await sleep(1000);
      const brokeJob = await queue.getJob(stuck.jobId);
      const brokeState = brokeJob ? await brokeJob.getState() : 'gone';
      check('a run out of credit waits for a person, and the queue is not retrying it', stuck.pauseReason === 'credit' && noCredit.asked.length === 1 && ['completed', 'gone'].includes(brokeState), `${stuck.pauseReason} asked ${noCredit.asked.length} job ${brokeState}`);
      await resumeRow(broke.id);
      await service.ensureRunJob(await reload(broke.id));
      claudes.set(broke.id, fakeClaude());
      const topped = await until(broke.id, (r) => r.status === 'COMPLETED');
      check('after Resume a fresh job is made and the run finishes', topped.status === 'COMPLETED' && topped.jobId !== stuck.jobId, `${topped.status}`);
      if (topped.jobId) made.jobs.push(topped.jobId);

      await realWorker.close();
      realWorker = null;
    }

    /* -- 11. the API ------------------------------------------------------------------------------- */
    section('The admin API');
    {
      await settle();

      api = spawn(process.execPath, ['server.js'], {
        cwd: join(import.meta.dirname, '..'),
        env: {
          ...process.env, PORT: String(PORT), SOURCE_LOCAL_DIR: dir, ANTHROPIC_API_KEY: 'e2e-not-a-real-key', OPENAI_API_KEY: 'e2e-not-a-real-key', TRANSLATION_VERSION: VERSION,
          AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      api.stdout.on('data', (chunk) => apiLog.push(String(chunk)));
      api.stderr.on('data', (chunk) => apiLog.push(String(chunk)));
      if (!(await waitForApi())) {
        console.error(apiLog.join('').slice(-2000));
        throw new Error('the API copy did not start');
      }

      await authService.invalidateUser(admin.id);
      await redis.del(`rl:write:${admin.id}`, `rl:read:${admin.id}`);
      const { accessToken: token } = await authService.issueSession(admin, DEVICE);
      const role = await prisma.role.findUnique({ where: { slug: 'user' } });
      const plain = await prisma.user.create({ data: { email: `${VERSION}@example.test`, name: 'E2E Plain', roleId: role.id, authProvider: 'GOOGLE', providerUserId: VERSION } });
      made.users.push(plain.id);
      const { accessToken: plainToken } = await authService.issueSession(plain, DEVICE);

      const denied = await call('GET', '/api/admin/translations/overview', { token: plainToken });
      check('a reader of the app cannot see any of it', denied.status === 403, String(denied.status));
      const anonymous = await call('GET', '/api/admin/translations/overview');
      check('and neither can someone signed out', anonymous.status === 401, String(anonymous.status));

      const overview = await call('GET', '/api/admin/translations/overview', { token });
      check('overview: the checklist is green', overview.status === 200 && overview.data.settings.apiKeyConfigured && overview.data.settings.storage.ok && overview.data.settings.version === VERSION, JSON.stringify(overview.data?.settings));
      check('overview: no worker is connected, and it says so', overview.data.settings.workerOnline === false);
      check('overview: seven languages, eighteen chapters, nothing active', overview.data.languages.length === 7 && overview.data.chapters.length === 18 && overview.data.active.length === 0);

      const estimate = await call('GET', '/api/admin/translations/estimate?language=te&chapters=2,3', { token });
      check('estimate: four verses to do, none saved or outdated', estimate.status === 200 && estimate.data.todo === 4 && estimate.data.willTranslate === 4 && estimate.data.saved === 0 && estimate.data.outdated === 0, JSON.stringify(estimate.data));
      check('estimate: it names the version a run would make', estimate.data.version === VERSION, String(estimate.data.version));
      check('estimate: a call per verse and a price', estimate.data.calls === 4 && estimate.data.costUsd > 0);
      const capped = await call('GET', '/api/admin/translations/estimate?language=te&chapters=2,3&limit=1', { token });
      check('estimate: a verse limit scales it down', capped.data.willTranslate === 1 && capped.data.costUsd < estimate.data.costUsd);
      const done = await call('GET', '/api/admin/translations/estimate?language=mr&chapters=2', { token });
      check('estimate: a chapter already translated under this version has nothing left', done.data.todo === 0 && done.data.saved === 2 && done.data.outdated === 0 && done.data.willTranslate === 0, JSON.stringify(done.data));
      check('estimate: a bad chapter list is refused', (await call('GET', '/api/admin/translations/estimate?language=te&chapters=2,99', { token })).status === 400);
      check('estimate: so is an unknown language', (await call('GET', '/api/admin/translations/estimate?language=xx', { token })).status === 400);

      const coverage = await call('GET', '/api/admin/translations/coverage?refresh=true', { token });
      const mr = coverage.data?.languages?.find((l) => l.code === 'mr');
      check('coverage: Marathi has the chapters that were translated', coverage.status === 200 && mr && mr.byClaude >= 4 && mr.scores[3] >= 4, JSON.stringify(mr && { saved: mr.saved, byClaude: mr.byClaude }));
      check('coverage: the total is every verse in the Gita fixture', coverage.data.total === 36, String(coverage.data?.total));
      check('coverage: a language nobody started has none', coverage.data.languages.find((l) => l.code === 'ml').saved === 0);
      check('coverage: it says which version it counted for, and how much of Marathi is up to date for it', coverage.data.version === VERSION && mr.upToDate === mr.saved && mr.chapters.find((c) => c.chapter === 2)?.upToDate === 2, JSON.stringify(mr && { version: coverage.data.version, saved: mr.saved, upToDate: mr.upToDate }));

      // A language already translated under this version is not translated again: no run, and the reason is said.
      const marathiRuns = await prisma.translationRun.count({ where: { language: 'mr' } });
      const nothingLeft = await call('POST', '/api/admin/translations/runs', { token, body: { language: 'mr', chapters: [2] } });
      check('start: a chapter already translated under this version is refused, saying so', nothingLeft.status === 409 && nothingLeft.json.error.details?.upToDate === true && nothingLeft.json.error.details?.version === VERSION && nothingLeft.json.error.message.includes(VERSION), `${nothingLeft.status} ${JSON.stringify(nothingLeft.json?.error)}`);
      check('start: and no run was made for it, nor a job', (await prisma.translationRun.count({ where: { language: 'mr' } })) === marathiRuns);
      const withLimit = await call('POST', '/api/admin/translations/runs', { token, body: { language: 'mr', chapters: [2], verseLimit: 1 } });
      check('start: a verse limit does not change that', withLimit.status === 409 && withLimit.json.error.details?.upToDate === true, String(withLimit.status));

      // starting
      heard.length = 0;
      const bad = await call('POST', '/api/admin/translations/runs', { token, body: { language: 'xx' } });
      check('start: an unknown language is refused', bad.status === 400, String(bad.status));
      check('start: so is a chapter that does not exist', (await call('POST', '/api/admin/translations/runs', { token, body: { language: 'te', chapters: [19] } })).status === 400);
      check('start: and a plain user cannot', (await call('POST', '/api/admin/translations/runs', { token: plainToken, body: { language: 'te' } })).status === 403);

      const start = await call('POST', '/api/admin/translations/runs', { token, body: { language: 'te', chapters: [12, 13], budgetUsd: 3 } });
      check('start: a run is queued', start.status === 201 && start.data.status === 'QUEUED' && start.data.language === 'te', `${start.status} ${JSON.stringify(start.json?.error ?? start.data?.status)}`);
      const teRun = start.data;
      if (teRun) made.runs.push(teRun.id);
      check('start: it carries who asked, what for and under which version', teRun.requestedBy?.name && same(teRun.chapters, [12, 13]) && teRun.budgetUsd === 3 && teRun.version === VERSION);
      const teRow = await reload(teRun.id);
      const teJob = await queue.getJob(teRow.jobId);
      if (teJob) made.jobs.push(teJob.id);
      check('start: the row names a job that is on the queue for it', Boolean(teJob) && teJob.data.runId === teRun.id && (await teJob.getState()) === 'waiting');
      await sleep(150);
      check('start: the page is told over the websocket channel', heard.some((m) => m.event === 'translation.run' && m.payload.id === teRun.id && m.payload.status === 'QUEUED'));

      const twice = await call('POST', '/api/admin/translations/runs', { token, body: { language: 'te' } });
      check('start: a second run for the same language is refused', twice.status === 409 && twice.json.error.details?.runId === teRun.id, String(twice.status));
      const raced = await Promise.all([1, 2, 3].map(() => call('POST', '/api/admin/translations/runs', { token, body: { language: 'ml', chapters: [14] } })));
      const accepted = raced.filter((r) => r.status === 201);
      for (const r of accepted) {
        made.runs.push(r.data.id);
        const row = await reload(r.data.id);
        made.jobs.push(row.jobId);
      }
      check('start: three clicks at once make exactly one run', accepted.length === 1 && raced.filter((r) => r.status === 409).length === 2, raced.map((r) => r.status).join(','));
      const overviewBusy = await call('GET', '/api/admin/translations/overview', { token });
      check('overview: both queued runs are listed as active', overviewBusy.data.active.length === 2);

      // reading
      const list = await call('GET', '/api/admin/translations/runs?status=QUEUED', { token });
      check('list: filters by status, newest first', list.status === 200 && list.data.length === 2 && list.data[0].language === 'ml' && list.json.meta.total === 2, JSON.stringify(list.data?.map((r) => r.language)));
      const byLang = await call('GET', '/api/admin/translations/runs?language=te', { token });
      check('list: filters by language', byLang.data.length > 0 && byLang.data.every((r) => r.language === 'te') && byLang.data.some((r) => r.id === teRun.id));
      const one = await call('GET', `/api/admin/translations/runs/${teRun.id}`, { token });
      check('one run: comes with its activity feed', one.status === 200 && one.data.run.id === teRun.id && one.data.feed.some((l) => /Queued by/.test(l.text)));
      check('one run: an unknown id is a 404', (await call('GET', '/api/admin/translations/runs/nope', { token })).status === 404);

      // cancel a waiting run
      const cancelQueued = await call('POST', `/api/admin/translations/runs/${teRun.id}/cancel`, { token });
      check('cancel: a waiting run is cancelled at once', cancelQueued.status === 200 && cancelQueued.data.status === 'CANCELLED', cancelQueued.data?.status);
      check('cancel: and its job is taken off the queue', (await queue.getJob(teRow.jobId)) === undefined || (await queue.getJob(teRow.jobId)) === null);
      check('cancel: again is a conflict', (await call('POST', `/api/admin/translations/runs/${teRun.id}/cancel`, { token })).status === 409);

      // cancel a running one: asked, not forced
      const runningRow = await newRun('kn', { chapters: [15], status: 'RUNNING', heartbeatAt: new Date() });
      const askCancel = await call('POST', `/api/admin/translations/runs/${runningRow.id}/cancel`, { token });
      const askedRow = await reload(runningRow.id);
      check('cancel: a working run is asked to stop, and keeps running until it does', askCancel.status === 200 && askedRow.status === 'RUNNING' && askedRow.cancelRequested === true, `${askedRow.status} ${askedRow.cancelRequested}`);
      await prisma.translationRun.update({ where: { id: runningRow.id }, data: { status: 'CANCELLED', finishedAt: new Date() } });

      // cancel one whose worker is gone
      const deadRow = await newRun('kn', { chapters: [15], status: 'RUNNING', heartbeatAt: new Date(Date.now() - 10 * 60_000) });
      const cancelDead = await call('POST', `/api/admin/translations/runs/${deadRow.id}/cancel`, { token });
      check('cancel: a run with no heartbeat has nobody to ask, so it is cancelled directly', cancelDead.status === 200 && cancelDead.data.status === 'CANCELLED');

      // resume
      const pausedRow = await newRun('kn', { chapters: [16], status: 'PAUSED', pauseReason: 'credit', statusMessage: 'out of credit', retriesInARow: 3, budgetMicros: 1_000_000 });
      const resumed = await call('POST', `/api/admin/translations/runs/${pausedRow.id}/resume`, { token, body: { budgetUsd: 9 } });
      const resumedRow = await reload(pausedRow.id);
      check('resume: a paused run is queued again with its pause cleared', resumed.status === 200 && resumedRow.status === 'QUEUED' && resumedRow.pauseReason === null && resumedRow.retriesInARow === 0, `${resumed.status} ${resumedRow.status}`);
      check('resume: with the new budget', resumed.data.budgetUsd === 9);
      const resumedJob = await queue.getJob(resumedRow.jobId);
      if (resumedJob) made.jobs.push(resumedJob.id);
      check('resume: and a live job on the queue', Boolean(resumedJob) && (await resumedJob.getState()) === 'waiting');
      check('resume: a run that is not paused is a conflict', (await call('POST', `/api/admin/translations/runs/${pausedRow.id}/resume`, { token })).status === 409);
      const failedRow = await newRun('kn', { chapters: [16], status: 'FAILED', statusMessage: 'x', finishedAt: new Date() });
      check('resume: a failed run cannot be resumed while another for the language is active', (await call('POST', `/api/admin/translations/runs/${failedRow.id}/resume`, { token })).status === 409);
      await prisma.translationRun.update({ where: { id: pausedRow.id }, data: { status: 'CANCELLED', finishedAt: new Date() } });
      const retryFailed = await call('POST', `/api/admin/translations/runs/${failedRow.id}/resume`, { token, body: { budgetUsd: null } });
      const failedAfter = await reload(failedRow.id);
      check('resume: a failed run can be retried once the language is free', retryFailed.status === 200 && failedAfter.status === 'QUEUED' && failedAfter.finishedAt === null && failedAfter.budgetMicros === null, `${retryFailed.status}`);
      const failedJob = await queue.getJob(failedAfter.jobId);
      if (failedJob) made.jobs.push(failedJob.id);

      // the output
      const chapter = await call('GET', '/api/admin/translations/output/mr/chapters/2', { token });
      check('output: a chapter lists its verses with who made them and how they scored', chapter.status === 200 && chapter.data.saved === 2 && chapter.data.total === 2 && chapter.data.verses.every((v) => v.saved && v.byClaude && v.correctness === 3 && v.version === VERSION), JSON.stringify(chapter.data?.verses?.[0]));
      check('output: with the start of each translation', chapter.data.verses[0].preview.includes(NATIVE.mr));
      const empty = await call('GET', '/api/admin/translations/output/ml/chapters/1', { token });
      check('output: a chapter nobody translated shows what is missing', empty.status === 200 && empty.data.saved === 0 && empty.data.verses.every((v) => !v.saved && v.preview === null));
      const verse = await call('GET', '/api/admin/translations/output/mr/verses/1.2.1', { token });
      check('output: a verse shows the English beside the translation', verse.status === 200 && verse.data.source.translation === ENGLISH[1].translation && verse.data.translated.translation.includes(NATIVE.mr), verse.json?.error?.message);
      check('output: with purport paragraphs, transliteration lines and word meanings', verse.data.translated.purport.length === 2 && verse.data.translated.transliteration.length === 2 && verse.data.translated.wordMeanings.length === 2);
      check('output: the model, version and scores', verse.data.ai.model === 'claude-sonnet-5-5' && verse.data.ai.version === VERSION && verse.data.ai.correctness === 3);
      check('output: a re-check of the saved text finds nothing wrong', Array.isArray(verse.data.problems) && verse.data.problems.length === 0, JSON.stringify(verse.data.problems));
      check('output: previous and next verse for the viewer\'s arrows', verse.data.previous === null && verse.data.next === '1.2.2');
      const unsaved = await call('GET', '/api/admin/translations/output/ml/verses/1.3.1', { token });
      check('output: a verse not yet translated has the English and no translation', unsaved.status === 200 && unsaved.data.translated === null && unsaved.data.problems === null && unsaved.data.source.translation.length > 0);
      check('output: an unknown verse is a 404', (await call('GET', '/api/admin/translations/output/mr/verses/1.2.77', { token })).status === 404);
      check('output: a malformed verse id is a 400', (await call('GET', '/api/admin/translations/output/mr/verses/xyz', { token })).status === 400);

      const audits = await prisma.auditLog.findMany({ where: { action: { startsWith: 'translation.' }, entityId: { in: made.runs } } });
      check('every start, cancel and resume is in the audit log', ['translation.start', 'translation.cancel', 'translation.resume'].every((a) => audits.some((r) => r.action === a)), audits.map((a) => a.action).join(','));

      /* -- 12. importing into the database: who may, and what it refuses ------------------------------ */
      section('Importing into the database');
      {
        await redis.del(`rl:write:${admin.id}`, `rl:read:${admin.id}`);
        importsStartedAt = new Date();
        const reader = await tokenWith(['translation.read'], 'reader');
        const importer = await tokenWith(['translation.read', 'translation.import'], 'importer');
        const post = (as, body) => call('POST', '/api/admin/translations/imports', { token: as, body });

        // Every request below that gets past a guard it should not have gone through names Malayalam, which has no
        // file in storage: the worst that can then happen is an import of nothing, never a write into the real Gita.
        const malayalam = (await call('GET', '/api/admin/translations/coverage?refresh=true', { token })).data.languages.find((l) => l.code === 'ml');
        check('(Malayalam has nothing in storage, so these requests cannot write)', malayalam.saved === 0, String(malayalam.saved));

        // looking
        check('what is in the database: a signed-out caller is refused', (await call('GET', '/api/admin/translations/imports')).status === 401);
        check('what is in the database: so is a reader of the app', (await call('GET', '/api/admin/translations/imports', { token: plainToken })).status === 403);
        const looked = await call('GET', '/api/admin/translations/imports', { token: reader });
        check('what is in the database: whoever may read translations may see it', looked.status === 200 && looked.data.version === VERSION && Array.isArray(looked.data.languages), `${looked.status} ${JSON.stringify(looked.data)}`);
        check('what is in the database: a line has the counts the page shows', looked.data.languages.every((l) => ['code', 'rows', 'current', 'published', 'versions', 'updatedAt'].every((k) => k in l)));

        // who may import
        check('import: a signed-out caller is refused', (await post(undefined, { language: 'ml' })).status === 401);
        check('import: so is a reader of the app', (await post(plainToken, { language: 'ml' })).status === 403);
        check('import: reading translations is not importing them', (await post(reader, { language: 'ml' })).status === 403);
        check('import: and not previewing an import either', (await post(reader, { language: 'ml', dryRun: true })).status === 403);

        // what it refuses
        check('import: an unknown language is refused', (await post(importer, { language: 'xx' })).status === 400);
        check('import: so is no language', (await post(importer, {})).status === 400);
        check('import: a chapter that does not exist', (await post(importer, { language: 'ml', chapters: [19] })).status === 400);
        check('import: an empty list of chapters', (await post(importer, { language: 'ml', chapters: [] })).status === 400);
        check('import: a flag that is not true or false', (await post(importer, { language: 'ml', publish: 'yes' })).status === 400);
        const unpublishable = await post(importer, { language: 'ml', publish: true });
        check('import: making translations visible needs verse.publish as well', unpublishable.status === 403 && /verse\.publish/.test(unpublishable.json.error.message), `${unpublishable.status} ${unpublishable.json?.error?.message}`);
        check('import: and so does previewing that', (await post(importer, { language: 'ml', publish: true, dryRun: true })).status === 403);

        // what it does for someone who may
        const nothing = await post(importer, { language: 'ml' });
        check('import: a language with nothing in storage reports every chapter as not found and writes nothing', nothing.status === 200 && nothing.data.language === 'ml' && nothing.data.dryRun === false && nothing.data.publish === false && nothing.data.chapters.length === 18 && nothing.data.chapters.every((c) => c.found === false) && nothing.data.totals.chapters === 0 && nothing.data.totals.created === 0 && nothing.data.totals.updated === 0, `${nothing.status} ${JSON.stringify(nothing.data?.totals)}`);
        const some = await post(token, { language: 'ml', chapters: [2, 1, 2], publish: true });
        check('import: an admin with verse.publish may publish, and a repeated chapter is read once', some.status === 200 && some.data.publish === true && same(some.data.chapters.map((c) => c.chapter), [1, 2]), `${some.status} ${JSON.stringify(some.data?.chapters?.map((c) => c.chapter))}`);
        check('import: the lock is let go afterwards', (await redis.exists(IMPORT_LOCK)) === 0);

        // the lock
        await redis.set(IMPORT_LOCK, VERSION, 'EX', 60);
        const locked = await post(importer, { language: 'ml' });
        check('import: while another import of the language is running, this one is refused', locked.status === 409 && /already running/.test(locked.json.error.message), `${locked.status} ${locked.json?.error?.message}`);
        const previewed = await post(importer, { language: 'ml', dryRun: true });
        check('import: a preview neither waits for it nor takes the lock', previewed.status === 200 && previewed.data.dryRun === true && (await redis.get(IMPORT_LOCK)) === VERSION, String(previewed.status));
        await redis.del(IMPORT_LOCK);
        check('import: once it is let go, the same request goes through', (await post(importer, { language: 'ml' })).status === 200);

        const trail = await prisma.auditLog.findMany({ where: { action: 'translation.import', createdAt: { gte: importsStartedAt }, entityId: 'ml' }, orderBy: { createdAt: 'asc' } });
        check('every import that ran is in the audit log, and nothing that was refused or only previewed', trail.length === 3 && trail.every((r) => r.entityType === 'TranslationImport' && r.after?.language === 'ml') && trail[1].after.publish === true && trail[0].after.publish === false, `${trail.length} rows`);

        // a preview of Marathi, which has files — read only, whatever the database holds
        const book = await prisma.book.findUnique({ where: { bookNumber: 1 }, select: { id: true } });
        const rowsOf = () => prisma.verseTranslation.aggregate({ where: { languageCode: 'mr', verse: { bookNumber: 1 } }, _count: { _all: true }, _max: { updatedAt: true } });
        const before = await rowsOf();
        const preview = await post(importer, { language: 'mr', chapters: [2], dryRun: true });
        if (!book) {
          check('preview: without the book in the database it says to import the book first', preview.status === 422 && /not in the database/.test(preview.json.error.message), `${preview.status} ${preview.json?.error?.message}`);
        } else {
          const line = preview.data?.chapters?.[0];
          check('preview: chapter 2 has both verses, each accounted for exactly once', preview.status === 200 && preview.data.dryRun === true && preview.data.chapters.length === 1 && line.found && line.inStorage === 2 && line.created + line.updated + line.unchanged + line.missing.length + line.conflicts.length === 2, `${preview.status} ${JSON.stringify(line)}`);
          check('preview: it counts the verses by the version that made them', preview.data.totals.versions[VERSION] === 2, JSON.stringify(preview.data.totals.versions));
          const after = await rowsOf();
          check('preview: nothing was written, whatever it found', before._count._all === after._count._all && String(before._max.updatedAt) === String(after._max.updatedAt), `${before._count._all} → ${after._count._all}`);
          check('preview: and it left no mark in the audit log', (await prisma.auditLog.count({ where: { action: 'translation.import', entityId: 'mr', createdAt: { gte: importsStartedAt } } })) === 0);
        }
      }

      /* -- 13. a new version, and text a person wrote -------------------------------------------------- */
      section('A new version translates again; a person’s text is left alone');
      {
        await redis.del(`rl:write:${admin.id}`, `rl:read:${admin.id}`);
        const NEXT = `${VERSION}-next`;
        const ofMr = { language: 'mr', chapters: [2] };

        const current = await service.estimate({ ...ofMr, version: VERSION });
        check('under the version Marathi chapter 2 was made with, nothing is left to do', current.saved === 2 && current.outdated === 0 && current.todo === 0 && current.willTranslate === 0, JSON.stringify(current));
        const bumped = await service.estimate({ ...ofMr, version: NEXT });
        check('under a new version the same verses are outdated, and a run would ask for each', bumped.saved === 0 && bumped.outdated === 2 && bumped.todo === 2 && bumped.willTranslate === 2 && bumped.calls === 2 && bumped.version === NEXT, JSON.stringify(bumped));

        const claude = fakeClaude();
        const redo = await work(await newRun('mr', { version: NEXT }), claude);
        check('a run for the new version translates both verses again', redo.row.status === 'COMPLETED' && same(claude.asked, ['2.1', '2.2']) && redo.row.totalVerses === 2 && redo.row.doneVerses === 2, `${redo.row.status} asked ${claude.asked.join(' ')}`);
        const file = readSaved(dir, 'mr', 2);
        check('each verse now carries the new version', file.verses.length === 2 && file.verses.every((v) => v.aiTranslation.version === NEXT));
        check('and the new text replaced the old: one translation for the verse, not two', file.verses.every((v) => v.commentaries.filter((c) => c.translatorSlug === 'prabhupada' && c.language === 'mr' && c.type === 'translation').length === 1));
        const again = fakeClaude();
        const idle = await work(await newRun('mr', { version: NEXT }), again);
        check('a second run under that version has nothing to do', idle.row.status === 'COMPLETED' && again.asked.length === 0 && idle.row.totalVerses === 0, `${idle.row.status} asked ${again.asked.length}`);

        // The API copy is still on the old version, and what is in storage now was made under another one.
        const stale = await call('GET', '/api/admin/translations/estimate?language=mr&chapters=2', { token });
        check('the API, still on the old version, calls them outdated', stale.data.saved === 0 && stale.data.outdated === 2 && stale.data.todo === 2 && stale.data.willTranslate === 2, JSON.stringify(stale.data));
        const recount = await call('GET', '/api/admin/translations/coverage?refresh=true', { token });
        const marathi = recount.data.languages.find((l) => l.code === 'mr');
        const chapterTwo = marathi.chapters.find((c) => c.chapter === 2);
        check('coverage counts them as saved but not up to date', chapterTwo.saved === 2 && chapterTwo.upToDate === 0 && marathi.upToDate === marathi.saved - 2 && marathi.versions[NEXT] === 2, JSON.stringify({ chapterTwo, upToDate: marathi.upToDate, saved: marathi.saved, versions: marathi.versions }));
        const restart = await call('POST', '/api/admin/translations/runs', { token, body: ofMr });
        check('so a run for them is accepted, not refused as up to date', restart.status === 201 && restart.data.status === 'QUEUED' && restart.data.version === VERSION, `${restart.status} ${JSON.stringify(restart.json?.error ?? restart.data?.status)}`);
        if (restart.data) {
          made.runs.push(restart.data.id);
          const job = (await reload(restart.data.id))?.jobId;
          if (job) made.jobs.push(job);
          check('(and it is cancelled again, so nothing is left waiting)', (await call('POST', `/api/admin/translations/runs/${restart.data.id}/cancel`, { token })).status === 200);
        }

        // A verse a translator wrote has no AI stamp; it is current under every version and is never replaced.
        const person = { verseId: '1.17.1', chapterNumber: 17, verseNumber: 1, verseNumberEnd: null, cantoNumber: null, bookNumber: 1, globalVerseNumber: 33 };
        writeJson(dir, langChapterKey('bn', 17), {
          meta: { bookNumber: 1, bookSlug: 'bhagavat-gita', language: 'bn', chapterNumber: 17 },
          verses: [{ ...person, commentaries: [{ translatorSlug: 'prabhupada', type: 'translation', language: 'bn', displayOrder: 1, text: 'HUMAN-MARKER' }] }],
        });
        const mixed = await service.estimate({ language: 'bn', chapters: [17], version: VERSION });
        check('a verse a person translated counts as saved, and is never outdated', mixed.saved === 1 && mixed.outdated === 0 && mixed.todo === 1, JSON.stringify(mixed));
        const first = fakeClaude();
        await work(await newRun('bn', { chapters: [17] }), first);
        check('a run asks only for the verse nobody translated', same(first.asked, ['17.2']), first.asked.join(' '));
        const second = fakeClaude();
        await work(await newRun('bn', { chapters: [17], version: NEXT }), second);
        check('a newer version redoes only what Claude made', same(second.asked, ['17.2']), second.asked.join(' '));
        const kept = readSaved(dir, 'bn', 17);
        const theirs = kept.verses.find((v) => v.verseId === '1.17.1');
        const mine = kept.verses.find((v) => v.verseId === '1.17.2');
        check('the person’s text is exactly as they left it, with no AI stamp', theirs.commentaries.length === 1 && theirs.commentaries[0].text === 'HUMAN-MARKER' && !theirs.aiTranslation);
        check('and the other verse carries the newer version', mine.aiTranslation.version === NEXT);
      }
    }
  } finally {
    translation.heartbeatMs = saved.heartbeatMs;
    translation.unknownRetryMs = saved.unknownRetryMs;
    translation.retryBaseMs = saved.retryBaseMs;
    await realWorker?.close().catch(() => {});
    api?.kill('SIGTERM');
    await subscriber.quit().catch(() => {});

    // Everything this script made, and nothing it did not.
    for (const id of made.runs) {
      const row = await prisma.translationRun.findUnique({ where: { id } }).catch(() => null);
      if (row?.jobId) await queue.getJob(row.jobId).then((job) => job?.remove()).catch(() => {});
      await redis.del(`translation:feed:${id}`).catch(() => {});
    }
    for (const id of made.jobs) await queue.getJob(id).then((job) => job?.remove()).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { entityId: { in: made.runs } } }).catch(() => {});
    await prisma.translationRun.deleteMany({ where: { id: { in: made.runs } } }).catch(() => {});
    await prisma.deviceSession?.deleteMany?.({ where: { userId: { in: made.users } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: made.users } } }).catch(() => {});
    await prisma.role.deleteMany({ where: { id: { in: made.roles } } }).catch(() => {}); // after their users; their permission rows go with them
    if (importsStartedAt) {
      await prisma.auditLog.deleteMany({ where: { action: 'translation.import', entityType: 'TranslationImport', entityId: 'ml', createdAt: { gte: importsStartedAt } } }).catch(() => {});
      if ((await redis.get(IMPORT_LOCK).catch(() => null)) === VERSION) await redis.del(IMPORT_LOCK).catch(() => {}); // only a lock this script took
    }
    await redis.del(translation.coverageCacheKey).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed) console.log(apiLog.join('').split('\n').filter((l) => /error|warn/i.test(l)).slice(-15).join('\n'));
  await prisma.$disconnect();
  await queue.close();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
