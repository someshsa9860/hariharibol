// Walks devotee etiquette end to end: the daily push (the real `deliver()` job, with the clock set to the moments that
// matter), the translation run (the worker's processor, in this process), and the admin and app APIs (a copy started
// on its own port). Run it with Postgres and Redis up, the migration applied and the etiquette seeded:
//
//   FIREBASE_PROJECT_ID= FIREBASE_CLIENT_EMAIL= FIREBASE_PRIVATE_KEY= GOOGLE_SERVICE_ACCOUNT_PATH= \
//   AWS_ACCESS_KEY_ID= AWS_SECRET_ACCESS_KEY= npm run test:etiquette
//
// Nothing here reaches a model provider, a phone or S3. The "model" is a stub; Firebase is blanked on the command line
// (the script refuses to run with it set, because a push to a made-up token would be a real call, and because the
// delivery job looks at every reader in the database); the API copy is given a key that is not real. The script
// refuses to run while a worker is connected to the etiquette queue, because that worker would pick up the runs it
// makes, and while the database has any other reader who could be pushed.
//
// What it checks is the part that fails quietly:
//   * a reader is pushed at 07:15 on their own clock, wherever they are, once, and the item is the day's — the same for
//     everyone on that date and different the next day;
//   * a banned reader, one with no push token, and the developer's companion app are never pushed;
//   * an item put back to draft or excluded after it got its day is not the one sent, and one that is excluded is
//     never picked, however early it sorts;
//   * the push speaks in the reader's reading language, and in English where there is no translation;
//   * a translation run saves what passed, counts its tokens on the row and in the token calculator, and survives every
//     way it can stop (credit gone, a refused key, the provider busy, answers that fail our checks, Cancel) and ends in
//     the state the page tells the admin; Resume carries on at the first item with no translation; a translation an
//     editor wrote is not replaced; an excluded or draft item is not translated;
//   * the API gives only the right people the pages, and the app is only ever served published items.
//
// Everything it makes is deleted again (items, readers, roles, runs, days, notifications, the tokens it counted).

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { mock } from 'node:test';

import { DelayedError } from 'bullmq';

import { prisma } from '../config/database.js';
import { redis, publisher } from '../config/redis.js';
import { etiquette } from '../config/etiquette.js';
import { SETTING_KEYS, ETIQUETTE_DEFAULT_DELIVERY_TIME } from '../config/constants.js';
import env from '../config/env.js';
import * as authService from '../services/auth.js';
import * as firebase from '../services/firebase.js';
import * as service from '../services/etiquette.js';
import { etiquetteItems, seedEtiquette } from '../prisma/seed/etiquette/index.js';
import * as settings from '../services/setting.js';
import * as tally from '../services/ai/token-tally.js';
import { queues } from '../jobs/index.js';
import deliver from '../jobs/processors/etiquette-deliver.js';
import { processRun, realDeps } from '../jobs/processors/etiquette.js';
import { parseTimeOfDay } from '../utils/sloka-delivery.js';
import { SYSTEM_PROMPT } from '../utils/etiquette.js';
import { toDateColumn, localDateString } from '../utils/date.js';
import { FatalApiError } from './lib/claude-translate-client.js';
import { providerOf } from './lib/translate-providers.js';

const PORT = 4500 + (Date.now() % 90);
const BASE = `http://localhost:${PORT}`;
const DEVICE = 'etiquette-e2e-device';
const STAMP = Date.now();
const P = `e2e-${STAMP}`; // every item this script makes starts its slug with this
const MODEL = `e2e-model-${STAMP}`;
const PROVIDER = service.defaultProvider();
const KEY_ENV = providerOf(PROVIDER).keyEnv;
const queue = queues.etiquette;

// Dates far from any real one, so the days this makes never meet a real day. No daylight saving moves on them in the
// zones used below (New York is on summer time, UTC−4).
const D1 = '2031-06-12';
const D2 = '2031-06-13';
const D3 = '2031-06-14';
const DAYS = [D1, D2, D3];

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}
const section = (title) => console.log(`\n${title}`);

const made = { users: [], roles: [], runs: [], items: [] };

/* ---------- items ---------- */

async function makeItem(key, extra = {}) {
  const row = await prisma.etiquette.create({
    data: {
      slug: `${P}-${key}`, category: 'temple', sortOrder: 0,
      title: `E2E ${key} title`, summary: `E2E ${key} summary, one plain sentence.`, body: `E2E ${key} body. A few plain sentences follow.`,
      status: 'PUBLISHED', ...extra,
    },
  });
  made.items.push(row.id);
  return row;
}
const itemRow = (id) => prisma.etiquette.findUnique({ where: { id } });

/* ---------- readers ---------- */

async function makeUser(label, { timezone = 'Asia/Kolkata', readingLanguage = 'en', isBanned = false, device = 'main', token = true } = {}) {
  const role = await prisma.role.findUnique({ where: { slug: 'user' } });
  const user = await prisma.user.create({
    data: {
      email: `${P}-${label}@example.test`, name: `Asha ${label}`, roleId: role.id, authProvider: 'GOOGLE', providerUserId: `${P}-${label}`,
      timezone, readingLanguage, appLanguage: readingLanguage, isBanned,
    },
  });
  made.users.push(user.id);
  if (device) {
    await prisma.device.create({ data: { deviceId: `${P}-${label}`, platform: 'android', app: device, userId: user.id, fcmToken: token ? 'e2e-not-a-token' : null } });
  }
  return user;
}

