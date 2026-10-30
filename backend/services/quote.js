// Everything the chanting-page quotes share that talks to something: the translations a run saves, the run's job on
// the queue, the activity feed in Redis and the live channel to the admin panel. The run itself is
// jobs/processors/quote.js; the pure rules are utils/quote.js. The same shape as services/etiquette.js.

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { redis } from '../config/redis.js';
import { quote, languages } from '../config/quote.js';
import { JOBS, queues } from '../jobs/index.js';
import { EVENTS, toPermission } from './websocket.js';
import * as tally from './ai/token-tally.js';
import { PROVIDERS, PROVIDER_IDS, providerOf } from '../scripts/lib/translate-providers.js';
import { translatedByOf } from '../scripts/lib/claude-translate-parts.js';
import { presentRun } from '../utils/quote.js';

const queue = queues.quote;

/* ---------- what the server is set up with ---------- */

export const defaultProvider = () => (PROVIDER_IDS.includes(quote.provider) ? quote.provider : 'openai');
export const apiKey = (provider = defaultProvider()) => env[providerOf(provider).keyEnv] || '';
export const model = (provider = defaultProvider()) => env[providerOf(provider).modelEnv] || providerOf(provider).defaultModel;

export const providers = () =>
  PROVIDER_IDS.map((id) => ({ id, label: PROVIDERS[id].label, company: PROVIDERS[id].company, keyEnv: PROVIDERS[id].keyEnv, apiKeyConfigured: Boolean(apiKey(id)), defaultModel: model(id) }));

/* ---------- translations ---------- */

/**
 * What a run has to translate into `language`: published English items that have no translation yet (all of them
 * with `force`). A translation an editor has changed by hand is never replaced, and an excluded or draft item is
 * never translated.
 * → `[{ id, slug, text }]` in reading order.
 */
export async function itemsToTranslate(language, force = false) {
  const rows = await prisma.quote.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, slug: true, text: true, translations: { where: { languageCode: language }, select: { isEdited: true, text: true } } },
  });
  return rows
    .filter((row) => {
      const have = row.translations[0];
      if (!have) return true;
      if (have.isEdited) return false;
      return force || !have.text?.trim();
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
  const done = await prisma.quoteTranslation.findMany({ where: { runId: run.id, languageCode: run.language }, select: { quoteId: true } });
  const skip = new Set(done.map((d) => d.quoteId));
  return items.filter((item) => !skip.has(item.id));
}

/** Saves one batch of checked answers: `items` is `[{ slug, text }]`. → how many were saved. */
export async function saveTranslations({ language, items, provider, runId }) {
  const rows = await prisma.quote.findMany({ where: { slug: { in: items.map((i) => i.slug) } }, select: { id: true, slug: true } });
  const idOf = new Map(rows.map((r) => [r.slug, r.id]));
  let saved = 0;
  for (const item of items) {
    const quoteId = idOf.get(item.slug);
    if (!quoteId) continue;
    const where = { quoteId_languageCode: { quoteId, languageCode: language } };
    const have = await prisma.quoteTranslation.findUnique({ where, select: { isEdited: true } });
    if (have?.isEdited) continue; // an editor's words are not written over
    const data = { text: item.text, translatedBy: translatedByOf(provider), runId, isPublished: true };
    await prisma.quoteTranslation.upsert({ where, create: { quoteId, languageCode: language, ...data }, update: data });
    saved += 1;
  }
  return saved;
}

/** For each of the languages, how many of the published quotes are translated. */
export async function coverage() {
  const total = await prisma.quote.count({ where: { status: 'PUBLISHED' } });
  const grouped = await prisma.quoteTranslation.groupBy({
    by: ['languageCode'],
    where: { quote: { status: 'PUBLISHED' }, text: { not: '' } },
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((g) => [g.languageCode, g._count._all]));
  const edited = await prisma.quoteTranslation.groupBy({ by: ['languageCode'], where: { isEdited: true }, _count: { _all: true } });
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

const feedKey = (runId) => `${quote.feedKey}:${runId}`;

export function publishRun(row) {
  toPermission('quote.translate', EVENTS.QUOTE_RUN, presentRun(row));
}

/** Adds a line to a run's feed (Redis, newest first, capped) and sends it to the watchers. Never throws. */
export async function pushFeed(runId, line) {
  const entry = { at: new Date().toISOString(), ...line };
  toPermission('quote.translate', EVENTS.QUOTE_ACTIVITY, { runId, ...entry });
  try {
    await redis.multi().lpush(feedKey(runId), JSON.stringify(entry)).ltrim(feedKey(runId), 0, quote.feedLines - 1).expire(feedKey(runId), quote.feedDays * 86400).exec();
  } catch (err) {
    logger.warn({ err: err.message, runId }, 'quote feed write failed');
  }
}

export async function readFeed(runId, count = 100) {
  const lines = await redis.lrange(feedKey(runId), 0, Math.min(count, quote.feedLines) - 1).catch(() => []);
  return lines.map((l) => JSON.parse(l));
}

/* ---------- a run's job on the queue ---------- */

const LIVE_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'];
export const newJobId = (runId) => `quote-${runId}-${Date.now().toString(36)}`;

export async function addRunJob(runId, jobId = newJobId(runId)) {
  await queue.add(JOBS.QUOTE_RUN, { runId }, { jobId });
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
  await prisma.quoteRun.update({ where: { id: run.id }, data: { jobId } });
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
  const rows = await prisma.quoteRun.findMany({
    where: { updatedAt: { lt: youngerThan }, OR: [{ status: { in: ['QUEUED', 'RUNNING'] } }, { status: 'PAUSED', resumeAt: { not: null } }] },
  });
  const requeued = [];
  for (const row of rows) {
    const job = row.jobId ? await queue.getJob(row.jobId).catch(() => null) : null;
    const state = job ? await job.getState().catch(() => 'unknown') : 'missing';
    if (LIVE_STATES.includes(state)) continue;
    if (job) await job.remove().catch(() => {});
    const jobId = newJobId(row.id);
    const next = await prisma.quoteRun.update({
      where: { id: row.id },
      data: { jobId, status: 'QUEUED', resumeAt: null, pauseReason: null, statusMessage: 'Picked up again after its background job was lost.' },
    });
    await addRunJob(row.id, jobId);
    publishRun(next);
    pushFeed(row.id, { kind: 'status', level: 'warn', text: 'Its background job was lost; queued again.' });
    logger.warn({ runId: row.id, was: state }, 'quote run re-queued');
    requeued.push(row.id);
  }
  return requeued;
}
