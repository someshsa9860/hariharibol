// Walks prayers end to end: the translation run (the worker's processor, in this process, with a stand-in for the
// model) and the admin and app APIs (a copy started on its own port). Run it with Postgres and Redis up and the
// migration applied (`20261114000000_prayers`, which also grants `prayer.manage` and `prayer.translate`):
//
//   FIREBASE_PROJECT_ID= FIREBASE_CLIENT_EMAIL= FIREBASE_PRIVATE_KEY= GOOGLE_SERVICE_ACCOUNT_PATH= \
//   AWS_ACCESS_KEY_ID= AWS_SECRET_ACCESS_KEY= npm run test:prayer
//
// Nothing here reaches a model provider, a phone or S3. The "model" is a stub; Firebase and AWS are blanked on the
// command line (the script refuses to run with them set); the API copy is given a key that is not real. The script
// refuses to run while a worker is connected to the prayer queue, because that worker would pick up the runs it makes,
// and while the database has an active prayer run, because a run waits for the ones before it.
//
// What it checks is the part that fails quietly:
//   * a run asks for exactly what is missing — a heading and meanings for a language written in the prayer's own script
//     or one a rule converts, the renderings too for one only a model writes (Tamil, Roman, a prayer whose original is
//     not Devanagari), only Roman renderings for English — and nothing a person wrote, a draft, or what is already done;
//   * a rendering older than its verse is asked for again, and an edited one is not; a forced run redoes the rest;
//   * a request carries one prayer's heading or up to `sliceVerses` verses, numbered from 1 in the slice;
//   * an answer that fails our checks (a verse missing, a line lost, left in English) is asked for again with the
//     problem, what passed is kept and only what failed is asked a second time, and the run then fails on it;
//   * a run survives every way it can stop (credit gone, a refused key, the provider busy, Cancel, no key, another job
//     holding the row), ends in the state the page tells the admin, counts its tokens on the row and in the token
//     calculator, and Resume carries on at the first prayer not finished;
//   * the page's per-language counts (`coverage`) agree with what a run would do (`needsOf`);
//   * the admin API gives only the right people the pages, saves what is written by hand, and the app is only ever
//     served published prayers, in the reader's language and with the scripts that can be shown.
//
// Everything it makes is deleted again (prayers, readers, roles, runs, feeds, audit rows, the tokens it counted).

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { mock } from 'node:test';

import { DelayedError } from 'bullmq';

import { prisma } from '../config/database.js';
import { redis, publisher } from '../config/redis.js';
import { prayer as cfg } from '../config/prayer.js';
import env from '../config/env.js';
import * as authService from '../services/auth.js';
import * as firebase from '../services/firebase.js';
import * as service from '../services/prayer.js';
import * as tally from '../services/ai/token-tally.js';
import { queues } from '../jobs/index.js';
import { processRun, realDeps } from '../jobs/processors/prayer.js';
import { SYSTEM_PROMPT } from '../utils/prayer.js';
import { FatalApiError } from './lib/claude-translate-client.js';
import { providerOf } from './lib/translate-providers.js';

const PORT = 4500 + (Date.now() % 90);
const BASE = `http://localhost:${PORT}`;
const DEVICE = 'prayer-e2e-device';
const STAMP = Date.now();
const P = `e2e-${STAMP}`; // every prayer this script makes starts its slug with this
const MODEL = `e2e-model-${STAMP}`;
const PROVIDER = service.defaultProvider();
const KEY_ENV = providerOf(PROVIDER).keyEnv;
const queue = queues.prayer;

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}
const section = (title) => console.log(`\n${title}`);

const made = { users: [], roles: [], runs: [], items: [] };

/* ---------- prayers ---------- */

// Each verse has two lines, so a rendering that loses one is caught. Both are in Devanagari, the script of the originals.
const V1 = { text: 'ॐ नमो भगवते\nवासुदेवाय', meaning: 'Om, I bow to Lord Vasudeva.' };
const V2 = { text: 'हरे कृष्ण हरे कृष्ण\nकृष्ण कृष्ण हरे हरे', meaning: 'Hare Krishna, Hare Krishna.' };
const LONG_AGO = new Date(Date.now() - 24 * 3_600_000); // a verse older than any rendering the run makes of it

async function makePrayer(key, { verses = [V1, V2], status = 'PUBLISHED', category = 'morning', sortOrder = 90_000, originalLanguage = 'sa', summary = `E2E ${key} summary.`, about = `E2E ${key} about.` } = {}) {
  const row = await prisma.prayer.create({
    data: {
      slug: `${P}-${key}`, category, sortOrder, originalLanguage, title: `E2E ${key} title`, summary, about, status,
      verses: { create: verses.map((v, i) => ({ position: i + 1, text: v.text, meaning: v.meaning ?? null, textChangedAt: LONG_AGO })) },
    },
    include: { verses: { orderBy: { position: 'asc' } } },
  });
  made.items.push(row.id);
  return row;
}

const headerRow = (prayerId, code) => prisma.prayerTranslation.findUnique({ where: { prayerId_languageCode: { prayerId, languageCode: code } } });
const verseRow = (verseId, code) => prisma.prayerVerseTranslation.findUnique({ where: { verseId_languageCode: { verseId, languageCode: code } } });
const mine = { startsWith: `${P}-t` };
const headerSlugs = async (code) => (await prisma.prayerTranslation.findMany({ where: { languageCode: code, prayer: { slug: mine } }, include: { prayer: { select: { slug: true } } } })).map((t) => t.prayer.slug).sort();
async function clearTranslations(code) {
  await prisma.prayerTranslation.deleteMany({ where: { languageCode: code, prayer: { slug: mine } } });
  await prisma.prayerVerseTranslation.deleteMany({ where: { languageCode: code, verse: { prayer: { slug: mine } } } });
}

/* ---------- a stand-in for the model ---------- */

// A word in each language's own script. Every answer is this word and a number, so it is in the script (digits are
// not letters) and the tests can tell which language it is in.
const WORD = { hi: 'हिंदी', mr: 'मराठी', ta: 'தமிழ்', te: 'తెలుగు', gu: 'ગુજરાતી', bn: 'বাংলা' };
// A verse line written out in the script asked for.
const LINE = { en: 'namo bhagavate vāsudevāya', ta: 'நமோ பகவதே வாஸுதேவாய', hi: 'ॐ नमो भगवते वासुदेवाय' };
const lines = (text) => String(text).split('\n').filter((l) => l.trim()).length;

/**
 * Answers a header request with a heading and a verses request with one rendering and meaning for each verse it was
 * given, in the language `code`. `script({ nth, kind, items })` may throw or wait first; `shape(data, { kind, items })`
 * may change the answer. `asked` records each request: its kind, the JSON items it carried, the prompt and who was asked.
 */