const pushes = (user) => prisma.notification.findMany({ where: { userId: user.id, type: 'ETIQUETTE' }, orderBy: { createdAt: 'asc' } });
const deliveries = (user) => prisma.etiquetteDelivery.findMany({ where: { userId: user.id }, orderBy: { date: 'asc' } });
const dayOf = (date) => prisma.etiquetteDay.findUnique({ where: { date: toDateColumn(date) } });

/* ---------- a stand-in for the model ---------- */

/** Answers in Devanagari for every item it finds in the request. `script(ctx)` may throw or wait first; `shape` may change the answer. */
function fakeModel(script = async () => {}, shape = (data) => data) {
  const asked = [];
  const makeAsk = (options) => async (request) => {
    const items = request.user.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
    asked.push({ slugs: items.map((i) => i.slug), user: request.user, system: request.system, model: options.model, provider: options.provider });
    await script({ nth: asked.length, items });
    return {
      data: shape({ items: items.map((it, i) => ({ slug: it.slug, title: `हिंदी शीर्षक ${i + 1}`, summary: `हिंदी सार ${i + 1}`, body: `हिंदी विवरण ${i + 1}` })) }, { items }),
      usage: { inputTokens: 1000, outputTokens: 400, cacheReadTokens: 0, cacheWriteTokens: 0 },
      costUsd: 0,
      stopReason: 'STOP',
    };
  };
  return { makeAsk, asked };
}

let jobCount = 0;
// A run only ever sees the items this script made for it, so what it asks for does not depend on what else is in the database.
const deps = (model) => ({
  ...realDeps,
  apiKey: () => 'e2e-not-a-real-key',
  makeAsk: model.makeAsk,
  itemsForRun: async (run) => (await realDeps.itemsForRun(run)).filter((i) => i.slug.startsWith(`${P}-t`)),
});

