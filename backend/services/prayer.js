// Everything prayers share that talks to something: choosing which prayers a run still has to do, saving what a run
// writes, the page-wide coverage the admin overview shows, the run's job on the queue, the activity feed in Redis and the
// live channel to the admin panel. The run itself is jobs/processors/prayer.js; the pure rules (what is needed, the
// prompts, the checks) are utils/prayer.js.
//
// What a prayer needs in a language is decided in exactly one place, `needsOf` in utils/prayer.js. The run, the
// estimate and the editor call it on whole rows. `coverage()` below cannot (the overview is polled, so it must not load
// every verse), and counts the same things in the database; it is a mirror of `needsOf` and has to be changed with it.

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { redis } from '../config/redis.js';
import { howText, languages, prayer as cfg } from '../config/prayer.js';
import { JOBS, queues } from '../jobs/index.js';
import { EVENTS, toPermission } from './websocket.js';
import * as tally from './ai/token-tally.js';
import { PROVIDER_IDS, providerChoices, providerOf } from '../scripts/lib/translate-providers.js';
import { translatedByOf } from '../scripts/lib/claude-translate-parts.js';
import { needsOf, presentRun, stateOf } from '../utils/prayer.js';
import { DEFAULT_LANGUAGE } from '../config/constants.js';

const queue = queues.prayer;
const filled = (value) => typeof value === 'string' && value.trim().length > 0;

/* ---------- what the server is set up with ---------- */

export const defaultProvider = () => (PROVIDER_IDS.includes(cfg.provider) ? cfg.provider : 'openai');
export const apiKey = (provider = defaultProvider()) => env[providerOf(provider).keyEnv] || '';
export const model = (provider = defaultProvider()) => env[providerOf(provider).modelEnv] || providerOf(provider).defaultModel;

/** The providers the page offers, each with the models it can pick from (see `providerChoices`). */
export const providers = () => providerChoices({ apiKey, model });

/* ---------- which prayers a run has to do ---------- */

/** A published prayer's rows in the shape `needsOf` reads: its header and verses in `language` only, verses in reading order. */
const forLanguage = (language) => ({
  translations: { where: { languageCode: language } },
  verses: { orderBy: [{ position: 'asc' }, { id: 'asc' }], include: { translations: { where: { languageCode: language } } } },
});

/**
 * The published prayers that have something to do in `language`, in the order the app lists them (`sortOrder`, then
 * oldest first), each with what `needsOf` says: `[{ prayer, needs }]`. `runId` is the run asking, so a forced run does
 * not do again what it has already written.
 */