function fakeModel({ code = 'hi', script = async () => {}, shape = (data) => data } = {}) {
  const asked = [];
  const makeAsk = (options) => async (request) => {
    const kind = request.user.startsWith('kind: header') ? 'header' : 'verses';
    const items = request.user.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
    asked.push({ kind, items, user: request.user, system: request.system, model: options.model, provider: options.provider });
    await script({ nth: asked.length, kind, items });
    const n = asked.length;
    const data = kind === 'header'
      ? { title: `${WORD[code]} ${n}`, summary: `${WORD[code]} ${n}`, about: `${WORD[code]} ${n}` }
      : {
          verses: items[0] && items.map((it) => ({
            n: it.n,
            rendering: it.ask.includes('rendering') ? Array.from({ length: lines(it.text) }, () => LINE[code]).join('\n') : '',
            meaning: it.ask.includes('meaning') ? `${WORD[code]} ${it.n}` : '',
          })),
        };
    return {
      data: shape(data, { kind, items }),
      usage: { inputTokens: 1000, outputTokens: 400, cacheReadTokens: 0, cacheWriteTokens: 0 },
      costUsd: 0,
      stopReason: 'STOP',
    };
  };
  return { makeAsk, asked };
}

// A run only ever sees the prayers this script made for it, so what it asks for does not depend on what else is in the
// database. `only` names the ones (by key) a run may see; the default is the three every section shares.
const only = (...keys) => async (run) => (await realDeps.prayersForRun(run)).filter((e) => keys.some((k) => e.prayer.slug === `${P}-${k}`));
const deps = (model) => ({ ...realDeps, apiKey: () => 'e2e-not-a-real-key', makeAsk: model.makeAsk, prayersForRun: only('t1', 't2', 't3') });

