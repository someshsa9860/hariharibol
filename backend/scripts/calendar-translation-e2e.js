// Walks the Hindu calendar's translation end to end: the translation run (the worker's processor, in this process), the
// words it writes into the public calendar and the festival push, and the admin and app APIs (a copy started on its own
// port). Run it with Postgres and Redis up and the migrations applied:
//
//   FIREBASE_PROJECT_ID= FIREBASE_CLIENT_EMAIL= FIREBASE_PRIVATE_KEY= GOOGLE_SERVICE_ACCOUNT_PATH= \
//   AWS_ACCESS_KEY_ID= AWS_SECRET_ACCESS_KEY= npm run test:calendar-translation
//
// Nothing here reaches a model provider, a phone or S3. The "model" is a stub; Firebase is blanked on the command line
// (the script refuses to run with it set); the API copy is given keys that are not real. No push is sent: the wording
// is read from `message()` with the words a reader's language would get. The script refuses to run while a worker is
// connected to the calendar queue, because that worker would pick up the runs it makes.
//
// It makes its own festivals and one panchang day (every text carries a marker, dated 2031 so no real day is touched),
// so what it asks the model for does not depend on what else the database holds. What it checks is the part that fails
// quietly:
//   * the words the calendar is made of are collected once each — names (a parana's Ekadashi too), descriptions (not a
//     parana's, which is built for its date) and the panchang terms, with what each is called in the prompt;
//   * a run saves what passed, counts its tokens on the row and in the token calculator under the provider and model
//     the admin picked, and survives every way it can stop (credit gone, a refused key, the provider busy, answers that
//     fail our checks, Cancel) and ends in the state the page tells the admin; Resume carries on at the first word with
//     no translation, a forced run too; a word an editor wrote is neither asked for nor replaced, with or without force;
//   * runs go one at a time in the order they were made, and a job the row does not name does nothing;
//   * the public calendar and the festival push use the translation for a reader whose language has one, and English
//     for a word that has none;
//   * the API gives only the right people the pages, validates the provider and model before a run is queued, and
//     refuses what it should (a second run into a language, everything already translated, a model that cannot run).
//
// Everything it makes is deleted again (festivals, the day, translations, runs, readers, roles, audit rows, the tokens it
// counted, and the permission `panchang.manage` if this database never had it).

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { DelayedError } from 'bullmq';

import { prisma } from '../config/database.js';
import { redis, publisher } from '../config/redis.js';
import { calendar, languages } from '../config/calendar.js';
import env from '../config/env.js';
import * as authService from '../services/auth.js';
import * as firebase from '../services/firebase.js';
import * as service from '../services/calendar-translation.js';
import { currentLocationKey } from '../services/panchang-store.js';
import * as tally from '../services/ai/token-tally.js';
import { queues } from '../jobs/index.js';
import { processRun, realDeps } from '../jobs/processors/calendar.js';
import { SYSTEM_PROMPT, sourceKeyOf } from '../utils/calendar-translation.js';
import { message } from '../utils/festival-message.js';
import { toDateColumn } from '../utils/date.js';
import { FatalApiError } from './lib/claude-translate-client.js';
import { PROVIDER_IDS, providerOf } from './lib/translate-providers.js';

const PORT = 4600 + (Date.now() % 90);
const BASE = `http://localhost:${PORT}`;
const DEVICE = 'calendar-translation-e2e-device';
const STAMP = Date.now();
const P = `e2e-${STAMP}`; // every festival this script makes starts its slug with this
const M = `E2E${STAMP}`; // and every English text it makes starts with this, so a run can be told its own words from any others
const MODEL = `e2e-model-${STAMP}`;
const PROVIDER = service.defaultProvider();
const KEY_ENV = providerOf(PROVIDER).keyEnv;
const NO_KEY_PROVIDER = ['gemini', 'openai'].find((p) => p !== PROVIDER); // the API copy is started without this one's key
const queue = queues.calendar;

// A date far from any real one, so the day this makes never meets a real day.
const D1 = '2031-06-12';
const D2 = '2031-06-13';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}
const section = (title) => console.log(`\n${title}`);

const made = { users: [], roles: [], runs: [], permission: null };

/* ---------- the calendar this script makes ---------- */

// Five names (a parana's Ekadashi among them), three descriptions and seven panchang terms (the two months read the same
// and count once): fifteen words, in three requests of five at a batch size of five.
const ALPHA = `${M} Alpha Utsav`;
const BETA = `${M} Beta Utsav`;
const GAMMA = `${M} Gamma Utsav`;
const EKADASHI = `${M} Delta Ekadashi`;
const PARANA_NAME = `${M} Delta Ekadashi parana`;
const DESC = { alpha: `${M} Alpha is a day of lamps.`, beta: `${M} Beta is a day of songs.`, gamma: `${M} Gamma is a day of rest.` };
const PARANA_DESC = 'Break the fast between 6:00 AM and 7:00 AM (New Delhi).';
const TERMS = { tithiName: `${M} Tithi`, nakshatra: `${M} Nakshatra`, yoga: `${M} Yoga`, karana: `${M} Karana`, monthAmanta: `${M} Month`, monthPurnimanta: `${M} Month`, sunSign: `${M} Sun`, moonSign: `${M} Moon` };
const MINE = 15;

let locationKey;
async function makeCalendar() {
  const date = toDateColumn(D1);
  const festival = (slug, name, description, extra = {}) => prisma.festival.create({ data: { date, locationKey, slug: `${P}-${slug}`, kind: 'FESTIVAL', name, description, ...extra } });
  await festival('alpha', ALPHA, DESC.alpha);
  await festival('beta', BETA, DESC.beta);
  await festival('gamma', GAMMA, DESC.gamma);
  await festival('parana', PARANA_NAME, PARANA_DESC, {
    kind: 'PARANA',
    details: { ekadashi: EKADASHI, startsAt: '2031-06-12T00:30:00.000Z', endsAt: '2031-06-12T01:30:00.000Z', place: 'New Delhi', timezone: 'Asia/Kolkata', twoDates: false, alsoFastToday: false },
  });
  await prisma.panchangDay.create({
    data: {
      date, locationKey, weekday: 4, tithiNumber: 11, paksha: 'SHUKLA', nakshatraNumber: 5, vikramSamvat: 2088, shakaSamvat: 1953, ...TERMS,
    },
  });
}
const festivalRows = () => prisma.festival.findMany({ where: { slug: { startsWith: P } }, orderBy: { slug: 'asc' } });