async function pendingPrayers(language, force, runId = null) {
  const rows = await prisma.prayer.findMany({
    where: { status: 'PUBLISHED', verses: { some: {} } },
    include: forLanguage(language),
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  return rows.map((row) => ({ prayer: row, needs: needsOf(row, language, force, runId) })).filter((entry) => entry.needs.any);
}

/** What a run into `language` would do (the estimate, and whether there is anything to start). */
export const prayersToTranslate = (language, force = false) => pendingPrayers(language, force);

/** What is left for a run: `prayersToTranslate`, without what a forced run has already written. */
export const prayersForRun = (run) => pendingPrayers(run.language, run.force, run.id);

/* ---------- saving what a run writes ---------- */

/**
 * Saves the pieces of a header answer that passed `checkHeader`: `header` is `{ title?, summary?, about? }`. A piece a
 * person wrote is never written over; a row a person edited keeps its `isEdited`, `translatedBy` and `runId`, and only
 * its empty pieces are filled. A new row needs a title, so without one nothing is saved. → the pieces that are now
 * settled (written, or already a person's words), so the run knows what it still has to ask for.
 */
export async function saveHeader({ prayerId, language, header, provider, runId }) {
  const where = { prayerId_languageCode: { prayerId, languageCode: language } };
  const have = await prisma.prayerTranslation.findUnique({ where });
  const written = {};
  const settled = [];
  for (const field of ['title', 'summary', 'about']) {
    if (header[field] === undefined) continue;
    if (have?.isEdited && filled(have[field])) {
      settled.push(field);
      continue;
    }
    written[field] = header[field];
  }

  if (!have) {
    if (!written.title) return [];
    await prisma.prayerTranslation.create({ data: { prayerId, languageCode: language, ...written, translatedBy: translatedByOf(provider), runId } });
  } else if (Object.keys(written).length) {
    await prisma.prayerTranslation.update({ where, data: { ...written, ...(have.isEdited ? {} : { translatedBy: translatedByOf(provider), runId }) } });
  }
  return [...settled, ...Object.keys(written)];
}

/**
 * Saves the pieces of a verses answer that passed `checkAnswer`: `items` is `[{ verseId, rendering?, meaning? }]`, and
 * `sentAt` is when the request went out. Merged into the verse's row, never replacing it: a piece a person wrote is
 * kept, and a row a person edited keeps its `isEdited`, `translatedBy` and `runId` while its empty pieces are filled.
 * A rendering is stamped `renderedAt = sentAt`, and is not saved for a verse that was deleted while the request was in
 * the air, nor for one whose text was changed after it went out (the admin is editing the prayer, and the rendering is of
 * words that are gone). → how many verses were written.
 */
export async function saveVerses({ prayerId, language, items, provider, runId, sentAt }) {
  if (!items.length) return 0;
  const verses = await prisma.prayerVerse.findMany({
    where: { prayerId, id: { in: items.map((i) => i.verseId) } },
    select: { id: true, textChangedAt: true, translations: { where: { languageCode: language } } },
  });
  const byId = new Map(verses.map((v) => [v.id, v]));

  const writes = [];
  for (const item of items) {
    const verse = byId.get(item.verseId);
    if (!verse) continue; // deleted while the request was in flight
    const have = verse.translations[0] ?? null;
    const data = {};
    if (item.rendering !== undefined && new Date(verse.textChangedAt) <= new Date(sentAt) && !(have?.isEdited && filled(have.text))) {
      data.text = item.rendering;
      data.renderedAt = sentAt;
    }
    if (item.meaning !== undefined && !(have?.isEdited && filled(have.meaning))) data.meaning = item.meaning;
    if (!Object.keys(data).length) continue;

    if (!have) {
      writes.push(prisma.prayerVerseTranslation.create({ data: { verseId: verse.id, languageCode: language, ...data, translatedBy: translatedByOf(provider), runId } }));
    } else {
      writes.push(
        prisma.prayerVerseTranslation.update({
          where: { id: have.id },
          data: { ...data, ...(have.isEdited ? {} : { translatedBy: translatedByOf(provider), runId }) },
        })
      );
    }
  }
  if (writes.length) await prisma.$transaction(writes);
  return writes.length;
}

/* ---------- coverage for the admin overview ---------- */

/**
 * For each language, how many of the published prayers (with at least one verse) are translated, partly, not at all or
 * out of date, and how many hold something a person wrote — worked out in the database in four small queries, because
 * the overview is polled and must not load every verse. A MIRROR of `needsOf` (utils/prayer.js) for an ordinary, not
 * forced, run, and it shares `stateOf` with it: a header is missing when there is no title; a rendering is missing when
 * the script is made by a model and a verse has no text, or its text is not a person's and is older than the verse; a
 * meaning is missing when the English one is not empty and the translation is. Change one, change the other.
 */
export async function coverage() {
  const [prayers, headers, aggregates] = await Promise.all([
    prisma.$queryRaw`
      SELECT p."id" AS "prayerId", p."originalLanguage" AS "originalLanguage",
             COUNT(v."id")::int AS "verses",
             (COUNT(v."id") FILTER (WHERE COALESCE(v."meaning", '') ~ '\S'))::int AS "withMeaning"
      FROM "Prayer" p JOIN "PrayerVerse" v ON v."prayerId" = p."id"
      WHERE p."status" = 'PUBLISHED'
      GROUP BY p."id", p."originalLanguage"`,
    prisma.prayerTranslation.findMany({
      where: { prayer: { status: 'PUBLISHED' } },
      select: { prayerId: true, languageCode: true, title: true, isEdited: true },
    }),
    prisma.$queryRaw`
      SELECT v."prayerId" AS "prayerId", t."languageCode" AS "languageCode",
             (COUNT(*) FILTER (WHERE COALESCE(t."text", '') ~ '\S'))::int AS "texts",
             (COUNT(*) FILTER (WHERE COALESCE(t."text", '') ~ '\S' AND NOT t."isEdited" AND (t."renderedAt" IS NULL OR t."renderedAt" < v."textChangedAt")))::int AS "stale",
             (COUNT(*) FILTER (WHERE COALESCE(t."meaning", '') ~ '\S' AND COALESCE(v."meaning", '') ~ '\S'))::int AS "meaningsDone",
             (COUNT(*) FILTER (WHERE COALESCE(t."meaning", '') ~ '\S'))::int AS "meaningsAny",
             (COUNT(*) FILTER (WHERE t."isEdited"))::int AS "edited"
      FROM "PrayerVerseTranslation" t
      JOIN "PrayerVerse" v ON v."id" = t."verseId"
      JOIN "Prayer" p ON p."id" = v."prayerId"
      WHERE p."status" = 'PUBLISHED'
      GROUP BY v."prayerId", t."languageCode"`,
  ]);

  const headerOf = new Map(headers.map((h) => [`${h.prayerId}:${h.languageCode}`, h]));
  const aggregateOf = new Map(aggregates.map((a) => [`${a.prayerId}:${a.languageCode}`, a]));

  return {
    total: prayers.length,
    languages: languages.map((l) => {
      const out = { code: l.code, name: l.name, endonym: l.endonym, how: null, translated: 0, partial: 0, missing: 0, stale: 0, edited: 0 };
      const hows = {};
      for (const p of prayers) {
        const how = howText(p.originalLanguage, l.code);
        hows[how] = (hows[how] ?? 0) + 1;
        const header = headerOf.get(`${p.prayerId}:${l.code}`);
        const a = aggregateOf.get(`${p.prayerId}:${l.code}`);

        const counts = { headers: 0, renderings: 0, meanings: 0, stale: 0 };
        if (l.code !== DEFAULT_LANGUAGE && !filled(header?.title)) counts.headers = 1;
        if (how === 'model') {
          counts.stale = a?.stale ?? 0;
          counts.renderings = p.verses - (a?.texts ?? 0) + counts.stale;
        }
        if (l.code !== DEFAULT_LANGUAGE) counts.meanings = p.withMeaning - (a?.meaningsDone ?? 0);

        const stored = filled(header?.title) || (a?.texts ?? 0) > 0 || (a?.meaningsAny ?? 0) > 0;
        const state = stateOf(counts, stored);
        out[state === 'translated' ? 'translated' : state === 'missing' ? 'missing' : state === 'stale' ? 'stale' : 'partial'] += 1;
        if (header?.isEdited || (a?.edited ?? 0) > 0) out.edited += 1;
      }
      // One word when every prayer agrees (the usual case), else how many of each.
      const kinds = Object.keys(hows);
      out.how = kinds.length === 1 ? kinds[0] : kinds.length === 0 ? howText('sa', l.code) : hows;
      return out;
    }),
  };
}

/* ---------- tokens ---------- */

/** Counts a finished call in the token calculator (the AI usage page) under its provider and model. */
export const countTokens = ({ provider, model: modelId, inputTokens, outputTokens }) => tally.record({ provider, model: modelId, inputTokens, outputTokens });

/* ---------- the live channel and the activity feed ---------- */

const feedKey = (runId) => `${cfg.feedKey}:${runId}`;

export function publishRun(row) {
  toPermission('prayer.translate', EVENTS.PRAYER_RUN, presentRun(row));
}

/** Adds a line to a run's feed (Redis, newest first, capped) and sends it to the watchers. Never throws. */
export async function pushFeed(runId, line) {
  const entry = { at: new Date().toISOString(), ...line };
  toPermission('prayer.translate', EVENTS.PRAYER_ACTIVITY, { runId, ...entry });
  try {
    await redis.multi().lpush(feedKey(runId), JSON.stringify(entry)).ltrim(feedKey(runId), 0, cfg.feedLines - 1).expire(feedKey(runId), cfg.feedDays * 86400).exec();
  } catch (err) {
    logger.warn({ err: err.message, runId }, 'prayer feed write failed');
  }
}

export async function readFeed(runId, count = 100) {
  const lines = await redis.lrange(feedKey(runId), 0, Math.min(count, cfg.feedLines) - 1).catch(() => []);
  return lines.map((l) => JSON.parse(l));
}

/* ---------- a run's job on the queue ---------- */

const LIVE_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'];
export const newJobId = (runId) => `prayer-${runId}-${Date.now().toString(36)}`;

export async function addRunJob(runId, jobId = newJobId(runId)) {
  await queue.add(JOBS.PRAYER_RUN, { runId }, { jobId });
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
  await prisma.prayerRun.update({ where: { id: run.id }, data: { jobId } });
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
  const rows = await prisma.prayerRun.findMany({
    where: { updatedAt: { lt: youngerThan }, OR: [{ status: { in: ['QUEUED', 'RUNNING'] } }, { status: 'PAUSED', resumeAt: { not: null } }] },
  });
  const requeued = [];
  for (const row of rows) {
    const job = row.jobId ? await queue.getJob(row.jobId).catch(() => null) : null;
    const state = job ? await job.getState().catch(() => 'unknown') : 'missing';
    if (LIVE_STATES.includes(state)) continue;
    if (job) await job.remove().catch(() => {});
    const jobId = newJobId(row.id);
    const next = await prisma.prayerRun.update({
      where: { id: row.id },
      data: { jobId, status: 'QUEUED', resumeAt: null, pauseReason: null, statusMessage: 'Picked up again after its background job was lost.' },
    });
    await addRunJob(row.id, jobId);
    publishRun(next);
    pushFeed(row.id, { kind: 'status', level: 'warn', text: 'Its background job was lost; queued again.' });
    logger.warn({ runId: row.id, was: state }, 'prayer run re-queued');
    requeued.push(row.id);
  }
  return requeued;
}
