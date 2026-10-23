// Everything devotee etiquette shares that talks to something: the day's pick, the translations a run saves, the run's
// job on the queue, the activity feed in Redis and the live channel to the admin panel. The run itself is
// jobs/processors/etiquette.js, the daily push jobs/processors/etiquette-deliver.js; the pure rules are utils/etiquette.js.

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { redis } from '../config/redis.js';
import { etiquette, languages } from '../config/etiquette.js';
import { JOBS, queues } from '../jobs/index.js';
import { EVENTS, toPermission } from './websocket.js';
import * as tally from './ai/token-tally.js';
import { PROVIDERS, PROVIDER_IDS, providerOf } from '../scripts/lib/translate-providers.js';
import { translatedByOf } from '../scripts/lib/claude-translate-parts.js';
import { toDateColumn } from '../utils/date.js';
import { pickNext, presentRun } from '../utils/etiquette.js';

const queue = queues.etiquette;

/* ---------- what the server is set up with ---------- */

export const defaultProvider = () => (PROVIDER_IDS.includes(etiquette.provider) ? etiquette.provider : 'openai');
export const apiKey = (provider = defaultProvider()) => env[providerOf(provider).keyEnv] || '';
export const model = (provider = defaultProvider()) => env[providerOf(provider).modelEnv] || providerOf(provider).defaultModel;

export const providers = () =>
  PROVIDER_IDS.map((id) => ({ id, label: PROVIDERS[id].label, company: PROVIDERS[id].company, keyEnv: PROVIDERS[id].keyEnv, apiKeyConfigured: Boolean(apiKey(id)), defaultModel: model(id) }));

/* ---------- the day's etiquette ---------- */

const dateKey = (date) => date.toISOString().slice(0, 10);

/**
 * The etiquette of a date (`YYYY-MM-DD`), made the first time anyone needs it so that everyone whose local date it
 * is gets the same one. → the `EtiquetteDay` with its `etiquette` (and that item's published translations), or null
 * when nothing is published.
 */
export async function dayFor(dateString) {
  const date = toDateColumn(dateString);
  const include = { etiquette: { include: { translations: { where: { isPublished: true } } } } };
  const found = await prisma.etiquetteDay.findUnique({ where: { date }, include });
  // An item that was excluded or put back to draft after it got its day is never shown: the day gets another.
  if (found && found.etiquette.status === 'PUBLISHED') return found;

  const published = await prisma.etiquette.findMany({ where: { status: 'PUBLISHED' }, select: { id: true, sortOrder: true } });
  const lastRows = await prisma.etiquetteDay.groupBy({ by: ['etiquetteId'], _max: { date: true } });
  const lastUsed = new Map(lastRows.map((r) => [r.etiquetteId, dateKey(r._max.date)]));
  const etiquetteId = pickNext(published, lastUsed);
  if (!etiquetteId) {
    logger.error('no published devotee etiquette — the day cannot be built');
    return null;
  }
  if (found) {
    logger.warn({ date: dateString, was: found.etiquetteId, now: etiquetteId }, 'etiquette of the day changed: the one chosen first is no longer published');
    return prisma.etiquetteDay.update({ where: { id: found.id }, data: { etiquetteId }, include });
  }
  try {
    return await prisma.etiquetteDay.create({ data: { date, etiquetteId }, include });
  } catch (err) {
    // Two deliveries asked for the same new date at once; the other one's row is the day.
    if (err?.code === 'P2002') return prisma.etiquetteDay.findUnique({ where: { date }, include });
    throw err;
  }
}

/* ---------- translations ---------- */

/**
 * What a run has to translate into `language`: published English items that have no translation yet (all of them
 * with `force`). A translation an editor has changed by hand is never replaced, and an excluded or draft item is
 * never translated.
 * → `[{ id, slug, title, summary, body }]` in reading order.
 */
export async function itemsToTranslate(language, force = false) {
  const rows = await prisma.etiquette.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, slug: true, title: true, summary: true, body: true, translations: { where: { languageCode: language }, select: { isEdited: true, title: true, summary: true, body: true } } },
  });
  return rows
    .filter((row) => {
      const have = row.translations[0];
      if (!have) return true;
      if (have.isEdited) return false;
      return force || !(have.title?.trim() && have.summary?.trim() && have.body?.trim());
    })
    .map(({ translations, ...item }) => item);
}

/**
 * What is left for a run: `itemsToTranslate`, and — for a run that forces — without the items this run has already
 * written, which would otherwise be done again on every resume.
 */
export async function itemsForRun(run) {
  const items = await itemsToTranslate(run.language, run.force);
  if (!run.force || items.length === 0) return items;
  const done = await prisma.etiquetteTranslation.findMany({ where: { runId: run.id, languageCode: run.language }, select: { etiquetteId: true } });
  const skip = new Set(done.map((d) => d.etiquetteId));
  return items.filter((item) => !skip.has(item.id));
}