/** What the stand-in model writes for an English text: Devanagari, and different for every text, so a test can tell which was saved. */
const deva = (source) => `हिंदी ${parseInt(sourceKeyOf(source).slice(0, 6), 16)}`;

/* ---------- readers and tokens ---------- */

async function ensurePermission(slug) {
  if (await prisma.permission.findUnique({ where: { slug } })) return;
  // This database was never seeded with it (`npm run seed` adds it); made for the walk and taken away again.
  const row = await prisma.permission.create({ data: { slug, name: 'E2E temporary', group: 'content' } });
  made.permission = row.id;
}

async function tokenWith(slugs, label) {
  const permissions = await prisma.permission.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
  if (permissions.length !== slugs.length) throw new Error(`Not all of ${slugs.join(', ')} exist. Apply the migration (\`prisma migrate deploy\`) or run \`npm run seed\`.`);
  const role = await prisma.role.create({ data: { slug: `${P}-${label}`, name: `E2E ${label}`, permissions: { create: permissions.map((p) => ({ permissionId: p.id })) } } });
  made.roles.push(role.id);
  const user = await prisma.user.create({ data: { email: `${P}-${label}@example.test`, name: `E2E ${label}`, roleId: role.id, authProvider: 'GOOGLE', providerUserId: `${P}-${label}` } });
  made.users.push(user.id);
  await redis.del(`rl:write:${user.id}`, `rl:read:${user.id}`);
  return (await authService.issueSession(user, DEVICE)).accessToken;
}

/* ---------- a stand-in for the model ---------- */

/**
 * Answers in Devanagari for every item it finds in the request. `script(ctx)` may throw or wait first; `shape` may change
 * the answer. The prompt is one JSON object per line: `{ ref, kind, group?, text }`.
 */
function fakeModel(script = async () => {}, shape = (data) => data) {
  const asked = [];
  const makeAsk = (options) => async (request) => {
    const items = request.user.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
    asked.push({ texts: items.map((i) => i.text), refs: items.map((i) => i.ref), kinds: items.map((i) => i.kind), user: request.user, system: request.system, model: options.model, provider: options.provider });
    await script({ nth: asked.length, items });
    return {
      data: shape({ items: items.map((it) => ({ ref: it.ref, text: deva(it.text) })) }, { items }),
      usage: { inputTokens: 1000, outputTokens: 400, cacheReadTokens: 0, cacheWriteTokens: 0 },
      costUsd: 0,
      stopReason: 'STOP',
    };
  };
  return { makeAsk, asked };
}

let jobCount = 0;
// A run only ever sees the words this script made, so what it asks for does not depend on what else is in the database.
const deps = (model) => ({
  ...realDeps,
  apiKey: () => 'e2e-not-a-real-key',
  makeAsk: model.makeAsk,
  itemsForRun: async (run) => (await realDeps.itemsForRun(run)).filter((i) => i.source.includes(M)),
});

async function newRun(extra = {}) {
  const jobId = `e2e-${STAMP}-${(jobCount += 1)}`;
  const row = await prisma.calendarRun.create({
    data: { language: 'hi', provider: PROVIDER, model: MODEL, status: 'QUEUED', statusMessage: 'Waiting for the worker.', jobId, requestedByName: 'e2e', ...extra },
  });
  made.runs.push(row.id);
  return row;
}

/** Works a run the way the worker would; a run that pauses to retry later throws DelayedError, which is the answer. */
async function work(row, model, over = {}) {
  const job = { id: row.jobId, data: { runId: row.id }, moveToDelayed: async () => {} };
  try {
    return await processRun(job, 'token', { ...deps(model), ...over });
  } catch (err) {
    if (err instanceof DelayedError) return { delayed: true };
    throw err;
  }
}
const fresh = (row) => prisma.calendarRun.findUnique({ where: { id: row.id } });
const mineWhere = (language = 'hi') => ({ languageCode: language, source: { contains: M } });
const clearTranslations = () => prisma.calendarTranslation.deleteMany({ where: { source: { contains: M } } });
const translatedCount = (language = 'hi') => prisma.calendarTranslation.count({ where: mineWhere(language) });
const translationOf = (kind, source, language = 'hi') => prisma.calendarTranslation.findUnique({ where: { kind_languageCode_sourceKey: { kind, languageCode: language, sourceKey: sourceKeyOf(source) } } });
const resumeReady = (row) => prisma.calendarRun.update({ where: { id: row.id }, data: { status: 'QUEUED', pauseReason: null, statusMessage: 'Resumed. Waiting for the worker.', stopReason: null, resumeAt: null, retriesInARow: 0 } });

async function counted() {
  const row = (await tally.today()).find((r) => r.provider === PROVIDER && r.model === MODEL);
  return { inputTokens: row?.inputTokens ?? 0, outputTokens: row?.outputTokens ?? 0, calls: row?.calls ?? 0 };
}

