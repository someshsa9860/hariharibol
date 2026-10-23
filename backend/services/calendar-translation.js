// Everything the Hindu calendar's translation shares that talks to something: the words the calendar is made of, the
// translations a run saves and a response reads, the run's job on the queue, the activity feed in Redis and the live
// channel to the admin panel. The run itself is jobs/processors/calendar.js; the pure rules are
// utils/calendar-translation.js.
//
// A translation is keyed by kind + language + the English text (CalendarTranslation), not by a festival or a day: the
// calendar says "Ekadashi" a hundred times a year and in five places, and one translation serves them all.

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { redis } from '../config/redis.js';
import { calendar, languages, TERM_FIELDS } from '../config/calendar.js';
import { JOBS, queues } from '../jobs/index.js';
import { EVENTS, toPermission } from './websocket.js';
import * as tally from './ai/token-tally.js';
import { PROVIDER_IDS, providerChoices, providerOf } from '../scripts/lib/translate-providers.js';
import { translatedByOf } from '../scripts/lib/claude-translate-parts.js';
import { itemKey, makeWords, plainWords, presentRun, sourceKeyOf, wordsOf } from '../utils/calendar-translation.js';
import { DEFAULT_LANGUAGE } from '../config/constants.js';

const queue = queues.calendar;

/* ---------- what the server is set up with ---------- */

export const defaultProvider = () => (PROVIDER_IDS.includes(calendar.provider) ? calendar.provider : 'openai');
export const apiKey = (provider = defaultProvider()) => env[providerOf(provider).keyEnv] || '';
export const model = (provider = defaultProvider()) => env[providerOf(provider).modelEnv] || providerOf(provider).defaultModel;

/** The providers the page offers, each with the models it can pick from (see `providerChoices`). */
export const providers = () => providerChoices({ apiKey, model });

/* ---------- the words the calendar is made of ---------- */

/**
 * Every distinct piece of English the calendar shows, as `[{ kind, source, sourceKey, group? }]`: festival names (a
 * parana's Ekadashi included), festival descriptions and the panchang terms of every day we hold, in every place.
 * A parana's description is that day's own times, built for the date, so it is left out; the push words it itself.
 * `group` (terms only) is what the prompt calls the term (a tithi, a nakshatra …).
 */
export async function collectItems() {
  const [names, descriptions, paranas, ...termSets] = await Promise.all([
    prisma.festival.findMany({ distinct: ['name'], select: { name: true } }),
    prisma.festival.findMany({ where: { description: { not: null }, kind: { not: 'PARANA' } }, distinct: ['description'], select: { description: true } }),
    prisma.festival.findMany({ where: { kind: 'PARANA' }, select: { details: true } }),
    ...Object.keys(TERM_FIELDS).map((field) => prisma.panchangDay.findMany({ distinct: [field], select: { [field]: true } })),
  ]);

  const seen = new Map();
  const add = (kind, text, group) => {
    const source = String(text ?? '').trim();
    if (!source) return;
    const key = itemKey(kind, source);
    if (!seen.has(key)) seen.set(key, { kind, source, sourceKey: sourceKeyOf(source), ...(group && { group }) });
  };

  for (const f of names) add('NAME', f.name);
  for (const p of paranas) add('NAME', p.details?.ekadashi);
  for (const f of descriptions) add('DESCRIPTION', f.description);
  Object.entries(TERM_FIELDS).forEach(([field, group], i) => {
    for (const row of termSets[i]) add('TERM', row[field], group);
  });

  const order = { NAME: 0, DESCRIPTION: 1, TERM: 2 };
  return [...seen.values()].sort((a, b) => order[a.kind] - order[b.kind] || a.source.localeCompare(b.source));
}

/* ---------- translations ---------- */

/**
 * What a run has to translate into `language`: the calendar's items with no translation (all of them with `force`). A
 * translation an editor has changed by hand is never replaced. → `collectItems()` rows, names first.
 */