/** Saves one batch of checked answers: `items` is `[{ slug, title, summary, body }]`. → how many were saved. */
export async function saveTranslations({ language, items, provider, runId }) {
  const rows = await prisma.etiquette.findMany({ where: { slug: { in: items.map((i) => i.slug) } }, select: { id: true, slug: true } });
  const idOf = new Map(rows.map((r) => [r.slug, r.id]));
  let saved = 0;
  for (const item of items) {
    const etiquetteId = idOf.get(item.slug);
    if (!etiquetteId) continue;
    const where = { etiquetteId_languageCode: { etiquetteId, languageCode: language } };
    const have = await prisma.etiquetteTranslation.findUnique({ where, select: { isEdited: true } });
    if (have?.isEdited) continue; // an editor's words are not written over
    const data = { title: item.title, summary: item.summary, body: item.body, translatedBy: translatedByOf(provider), runId, isPublished: true };
    await prisma.etiquetteTranslation.upsert({ where, create: { etiquetteId, languageCode: language, ...data }, update: data });
    saved += 1;
  }
  return saved;
}

/** For each of the languages, how many of the published items have all three parts translated. */
export async function coverage() {
  const total = await prisma.etiquette.count({ where: { status: 'PUBLISHED' } });
  const grouped = await prisma.etiquetteTranslation.groupBy({
    by: ['languageCode'],
    where: { etiquette: { status: 'PUBLISHED' }, title: { not: '' }, summary: { not: '' }, body: { not: '' } },
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((g) => [g.languageCode, g._count._all]));
  const edited = await prisma.etiquetteTranslation.groupBy({ by: ['languageCode'], where: { isEdited: true }, _count: { _all: true } });
  const editedBy = new Map(edited.map((g) => [g.languageCode, g._count._all]));
  return {
    total,
    languages: languages.map((l) => ({ code: l.code, name: l.name, endonym: l.endonym, translated: counts.get(l.code) ?? 0, edited: editedBy.get(l.code) ?? 0 })),
  };
}

/* ---------- tokens ---------- */

/** Counts a finished call in the token calculator (the AI usage page) under its provider and model. */
export const countTokens = ({ provider, model: modelId, inputTokens, outputTokens }) => tally.record({ provider, model: modelId, inputTokens, outputTokens });

/* ---------- the live channel and the activity feed ---------- */

const feedKey = (runId) => `${etiquette.feedKey}:${runId}`;

export function publishRun(row) {
  toPermission('etiquette.translate', EVENTS.ETIQUETTE_RUN, presentRun(row));
}

/** Adds a line to a run's feed (Redis, newest first, capped) and sends it to the watchers. Never throws. */
export async function pushFeed(runId, line) {
  const entry = { at: new Date().toISOString(), ...line };
  toPermission('etiquette.translate', EVENTS.ETIQUETTE_ACTIVITY, { runId, ...entry });
  try {
    await redis.multi().lpush(feedKey(runId), JSON.stringify(entry)).ltrim(feedKey(runId), 0, etiquette.feedLines - 1).expire(feedKey(runId), etiquette.feedDays * 86400).exec();
  } catch (err) {
    logger.warn({ err: err.message, runId }, 'etiquette feed write failed');
  }
}

export async function readFeed(runId, count = 100) {
  const lines = await redis.lrange(feedKey(runId), 0, Math.min(count, etiquette.feedLines) - 1).catch(() => []);
  return lines.map((l) => JSON.parse(l));
}

/* ---------- a run's job on the queue ---------- */

const LIVE_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'];
export const newJobId = (runId) => `etiquette-${runId}-${Date.now().toString(36)}`;

export async function addRunJob(runId, jobId = newJobId(runId)) {
  await queue.add(JOBS.ETIQUETTE_RUN, { runId }, { jobId });
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
  await prisma.etiquetteRun.update({ where: { id: run.id }, data: { jobId } });
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
  const rows = await prisma.etiquetteRun.findMany({
    where: { updatedAt: { lt: youngerThan }, OR: [{ status: { in: ['QUEUED', 'RUNNING'] } }, { status: 'PAUSED', resumeAt: { not: null } }] },
  });
  const requeued = [];
  for (const row of rows) {
    const job = row.jobId ? await queue.getJob(row.jobId).catch(() => null) : null;
    const state = job ? await job.getState().catch(() => 'unknown') : 'missing';
    if (LIVE_STATES.includes(state)) continue;
    if (job) await job.remove().catch(() => {});
    const jobId = newJobId(row.id);
    const next = await prisma.etiquetteRun.update({
      where: { id: row.id },
      data: { jobId, status: 'QUEUED', resumeAt: null, pauseReason: null, statusMessage: 'Picked up again after its background job was lost.' },
    });
    await addRunJob(row.id, jobId);
    publishRun(next);
    pushFeed(row.id, { kind: 'status', level: 'warn', text: 'Its background job was lost; queued again.' });
    logger.warn({ runId: row.id, was: state }, 'etiquette run re-queued');
    requeued.push(row.id);
  }
  return requeued;
}