/* ---------- the API ---------- */

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-device-id': DEVICE, 'x-platform': 'android', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data, error: json?.error, json };
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
  if (firebase.messaging()) {
    console.error('\nFirebase is configured. Blank FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY and GOOGLE_SERVICE_ACCOUNT_PATH — see the top of this file.\n');
    process.exit(1);
  }
  if (env.AWS_ACCESS_KEY_ID || env.AWS_SECRET_ACCESS_KEY) {
    console.error('\nAWS keys are set. Blank AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY — see the top of this file.\n');
    process.exit(1);
  }
  if ((await queue.getWorkers()).length) {
    console.error('\nA worker is connected to the calendar queue. Stop it first — it would work the runs this script makes.\n');
    process.exit(1);
  }
  const busy = await prisma.calendarRun.count({ where: { status: { in: ['QUEUED', 'RUNNING', 'PAUSED'] } } });
  if (busy) {
    console.error(`\n${busy} calendar translation run(s) are active in this database. Finish or cancel them first.\n`);
    process.exit(1);
  }
  locationKey = await currentLocationKey();
  if (await prisma.panchangDay.count({ where: { date: toDateColumn(D1), locationKey } })) {
    console.error(`\nThe database already holds a panchang day for ${D1} at ${locationKey}. This walk makes its own; use a scratch database.\n`);
    process.exit(1);
  }
  if (!PROVIDER_IDS.includes(NO_KEY_PROVIDER)) throw new Error('no provider to leave without a key');

  const saved = { heartbeatMs: calendar.heartbeatMs, batchSize: calendar.batchSize };
  calendar.heartbeatMs = 100;
  calendar.batchSize = 5;
  let api = null;
  const apiLog = [];

  try {
    await ensurePermission('panchang.manage');
    const baseline = (await service.collectItems()).length; // words the database held before this script's own
    const baselineHindi = (await service.coverage()).languages.find((l) => l.code === 'hi').translated;
    await makeCalendar();

    /* ---------- the words the calendar is made of ---------- */

    section('The words the calendar is made of');
    {
      const items = await service.collectItems();
      const mine = items.filter((i) => i.source.includes(M));
      const of = (kind) => mine.filter((i) => i.kind === kind).map((i) => i.source);
      check(`there are ${MINE} of them, each once`, mine.length === MINE && items.length === baseline + MINE && new Set(mine.map((i) => `${i.kind}:${i.sourceKey}`)).size === MINE, `${mine.length}, ${items.length - baseline} new`);
      check('five names, a parana’s Ekadashi among them', of('NAME').length === 5 && of('NAME').includes(EKADASHI) && of('NAME').includes(PARANA_NAME), of('NAME').join(' | '));
      check('three descriptions, and not a parana’s, which is built for its date', of('DESCRIPTION').length === 3 && !of('DESCRIPTION').includes(PARANA_DESC), of('DESCRIPTION').join(' | '));
      check('seven terms: the two months read the same and count once', of('TERM').length === 7 && of('TERM').filter((t) => t === TERMS.monthAmanta).length === 1, of('TERM').join(' | '));
      check('terms say what they are, for the prompt', mine.find((i) => i.source === TERMS.tithiName).group === 'tithi' && mine.find((i) => i.source === TERMS.moonSign).group === 'zodiac sign (rashi)' && mine.find((i) => i.source === TERMS.monthAmanta).group === 'lunar month');
      check('names come first, then descriptions, then terms', mine.map((i) => i.kind).join() === [...of('NAME').map(() => 'NAME'), ...of('DESCRIPTION').map(() => 'DESCRIPTION'), ...of('TERM').map(() => 'TERM')].join());
      check('nothing is to be translated that is not the calendar’s', (await service.itemsToTranslate('hi')).filter((i) => i.source.includes(M)).length === MINE);
    }

    /* ---------- the translation run ---------- */

    section('A run that translates');
    {
      const model = fakeModel();
      const row = await newRun();
      const result = await work(row, model);
      const after = await fresh(row);
      check('it completes', result.completed === true && after.status === 'COMPLETED' && after.stopReason === 'finished', JSON.stringify(result));
      check('every word was done, five to a request', after.totalItems === MINE && after.doneItems === MINE && model.asked.map((a) => a.texts.length).join() === '5,5,5', `${after.doneItems}/${after.totalItems}, requests ${model.asked.map((a) => a.texts.length)}`);
      check('names go first, as the prompt’s kind says', model.asked[0].kinds.every((k) => k === 'NAME') && model.asked[1].kinds.slice(0, 3).every((k) => k === 'DESCRIPTION') && model.asked[2].kinds.every((k) => k === 'TERM'));
      check('asked of the run’s provider and model, with the system prompt', model.asked.every((a) => a.provider === PROVIDER && a.model === MODEL && a.system === SYSTEM_PROMPT));
      check('the prompt names the language and, for a term, what it is', /Translate into Hindi \(/.test(model.asked[0].user) && model.asked[2].user.includes('"group":"tithi"'));
      check('all fifteen are saved in Hindi', (await translatedCount()) === MINE);
      const alpha = await translationOf('NAME', ALPHA);
      check('each is the text the model gave for it, marked with who made it and the run', alpha?.text === deva(ALPHA) && alpha.isEdited === false && alpha.runId === row.id && Boolean(alpha.translatedBy), JSON.stringify(alpha));
      check('a parana’s own description was never asked for and has no translation', (await translationOf('DESCRIPTION', PARANA_DESC)) === null && !model.asked.some((a) => a.texts.includes(PARANA_DESC)));
      check('tokens are on the row', after.inputTokens === 3000 && after.outputTokens === 1200 && after.calls === 3, `${after.inputTokens}/${after.outputTokens}/${after.calls}`);
      const day = await counted();
      check('and in the token calculator under the provider and model', day.inputTokens === 3000 && day.outputTokens === 1200 && day.calls === 3, JSON.stringify(day));
      check('the feed has a line for each request', (await service.readFeed(row.id)).filter((l) => l.level === 'success' && /translated/.test(l.text)).length >= 3);
      check('nothing is left to translate into Hindi', (await service.itemsToTranslate('hi')).filter((i) => i.source.includes(M)).length === 0);
      check('coverage counts them', (await service.coverage()).languages.find((l) => l.code === 'hi').translated - baselineHindi === MINE);
    }

    section('Words already translated');
    {
      const none = fakeModel();
      const row = await newRun();
      const result = await work(row, none);
      check('are not asked for again: the run finishes at once without a request', result.completed === true && none.asked.length === 0 && (await fresh(row)).totalItems === 0);

      await prisma.calendarTranslation.update({ where: { id: (await translationOf('NAME', ALPHA)).id }, data: { text: 'मेरा अल्फा', isEdited: true, translatedBy: 'admin' } });
      const again = fakeModel();
      const forced = await newRun({ force: true });
      await work(forced, again);
      const asked = again.asked.flatMap((a) => a.texts);
      check('unless asked to translate again on purpose: all but the edited one, five to a request', again.asked.map((a) => a.texts.length).join() === '5,5,4' && asked.length === MINE - 1 && !asked.includes(ALPHA), again.asked.map((a) => a.texts.length).join());
      const kept = await translationOf('NAME', ALPHA);
      check('a word an editor wrote is neither asked for nor replaced', kept.text === 'मेरा अल्फा' && kept.isEdited && kept.translatedBy === 'admin' && kept.runId !== forced.id);
      check('the others were rewritten by the new run', (await translationOf('NAME', BETA)).runId === forced.id && (await translationOf('TERM', TERMS.yoga)).runId === forced.id);
      check('and the forced run counts its own work', (await fresh(forced)).totalItems === MINE - 1 && (await fresh(forced)).doneItems === MINE - 1);
    }

    section('A queue of runs');
    {
      await clearTranslations();
      const earlier = await newRun();
      await sleep(20);
      const later = await newRun();
      const model = fakeModel();
      const early = await work(later, model);
      check('a run waits while an earlier one is queued', early.delayed === true && model.asked.length === 0 && (await fresh(later)).status === 'QUEUED');
      await work(earlier, fakeModel());
      const after = await work(later, model);
      check('and starts once the earlier one has finished', after.completed === true && (await fresh(later)).status === 'COMPLETED');
    }

    section('Every way a run can stop');
    {
      const stop = (row) => prisma.calendarRun.update({ where: { id: row.id }, data: { status: 'CANCELLED' } });

      await clearTranslations();
      let row = await newRun();
      await work(row, fakeModel(async () => { throw Object.assign(new FatalApiError('API key not valid', 401), { provider: PROVIDER }); }));
      let after = await fresh(row);
      check('a refused key pauses it until a person fixes it and names the setting', after.status === 'PAUSED' && after.pauseReason === 'auth' && after.resumeAt === null && after.statusMessage.includes(KEY_ENV), `${after.pauseReason}: ${after.statusMessage}`);

      row = await newRun();
      let result = await work(row, fakeModel(async () => { throw Object.assign(new Error('rate limited'), { status: 429, provider: PROVIDER }); }));
      after = await fresh(row);
      check('a provider’s limit pauses it and it tries again by itself', result.delayed === true && after.status === 'PAUSED' && after.pauseReason === 'rate_limit' && after.resumeAt && after.retriesInARow === 1, `${after.pauseReason} ${after.resumeAt}`);
      await stop(row); // a run paused to retry by itself holds its place in the queue; this one is done with

      row = await newRun();
      await work(row, fakeModel(async () => { throw new FatalApiError('spend limit reached, billing', 402); }));
      after = await fresh(row);
      check('no credit pauses it for a person', after.status === 'PAUSED' && after.pauseReason === 'credit' && !after.resumeAt);

      // Resume carries on at the first word with no translation: five to a request, and the second request is refused.
      await clearTranslations();
      row = await newRun();
      await work(row, fakeModel(async ({ nth }) => { if (nth === 2) throw new FatalApiError('spend limit reached, billing', 402); }));
      after = await fresh(row);
      check('what was done before the credit ran out is kept', after.status === 'PAUSED' && after.pauseReason === 'credit' && after.doneItems === 5 && (await translatedCount()) === 5 && after.calls === 1, `${after.doneItems} ${await translatedCount()}`);
      await resumeReady(row);
      const rest = fakeModel();
      result = await work(row, rest);
      after = await fresh(row);
      check('and Resume asks only for the rest, then completes', result.completed === true && rest.asked.map((a) => a.texts.length).join() === '5,5' && rest.asked[0].texts[0] === DESC.alpha && after.status === 'COMPLETED' && after.doneItems === MINE && after.totalItems === MINE && after.attempts === 2, `${rest.asked.map((a) => a.texts.length)} ${after.doneItems}/${after.totalItems} attempts ${after.attempts}`);

      // The same for a run that translates again: what it already rewrote is not done twice.
      row = await newRun({ force: true });
      await work(row, fakeModel(async ({ nth }) => { if (nth === 2) throw new FatalApiError('spend limit reached, billing', 402); }));
      await resumeReady(row);
      const forcedRest = fakeModel();
      await work(row, forcedRest);
      after = await fresh(row);
      check('a run that translates again, resumed, does not redo what it rewrote', forcedRest.asked.map((a) => a.texts.length).join() === '5,5' && after.status === 'COMPLETED' && after.doneItems === MINE, `${forcedRest.asked.map((a) => a.texts.length)} ${after.doneItems}`);

      await clearTranslations();
      row = await newRun();
      const bad = fakeModel(async () => {}, (data, { items }) => ({ items: data.items.filter((_, i) => items[i].text !== GAMMA) }));
      await work(row, bad);
      after = await fresh(row);
      check('an answer that leaves a word out is asked for again, then the run fails on it', after.status === 'FAILED' && after.stopReason === 'error' && bad.asked.length === calendar.invalidTries && /1 item\(s\) could not be translated into Hindi after 2 tries/.test(after.statusMessage) && after.statusMessage.includes('"5" is missing'), `${bad.asked.length} ${after.statusMessage}`);
      check('the second request names the problem and asks only for what is left', /Your last answer had these problems/.test(bad.asked[1].user) && bad.asked[1].texts.join() === GAMMA);
      check('what passed is kept, and what the failed asks cost is counted', (await translatedCount()) === 4 && (await translationOf('NAME', GAMMA)) === null && after.doneItems === 4 && after.calls === calendar.invalidTries);

      await clearTranslations();
      row = await newRun();
      const english = fakeModel(async () => {}, (data, { items }) => ({ items: data.items.map((i, n) => ({ ...i, text: `Offer with care ${items[n].ref}` })) }));
      await work(row, english);
      after = await fresh(row);
      check('an answer left in English is not saved, and fails the run', after.status === 'FAILED' && (await translatedCount()) === 0 && /not written in Hindi/.test(after.statusMessage), after.statusMessage);

      await clearTranslations();
      row = await newRun();
      const cancelModel = fakeModel(async ({ nth }) => { if (nth === 1) await prisma.calendarRun.update({ where: { id: row.id }, data: { cancelRequested: true } }); await sleep(600); });
      result = await work(row, cancelModel);
      after = await fresh(row);
      check('Cancel stops it after the request in progress', after.status === 'CANCELLED' && after.stopReason === 'cancelled' && result.cancelled === true && cancelModel.asked.length === 1 && (await translatedCount()) === 5, `${after.status} ${after.stopReason} ${cancelModel.asked.length} request(s)`);

      const early = await newRun({ cancelRequested: true });
      const none = fakeModel();
      result = await work(early, none);
      check('a run cancelled before it started never asks anything', result.cancelled === true && none.asked.length === 0 && (await fresh(early)).status === 'CANCELLED');

      const noKey = await newRun();
      await work(noKey, fakeModel(), { apiKey: () => '' });
      after = await fresh(noKey);
      check('a server with no key pauses the run and names the setting', after.status === 'PAUSED' && after.pauseReason === 'config' && after.statusMessage.includes(KEY_ENV), after.statusMessage);

      const noLanguage = await newRun({ language: 'xx' });
      await work(noLanguage, fakeModel());
      after = await fresh(noLanguage);
      check('a language the calendar is not translated into pauses it as a setting problem', after.status === 'PAUSED' && after.pauseReason === 'config' && /not a language/.test(after.statusMessage), after.statusMessage);

      const stale = await newRun();
      const other = await work({ ...stale, jobId: 'some-other-job' }, fakeModel());
      check('a job the row does not name does nothing', other.skipped === 'superseded by another job');
      await prisma.calendarRun.updateMany({ where: { id: { in: made.runs }, status: { in: ['QUEUED', 'PAUSED'] } }, data: { status: 'CANCELLED' } });
    }

    /* ---------- what readers get ---------- */

    // One complete Hindi translation for the rest of the walk, and a hand-written one over it.
    await clearTranslations();
    await work(await newRun(), fakeModel());
    await prisma.calendarTranslation.update({ where: { id: (await translationOf('NAME', ALPHA)).id }, data: { text: 'मेरा अल्फा', isEdited: true, translatedBy: 'admin' } });
    const nameOf = (source) => (source === ALPHA ? 'मेरा अल्फा' : deva(source));

    section('The festival push words');
    {
      const [alpha, , , parana] = await festivalRows();
      const all = await festivalRows();
      const days = await prisma.panchangDay.findMany({ where: { date: toDateColumn(D1), locationKey } }); // the terms come from the day's row
      const hindi = await service.wordsFor(['hi', 'en'], days, all);
      const english = await service.wordsFor(['en'], days, all);
      check('an English reader costs no lookup and sees the English', english('NAME', ALPHA) === ALPHA && english('TERM', TERMS.yoga) === TERMS.yoga);
      check('a Hindi reader sees the translation of a name, a description and a term, and an editor’s words over a run’s', hindi('NAME', BETA) === deva(BETA) && hindi('DESCRIPTION', DESC.beta) === deva(DESC.beta) && hindi('TERM', TERMS.yoga) === deva(TERMS.yoga) && hindi('NAME', ALPHA) === 'मेरा अल्फा');
      check('a word with no translation stays English', hindi('NAME', `${M} Unknown`) === `${M} Unknown`);

      const today = message(alpha, 0, ['hi', 'en'], hindi);
      check('the push title and body are the translated name and description', today.title.includes('मेरा अल्फा') && !today.title.includes(ALPHA) && today.body.startsWith(deva(DESC.alpha)), `${today.title} | ${today.body}`);
      const tomorrow = message(alpha, 1, ['hi', 'en'], hindi);
      check('the day before says so around the translated name', tomorrow.title.includes('मेरा अल्फा') && tomorrow.title !== today.title, tomorrow.title);

      const tamil = await service.wordsFor(['ta', 'en'], days, all);
      const inTamil = message(alpha, 0, ['ta', 'en'], tamil);
      check('a Tamil reader, with no Tamil translation yet, gets the English name and description', inTamil.title.includes(ALPHA) && inTamil.body.startsWith(DESC.alpha), `${inTamil.title} | ${inTamil.body}`);

      const fast = message(parana, 0, ['hi', 'en'], hindi);
      check('a parana push names the Ekadashi in Hindi and keeps its times', fast.body.includes(deva(EKADASHI)) && !fast.body.includes(EKADASHI) && /6:00|६:००/.test(fast.title), `${fast.title} | ${fast.body}`);
    }

    /* ---------- the APIs ---------- */

    section('The admin API');
    {
      await prisma.calendarRun.deleteMany({ where: { id: { in: made.runs } } });
      for (const runId of made.runs) await redis.del(`${calendar.feedKey}:${runId}`);
      made.runs.length = 0;

      api = spawn(process.execPath, ['server.js'], {
        cwd: join(import.meta.dirname, '..'),
        env: {
          ...process.env,
          PORT: String(PORT),
          // Keys that are not real, for every provider but one; that one has none, to see the API refuse it.
          ...Object.fromEntries(PROVIDER_IDS.map((id) => [providerOf(id).keyEnv, id === NO_KEY_PROVIDER ? '' : 'e2e-not-a-real-key'])),
          AWS_ACCESS_KEY_ID: '',
          AWS_SECRET_ACCESS_KEY: '',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      api.stdout.on('data', (c) => apiLog.push(String(c)));
      api.stderr.on('data', (c) => apiLog.push(String(c)));
      if (!(await waitForApi())) {
        console.error(apiLog.join('').slice(-2000));
        throw new Error('the API copy did not start');
      }

      const translator = await tokenWith(['panchang.translate'], 'translator');
      const manager = await tokenWith(['panchang.manage'], 'manager');
      const outsider = await tokenWith(['reel.read'], 'outsider');
      const reader = await tokenWith([], 'reader');
      const base = '/api/admin/panchang/translation';

      check('someone without the permission is refused', (await call('GET', `${base}/overview`, { token: outsider })).status === 403);
      check('so is someone signed out', (await call('GET', `${base}/overview`)).status === 403);
      check('and someone who may edit the calendar but not translate it', (await call('GET', `${base}/overview`, { token: manager })).status === 403 && (await call('POST', `${base}/runs`, { token: manager, body: { language: 'hi' } })).status === 403);

      const overview = await call('GET', `${base}/overview`, { token: translator });
      const o = overview.data;
      check('overview: every word of the calendar, by kind, and the 11 languages', overview.status === 200 && o.itemsTotal === baseline + MINE && o.itemsByKind.NAME >= 5 && o.languages.length === 11 && o.languages.every((l) => l.endonym), JSON.stringify(o?.itemsByKind));
      check('overview: Hindi is counted', o.languages.find((l) => l.code === 'hi').translated - baselineHindi === MINE && o.languages.find((l) => l.code === 'hi').edited >= 1);
      check('overview: the three providers, each with models, and which have a key', o.translation.providers.length === PROVIDER_IDS.length && o.translation.providers.every((p) => Array.isArray(p.models) && p.models.length > 0) && o.translation.providers.find((p) => p.id === PROVIDER).apiKeyConfigured === true && o.translation.providers.find((p) => p.id === NO_KEY_PROVIDER).apiKeyConfigured === false, JSON.stringify(o?.translation.providers.map((p) => [p.id, p.apiKeyConfigured])));
      check('overview: the default provider, its key and no worker', o.translation.defaultProvider === PROVIDER && o.translation.apiKeyConfigured === true && o.translation.workerOnline === false && o.translation.batchSize === saved.batchSize && o.active.length === 0, JSON.stringify(o?.translation));
      check('overview: a model that cannot be used says why', o.translation.providers.flatMap((p) => p.models).some((m) => m.unusableReason));

      const ofMine = (extra = '') => `${base}/items?language=hi&q=${M}${extra}`;
      const items = await call('GET', ofMine(), { token: translator });
      check('items: the words, each with its Hindi', items.status === 200 && items.data.length === MINE && items.data.every((i) => i.translation?.text), `${items.data?.length}`);
      check('items: names, descriptions and terms are told apart, and a term carries its group', items.data.filter((i) => i.kind === 'NAME').length === 5 && items.data.filter((i) => i.kind === 'DESCRIPTION').length === 3 && items.data.find((i) => i.source === TERMS.tithiName).group === 'tithi');
      check('items: a kind narrows them', (await call('GET', ofMine('&kind=TERM'), { token: translator })).data?.length === 7);
      check('items: the hand-written ones are marked', (await call('GET', ofMine('&state=edited'), { token: translator })).data?.map((i) => i.source).join() === ALPHA);
      check('items: none are missing in Hindi, all are in Tamil', (await call('GET', ofMine('&state=missing'), { token: translator })).data?.length === 0 && (await call('GET', `${base}/items?language=ta&q=${M}&state=missing`, { token: translator })).data?.length === MINE);
      check('items: searching finds the Hindi as well as the English', (await call('GET', `${base}/items?language=hi&q=${encodeURIComponent('मेरा अल्फा')}`, { token: translator })).data?.some((i) => i.source === ALPHA));
      check('items: an unknown language is a 400', (await call('GET', `${base}/items?language=xx`, { token: translator })).status === 400);

      const put = await call('PUT', `${base}/items`, { token: translator, body: { language: 'ta', kind: 'NAME', source: BETA, text: 'பீட்டா' } });
      check('a translation written by hand is marked edited and as an admin’s', put.status === 200 && put.data.isEdited === true && put.data.translatedBy === 'admin' && put.data.text === 'பீட்டா' && put.data.sourceKey === sourceKeyOf(BETA), JSON.stringify(put.data));
      check('writing a word the calendar does not hold is a 404', (await call('PUT', `${base}/items`, { token: translator, body: { language: 'ta', kind: 'NAME', source: `${M} Not In The Calendar`, text: 'x' } })).status === 404);
      check('the right word under the wrong kind is a 404 too', (await call('PUT', `${base}/items`, { token: translator, body: { language: 'ta', kind: 'TERM', source: BETA, text: 'x' } })).status === 404);
      check('an unknown language and an empty text are 400s', (await call('PUT', `${base}/items`, { token: translator, body: { language: 'xx', kind: 'NAME', source: BETA, text: 'x' } })).status === 400 && (await call('PUT', `${base}/items`, { token: translator, body: { language: 'ta', kind: 'NAME', source: BETA, text: '  ' } })).status === 400);
      check('writing again replaces the text', (await call('PUT', `${base}/items`, { token: translator, body: { language: 'ta', kind: 'NAME', source: BETA, text: 'பீட்டா உத்சவம்' } })).data?.text === 'பீட்டா உத்சவம்');
      check('a manager without the translate permission cannot write one', (await call('PUT', `${base}/items`, { token: manager, body: { language: 'ta', kind: 'NAME', source: BETA, text: 'x' } })).status === 403);

      section('The public calendar');
      const cal = (qs = '', token) => call('GET', `/api/app/calendar?from=${D1}&to=${D2}${qs}`, { token });
      const hi = await cal('&language=hi');
      const day = hi.data?.days?.find((d) => d.date === D1);
      const feast = (slug, data = hi.data) => data?.festivals?.find((f) => f.slug === `${P}-${slug}`);
      check('in Hindi: the day’s terms are translated', hi.status === 200 && day?.tithi.name === deva(TERMS.tithiName) && day.nakshatra.name === deva(TERMS.nakshatra) && day.yoga === deva(TERMS.yoga) && day.karana === deva(TERMS.karana) && day.sunSign === deva(TERMS.sunSign) && day.moonSign === deva(TERMS.moonSign), JSON.stringify(day));
      check('in Hindi: both months, from the one translation', day?.month === deva(TERMS.monthAmanta) && day?.monthPurnimanta === deva(TERMS.monthPurnimanta));
      check('in Hindi: a festival’s name and description, an editor’s words where there are some', feast('alpha')?.name === 'मेरा अल्फा' && feast('alpha')?.description === deva(DESC.alpha) && feast('beta')?.name === deva(BETA) && feast('gamma')?.description === deva(DESC.gamma), JSON.stringify(feast('alpha')));
      check('in Hindi: a parana’s name is translated and its description, made for its date, is left as it is', feast('parana')?.name === deva(PARANA_NAME) && feast('parana')?.description === PARANA_DESC, JSON.stringify(feast('parana')));
      check('what is not words is the same in every language', day?.tithi.number === 11 && day?.tithi.paksha === 'SHUKLA' && day?.vikramSamvat === 2088 && feast('alpha')?.kind === 'FESTIVAL');
      check('it is public: signed out sees the same', JSON.stringify((await cal('&language=hi')).data) === JSON.stringify(hi.data));

      const ta = await cal('&language=ta', reader);
      check('in a language with no translation: English, nothing missing', ta.status === 200 && ta.data.days.find((d) => d.date === D1).tithi.name === TERMS.tithiName && feast('alpha', ta.data)?.name === ALPHA && feast('alpha', ta.data)?.description === DESC.alpha);
      check('a word one language has and another does not: Tamil gets its own, the rest English', feast('beta', ta.data)?.name === 'பீட்டா உத்சவம்' && feast('gamma', ta.data)?.name === GAMMA);
      const plain = await cal('', reader);
      check('with no language named, and an English reader: English', plain.status === 200 && feast('alpha', plain.data)?.name === ALPHA && plain.data.days.find((d) => d.date === D1).yoga === TERMS.yoga);
      check('a language that is not one the calendar translates into is English, not an error', (await cal('&language=en', reader)).data?.festivals.find((f) => f.slug === `${P}-alpha`)?.name === ALPHA);
      check('one language is named at a time: a list of them is a 400, not a guess', (await cal('&language=ta,hi', reader)).status === 400 && (await cal('&language=hindi', reader)).status === 400);
      // With no language on the call, the signed-in reader's own app language is used.
      const hindiReaderToken = await tokenWith([], 'hindireader');
      await prisma.user.update({ where: { id: made.users.at(-1) }, data: { appLanguage: 'hi' } });
      await redis.del(`rl:read:${made.users.at(-1)}`);
      const own = await cal('', hindiReaderToken);
      check('with no language named, a reader whose app is in Hindi gets Hindi', own.status === 200 && feast('beta', own.data)?.name === deva(BETA) && own.data.days.find((d) => d.date === D1).yoga === deva(TERMS.yoga), `${feast('beta', own.data)?.name}`);
      check('and naming another language on the call wins over the account’s', feast('beta', (await cal('&language=ta', hindiReaderToken)).data)?.name === 'பீட்டா உத்சவம்');

      section('Estimate, and starting a run');
      const estimateOf = (qs) => call('GET', `${base}/estimate?${qs}`, { token: translator });
      const est = await estimateOf('language=ta');
      check('estimate: the words still to translate, in requests and tokens', est.status === 200 && est.data.willTranslate === baseline + MINE - (await prisma.calendarTranslation.count({ where: { languageCode: 'ta' } })) && est.data.requests === Math.ceil(est.data.willTranslate / saved.batchSize) && est.data.inputTokens > 0 && est.data.outputTokens > 0 && est.data.byKind.NAME + est.data.byKind.DESCRIPTION + est.data.byKind.TERM === est.data.willTranslate, JSON.stringify(est.data));
      check('estimate: names the provider and model it would use, and nothing is wrong with them', est.data.provider === PROVIDER && Boolean(est.data.model) && est.data.unusable === null);
      check('estimate: Hindi has none left but what “translate again” would redo, never the edited one', (await estimateOf('language=hi')).data?.willTranslate === 0 && (await estimateOf('language=hi&force=true')).data?.willTranslate === baseline + MINE - 1 - (await prisma.calendarTranslation.count({ where: { languageCode: 'hi', isEdited: true, NOT: { source: { contains: M } } } })));
      check('estimate: a model that cannot be used says why', typeof (await estimateOf('language=ta&provider=anthropic&model=claude-fable-5-1')).data?.unusable === 'string');
      check('estimate: an unknown language and an unknown provider are 400s', (await estimateOf('language=xx')).status === 400 && (await estimateOf('language=ta&provider=nope')).status === 400);
      check('a manager without the translate permission cannot ask', (await call('GET', `${base}/estimate?language=ta`, { token: manager })).status === 403);

      check('a bad language is a 400', (await call('POST', `${base}/runs`, { token: translator, body: { language: 'xx' } })).status === 400);
      const noKey = await call('POST', `${base}/runs`, { token: translator, body: { language: 'te', provider: NO_KEY_PROVIDER } });
      check('a provider the server has no key for is refused, naming the setting', noKey.status === 422 && noKey.error?.message.includes(providerOf(NO_KEY_PROVIDER).keyEnv), JSON.stringify(noKey.error));
      const unusable = await call('POST', `${base}/runs`, { token: translator, body: { language: 'te', provider: 'anthropic', model: 'claude-fable-5-1' } });
      check('a model that cannot run without extended thinking is refused before anything is queued', unusable.status === 422 && (await prisma.calendarRun.count({ where: { language: 'te' } })) === 0, JSON.stringify(unusable.error));
      check('a manager without the translate permission cannot start a run', (await call('POST', `${base}/runs`, { token: manager, body: { language: 'ta' } })).status === 403);
      const upToDate = await call('POST', `${base}/runs`, { token: translator, body: { language: 'hi' } });
      check('Hindi is already translated, so a run into it is refused, and says so', upToDate.status === 409 && upToDate.error?.details?.upToDate === true && (await prisma.calendarRun.count({ where: { language: 'hi' } })) === 0, JSON.stringify(upToDate.error));

      const started = await call('POST', `${base}/runs`, { token: translator, body: { language: 'ta' } });
      if (started.data?.id) made.runs.push(started.data.id);
      check('starting queues a run for the default provider and its model', started.status === 201 && started.data.status === 'QUEUED' && started.data.provider === PROVIDER && started.data.model === service.model(PROVIDER) && started.data.language === 'ta' && started.data.languageName === 'Tamil' && started.data.force === false, JSON.stringify(started.data));
      check('the job is on the queue and the row names it', Boolean((await fresh(started.data)).jobId) && Boolean(await queue.getJob((await fresh(started.data)).jobId)));
      const dup = await call('POST', `${base}/runs`, { token: translator, body: { language: 'ta' } });
      check('a second run into the same language is refused', dup.status === 409 && (await prisma.calendarRun.count({ where: { language: 'ta' } })) === 1);
      const second = await call('POST', `${base}/runs`, { token: translator, body: { language: 'mr', provider: 'anthropic', model: providerOf('anthropic').defaultModel } });
      if (second.data?.id) made.runs.push(second.data.id);
      check('another language queues behind it, with the provider and model chosen for it', second.status === 201 && second.data.status === 'QUEUED' && second.data.provider === 'anthropic' && second.data.model === providerOf('anthropic').defaultModel, JSON.stringify(second.data));
      check('the audit log says who started each', (await prisma.auditLog.count({ where: { action: 'calendar.run.start', entityId: { in: [started.data.id, second.data.id] } } })) === 2);
      check('overview lists both as active', (await call('GET', `${base}/overview`, { token: translator })).data?.active.map((r) => r.id).sort().join() === [started.data.id, second.data.id].sort().join());

      const got = await call('GET', `${base}/runs/${started.data.id}`, { token: translator });
      check('the run and its feed can be read', got.status === 200 && got.data.run.id === started.data.id && got.data.feed.some((l) => /Queued by/.test(l.text) && l.text.includes('Tamil')), JSON.stringify(got.data?.feed?.[0]));
      check('a run that is not there is a 404', (await call('GET', `${base}/runs/nope`, { token: translator })).status === 404 && (await call('POST', `${base}/runs/nope/cancel`, { token: translator })).status === 404 && (await call('POST', `${base}/runs/nope/resume`, { token: translator })).status === 404);
      check('Resume refuses a run that is waiting', (await call('POST', `${base}/runs/${started.data.id}/resume`, { token: translator })).status === 409);

      const cancelled = await call('POST', `${base}/runs/${started.data.id}/cancel`, { token: translator });
      check('Cancel on a waiting run ends it at once', cancelled.status === 200 && cancelled.data.status === 'CANCELLED' && cancelled.data.progress.done === 0, JSON.stringify(cancelled.data));
      check('and the job is gone from the queue', !(await queue.getJob((await fresh(started.data)).jobId)));
      check('Cancel twice is a 409', (await call('POST', `${base}/runs/${started.data.id}/cancel`, { token: translator })).status === 409);
      const listed = await call('GET', `${base}/runs?status=CANCELLED&language=ta`, { token: translator });
      check('the list shows it, and narrows by status and language', listed.status === 200 && listed.data.some((r) => r.id === started.data.id) && (await call('GET', `${base}/runs?language=hi`, { token: translator })).data.length === 0);
      check('a manager without the translate permission cannot read runs', (await call('GET', `${base}/runs`, { token: manager })).status === 403);

      const failedRun = await prisma.calendarRun.update({ where: { id: second.data.id }, data: { status: 'FAILED', stopReason: 'error', statusMessage: 'E2E failure', finishedAt: new Date() } });
      const resumed = await call('POST', `${base}/runs/${failedRun.id}/resume`, { token: translator });
      check('Resume puts a failed run back on the queue', resumed.status === 200 && resumed.data.status === 'QUEUED' && resumed.data.statusMessage === 'Resumed. Waiting for the worker.' && Boolean(await queue.getJob((await fresh(failedRun)).jobId)), JSON.stringify(resumed.data));
      const paused = await prisma.calendarRun.update({ where: { id: failedRun.id }, data: { status: 'PAUSED', pauseReason: 'credit', statusMessage: 'E2E: out of credit' } });
      check('and a run paused for credit', (await call('POST', `${base}/runs/${paused.id}/resume`, { token: translator })).data?.status === 'QUEUED');
      const done = await prisma.calendarRun.update({ where: { id: failedRun.id }, data: { status: 'COMPLETED', stopReason: 'finished', finishedAt: new Date() } });
      check('a finished run can be neither resumed nor cancelled', (await call('POST', `${base}/runs/${done.id}/resume`, { token: translator })).status === 409 && (await call('POST', `${base}/runs/${done.id}/cancel`, { token: translator })).status === 409);
      await prisma.calendarRun.update({ where: { id: failedRun.id }, data: { status: 'QUEUED', finishedAt: null } });
      await call('POST', `${base}/runs/${failedRun.id}/cancel`, { token: translator });
      check('the audit log has the resume and the cancel', (await prisma.auditLog.count({ where: { action: 'calendar.run.resume', entityId: failedRun.id } })) >= 1 && (await prisma.auditLog.count({ where: { action: 'calendar.run.cancel', entityId: { in: [started.data.id, failedRun.id] } } })) >= 2);

      section('Deleting a translation');
      const beta = await translationOf('NAME', BETA, 'ta');
      check('a translation can be deleted, so a run can write it again', (await call('DELETE', `${base}/items/${beta.id}`, { token: translator })).status === 200 && (await translationOf('NAME', BETA, 'ta')) === null);
      check('deleting it twice is a 404', (await call('DELETE', `${base}/items/${beta.id}`, { token: translator })).status === 404);
      check('and readers see English for it again', feast('beta', (await cal('&language=ta', reader)).data)?.name === BETA);
      check('a manager without the translate permission cannot delete one', (await call('DELETE', `${base}/items/${(await translationOf('NAME', GAMMA)).id}`, { token: manager })).status === 403);
    }
  } finally {
    calendar.heartbeatMs = saved.heartbeatMs;
    calendar.batchSize = saved.batchSize;
    api?.kill('SIGTERM');

    // Runs started through the API carry the admin's name, not "e2e".
    const runRows = await prisma.calendarRun.findMany({ where: { OR: [{ id: { in: made.runs } }, { requestedByName: 'e2e' }, { model: MODEL }, { requestedById: { in: made.users } }] }, select: { id: true, jobId: true } }).catch(() => []);
    for (const row of runRows) {
      if (row.jobId) await queue.getJob(row.jobId).then((job) => job?.remove()).catch(() => {});
      await redis.del(`${calendar.feedKey}:${row.id}`).catch(() => {});
    }
    const runIds = runRows.map((r) => r.id);
    const translationIds = (await prisma.calendarTranslation.findMany({ where: { OR: [{ source: { contains: M } }, { runId: { in: runIds } }] }, select: { id: true } }).catch(() => [])).map((t) => t.id);
    // By who did it as well as by what it touched: a translation saved and deleted through the API is gone by now, and
    // deleting the users below would blank the actor on its rows.
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: made.users } }, { entityId: { in: [...runIds, ...translationIds] } }] } }).catch(() => {});
    await prisma.calendarTranslation.deleteMany({ where: { id: { in: translationIds } } }).catch(() => {});
    await prisma.calendarRun.deleteMany({ where: { id: { in: runIds } } }).catch(() => {});
    await prisma.festival.deleteMany({ where: { slug: { startsWith: P } } }).catch(() => {});
    await prisma.panchangDay.deleteMany({ where: { date: toDateColumn(D1), tithiName: TERMS.tithiName } }).catch(() => {});
    await prisma.device.deleteMany({ where: { OR: [{ deviceId: DEVICE }, { userId: { in: made.users } }] } }).catch(() => {});
    await prisma.deviceSession?.deleteMany?.({ where: { userId: { in: made.users } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: made.users } } }).catch(() => {});
    await prisma.role.deleteMany({ where: { id: { in: made.roles } } }).catch(() => {});
    if (made.permission) await prisma.permission.deleteMany({ where: { id: made.permission } }).catch(() => {});
    // The tokens this script counted, taken back out of today's tally.
    await redis.hdel(tally.keyOf(new Date()), `${PROVIDER}|${MODEL}|in`, `${PROVIDER}|${MODEL}|out`, `${PROVIDER}|${MODEL}|calls`).catch(() => {});
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed) console.log(apiLog.join('').split('\n').filter((l) => /error|warn/i.test(l)).slice(-15).join('\n'));
  await prisma.$disconnect();
  await queue.close();
  redis.disconnect();
  publisher.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