export async function itemsToTranslate(language, force = false) {
  const [items, have] = await Promise.all([
    collectItems(),
    prisma.calendarTranslation.findMany({ where: { languageCode: language }, select: { kind: true, sourceKey: true, text: true, isEdited: true } }),
  ]);
  const byKey = new Map(have.map((row) => [`${row.kind}:${row.sourceKey}`, row]));
  return items.filter((item) => {
    const row = byKey.get(`${item.kind}:${item.sourceKey}`);
    if (!row) return true;
    if (row.isEdited) return false;
    return force || !row.text?.trim();
  });
}

/**
 * What is left for a run: `itemsToTranslate`, and — for a run that forces — without what this run has already written,
 * which would otherwise be done again on every resume.
 */
export async function itemsForRun(run) {
  const items = await itemsToTranslate(run.language, run.force);
  if (!run.force || items.length === 0) return items;
  const done = await prisma.calendarTranslation.findMany({ where: { runId: run.id, languageCode: run.language }, select: { kind: true, sourceKey: true } });
  const skip = new Set(done.map((d) => `${d.kind}:${d.sourceKey}`));
  return items.filter((item) => !skip.has(`${item.kind}:${item.sourceKey}`));
}

/** Saves one batch of checked answers: `items` is `[{ kind, source, sourceKey, text }]`. → how many were saved. */
export async function saveTranslations({ language, items, provider, runId }) {
  if (!items.length) return 0;
  const edited = await prisma.calendarTranslation.findMany({
    where: { languageCode: language, isEdited: true, sourceKey: { in: items.map((i) => i.sourceKey) } },
    select: { kind: true, sourceKey: true },
  });
  const skip = new Set(edited.map((e) => `${e.kind}:${e.sourceKey}`));
  let saved = 0;
  for (const item of items) {
    if (skip.has(`${item.kind}:${item.sourceKey}`)) continue; // an editor's words are not written over
    const where = { kind_languageCode_sourceKey: { kind: item.kind, languageCode: language, sourceKey: item.sourceKey } };
    const data = { source: item.source, text: item.text, translatedBy: translatedByOf(provider), runId };
    await prisma.calendarTranslation.upsert({ where, create: { kind: item.kind, languageCode: language, sourceKey: item.sourceKey, ...data }, update: data });
    saved += 1;
  }
  return saved;
}

/** For each language, how many of the calendar's current items are translated (and how many of those by hand). */
export async function coverage() {
  const [items, rows] = await Promise.all([
    collectItems(),
    prisma.calendarTranslation.findMany({ select: { kind: true, languageCode: true, sourceKey: true, text: true, isEdited: true } }),
  ]);
  const current = new Set(items.map((i) => `${i.kind}:${i.sourceKey}`));
  const byKind = items.reduce((acc, i) => ({ ...acc, [i.kind]: (acc[i.kind] ?? 0) + 1 }), { NAME: 0, DESCRIPTION: 0, TERM: 0 });

  const counts = new Map();
  for (const row of rows) {
    if (!row.text?.trim() || !current.has(`${row.kind}:${row.sourceKey}`)) continue;
    const entry = counts.get(row.languageCode) ?? { translated: 0, edited: 0 };
    entry.translated += 1;
    if (row.isEdited) entry.edited += 1;
    counts.set(row.languageCode, entry);
  }
  return {
    total: items.length,
    byKind,
    languages: languages.map((l) => ({ code: l.code, name: l.name, endonym: l.endonym, translated: counts.get(l.code)?.translated ?? 0, edited: counts.get(l.code)?.edited ?? 0 })),
  };
}

/**
 * `(kind, text) => the text in the reader's language` for a response made of these `days` and `festivals`. English (or
 * a chain with nothing but English) costs no query. A text with no translation stays English.
 */
export async function wordsFor(chain, days = [], festivals = []) {
  const codes = [];
  for (const code of chain ?? []) {
    if (code === DEFAULT_LANGUAGE) break;
    if (languages.some((l) => l.code === code)) codes.push(code);
  }
  if (!codes.length || (!days.length && !festivals.length)) return plainWords;
  try {
    const keys = [...new Set(wordsOf(days, festivals).map((w) => sourceKeyOf(w.text)))];
    if (!keys.length) return plainWords;
    const rows = await prisma.calendarTranslation.findMany({
      where: { languageCode: { in: codes }, sourceKey: { in: keys }, text: { not: '' } },
      select: { kind: true, languageCode: true, sourceKey: true, text: true },
    });
    return makeWords(rows, codes);
  } catch (err) {
    // A reader who cannot have the translation still gets the calendar, in English.
    logger.warn({ err: err.message }, 'calendar translations could not be read');
    return plainWords;
  }
}