let jobCount = 0;
async function newRun(extra = {}) {
  const jobId = `e2e-${STAMP}-${(jobCount += 1)}`;
  const row = await prisma.prayerRun.create({
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
const fresh = (row) => prisma.prayerRun.findUnique({ where: { id: row.id } });

async function counted() {
  const row = (await tally.today()).find((r) => r.provider === PROVIDER && r.model === MODEL);
  return { inputTokens: row?.inputTokens ?? 0, outputTokens: row?.outputTokens ?? 0, calls: row?.calls ?? 0 };
}

/* ---------- the API ---------- */

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
    console.error('\nA worker is connected to the prayer queue. Stop it first — it would work the runs this script makes.\n');
    process.exit(1);
  }
  let busy;
  try {
    busy = await prisma.prayerRun.count({ where: { status: { in: ['QUEUED', 'RUNNING', 'PAUSED'] } } });
  } catch {
    console.error('\nThe prayer tables are missing. Apply the migration `20261114000000_prayers` (`prisma migrate deploy`).\n');
    process.exit(1);
  }
  if (busy) {
    console.error(`\n${busy} prayer run(s) are active in this database. Finish or cancel them first.\n`);
    process.exit(1);
  }

  const saved = { heartbeatMs: cfg.heartbeatMs, sliceVerses: cfg.sliceVerses };
  cfg.heartbeatMs = 100;
  let api = null;
  const apiLog = [];

  try {
    /* ---------- the translation run ---------- */

    // t1 has a summary and an about text, t2 has neither, t3 is in another category. `draft` is never translated.
    const t1 = await makePrayer('t1', { sortOrder: 90_001 });
    const t2 = await makePrayer('t2', { sortOrder: 90_002, verses: [V1], summary: null, about: null });
    const t3 = await makePrayer('t3', { sortOrder: 90_003, category: 'aarti' });
    const draft = await makePrayer('draft', { sortOrder: 90_004, status: 'DRAFT' });

    section('What a run would do');
    {
      const todo = await service.prayersToTranslate('hi');
      const slugs = todo.map((e) => e.prayer.slug);
      check('published prayers are to do and a draft is not', [t1, t2, t3].every((p) => slugs.includes(p.slug)) && !slugs.includes(draft.slug), slugs.join());
      const one = todo.find((e) => e.prayer.slug === t1.slug);
      check('into Hindi from a Sanskrit original: the heading and the meanings, no renderings (same script)', Boolean(one.needs.header) && one.needs.counts.meanings === 2 && one.needs.counts.renderings === 0, JSON.stringify(one.needs.counts));
      const noSummary = todo.find((e) => e.prayer.slug === t2.slug);
      check('a prayer with no English summary or about asks for the title only', noSummary.needs.header.summary === false && noSummary.needs.header.about === false, JSON.stringify(noSummary.needs.header));
      const tamil = (await service.prayersToTranslate('ta')).find((e) => e.prayer.slug === t1.slug);
      check('into Tamil: the renderings too (only a model writes it)', tamil.needs.counts.renderings === 2 && tamil.needs.counts.meanings === 2, JSON.stringify(tamil.needs.counts));
      const telugu = (await service.prayersToTranslate('te')).find((e) => e.prayer.slug === t1.slug);
      check('into Telugu: no renderings (a rule makes them at read time)', telugu.needs.counts.renderings === 0 && telugu.needs.counts.meanings === 2, JSON.stringify(telugu.needs.counts));
      const roman = (await service.prayersToTranslate('en')).find((e) => e.prayer.slug === t1.slug);
      check('into English: Roman renderings only, no heading, no meanings', roman.needs.header === null && roman.needs.counts.renderings === 2 && roman.needs.counts.meanings === 0, JSON.stringify(roman.needs.counts));
    }

    section('A run into Hindi');
    {
      const model = fakeModel({ code: 'hi' });
      const row = await newRun();
      // The draft is let through the filter on purpose: it is the run itself that has to leave it out.
      const result = await work(row, model, { prayersForRun: only('t1', 't2', 't3', 'draft') });
      const after = await fresh(row);
      check('it completes', result.completed === true && after.status === 'COMPLETED' && after.stopReason === 'finished', JSON.stringify(result));
      check('every prayer was done', after.totalItems === 3 && after.doneItems === 3, `${after.doneItems}/${after.totalItems}`);
      check('a heading request, then the verses, for each prayer in order', model.asked.map((a) => a.kind).join() === 'header,verses,header,verses,header,verses', model.asked.map((a) => a.kind).join());
      check('the heading of t1 asks for a title, summary and about text', model.asked[0].items[0].title === t1.title && model.asked[0].items[0].ask.join() === 'title,summary,about');
      check('and the heading of t2, which has neither, for the title only', model.asked[2].items[0].ask.join() === 'title' && model.asked[2].items[0].summary === undefined);
      check('the verses ask for the meaning only, with no text to write out', model.asked[1].items.map((i) => i.n).join() === '1,2' && model.asked[1].items.every((i) => i.ask.join() === 'meaning' && i.text === undefined && i.meaning), JSON.stringify(model.asked[1].items));
      check('asked of the run’s provider and model, with the system prompt', model.asked.every((a) => a.provider === PROVIDER && a.model === MODEL && a.system === SYSTEM_PROMPT));
      check('a draft is never sent and gets nothing written', (await headerSlugs('hi')).join() === [t1.slug, t2.slug, t3.slug].sort().join() && (await prisma.prayerTranslation.count({ where: { prayerId: draft.id } })) === 0 && !model.asked.some((a) => JSON.stringify(a.items).includes(draft.title)));

      const head = await headerRow(t1.id, 'hi');
      check('the heading is saved, with the run that wrote it', head.title.startsWith('हिंदी') && head.summary && head.about && head.runId === row.id && head.isEdited === false && Boolean(head.translatedBy), JSON.stringify(head));
      const noText = await headerRow(t2.id, 'hi');
      check('and a heading with no summary or about keeps none', noText.summary === null && noText.about === null);
      const meaning = await verseRow(t1.verses[0].id, 'hi');
      check('a verse has its meaning, and no text of its own', meaning.meaning.startsWith('हिंदी') && meaning.text === null && meaning.runId === row.id && meaning.isEdited === false, JSON.stringify(meaning));
      check('tokens are on the row', after.inputTokens === 6000 && after.outputTokens === 2400 && after.calls === 6, `${after.inputTokens}/${after.outputTokens}/${after.calls}`);
      const day = await counted();
      check('and in the token calculator under the provider and model', day.inputTokens === 6000 && day.outputTokens === 2400 && day.calls === 6, JSON.stringify(day));
      const feed = await service.readFeed(row.id);
      check('the feed has a line for each heading, verse batch and prayer', feed.some((l) => l.text.includes('title, summary, about written')) && feed.some((l) => l.text.includes('verse(s) written')) && feed.some((l) => l.level === 'success' && l.text.includes('(3 of 3)')));
    }

    section('What is written is not asked for again');
    {
      const none = fakeModel();
      const row = await newRun();
      const result = await work(row, none);
      check('a run with nothing to do finishes at once without a request', result.completed === true && none.asked.length === 0 && (await fresh(row)).totalItems === 0);

      // An editor wrote t2's heading and its first meaning.
      await prisma.prayerTranslation.update({ where: { id: (await headerRow(t2.id, 'hi')).id }, data: { title: 'मेरा शीर्षक', isEdited: true, translatedBy: 'admin' } });
      await prisma.prayerVerseTranslation.update({ where: { id: (await verseRow(t2.verses[0].id, 'hi')).id }, data: { meaning: 'मेरा अर्थ', isEdited: true, translatedBy: 'admin' } });
      const again = fakeModel();
      const forced = await newRun({ force: true });
      await work(forced, again);
      check('a forced run redoes the rest and skips the prayer an editor wrote entirely', (await fresh(forced)).totalItems === 2 && again.asked.map((a) => a.kind).join() === 'header,verses,header,verses', again.asked.map((a) => a.kind).join());
      const kept = await headerRow(t2.id, 'hi');
      const keptMeaning = await verseRow(t2.verses[0].id, 'hi');
      check('the words an editor wrote are neither asked for nor replaced', kept.title === 'मेरा शीर्षक' && kept.isEdited && kept.translatedBy === 'admin' && keptMeaning.meaning === 'मेरा अर्थ' && keptMeaning.isEdited);
      check('the others were rewritten by the new run', (await headerRow(t1.id, 'hi')).runId === forced.id && (await verseRow(t3.verses[1].id, 'hi')).runId === forced.id);
    }

    section('A language only a model writes: Tamil');
    {
      const model = fakeModel({ code: 'ta' });
      const row = await newRun({ language: 'ta' });
      const result = await work(row, model);
      check('it completes', result.completed === true && (await fresh(row)).doneItems === 3, JSON.stringify(result));
      check('each verse asks for its rendering and its meaning, with the verse’s text', model.asked[1].items.every((i) => i.ask.join() === 'rendering,meaning' && i.text && i.meaning), JSON.stringify(model.asked[1].items));
      check('the request names the script the verses are in and carries the Tamil convention', model.asked[1].user.includes('written in Devanagari script') && model.asked[1].user.includes('Tamil letters:'));
      const r = await verseRow(t1.verses[0].id, 'ta');
      check('the rendering is saved with its two lines, stamped, and the run that wrote it', r.text === `${LINE.ta}\n${LINE.ta}` && Boolean(r.renderedAt) && r.runId === row.id && r.isEdited === false && r.meaning.startsWith('தமிழ்'), JSON.stringify(r));
      check('a verse has one rendering and one meaning, not a row for each', (await prisma.prayerVerseTranslation.count({ where: { verseId: t1.verses[0].id, languageCode: 'ta' } })) === 1);
    }

    section('A rendering older than its verse');
    {
      // The first verse of t1 is changed after its Tamil was made; an editor wrote the Tamil of the second, and it is changed too.
      await sleep(20);
      await prisma.prayerVerse.updateMany({ where: { prayerId: t1.id }, data: { textChangedAt: new Date() } });
      await prisma.prayerVerseTranslation.update({ where: { id: (await verseRow(t1.verses[1].id, 'ta')).id }, data: { text: 'என் உரை', isEdited: true, translatedBy: 'admin' } });
      const todo = (await service.prayersToTranslate('ta')).find((e) => e.prayer.slug === t1.slug);
      check('the stale one is to do, and the edited one is not', todo.needs.counts.stale === 1 && todo.needs.verses.length === 1 && todo.needs.verses[0].verse.id === t1.verses[0].id, JSON.stringify(todo.needs.counts));

      await sleep(20);
      const model = fakeModel({ code: 'ta' });
      const row = await newRun({ language: 'ta' });
      await work(row, model);
      check('a run asks for that verse’s rendering only', model.asked.length === 1 && model.asked[0].kind === 'verses' && model.asked[0].items.length === 1 && model.asked[0].items[0].ask.join() === 'rendering', JSON.stringify(model.asked.map((a) => a.items)));
      const redone = await verseRow(t1.verses[0].id, 'ta');
      const edited = await verseRow(t1.verses[1].id, 'ta');
      check('it is rewritten by that run', redone.runId === row.id && redone.renderedAt > (await prisma.prayerVerse.findUnique({ where: { id: t1.verses[0].id } })).textChangedAt);
      check('and the one an editor wrote is untouched', edited.text === 'என் உரை' && edited.isEdited === true && edited.runId !== row.id);
      check('nothing is stale afterwards', (await service.prayersToTranslate('ta')).every((e) => e.needs.counts.stale === 0));
    }

    section('Roman letters');
    {
      const model = fakeModel({ code: 'en' });
      const row = await newRun({ language: 'en' });
      const result = await work(row, model);
      const after = await fresh(row);
      check('English asks for renderings only: no heading, no meanings, one request a prayer', result.completed === true && model.asked.length === 3 && model.asked.every((a) => a.kind === 'verses' && a.items.every((i) => i.ask.join() === 'rendering' && i.meaning === undefined)), model.asked.map((a) => a.kind).join());
      check('the request carries the Roman (IAST) style', model.asked[0].user.includes('Roman letters:') && model.asked[0].user.includes('IAST'));
      const r = await verseRow(t1.verses[0].id, 'en');
      check('the rendering is saved in Roman letters with the same two lines', r.text === `${LINE.en}\n${LINE.en}` && r.meaning === null && Boolean(r.renderedAt), JSON.stringify(r));
      check('no heading is written for English', (await prisma.prayerTranslation.count({ where: { languageCode: 'en', prayer: { slug: mine } } })) === 0);
      check('all three prayers were done', after.totalItems === 3 && after.doneItems === 3);
    }

    section('A language a rule writes: Telugu');
    {
      const model = fakeModel({ code: 'te' });
      const row = await newRun({ language: 'te' });
      await work(row, model);
      check('it asks for the heading and the meanings, never a rendering', model.asked.filter((a) => a.kind === 'verses').every((a) => a.items.every((i) => i.ask.join() === 'meaning' && i.text === undefined)) && model.asked.filter((a) => a.kind === 'header').length === 3);
      check('and no verse has a text of its own', (await prisma.prayerVerseTranslation.count({ where: { languageCode: 'te', text: { not: null }, verse: { prayer: { slug: mine } } } })) === 0);
    }

    section('An original that is not in Devanagari');
    {
      const tt = await makePrayer('tt', { sortOrder: 90_010, originalLanguage: 'ta', verses: [{ text: 'நமோ பகவதே\nவாஸுதேவாய', meaning: 'I bow to Vasudeva.' }] });
      const model = fakeModel({ code: 'hi' });
      const row = await newRun({ language: 'hi' });
      await work(row, model, { prayersForRun: only('tt') });
      check('a Tamil prayer into Hindi is a model’s work: the rendering too, naming Tamil as the source', model.asked[1].items[0].ask.join() === 'rendering,meaning' && model.asked[1].user.includes('written in Tamil script'), model.asked[1].items[0].ask.join());
      const r = await verseRow(tt.verses[0].id, 'hi');
      check('and the Devanagari is saved with its two lines', r.text === `${LINE.hi}\n${LINE.hi}`, JSON.stringify(r));
    }

    section('Requests are sliced');
    {
      const tl = await makePrayer('tl', { sortOrder: 90_011, verses: [V1, V2, V1, V2, V1] });
      cfg.sliceVerses = 2;
      const model = fakeModel({ code: 'hi' });
      const row = await newRun();
      await work(row, model, { prayersForRun: only('tl') });
      cfg.sliceVerses = saved.sliceVerses;
      check('a heading, then the verses two at a time (2, 2, 1)', model.asked.map((a) => (a.kind === 'header' ? 'h' : a.items.length)).join() === 'h,2,2,1', model.asked.map((a) => (a.kind === 'header' ? 'h' : a.items.length)).join());
      check('and each slice is numbered from 1', model.asked[3].items.map((i) => i.n).join() === '1' && model.asked[2].items.map((i) => i.n).join() === '1,2');
      check('every verse got its meaning', (await prisma.prayerVerseTranslation.count({ where: { languageCode: 'hi', meaning: { not: null }, verse: { prayerId: tl.id } } })) === 5);
    }

    section('The page’s counts agree with what a run would do');
    {
      const cov = await service.coverage();
      for (const code of ['hi', 'ta', 'en', 'te', 'mr', 'bn']) {
        const todo = await service.prayersToTranslate(code);
        const l = cov.languages.find((x) => x.code === code);
        check(`${code}: prayers with something left are the same ${todo.length} in both`, l.partial + l.missing + l.stale === todo.length, JSON.stringify(l));
      }
      check('and every published prayer with verses is counted once', cov.total === (await prisma.prayer.count({ where: { status: 'PUBLISHED', verses: { some: {} } } })), `${cov.total}`);
    }

    section('A queue of runs');
    {
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
      const run = (extra) => newRun(extra);
      const stop = async (row) => prisma.prayerRun.update({ where: { id: row.id }, data: { status: 'CANCELLED' } });
      const refuse = (err) => async () => { throw err; };

      await clearTranslations('hi');
      let row = await run();
      await work(row, fakeModel({ script: refuse(Object.assign(new FatalApiError('API key not valid', 401), { provider: PROVIDER })) }));
      let after = await fresh(row);
      check('a refused key pauses it until a person fixes it and names the setting', after.status === 'PAUSED' && after.pauseReason === 'auth' && after.resumeAt === null && after.statusMessage.includes(KEY_ENV), `${after.pauseReason}: ${after.statusMessage}`);

      row = await run();
      let result = await work(row, fakeModel({ script: refuse(Object.assign(new Error('rate limited'), { status: 429, provider: PROVIDER })) }));
      after = await fresh(row);
      check('a provider’s limit pauses it and it tries again by itself', result.delayed === true && after.status === 'PAUSED' && after.pauseReason === 'rate_limit' && after.resumeAt && after.retriesInARow === 1, `${after.pauseReason} ${after.resumeAt}`);
      await stop(row); // a run paused to retry by itself holds its place in the queue; this one is done with

      row = await run();
      await work(row, fakeModel({ script: refuse(Object.assign(new FatalApiError('spend limit reached, billing', 402), { provider: PROVIDER })) }));
      after = await fresh(row);
      check('no credit pauses it for a person', after.status === 'PAUSED' && after.pauseReason === 'credit' && !after.resumeAt);

      // Resume carries on at the first prayer not finished: t1 is a heading and a verse request, the third request is refused.
      await clearTranslations('hi');
      row = await run();
      const broke = fakeModel({ script: async ({ nth }) => { if (nth === 3) throw Object.assign(new FatalApiError('spend limit reached, billing', 402), { provider: PROVIDER }); } });
      await work(row, broke);
      after = await fresh(row);
      check('the prayer done before the credit ran out is kept', after.status === 'PAUSED' && after.pauseReason === 'credit' && after.doneItems === 1 && (await headerSlugs('hi')).join() === t1.slug, `${after.doneItems} ${(await headerSlugs('hi')).join()}`);
      await prisma.prayerRun.update({ where: { id: row.id }, data: { status: 'QUEUED', pauseReason: null, statusMessage: 'Resumed. Waiting for the worker.', stopReason: null, resumeAt: null, retriesInARow: 0 } });
      const rest = fakeModel();
      result = await work(row, rest);
      after = await fresh(row);
      check('and Resume asks only for the rest, then completes', result.completed === true && rest.asked.filter((a) => a.kind === 'header').map((a) => a.items[0].title).join() === `${t2.title},${t3.title}` && rest.asked.length === 4 && after.status === 'COMPLETED' && after.doneItems === 3 && after.totalItems === 3 && after.attempts === 2, `${rest.asked.map((a) => a.kind)} ${after.doneItems}/${after.totalItems} attempts ${after.attempts}`);

      // A verse left out of an answer: asked for again, then the run fails on it. The heading and the verse that came back are kept.
      await clearTranslations('hi');
      row = await run();
      const bad = fakeModel({ shape: (data, { kind }) => (kind === 'verses' ? { verses: data.verses.filter((v) => v.n !== 2) } : data) });
      await work(row, bad);
      after = await fresh(row);
      check('an answer that leaves a verse out is asked for again, then the run fails on it', after.status === 'FAILED' && after.stopReason === 'error' && bad.asked.length === 1 + cfg.invalidTries && after.statusMessage.includes(t1.title) && /verse 2 is missing/.test(after.statusMessage), `${bad.asked.length} ${after.statusMessage}`);
      check('the second ask names the problem and only the verse that is left', /Your last answer had these problems/.test(bad.asked[2].user) && bad.asked[2].items.map((i) => i.n).join() === '2');
      check('what passed is kept, and what the failed asks cost is counted', Boolean(await headerRow(t1.id, 'hi')) && Boolean(await verseRow(t1.verses[0].id, 'hi')) && !(await verseRow(t1.verses[1].id, 'hi')) && after.doneItems === 0 && after.calls === 1 + cfg.invalidTries, `${after.doneItems} ${after.calls}`);

      // A rendering that lost a line: the meaning that came with it is kept, and only the rendering is asked for again.
      await clearTranslations('ta');
      row = await run({ language: 'ta' });
      const oneLine = fakeModel({ code: 'ta', shape: (data, { kind }) => (kind === 'verses' ? { verses: data.verses.map((v) => ({ ...v, rendering: v.rendering.replace(/\n/g, ' ') })) } : data) });
      await work(row, oneLine, { prayersForRun: only('t1') });
      after = await fresh(row);
      check('a rendering that lost a line is not saved, and fails the run', after.status === 'FAILED' && /the rendering has 1 lines, the verse has 2/.test(after.statusMessage), after.statusMessage);
      check('the second ask is for the renderings alone, the meanings having passed', oneLine.asked[2].items.every((i) => i.ask.join() === 'rendering'));
      const half = await verseRow(t1.verses[0].id, 'ta');
      check('and the meaning that passed is saved without a text', half.meaning.startsWith('தமிழ்') && half.text === null, JSON.stringify(half));

      await clearTranslations('hi');
      row = await run();
      const english = fakeModel({ shape: (data, { kind }) => (kind === 'header' ? { title: 'Offer with care', summary: 'Offer with care.', about: 'Offer everything with care.' } : data) });
      await work(row, english);
      after = await fresh(row);
      check('a heading left in English is not saved, and fails the run', after.status === 'FAILED' && english.asked.length === cfg.invalidTries && (await headerSlugs('hi')).length === 0 && /not written in Hindi/.test(after.statusMessage), after.statusMessage);

      await clearTranslations('hi');
      row = await run();
      const cancelModel = fakeModel({ script: async ({ nth }) => { if (nth === 1) { await prisma.prayerRun.update({ where: { id: row.id }, data: { cancelRequested: true } }); await sleep(600); } } });
      result = await work(row, cancelModel);
      after = await fresh(row);
      check('Cancel stops it after the request in progress', after.status === 'CANCELLED' && after.stopReason === 'cancelled' && result.cancelled === true, `${after.status} ${after.stopReason}`);

      const early = await run({ cancelRequested: true });
      const none = fakeModel();
      result = await work(early, none);
      check('a run cancelled before it started never asks anything', result.cancelled === true && none.asked.length === 0 && (await fresh(early)).status === 'CANCELLED');

      const noKey = await run();
      await work(noKey, fakeModel(), { apiKey: () => '' });
      after = await fresh(noKey);
      check('a server with no key pauses the run and names the setting', after.status === 'PAUSED' && after.pauseReason === 'config' && after.statusMessage.includes(KEY_ENV), after.statusMessage);

      const stale = await run();
      const other = await work({ ...stale, jobId: 'some-other-job' }, fakeModel());
      check('a job the row does not name does nothing', other.skipped === 'superseded by another job');
      await prisma.prayerRun.updateMany({ where: { id: { in: made.runs }, status: { in: ['QUEUED', 'PAUSED'] } }, data: { status: 'CANCELLED' } });
    }

    /* ---------- the APIs ---------- */

    section('The admin API');
    {
      await prisma.prayerRun.deleteMany({ where: { id: { in: made.runs } } });
      for (const runId of made.runs) await redis.del(`${cfg.feedKey}:${runId}`);
      made.runs.length = 0;

      api = spawn(process.execPath, ['server.js'], {
        cwd: join(import.meta.dirname, '..'),
        env: { ...process.env, PORT: String(PORT), [KEY_ENV]: 'e2e-not-a-real-key', AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: '' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      api.stdout.on('data', (c) => apiLog.push(String(c)));
      api.stderr.on('data', (c) => apiLog.push(String(c)));
      if (!(await waitForApi())) {
        console.error(apiLog.join('').slice(-2000));
        throw new Error('the API copy did not start');
      }

      const manager = await tokenWith(['prayer.manage'], 'manager');
      const translator = await tokenWith(['prayer.manage', 'prayer.translate'], 'translator');
      const outsider = await tokenWith(['reel.read'], 'outsider');
      const reader = await tokenWith([], 'app-reader');
      const admin = '/api/admin/prayers';

      check('someone without the permission is refused', (await call('GET', `${admin}/overview`, { token: outsider })).status === 403);
      check('and so is someone signed out', (await call('GET', `${admin}/overview`)).status === 403);

      const overview = await call('GET', `${admin}/overview`, { token: manager });
      const o = overview.data;
      check('overview: counts by status, the eight categories, the 12 languages', overview.status === 200 && o.counts.total === o.counts.published + o.counts.draft && o.counts.published >= 5 && o.counts.draft >= 1 && o.categories.length === 8 && o.languages.length === 12, JSON.stringify(o?.counts));
      check('overview: the provider’s key, the slice size, no worker', o.translation.defaultProvider === PROVIDER && o.translation.apiKeyConfigured === true && o.translation.workerOnline === false && o.translation.batchSize === cfg.sliceVerses, JSON.stringify(o?.translation));

      const listed = await call('GET', `${admin}/items?q=${P}`, { token: manager });
      check('list: search finds the prayers this script made, whatever their status', listed.status === 200 && listed.data.length === made.items.length && listed.data.some((i) => i.status === 'DRAFT'), `${listed.data?.length}/${made.items.length}`);
      const row1 = listed.data.find((i) => i.id === t1.id);
      check('list: each carries its verse count and how many languages have a heading', row1.verseCount === 2 && row1.translatedLanguages >= 1, JSON.stringify(row1));
      check('list: the status filter', (await call('GET', `${admin}/items?q=${P}&status=DRAFT`, { token: manager })).data.every((i) => i.status === 'DRAFT'));
      check('list: the category filter', (await call('GET', `${admin}/items?q=${P}&category=aarti`, { token: manager })).data.map((i) => i.id).join() === t3.id);
      check('list: an unknown category is a 400', (await call('GET', `${admin}/items?category=nope`, { token: manager })).status === 400);

      const detail = await call('GET', `${admin}/items/${t1.id}`, { token: manager });
      const taLanguage = detail.data?.languages.find((l) => l.code === 'ta');
      check('one prayer: its verses in order and what each language holds', detail.status === 200 && detail.data.verses.map((v) => v.position).join() === '1,2' && detail.data.languages.length === 12 && detail.data.languages.find((l) => l.code === 'en').texts === 2 && taLanguage.how === 'model', JSON.stringify(detail.data?.languages.find((l) => l.code === 'en')));
      check('one prayer: a missing id is a 404', (await call('GET', `${admin}/items/nope`, { token: manager })).status === 404);

      const body = {
        category: 'morning', originalLanguage: 'sa', title: `E2E ${STAMP} api made`, summary: 'Made from the admin page.', author: 'E2E Author',
        verses: [{ text: 'ॐ नमः\nशिवाय', meaning: 'I bow to Shiva.' }, { text: 'हरि बोल', meaning: '' }],
      };
      const createdItem = await call('POST', `${admin}/items`, { token: manager, body });
      if (createdItem.data?.id) made.items.push(createdItem.data.id);
      const a = createdItem.data;
      check('create: a new prayer is a draft with a slug from its title and its verses in order', createdItem.status === 201 && a.status === 'DRAFT' && a.slug === `${P}-api-made` && a.verses.map((v) => v.position).join() === '1,2' && a.verses[1].meaning === null, JSON.stringify(a?.slug));
      check('create: the audit trail has it', (await prisma.auditLog.count({ where: { action: 'prayer.create', entityId: a.id } })) === 1);
      const second = await call('POST', `${admin}/items`, { token: manager, body: { ...body, verses: undefined } });
      if (second.data?.id) made.items.push(second.data.id);
      check('create: a second with the same title gets another slug, and may have no verses yet', second.status === 201 && second.data.slug === `${P}-api-made-2` && second.data.verses.length === 0);
      check('create: an unknown category is a 400', (await call('POST', `${admin}/items`, { token: manager, body: { ...body, category: 'nope' } })).status === 400);
      check('create: an unknown original language is a 400', (await call('POST', `${admin}/items`, { token: manager, body: { ...body, originalLanguage: 'xx' } })).status === 400);
      check('create: a verse with no text is a 400', (await call('POST', `${admin}/items`, { token: manager, body: { ...body, verses: [{ text: '' }] } })).status === 400);
      check('app: a draft is not served', (await call('GET', `/api/app/prayers/${a.id}`, { token: reader })).status === 404);

      const edited = await call('PATCH', `${admin}/items/${a.id}`, { token: manager, body: { title: `E2E ${STAMP} renamed`, sourceUrl: 'https://example.org/page', sortOrder: 90_020 } });
      check('edit: changes the wording and the source', edited.status === 200 && edited.data.title.endsWith('renamed') && edited.data.sourceUrl === 'https://example.org/page' && edited.data.sortOrder === 90_020);
      check('edit: nothing to change is a 400', (await call('PATCH', `${admin}/items/${a.id}`, { token: manager, body: {} })).status === 400);
      check('edit: a source that is not a link is a 400', (await call('PATCH', `${admin}/items/${a.id}`, { token: manager, body: { sourceUrl: 'not a link' } })).status === 400);
      check('edit: a source that is not http is a 400', (await call('PATCH', `${admin}/items/${a.id}`, { token: manager, body: { sourceUrl: 'javascript:alert(1)' } })).status === 400);
      const stampBefore = (await prisma.prayerVerse.findUnique({ where: { id: a.verses[0].id } })).textChangedAt;
      await sleep(20);
      await call('PATCH', `${admin}/items/${a.id}`, { token: manager, body: { originalLanguage: 'hi' } });
      const stampAfter = (await prisma.prayerVerse.findUnique({ where: { id: a.verses[0].id } })).textChangedAt;
      check('edit: changing the original language marks every verse’s text as changed', stampAfter > stampBefore);
      await call('PATCH', `${admin}/items/${a.id}`, { token: manager, body: { originalLanguage: 'sa' } });

      // The verses: an id keeps its row, a missing one is new, one left out is gone.
      const [v1, v2] = a.verses;
      const stamp1 = (await prisma.prayerVerse.findUnique({ where: { id: v1.id } })).textChangedAt;
      const save1 = await call('PUT', `${admin}/items/${a.id}/verses`, { token: manager, body: { verses: [{ id: v1.id, text: v1.text, meaning: 'I bow to Lord Shiva.' }, { text: 'ॐ शान्तिः' }] } });
      check('verses: a row with an id keeps it, a row without is new, and one left out is deleted', save1.status === 200 && save1.data[0].id === v1.id && save1.data[0].meaning === 'I bow to Lord Shiva.' && save1.data[1].id !== v2.id && save1.data.length === 2 && (await prisma.prayerVerse.count({ where: { id: v2.id } })) === 0);
      check('verses: a changed meaning does not mark the text as changed', (await prisma.prayerVerse.findUnique({ where: { id: v1.id } })).textChangedAt.getTime() === stamp1.getTime());
      const stamp2 = (await prisma.prayerVerse.findUnique({ where: { id: save1.data[1].id } })).textChangedAt;
      await sleep(20);
      const save2 = await call('PUT', `${admin}/items/${a.id}/verses`, { token: manager, body: { verses: [{ id: v1.id, text: 'ॐ नमः शिवाय', meaning: 'I bow to Lord Shiva.' }, { id: save1.data[1].id, text: save1.data[1].text }] } });
      check('verses: changing the text marks that verse, and only that one', save2.status === 200 && (await prisma.prayerVerse.findUnique({ where: { id: v1.id } })).textChangedAt > stamp1 && (await prisma.prayerVerse.findUnique({ where: { id: save1.data[1].id } })).textChangedAt.getTime() === stamp2.getTime());
      check('verses: a verse named twice is a 400', (await call('PUT', `${admin}/items/${a.id}/verses`, { token: manager, body: { verses: [{ id: v1.id, text: 'क' }, { id: v1.id, text: 'ख' }] } })).status === 400);
      check('verses: one that belongs to another prayer is a 409', (await call('PUT', `${admin}/items/${a.id}/verses`, { token: manager, body: { verses: [{ id: t1.verses[0].id, text: 'क' }] } })).status === 409);
      check('verses: a prayer that does not exist is a 404', (await call('PUT', `${admin}/items/nope/verses`, { token: manager, body: { verses: [] } })).status === 404);

      check('status: a prayer with no verse cannot be published', (await call('POST', `${admin}/items/${second.data.id}/status`, { token: manager, body: { status: 'PUBLISHED' } })).status === 400);
      const publish = await call('POST', `${admin}/items/${a.id}/status`, { token: manager, body: { status: 'PUBLISHED' } });
      check('status: publishing', publish.status === 200 && publish.data.status === 'PUBLISHED');
      await call('POST', `${admin}/items/${a.id}/status`, { token: manager, body: { status: 'PUBLISHED' } });
      check('status: publishing twice writes one audit row, for the change', (await prisma.auditLog.count({ where: { action: 'prayer.status', entityId: a.id } })) === 1);
      check('verses: a published prayer cannot be left with none', (await call('PUT', `${admin}/items/${a.id}/verses`, { token: manager, body: { verses: [] } })).status === 400);

      const served = await call('GET', `/api/app/prayers/${a.id}`, { token: reader });
      check('app: a published prayer is served with its source and its verses', served.status === 200 && served.data.title.endsWith('renamed') && served.data.sourceUrl === 'https://example.org/page' && served.data.sourceLanguage === 'sa' && served.data.verses.length === 2, JSON.stringify(served.data?.title));
      await call('POST', `${admin}/items/${a.id}/status`, { token: manager, body: { status: 'DRAFT' } });
      check('app: held back, it is a 404 and out of the list', (await call('GET', `/api/app/prayers/${a.id}`, { token: reader })).status === 404 && !(await call('GET', '/api/app/prayers', { token: reader })).data.items.some((i) => i.id === a.id));
      await call('POST', `${admin}/items/${a.id}/status`, { token: manager, body: { status: 'PUBLISHED' } });

      // Writing a language by hand.
      const hiPut = await call('PUT', `${admin}/items/${t1.id}/translations/hi`, {
        token: manager,
        body: { header: { title: 'हिंदी शीर्षक', summary: 'हिंदी सार', about: 'हिंदी विवरण' }, verses: [{ verseId: t1.verses[0].id, meaning: 'हिंदी अर्थ' }] },
      });
      check('translation: a heading and a meaning written by hand are marked as an editor’s', hiPut.status === 200 && hiPut.data.header.isEdited === true && hiPut.data.header.translatedBy && hiPut.data.verses[0].meaning === 'हिंदी अर्थ' && hiPut.data.verses[0].isEdited === true, JSON.stringify(hiPut.data?.header));
      const tePut = await call('PUT', `${admin}/items/${t1.id}/translations/te`, { token: manager, body: { verses: [{ verseId: t1.verses[0].id, text: 'తెలుగు' }] } });
      check('translation: a text for a rule language is saved, stamped, and the rule’s own is shown beside it', tePut.status === 200 && tePut.data.how === 'rule' && tePut.data.verses[0].text === 'తెలుగు' && /[ఀ-౿]/.test(tePut.data.verses[0].automatic ?? ''), JSON.stringify(tePut.data?.verses[0]));
      const enGet = await call('GET', `${admin}/items/${t1.id}/translations/en`, { token: manager });
      check('translation: English reads back with its Roman renderings and no heading', enGet.status === 200 && enGet.data.how === 'model' && enGet.data.header === null && enGet.data.verses[0].text === `${LINE.en}\n${LINE.en}` && enGet.data.verses[0].stale === false, JSON.stringify(enGet.data?.verses[0]));
      check('translation: a heading for English is a 400', (await call('PUT', `${admin}/items/${t1.id}/translations/en`, { token: manager, body: { header: { title: 'x' } } })).status === 400);
      check('translation: a summary with no title is a 400', (await call('PUT', `${admin}/items/${t1.id}/translations/mr`, { token: manager, body: { header: { title: '', summary: 'मराठी सार' } } })).status === 400);
      check('translation: a text for a language in the prayer’s own script is a 400', (await call('PUT', `${admin}/items/${t1.id}/translations/hi`, { token: manager, body: { verses: [{ verseId: t1.verses[0].id, text: 'क' }] } })).status === 400);
      check('translation: an English meaning is a 400', (await call('PUT', `${admin}/items/${t1.id}/translations/en`, { token: manager, body: { verses: [{ verseId: t1.verses[0].id, meaning: 'x' }] } })).status === 400);
      check('translation: a verse of another prayer is a 400', (await call('PUT', `${admin}/items/${t1.id}/translations/mr`, { token: manager, body: { verses: [{ verseId: t3.verses[0].id, meaning: 'मराठी अर्थ' }] } })).status === 400);
      check('translation: an unknown language is a 400', (await call('PUT', `${admin}/items/${t1.id}/translations/xx`, { token: manager, body: { verses: [] } })).status === 400);
      check('translation: an unknown prayer is a 404', (await call('PUT', `${admin}/items/nope/translations/mr`, { token: manager, body: { verses: [] } })).status === 404);

      const mrPut = await call('PUT', `${admin}/items/${t3.id}/translations/mr`, { token: manager, body: { header: { title: 'मराठी शीर्षक' }, verses: [{ verseId: t3.verses[0].id, meaning: 'मराठी अर्थ' }] } });
      check('translation: a heading alone, and a meaning alone, are saved', mrPut.status === 200 && mrPut.data.header.title === 'मराठी शीर्षक' && mrPut.data.header.summary === null);
      const cleared = await call('PUT', `${admin}/items/${t3.id}/translations/mr`, { token: manager, body: { header: { title: '' }, verses: [{ verseId: t3.verses[0].id, meaning: '' }] } });
      check('translation: a blank heading and a blank meaning clear what was there, so a run can fill it again', cleared.status === 200 && cleared.data.header === null && cleared.data.verses[0].meaning === null && !(await headerRow(t3.id, 'mr')) && !(await verseRow(t3.verses[0].id, 'mr')));
      check('translation: deleting a language removes all of it', (await call('DELETE', `${admin}/items/${t1.id}/translations/te`, { token: manager })).status === 200 && !(await verseRow(t1.verses[0].id, 'te')));
      check('translation: deleting it twice is a 404', (await call('DELETE', `${admin}/items/${t1.id}/translations/te`, { token: manager })).status === 404);

      section('The app API');
      const list = await call('GET', '/api/app/prayers', { token: reader });
      const ids = list.data?.items.map((i) => i.id) ?? [];
      check('list: published prayers only, with the categories that have any', list.status === 200 && [t1, t2, t3, a].every((p) => ids.includes(p.id)) && !ids.includes(draft.id) && !ids.includes(second.data.id), `${ids.length}`);
      check('list: the category counts are right and unused ones are left out', list.data.categories.find((c) => c.id === 'aarti')?.count >= 1 && list.data.categories.every((c) => c.count > 0));
      check('list: in the order of the categories', ids.indexOf(t1.id) < ids.indexOf(t3.id));
      check('list: a verse count and no verses', list.data.items.find((i) => i.id === t1.id).verseCount === 2 && list.data.items.every((i) => i.verses === undefined));
      check('list: the title in English by default', list.data.items.find((i) => i.id === t1.id).title === t1.title);
      const inHindi = await call('GET', '/api/app/prayers?languages=hi', { token: reader });
      check('list: the reading language chooses the words', inHindi.data.items.find((i) => i.id === t1.id).title === 'हिंदी शीर्षक' && inHindi.data.items.find((i) => i.id === t1.id).summary === 'हिंदी सार');
      check('list: signed out is refused', (await call('GET', '/api/app/prayers')).status === 403);

      const full = await call('GET', `/api/app/prayers/${t1.id}?languages=hi`, { token: reader });
      check('prayer: the heading, about text and meanings in the reading language', full.status === 200 && full.data.title === 'हिंदी शीर्षक' && full.data.about === 'हिंदी विवरण' && full.data.verses[0].meaning === 'हिंदी अर्थ', JSON.stringify(full.data?.verses[0]?.meaning));
      check('prayer: and the second verse’s meaning, which no editor wrote, in English', full.data.verses[1].meaning === V2.meaning);
      check('prayer: the verses in the original script, in order', full.data.verses.map((v) => v.text).join('|') === `${V1.text}|${V2.text}` && full.data.sourceLanguage === 'sa');
      const original = full.data.scripts[0];
      check('prayer: the original script is offered first, for sa, hi and mr', original.kind === 'original' && ['sa', 'hi', 'mr'].every((c) => original.languages.includes(c)) && original.languages.length === 3, JSON.stringify(original));
      check('prayer: a rule language is offered, and one written out is offered only when complete', full.data.scripts.some((s) => s.code === 'te' && s.kind === 'rule') && full.data.scripts.some((s) => s.code === 'en' && s.kind === 'stored'));
      check('prayer: each verse carries the renderings stored for it', full.data.verses[0].renderings.en === `${LINE.en}\n${LINE.en}` && full.data.verses[0].renderings.hi === undefined);
      const fallback = await call('GET', `/api/app/prayers/${t1.id}?languages=ml`, { token: reader });
      check('prayer: a language with nothing written falls back to English', fallback.data.title === t1.title && fallback.data.verses[0].meaning === V1.meaning);
      check('prayer: a draft is a 404, whoever asks', (await call('GET', `/api/app/prayers/${draft.id}`, { token: reader })).status === 404);
      check('prayer: a missing id is a 404', (await call('GET', '/api/app/prayers/nope', { token: reader })).status === 404);
      check('prayer: signed out is refused', (await call('GET', `/api/app/prayers/${t1.id}`)).status === 403);

      section('Translation runs through the API');
      const est = await call('GET', `${admin}/estimate?language=gu`, { token: translator });
      const wouldDo = await service.prayersToTranslate('gu');
      check('estimate: counts the prayers to do and their requests', est.status === 200 && est.data.willTranslate === wouldDo.length && est.data.requests >= est.data.willTranslate && est.data.inputTokens > 0 && est.data.byPiece.headers === wouldDo.length, JSON.stringify(est.data));
      check('estimate: an unknown language is a 400', (await call('GET', `${admin}/estimate?language=xx`, { token: translator })).status === 400);
      check('a manager without the translate permission cannot estimate or start a run', (await call('GET', `${admin}/estimate?language=gu`, { token: manager })).status === 403 && (await call('POST', `${admin}/runs`, { token: manager, body: { language: 'gu' } })).status === 403);
      const started = await call('POST', `${admin}/runs`, { token: translator, body: { language: 'gu' } });
      if (started.data?.id) made.runs.push(started.data.id);
      check('starting queues a run for the default provider and its model', started.status === 201 && started.data.status === 'QUEUED' && started.data.provider === PROVIDER && started.data.language === 'gu' && started.data.languageName === 'Gujarati', JSON.stringify(started.data));
      check('a second run into the same language is refused', (await call('POST', `${admin}/runs`, { token: translator, body: { language: 'gu' } })).status === 409);
      const other = await call('POST', `${admin}/runs`, { token: translator, body: { language: 'bn' } });
      if (other.data?.id) made.runs.push(other.data.id);
      check('but another language is queued behind it', other.status === 201 && other.data.status === 'QUEUED');
      const got = await call('GET', `${admin}/runs/${started.data.id}`, { token: translator });
      check('the run and its feed can be read', got.status === 200 && got.data.run.id === started.data.id && got.data.feed.some((l) => /Queued by/.test(l.text)), JSON.stringify(got.data?.feed?.[0]));
      check('Resume refuses a run that is waiting', (await call('POST', `${admin}/runs/${started.data.id}/resume`, { token: translator })).status === 409);
      const startedJobId = (await fresh(started.data)).jobId;
      check('the run names the job that may work it, and the job is on the queue', Boolean(startedJobId) && Boolean(await queue.getJob(startedJobId)), `${startedJobId}`);
      const cancelled = await call('POST', `${admin}/runs/${started.data.id}/cancel`, { token: translator });
      check('Cancel on a waiting run ends it at once', cancelled.status === 200 && cancelled.data.status === 'CANCELLED');
      check('and the job is gone from the queue', !(await queue.getJob(startedJobId)));
      check('Cancel twice is a 409', (await call('POST', `${admin}/runs/${started.data.id}/cancel`, { token: translator })).status === 409);
      const listedRuns = await call('GET', `${admin}/runs?status=CANCELLED&language=gu`, { token: translator });
      check('the list shows it', listedRuns.status === 200 && listedRuns.data.some((r) => r.id === started.data.id));
      check('a manager without the translate permission cannot read runs', (await call('GET', `${admin}/runs`, { token: manager })).status === 403);
      check('a run that does not exist is a 404', (await call('GET', `${admin}/runs/nope`, { token: translator })).status === 404 && (await call('POST', `${admin}/runs/nope/resume`, { token: translator })).status === 404);

      const failedRun = await prisma.prayerRun.update({ where: { id: other.data.id }, data: { status: 'FAILED', stopReason: 'error', statusMessage: 'E2E failure', finishedAt: new Date() } });
      const resumed = await call('POST', `${admin}/runs/${failedRun.id}/resume`, { token: translator });
      check('Resume puts a failed run back on the queue', resumed.status === 200 && resumed.data.status === 'QUEUED' && Boolean((await fresh(failedRun)).jobId) && Boolean(await queue.getJob((await fresh(failedRun)).jobId)));
      await call('POST', `${admin}/runs/${failedRun.id}/cancel`, { token: translator });
    }
  } finally {
    mock.timers.reset();
    cfg.heartbeatMs = saved.heartbeatMs;
    cfg.sliceVerses = saved.sliceVerses;
    api?.kill('SIGTERM');

    // Runs this script made, and the ones started through the API (those carry the admin's name, not "e2e").
    const runRows = await prisma.prayerRun.findMany({ where: { OR: [{ id: { in: made.runs } }, { requestedByName: 'e2e' }, { model: MODEL }, { requestedById: { in: made.users } }] }, select: { id: true, jobId: true } }).catch(() => []);
    for (const row of runRows) {
      if (row.jobId) await queue.getJob(row.jobId).then((job) => job?.remove()).catch(() => {});
      await redis.del(`${cfg.feedKey}:${row.id}`).catch(() => {});
    }
    const runIds = runRows.map((r) => r.id);
    const rows = await prisma.prayer.findMany({ where: { slug: { startsWith: P } }, select: { id: true, translations: { select: { id: true } } } }).catch(() => []);
    const prayerIds = [...made.items, ...rows.map((r) => r.id)];
    const translationIds = rows.flatMap((r) => r.translations.map((t) => t.id));
    // By who did it as well as by what it touched: deleting the users below would blank the actor on their rows.
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: made.users } }, { entityId: { in: [...runIds, ...prayerIds, ...translationIds] } }] } }).catch(() => {});
    await prisma.prayerRun.deleteMany({ where: { id: { in: runIds } } }).catch(() => {});
    await prisma.prayer.deleteMany({ where: { slug: { startsWith: P } } }).catch(() => {});
    await prisma.device.deleteMany({ where: { OR: [{ deviceId: DEVICE }, { userId: { in: made.users } }] } }).catch(() => {});
    await prisma.deviceSession?.deleteMany?.({ where: { userId: { in: made.users } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: made.users } } }).catch(() => {});
    await prisma.role.deleteMany({ where: { id: { in: made.roles } } }).catch(() => {});
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
  mock.timers.reset();
  process.exit(1);
});