async function newRun(extra = {}) {
  const jobId = `e2e-${STAMP}-${(jobCount += 1)}`;
  const row = await prisma.etiquetteRun.create({
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
const fresh = (row) => prisma.etiquetteRun.findUnique({ where: { id: row.id } });
const clearTranslations = () => prisma.etiquetteTranslation.deleteMany({ where: { languageCode: 'hi', etiquette: { slug: { startsWith: `${P}-t` } } } });
const translated = async (slugs) => (await prisma.etiquetteTranslation.findMany({ where: { languageCode: 'hi', etiquette: { slug: { in: slugs } } }, include: { etiquette: { select: { slug: true } } } })).map((t) => t.etiquette.slug).sort();

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
    console.error('\nFirebase is configured, so a push would be a real call. Blank FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY and GOOGLE_SERVICE_ACCOUNT_PATH — see the top of this file.\n');
    process.exit(1);
  }
  if (env.AWS_ACCESS_KEY_ID || env.AWS_SECRET_ACCESS_KEY) {
    console.error('\nAWS keys are set. Blank AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY — see the top of this file.\n');
    process.exit(1);
  }
  if ((await queue.getWorkers()).length) {
    console.error('\nA worker is connected to the etiquette queue. Stop it first — it would work the runs this script makes.\n');
    process.exit(1);
  }
  const busy = await prisma.etiquetteRun.count({ where: { status: { in: ['QUEUED', 'RUNNING', 'PAUSED'] } } });
  if (busy) {
    console.error(`\n${busy} etiquette run(s) are active in this database. Finish or cancel them first.\n`);
    process.exit(1);
  }
  const pushable = await prisma.user.count({ where: { isBanned: false, devices: { some: { app: 'main', fcmToken: { not: null }, isBanned: false } } } });
  if (pushable) {
    console.error(`\n${pushable} reader(s) in this database could be pushed. The delivery job looks at everyone, so this walks a scratch database only.\n`);
    process.exit(1);
  }
  const target = parseTimeOfDay(await settings.get(SETTING_KEYS.ETIQUETTE_DELIVERY_TIME)) ?? parseTimeOfDay(ETIQUETTE_DEFAULT_DELIVERY_TIME);
  if (target !== 435) {
    console.error('\nThis walks the default delivery time, 07:15; the database has another. Set it back or edit the times below.\n');
    process.exit(1);
  }
  const seeded = await prisma.etiquette.count({ where: { status: 'PUBLISHED', slug: { not: { startsWith: P } } } });
  if (seeded < 2) {
    console.error('\nThe database has no seeded etiquette. Run `npm run seed:etiquette` first.\n');
    process.exit(1);
  }

  const saved = { heartbeatMs: etiquette.heartbeatMs, batchSize: etiquette.batchSize };
  etiquette.heartbeatMs = 100;
  let api = null;
  const apiLog = [];
  const todayKolkata = localDateString('Asia/Kolkata');
  const hadToday = Boolean(await dayOf(todayKolkata));

  try {
    /* ---------- the daily push ---------- */

    // Sort orders below every seeded item (they start at 0): the three published ones are the first three days, in order.
    const first = await makeItem('first', { sortOrder: -50, author: 'E2E First Author' });
    const second = await makeItem('second', { sortOrder: -49 });
    const third = await makeItem('third', { sortOrder: -48 });
    const excluded = await makeItem('excluded', { sortOrder: -60, status: 'EXCLUDED', excludedReason: 'E2E: speaks ill of a deity' });
    const draft = await makeItem('draft', { sortOrder: -61, status: 'DRAFT' });
    await prisma.etiquetteTranslation.create({ data: { etiquetteId: first.id, languageCode: 'hi', title: 'हिंदी शीर्षक पहला', summary: 'हिंदी सार पहला', body: 'हिंदी विवरण पहला', translatedBy: 'admin', isPublished: true } });

    const kolkata = await makeUser('kolkata', { timezone: 'Asia/Kolkata' }); //           +5:30
    const hindi = await makeUser('hindi', { timezone: 'Asia/Kolkata', readingLanguage: 'hi' });
    const kiritimati = await makeUser('kiritimati', { timezone: 'Pacific/Kiritimati' }); // +14, the furthest ahead there is
    const newYork = await makeUser('new-york', { timezone: 'America/New_York' }); //       −4 in June
    const banned = await makeUser('banned', { isBanned: true });
    const tokenless = await makeUser('tokenless', { token: false });
    const companion = await makeUser('companion', { device: 'dev' }); // the developer's app, not the reader's
    const nobody = await makeUser('no-device', { device: null });
    const everyone = [kolkata, hindi, kiritimati, newYork, banned, tokenless, companion, nobody];

    section('The day’s etiquette is chosen once, for the date, and never an item that is not published');
    {
      const day1 = await service.dayFor(D1);
      check('the first date gets the first published item in order', day1?.etiquetteId === first.id, `${day1?.etiquette.slug}`);
      check('and asking again gives the same one', (await service.dayFor(D1)).etiquetteId === first.id);
      const day2 = await service.dayFor(D2);
      check('the next date gets the next item, not a repeat', day2?.etiquetteId === second.id, `${day2?.etiquette.slug}`);
      check('an excluded item is never picked, though it sorts before all the rest', ![day1.etiquetteId, day2.etiquetteId].includes(excluded.id));
      check('nor is a draft', ![day1.etiquetteId, day2.etiquetteId].includes(draft.id));
      await prisma.etiquetteDay.deleteMany({ where: { date: { in: [toDateColumn(D1), toDateColumn(D2)] } } });
    }

    section('The push goes out at 07:15 on each reader’s own clock, once');
    mock.timers.enable({ apis: ['Date'], now: new Date('2031-06-11T00:00:00Z').getTime() });
    try {
      const runAt = async (iso) => {
        mock.timers.setTime(new Date(iso).getTime());
        return deliver();
      };

      let r = await runAt('2031-06-11T17:00:00Z'); // 07:00 in Kiritimati
      check('nobody is sent a quarter hour early', r.sent === 0, `sent ${r.sent}`);

      r = await runAt('2031-06-11T17:15:00Z'); // 07:15 on the 12th in Kiritimati, while UTC is still on the 11th
      check('Kiritimati, a day ahead of UTC, is sent at 07:15', r.sent === 1 && (await pushes(kiritimati)).length === 1, `sent ${r.sent}`);
      check('and no one else is sent in that run', (await pushes(kolkata)).length + (await pushes(newYork)).length === 0);
      r = await runAt('2031-06-11T17:15:00Z');
      check('the same run again sends nothing more', r.sent === 0 && (await pushes(kiritimati)).length === 1);

      r = await runAt('2031-06-12T01:45:00Z'); // 07:15 in Kolkata
      check('Kolkata is sent at 07:15 its own time, while UTC is still early', r.sent === 2 && (await pushes(kolkata)).length === 1 && (await pushes(hindi)).length === 1, `sent ${r.sent}`);
      check('a banned reader, one with no push token, the developer’s app and a reader with no device are not sent',
        (await Promise.all([banned, tokenless, companion, nobody].map(pushes))).every((list) => list.length === 0));
      await runAt('2031-06-12T01:55:00Z'); // still inside the quarter hour
      await runAt('2031-06-12T02:00:00Z');
      check('Kolkata is not sent a second time', (await pushes(kolkata)).length === 1 && (await deliveries(kolkata)).length === 1);

      r = await runAt('2031-06-12T11:15:00Z'); // 07:15 in New York
      check('New York is sent at 07:15 its own time', r.sent === 1 && (await pushes(newYork)).length === 1, `sent ${r.sent}`);

      const day1 = await dayOf(D1);
      check('everyone on the 12th got the one item chosen for that date', day1.etiquetteId === first.id && (await Promise.all([kiritimati, kolkata, hindi, newYork].map(deliveries))).every((d) => d.length === 1 && d[0].etiquetteId === first.id));

      const sent = (await pushes(kolkata))[0];
      check('the push is typed, titled and carries the item', sent.type === 'ETIQUETTE' && /Devotee etiquette/.test(sent.title) && sent.title.includes('Asha') && sent.body.startsWith(first.title) && sent.body.includes(first.summary), `${sent.title} | ${sent.body}`);
      check('and opens the app on it', sent.data?.deeplink === `hariharibol://etiquette/${first.id}` && sent.data?.etiquetteId === first.id && sent.data?.category === 'temple', JSON.stringify(sent.data));
      const hi = (await pushes(hindi))[0];
      check('a Hindi reader gets the Hindi title and words', hi.title.includes('भक्त शिष्टाचार') && hi.body.startsWith('हिंदी शीर्षक पहला') && hi.body.includes('हिंदी सार पहला'), `${hi.title} | ${hi.body}`);

      r = await runAt('2031-06-12T17:15:00Z'); // 07:15 on the 13th in Kiritimati
      const kiri2 = await deliveries(kiritimati);
      check('the next day brings the next item', r.sent === 1 && kiri2.length === 2 && kiri2[1].etiquetteId === second.id, `sent ${r.sent}`);
      r = await runAt('2031-06-13T01:45:00Z');
      const kol2 = await deliveries(kolkata);
      check('Kolkata is sent the same item for the 13th, a few hours later', r.sent === 2 && kol2.length === 2 && kol2[1].etiquetteId === second.id);
      const hi2 = (await pushes(hindi))[1];
      check('a Hindi reader gets English where the item has no translation yet', hi2.title.includes('भक्त शिष्टाचार') && hi2.body.startsWith(second.title), hi2.body);

      // The item chosen for the 14th is excluded before anyone is sent it.
      check('the 14th is given the third item', (await service.dayFor(D3)).etiquetteId === third.id);
      await prisma.etiquette.update({ where: { id: third.id }, data: { status: 'EXCLUDED', excludedReason: 'E2E: excluded after it was chosen' } });
      r = await runAt('2031-06-14T01:45:00Z');
      const kol3 = await deliveries(kolkata);
      const day3 = await dayOf(D3);
      const chosen = await itemRow(day3.etiquetteId);
      check('an item excluded after it was chosen is not sent; the day gets another', r.sent === 2 && kol3.length === 3 && kol3[2].etiquetteId !== third.id && chosen.status === 'PUBLISHED' && day3.etiquetteId === kol3[2].etiquetteId, `${chosen.slug} ${chosen.status}`);
      check('and its words are not in the push', !(await pushes(kolkata))[2].body.includes(third.title));
      await prisma.etiquette.update({ where: { id: third.id }, data: { status: 'DRAFT' } });
      await prisma.etiquetteDay.update({ where: { date: toDateColumn(D3) }, data: { etiquetteId: third.id } });
      const reread = await service.dayFor(D3);
      check('likewise for a draft', reread.etiquetteId !== third.id && reread.etiquette.status === 'PUBLISHED');

      r = await runAt('2031-06-14T02:00:00Z');
      check('the run after is quiet', r.sent === 0);
    } finally {
      mock.timers.reset();
    }

    /* ---------- the translation run ---------- */

    const t1 = await makeItem('t1', { category: 'daily-life', sortOrder: 90001 });
    const t2 = await makeItem('t2', { category: 'daily-life', sortOrder: 90002 });
    const t3 = await makeItem('t3', { category: 'daily-life', sortOrder: 90003 });
    const tx = await makeItem('tx', { category: 'daily-life', sortOrder: 90004, status: 'EXCLUDED', excludedReason: 'E2E: excluded' });
    const td = await makeItem('td', { category: 'daily-life', sortOrder: 90005, status: 'DRAFT' });
    const slugs = [t1.slug, t2.slug, t3.slug];

    section('A run that translates');
    {
      const model = fakeModel();
      const row = await newRun();
      const result = await work(row, model);
      const after = await fresh(row);
      check('it completes', result.completed === true && after.status === 'COMPLETED' && after.stopReason === 'finished', JSON.stringify(result));
      check('every published item was done, in one request', after.totalItems === 3 && after.doneItems === 3 && model.asked.length === 1, `${after.doneItems}/${after.totalItems}, ${model.asked.length} request(s)`);
      check('an excluded item and a draft are not translated or even sent to the model', model.asked[0].slugs.join() === slugs.join() && (await translated([tx.slug, td.slug])).length === 0, model.asked[0].slugs.join());
      check('asked of the run’s provider and model, with the system prompt', model.asked[0].provider === PROVIDER && model.asked[0].model === MODEL && model.asked[0].system === SYSTEM_PROMPT);
      check('the three are saved in Hindi, published, marked with who made them', (await translated(slugs)).join() === [...slugs].sort().join());
      const rows = await prisma.etiquetteTranslation.findMany({ where: { languageCode: 'hi', etiquetteId: t1.id } });
      check('with the run that wrote them', rows[0].isPublished === true && rows[0].isEdited === false && rows[0].runId === row.id && Boolean(rows[0].translatedBy) && rows[0].title.startsWith('हिंदी'), JSON.stringify(rows[0]));
      check('tokens are on the row', after.inputTokens === 1000 && after.outputTokens === 400 && after.calls === 1, `${after.inputTokens}/${after.outputTokens}/${after.calls}`);
      const day = await counted();
      check('and in the token calculator under the provider and model', day.inputTokens === 1000 && day.outputTokens === 400 && day.calls === 1, JSON.stringify(day));
      check('the feed has a line for the batch', (await service.readFeed(row.id)).some((l) => l.level === 'success' && l.text.includes(t1.slug)));
    }

    section('Items already translated');
    {
      const none = fakeModel();
      const row = await newRun();
      const result = await work(row, none);
      check('are not asked for again: the run finishes at once without a request', result.completed === true && none.asked.length === 0 && (await fresh(row)).totalItems === 0);

      await prisma.etiquetteTranslation.update({ where: { etiquetteId_languageCode: { etiquetteId: t2.id, languageCode: 'hi' } }, data: { title: 'मेरा शीर्षक', isEdited: true, translatedBy: 'admin' } });
      const again = fakeModel();
      const forced = await newRun({ force: true });
      await work(forced, again);
      check('unless asked to translate again on purpose', again.asked.length === 1 && again.asked[0].slugs.join() === [t1.slug, t3.slug].join(), again.asked[0]?.slugs.join());
      const kept = await prisma.etiquetteTranslation.findUnique({ where: { etiquetteId_languageCode: { etiquetteId: t2.id, languageCode: 'hi' } } });
      check('and a translation an editor wrote is neither asked for nor replaced', kept.title === 'मेरा शीर्षक' && kept.isEdited && kept.translatedBy === 'admin');
      check('the others were rewritten by the new run', (await prisma.etiquetteTranslation.findUnique({ where: { etiquetteId_languageCode: { etiquetteId: t1.id, languageCode: 'hi' } } })).runId === forced.id);
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
      const run = (extra) => newRun(extra);
      const stop = async (row) => prisma.etiquetteRun.update({ where: { id: row.id }, data: { status: 'CANCELLED' } });

      await clearTranslations();
      let row = await run();
      await work(row, fakeModel(async () => { throw Object.assign(new FatalApiError('API key not valid', 401), { provider: PROVIDER }); }));
      let after = await fresh(row);
      check('a refused key pauses it until a person fixes it and names the setting', after.status === 'PAUSED' && after.pauseReason === 'auth' && after.resumeAt === null && after.statusMessage.includes(KEY_ENV), `${after.pauseReason}: ${after.statusMessage}`);

      row = await run();
      let result = await work(row, fakeModel(async () => { throw Object.assign(new Error('rate limited'), { status: 429, provider: PROVIDER }); }));
      after = await fresh(row);
      check('a provider’s limit pauses it and it tries again by itself', result.delayed === true && after.status === 'PAUSED' && after.pauseReason === 'rate_limit' && after.resumeAt && after.retriesInARow === 1, `${after.pauseReason} ${after.resumeAt}`);
      await stop(row); // a run paused to retry by itself holds its place in the queue; this one is done with

      row = await run();
      await work(row, fakeModel(async () => { throw Object.assign(new FatalApiError('spend limit reached, billing', 402), { provider: PROVIDER }); }));
      after = await fresh(row);
      check('no credit pauses it for a person', after.status === 'PAUSED' && after.pauseReason === 'credit' && !after.resumeAt);

      // Resume carries on at the first item with no translation: one item to a request, the second request is refused.
      await clearTranslations();
      etiquette.batchSize = 1;
      row = await run();
      const broke = fakeModel(async ({ nth }) => { if (nth === 2) throw Object.assign(new FatalApiError('spend limit reached, billing', 402), { provider: PROVIDER }); });
      await work(row, broke);
      after = await fresh(row);
      check('the item done before the credit ran out is kept', after.status === 'PAUSED' && after.pauseReason === 'credit' && after.doneItems === 1 && (await translated(slugs)).join() === [t1.slug].join(), `${after.doneItems} ${(await translated(slugs)).join()}`);
      await prisma.etiquetteRun.update({ where: { id: row.id }, data: { status: 'QUEUED', pauseReason: null, statusMessage: 'Resumed. Waiting for the worker.', stopReason: null, resumeAt: null, retriesInARow: 0 } });
      const rest = fakeModel();
      result = await work(row, rest);
      after = await fresh(row);
      check('and Resume asks only for the rest, then completes', result.completed === true && rest.asked.map((a) => a.slugs.join()).join('|') === `${t2.slug}|${t3.slug}` && after.status === 'COMPLETED' && after.doneItems === 3 && after.totalItems === 3 && after.attempts === 2, `${rest.asked.map((a) => a.slugs.join())} ${after.doneItems}/${after.totalItems} attempts ${after.attempts}`);
      etiquette.batchSize = saved.batchSize;

      await clearTranslations();
      row = await run();
      const bad = fakeModel(async () => {}, (data) => ({ items: data.items.filter((i) => i.slug !== t3.slug) }));
      await work(row, bad);
      after = await fresh(row);
      check('an answer that leaves an item out is asked for again, then the run fails on it', after.status === 'FAILED' && after.stopReason === 'error' && bad.asked.length === etiquette.invalidTries && after.statusMessage.includes(t3.slug), `${bad.asked.length} ${after.statusMessage}`);
      check('the second request names the problem and asks only for what is left', /Your last answer had these problems/.test(bad.asked[1].user) && bad.asked[1].slugs.join() === t3.slug);
      check('what passed is kept, and what the failed asks cost is counted', (await translated(slugs)).join() === [t1.slug, t2.slug].sort().join() && after.doneItems === 2 && after.calls === etiquette.invalidTries);

      await clearTranslations();
      row = await run();
      const english = fakeModel(async () => {}, (data) => ({ items: data.items.map((i) => ({ ...i, title: 'Offer with care', summary: 'Offer with care.', body: 'Offer everything with care and love.' })) }));
      await work(row, english);
      after = await fresh(row);
      check('an answer left in English is not saved, and fails the run', after.status === 'FAILED' && (await translated(slugs)).length === 0 && /not written in Hindi/.test(after.statusMessage), after.statusMessage);

      await clearTranslations();
      row = await run();
      const cancelModel = fakeModel(async ({ nth }) => { if (nth === 1) await prisma.etiquetteRun.update({ where: { id: row.id }, data: { cancelRequested: true } }); await sleep(600); });
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
      await prisma.etiquetteRun.updateMany({ where: { id: { in: made.runs }, status: { in: ['QUEUED', 'PAUSED'] } }, data: { status: 'CANCELLED' } });
    }

    section('The seed fills in a missing author on an edited row, leaving its other edits alone');
    {
      const seedItem = etiquetteItems[0];
      const before = await prisma.etiquette.findUnique({ where: { slug: seedItem.slug } });
      await prisma.etiquette.update({ where: { id: before.id }, data: { isEdited: true, author: null, title: `${before.title} (e2e edited)` } });
      await seedEtiquette(prisma);
      const after = await itemRow(before.id);
      check('an edited row with no author is given the seed’s author', after.author === seedItem.author, after.author);
      check('but the title an admin changed is left standing', after.title === `${before.title} (e2e edited)`, after.title);
      await prisma.etiquette.update({ where: { id: before.id }, data: { author: before.author, title: before.title, isEdited: before.isEdited } });
    }

    /* ---------- the APIs ---------- */

    section('The admin API');
    {
      await prisma.etiquetteRun.deleteMany({ where: { id: { in: made.runs } } });
      for (const runId of made.runs) await redis.del(`${etiquette.feedKey}:${runId}`);
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

      const manager = await tokenWith(['etiquette.manage'], 'manager');
      const translator = await tokenWith(['etiquette.manage', 'etiquette.translate'], 'translator');
      const outsider = await tokenWith(['reel.read'], 'outsider');

      check('someone without the permission is refused', (await call('GET', '/api/admin/etiquette/overview', { token: outsider })).status === 403);
      check('and so is someone signed out', (await call('GET', '/api/admin/etiquette/overview')).status === 403);

      const overview = await call('GET', '/api/admin/etiquette/overview', { token: manager });
      const o = overview.data;
      check('overview: counts by status, the nine categories, the 11 languages', overview.status === 200 && o.counts.published >= 90 && o.counts.excluded >= 2 && o.counts.total === o.counts.published + o.counts.draft + o.counts.excluded && o.categories.length === 9 && o.languages.length === 11, JSON.stringify(o?.counts));
      check('overview: 07:15 and the provider’s key, no worker', o.delivery.time === '07:15' && o.translation.defaultProvider === PROVIDER && o.translation.apiKeyConfigured === true && o.translation.workerOnline === false, JSON.stringify(o?.translation));

      const mine = await call('GET', `/api/admin/etiquette/items?q=${P}`, { token: manager });
      check('list: search finds the items this script made, whatever their status', mine.status === 200 && mine.data.length === made.items.length && mine.data.some((i) => i.status === 'EXCLUDED') && mine.data.some((i) => i.status === 'DRAFT'), `${mine.data?.length}/${made.items.length}`);
      const onlyExcluded = await call('GET', '/api/admin/etiquette/items?status=EXCLUDED', { token: manager });
      check('list: the status filter shows the excluded ones, with why', onlyExcluded.status === 200 && onlyExcluded.data.length >= 2 && onlyExcluded.data.every((i) => i.status === 'EXCLUDED' && i.excludedReason));
      check('list: a language filter shows what is not translated yet', (await call('GET', `/api/admin/etiquette/items?q=${P}-t&language=hi&untranslated=true`, { token: manager })).data?.length >= 1);
      check('list: an unknown category is a 400', (await call('GET', '/api/admin/etiquette/items?category=nope', { token: manager })).status === 400);

      const detail = await call('GET', `/api/admin/etiquette/items/${first.id}`, { token: manager });
      check('one item: with its translations and how often it was shown and pushed', detail.status === 200 && detail.data.translations.some((t) => t.language === 'hi' && t.title === 'हिंदी शीर्षक पहला') && detail.data.timesShown === 1 && detail.data.timesPushed >= 4, JSON.stringify({ s: detail.data?.timesShown, p: detail.data?.timesPushed }));
      check('one item: carries its author', detail.data.author === 'E2E First Author', detail.data.author);
      check('one item: a missing id is a 404', (await call('GET', '/api/admin/etiquette/items/nope', { token: manager })).status === 404);

      const body = { category: 'daily-life', title: `E2E ${STAMP} api made`, summary: 'Made from the admin page.', body: 'A few plain sentences, written by an admin.', author: 'E2E Author' };
      const createdItem = await call('POST', '/api/admin/etiquette/items', { token: manager, body });
      if (createdItem.data?.id) made.items.push(createdItem.data.id);
      check('create: a new item is a draft, edited, with a slug from its title', createdItem.status === 201 && createdItem.data.status === 'DRAFT' && createdItem.data.isEdited === true && createdItem.data.slug === `${P}-api-made`, JSON.stringify(createdItem.data?.slug));
      check('create: the author is saved', createdItem.data.author === 'E2E Author', createdItem.data.author);
      check('create: a second with the same title gets another slug', await (async () => {
        const again = await call('POST', '/api/admin/etiquette/items', { token: manager, body });
        if (again.data?.id) made.items.push(again.data.id);
        return again.status === 201 && again.data.slug === `${P}-api-made-2`;
      })());
      check('create: an unknown category is a 400', (await call('POST', '/api/admin/etiquette/items', { token: manager, body: { ...body, category: 'nope' } })).status === 400);
      check('create: excluded needs a reason', (await call('POST', '/api/admin/etiquette/items', { token: manager, body: { ...body, status: 'EXCLUDED' } })).status === 400);

      const id = createdItem.data.id;
      const createdDetail = await call('GET', `/api/admin/etiquette/items/${id}`, { token: manager });
      check('create: and reads back with its author from the admin API', createdDetail.status === 200 && createdDetail.data.author === 'E2E Author', createdDetail.data?.author);
      check('app: a draft is not served', (await call('GET', `/api/app/etiquette/${id}`, { token: await tokenWith([], 'app-reader') })).status === 404);
      const edited = await call('PATCH', `/api/admin/etiquette/items/${id}`, { token: manager, body: { title: `E2E ${STAMP} renamed`, sourceUrl: 'https://example.org/page', author: 'E2E Author, edited' } });
      check('edit: changes the wording and marks it edited', edited.status === 200 && edited.data.title.endsWith('renamed') && edited.data.sourceUrl === 'https://example.org/page' && edited.data.isEdited);
      check('edit: and changes the author too', edited.data.author === 'E2E Author, edited', edited.data.author);
      check('edit: nothing to change is a 400', (await call('PATCH', `/api/admin/etiquette/items/${id}`, { token: manager, body: {} })).status === 400);
      check('edit: a source that is not a link is a 400', (await call('PATCH', `/api/admin/etiquette/items/${id}`, { token: manager, body: { sourceUrl: 'not a link' } })).status === 400);

      check('status: excluding without a reason is a 400', (await call('POST', `/api/admin/etiquette/items/${id}/status`, { token: manager, body: { status: 'EXCLUDED' } })).status === 400);
      const publish = await call('POST', `/api/admin/etiquette/items/${id}/status`, { token: manager, body: { status: 'PUBLISHED' } });
      check('status: publishing', publish.status === 200 && publish.data.status === 'PUBLISHED' && publish.data.excludedReason === null);

      const reader = await tokenWith([], 'app-reader-2');
      const english = await call('GET', `/api/app/etiquette/${id}`, { token: reader });
      check('app: a published item is served with its source', english.status === 200 && english.data.title.endsWith('renamed') && english.data.sourceUrl === 'https://example.org/page' && english.data.language === 'en', JSON.stringify(english.data));
      check('app: and its author', english.data.author === 'E2E Author, edited', english.data.author);
      const exclude = await call('POST', `/api/admin/etiquette/items/${id}/status`, { token: manager, body: { status: 'EXCLUDED', reason: 'E2E: speaks ill of a deity' } });
      check('status: excluding keeps it, with the reason', exclude.status === 200 && exclude.data.status === 'EXCLUDED' && exclude.data.excludedReason === 'E2E: speaks ill of a deity');
      check('app: an excluded item is a 404, whoever asks', (await call('GET', `/api/app/etiquette/${id}`, { token: reader })).status === 404);
      check('and is not in the list', !(await call('GET', '/api/app/etiquette', { token: reader })).data.items.some((i) => i.id === id));
      check('but is still there for an admin, with the reason', (await call('GET', `/api/admin/etiquette/items/${id}`, { token: manager })).data?.excludedReason === 'E2E: speaks ill of a deity');

      const put = await call('PUT', `/api/admin/etiquette/items/${first.id}/translations/mr`, { token: manager, body: { title: 'मराठी शीर्षक', summary: 'मराठी सार', body: 'मराठी विवरण' } });
      check('translation: written by hand, marked edited and as an admin’s', put.status === 200 && put.data.isEdited === true && put.data.translatedBy === 'admin' && put.data.isPublished === true);
      check('translation: a language it is not translated into is a 400', (await call('PUT', `/api/admin/etiquette/items/${first.id}/translations/xx`, { token: manager, body: { title: 'a', summary: 'b', body: 'c' } })).status === 400);
      check('translation: an empty part is a 400', (await call('PUT', `/api/admin/etiquette/items/${first.id}/translations/mr`, { token: manager, body: { title: '', summary: 'b', body: 'c' } })).status === 400);

      const mr = await call('GET', `/api/app/etiquette/${first.id}?languages=mr`, { token: reader });
      check('app: the reading language chooses the words', mr.status === 200 && mr.data.title === 'मराठी शीर्षक' && mr.data.language === 'mr', JSON.stringify(mr.data));
      const fallback = await call('GET', `/api/app/etiquette/${first.id}?languages=ta,en`, { token: reader });
      check('app: a language with no translation falls back to English', fallback.status === 200 && fallback.data.title === first.title && fallback.data.language === 'en');
      check('translation: deleted, so a run can do it again', (await call('DELETE', `/api/admin/etiquette/items/${first.id}/translations/mr`, { token: manager })).status === 200);
      check('translation: deleting it twice is a 404', (await call('DELETE', `/api/admin/etiquette/items/${first.id}/translations/mr`, { token: manager })).status === 404);

      section('The app API');
      const list = await call('GET', '/api/app/etiquette', { token: reader });
      check('list: published items only, with the categories that have any', list.status === 200 && list.data.items.length >= 90 && list.data.categories.length === 9 && !list.data.items.some((i) => [excluded.id, draft.id, third.id, id].includes(i.id)), `${list.data?.items.length}`);
      check('list: no long text, only title and summary', list.data.items.every((i) => i.title && i.summary && i.body === undefined));
      const temple = await call('GET', '/api/app/etiquette?category=temple', { token: reader });
      check('list: a category narrows it, in reading order', temple.status === 200 && temple.data.items.length > 0 && temple.data.items.every((i) => i.category === 'temple') && temple.data.items.some((i) => i.id === first.id));
      check('list: an unknown category is a 400', (await call('GET', '/api/app/etiquette?category=nope', { token: reader })).status === 400);
      check('list: signed out is refused', (await call('GET', '/api/app/etiquette')).status === 403);

      const todayCall = await call('GET', '/api/app/etiquette/today', { token: reader });
      const todayRow = await dayOf(todayKolkata);
      const todayItemRow = await itemRow(todayRow.etiquetteId);
      check('today: the item for the reader’s own date, the one stored for it, published', todayCall.status === 200 && todayCall.data.date === todayKolkata && todayCall.data.item?.id === todayRow?.etiquetteId && todayItemRow.status === 'PUBLISHED', JSON.stringify(todayCall.data?.item?.slug));
      check('today: and carries its author, whatever it is', todayCall.data.item?.author === (todayItemRow.author ?? null), JSON.stringify({ api: todayCall.data?.item?.author, db: todayItemRow.author }));
      check('today: asking again gives the same', (await call('GET', '/api/app/etiquette/today', { token: reader })).data.item.id === todayCall.data.item.id);

      section('Translation runs through the API');
      check('estimate: counts the published items still to translate', await (async () => {
        const e = await call('GET', '/api/admin/etiquette/estimate?language=hi', { token: translator });
        return e.status === 200 && e.data.willTranslate >= 90 && e.data.requests === Math.ceil(e.data.willTranslate / etiquette.batchSize) && e.data.inputTokens > 0;
      })());
      check('estimate: an unknown language is a 400', (await call('GET', '/api/admin/etiquette/estimate?language=xx', { token: translator })).status === 400);
      check('a manager without the translate permission cannot start a run', (await call('POST', '/api/admin/etiquette/runs', { token: manager, body: { language: 'hi' } })).status === 403);
      const started = await call('POST', '/api/admin/etiquette/runs', { token: translator, body: { language: 'hi' } });
      if (started.data?.id) made.runs.push(started.data.id);
      check('starting queues a run for the default provider and its model', started.status === 201 && started.data.status === 'QUEUED' && started.data.provider === PROVIDER && started.data.language === 'hi' && started.data.languageName === 'Hindi', JSON.stringify(started.data));
      const dup = await call('POST', '/api/admin/etiquette/runs', { token: translator, body: { language: 'hi' } });
      check('a second run into the same language is refused', dup.status === 409);
      const other = await call('POST', '/api/admin/etiquette/runs', { token: translator, body: { language: 'ta' } });
      if (other.data?.id) made.runs.push(other.data.id);
      check('but another language is queued behind it', other.status === 201 && other.data.status === 'QUEUED');
      const got = await call('GET', `/api/admin/etiquette/runs/${started.data.id}`, { token: translator });
      check('the run and its feed can be read', got.status === 200 && got.data.run.id === started.data.id && got.data.feed.some((l) => /Queued by/.test(l.text)), JSON.stringify(got.data?.feed?.[0]));
      check('Resume refuses a run that is waiting', (await call('POST', `/api/admin/etiquette/runs/${started.data.id}/resume`, { token: translator })).status === 409);
      const cancelled = await call('POST', `/api/admin/etiquette/runs/${started.data.id}/cancel`, { token: translator });
      check('Cancel on a waiting run ends it at once', cancelled.status === 200 && cancelled.data.status === 'CANCELLED');
      check('and the job is gone from the queue', !(await queue.getJob((await fresh(started.data)).jobId)));
      check('Cancel twice is a 409', (await call('POST', `/api/admin/etiquette/runs/${started.data.id}/cancel`, { token: translator })).status === 409);
      const listed = await call('GET', '/api/admin/etiquette/runs?status=CANCELLED&language=hi', { token: translator });
      check('the list shows it', listed.status === 200 && listed.data.some((r) => r.id === started.data.id));
      check('a manager without the translate permission cannot read runs', (await call('GET', '/api/admin/etiquette/runs', { token: manager })).status === 403);

      const failedRun = await prisma.etiquetteRun.update({ where: { id: other.data.id }, data: { status: 'FAILED', stopReason: 'error', statusMessage: 'E2E failure', finishedAt: new Date() } });
      const resumed = await call('POST', `/api/admin/etiquette/runs/${failedRun.id}/resume`, { token: translator });
      check('Resume puts a failed run back on the queue', resumed.status === 200 && resumed.data.status === 'QUEUED' && Boolean((await fresh(failedRun)).jobId) && Boolean(await queue.getJob((await fresh(failedRun)).jobId)));
      await call('POST', `/api/admin/etiquette/runs/${failedRun.id}/cancel`, { token: translator });
    }
  } finally {
    mock.timers.reset();
    etiquette.heartbeatMs = saved.heartbeatMs;
    etiquette.batchSize = saved.batchSize;
    api?.kill('SIGTERM');

    const runRows = await prisma.etiquetteRun.findMany({ where: { OR: [{ id: { in: made.runs } }, { requestedByName: 'e2e' }, { model: MODEL }] }, select: { id: true, jobId: true } }).catch(() => []);
    for (const row of runRows) {
      if (row.jobId) await queue.getJob(row.jobId).then((job) => job?.remove()).catch(() => {});
      await redis.del(`${etiquette.feedKey}:${row.id}`).catch(() => {});
    }
    // Runs started through the API carry the admin's name, not "e2e".
    const viaApi = await prisma.etiquetteRun.findMany({ where: { requestedById: { in: made.users } }, select: { id: true, jobId: true } }).catch(() => []);
    for (const row of viaApi) {
      if (row.jobId) await queue.getJob(row.jobId).then((job) => job?.remove()).catch(() => {});
      await redis.del(`${etiquette.feedKey}:${row.id}`).catch(() => {});
    }
    const runIds = [...runRows, ...viaApi].map((r) => r.id);
    const translationIds = (await prisma.etiquetteTranslation.findMany({ where: { etiquetteId: { in: made.items } }, select: { id: true } }).catch(() => [])).map((t) => t.id);
    // By who did it as well as by what it touched: a translation saved and deleted through the API is gone by now, and
    // deleting the users below would blank the actor on its rows.
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: made.users } }, { entityId: { in: [...runIds, ...made.items, ...translationIds] } }] } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { userId: { in: made.users } } }).catch(() => {});
    await prisma.etiquetteDelivery.deleteMany({ where: { userId: { in: made.users } } }).catch(() => {});
    await prisma.etiquetteDay.deleteMany({ where: { date: { in: DAYS.map(toDateColumn) } } }).catch(() => {});
    // The day this script's API calls decided for today, if there was none before.
    if (!hadToday) await prisma.etiquetteDay.deleteMany({ where: { date: toDateColumn(todayKolkata) } }).catch(() => {});
    await prisma.pushCampaign.deleteMany({ where: { key: { startsWith: 'etiquette:2031-' } } }).catch(() => {});
    await prisma.etiquetteRun.deleteMany({ where: { id: { in: runIds } } }).catch(() => {});
    await prisma.etiquette.deleteMany({ where: { slug: { startsWith: P } } }).catch(() => {});
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