/* ---------- tokens ---------- */

/** Counts a finished call in the token calculator (the AI usage page) under its provider and model. */
export const countTokens = ({ provider, model: modelId, inputTokens, outputTokens }) => tally.record({ provider, model: modelId, inputTokens, outputTokens });

/* ---------- the live channel and the activity feed ---------- */

const feedKey = (runId) => `${calendar.feedKey}:${runId}`;

export function publishRun(row) {
  toPermission('panchang.translate', EVENTS.CALENDAR_RUN, presentRun(row));
}

/** Adds a line to a run's feed (Redis, newest first, capped) and sends it to the watchers. Never throws. */
export async function pushFeed(runId, line) {
  const entry = { at: new Date().toISOString(), ...line };
  toPermission('panchang.translate', EVENTS.CALENDAR_ACTIVITY, { runId, ...entry });
  try {
    await redis.multi().lpush(feedKey(runId), JSON.stringify(entry)).ltrim(feedKey(runId), 0, calendar.feedLines - 1).expire(feedKey(runId), calendar.feedDays * 86400).exec();
  } catch (err) {
    logger.warn({ err: err.message, runId }, 'calendar feed write failed');
  }
}

export async function readFeed(runId, count = 100) {
  const lines = await redis.lrange(feedKey(runId), 0, Math.min(count, calendar.feedLines) - 1).catch(() => []);
  return lines.map((l) => JSON.parse(l));
}

/* ---------- a run's job on the queue ---------- */

const LIVE_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'];
export const newJobId = (runId) => `calendar-${runId}-${Date.now().toString(36)}`;

export async function addRunJob(runId, jobId = newJobId(runId)) {
  await queue.add(JOBS.CALENDAR_RUN, { runId }, { jobId });
  return jobId;
}

/** A live job for the run, soon: a delayed one is brought forward, a finished or missing one is replaced. */
export async function ensureRunJob(run) {
  const job = run.jobId ? await queue.getJob(run.jobId) : null;
  if (job) {
    const state = await job.getState();
    if (state === 'delayed') {
      await job.promote().catch((err) => logger.warn({ err: err.message, runId: run.id }, 'promote failed'));
      return run.jobId;
    }
    if (LIVE_STATES.includes(state)) return run.jobId;
    await job.remove().catch(() => {});
  }
  const jobId = newJobId(run.id);
  await prisma.calendarRun.update({ where: { id: run.id }, data: { jobId } });
  await addRunJob(run.id, jobId);
  return jobId;
}

export async function dropRunJob(run) {
  if (!run.jobId) return;
  const job = await queue.getJob(run.jobId).catch(() => null);
  if (job) await job.remove().catch(() => {});
}

/** The safety net, as for translations: a run that should be working but has no live job gets a new one. */
export async function reconcileRuns() {
  const youngerThan = new Date(Date.now() - 30_000);
  const rows = await prisma.calendarRun.findMany({
    where: { updatedAt: { lt: youngerThan }, OR: [{ status: { in: ['QUEUED', 'RUNNING'] } }, { status: 'PAUSED', resumeAt: { not: null } }] },
  });
  const requeued = [];
  for (const row of rows) {
    const job = row.jobId ? await queue.getJob(row.jobId).catch(() => null) : null;
    const state = job ? await job.getState().catch(() => 'unknown') : 'missing';
    if (LIVE_STATES.includes(state)) continue;
    if (job) await job.remove().catch(() => {});
    const jobId = newJobId(row.id);
    const next = await prisma.calendarRun.update({
      where: { id: row.id },
      data: { jobId, status: 'QUEUED', resumeAt: null, pauseReason: null, statusMessage: 'Picked up again after its background job was lost.' },
    });
    await addRunJob(row.id, jobId);
    publishRun(next);
    pushFeed(row.id, { kind: 'status', level: 'warn', text: 'Its background job was lost; queued again.' });
    logger.warn({ runId: row.id, was: state }, 'calendar run re-queued');
    requeued.push(row.id);
  }
  return requeued;
}
