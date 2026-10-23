// The Hindu calendar's translations in the admin panel: the runs that translate the calendar's words (festival names,
// descriptions, panchang terms) into a language with the provider and model the admin picks, and the translations
// themselves (see, write by hand, delete).
//
// A run is a `CalendarRun` row worked by the worker (jobs/processors/calendar.js), the same shape as Scenes and
// Etiquette: Cancel on a running run only sets `cancelRequested`, Resume is for a paused or failed run and carries on
// from the first item that has no translation. A translation an editor wrote is marked `isEdited` and never replaced.

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import logger from '../../config/logger.js';
import { calendar, languages, KINDS } from '../../config/calendar.js';
import * as audit from '../../services/audit.js';
import * as translationService from '../../services/translation.js';
import * as service from '../../services/calendar-translation.js';
import { whyNotUsable } from '../../scripts/lib/translate-providers.js';
import { ACTIVE_STATUSES } from '../../utils/translation-run.js';
import { PROMPT_VERSION, SYSTEM_PROMPT, estimateTokens, languageInfo, presentRun, sourceKeyOf } from '../../utils/calendar-translation.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { paginate, readPage } from '../../utils/pagination.js';
import { badRequest, conflict, notFound, unprocessable } from '../../utils/errors.js';

export const LANGUAGE_CODES = languages.map((l) => l.code);

const START_LOCK_SECONDS = 20;
const LOCK_KEY = 'calendar:start';
const who = (req) => req.auth.user.name || req.auth.user.email || 'an admin';

// A request carries its items as JSON lines: the keys and quotes around the text are tokens too.
const ITEM_OVERHEAD_TOKENS = 18;
const SECONDS_PER_REQUEST = 25;

const notALanguage = (code) => badRequest(`"${code}" is not a language the Hindu calendar is translated into.`);

/** GET /api/admin/panchang/translation/overview — what the page needs before anything is chosen. */
export const overview = async (req, res) => {
  const provider = service.defaultProvider();
  const [coverage, workerOnline, active] = await Promise.all([
    service.coverage(),
    translationService.workerOnline(),
    prisma.calendarRun.findMany({ where: { status: { in: ACTIVE_STATUSES } }, orderBy: { createdAt: 'asc' } }),
  ]);
  const providers = service.providers();
  return ok(res, {
    languages: coverage.languages,
    itemsTotal: coverage.total,
    itemsByKind: coverage.byKind,
    translation: {
      providers,
      defaultProvider: provider,
      model: service.model(provider),
      apiKeyConfigured: providers.find((p) => p.id === provider)?.apiKeyConfigured ?? false,
      workerOnline,
      batchSize: calendar.batchSize,
      promptVersion: PROMPT_VERSION,
    },
    active: active.map((row) => presentRun(row)),
  });
};

/* ---------- the translations ---------- */

/**
 * GET /api/admin/panchang/translation/items — every English word the calendar shows, with its translation into one
 * language (or none yet). `state` narrows to the translated, the missing or the hand-written ones.
 */
export const listItems = async (req, res) => {
  const { language, kind, state, q } = req.valid.query;
  if (!languageInfo(language)) throw notALanguage(language);

  const [items, rows] = await Promise.all([service.collectItems(), prisma.calendarTranslation.findMany({ where: { languageCode: language } })]);
  const byKey = new Map(rows.map((r) => [`${r.kind}:${r.sourceKey}`, r]));
  const needle = q?.toLowerCase();

  const all = items
    .map((item) => {
      const row = byKey.get(`${item.kind}:${item.sourceKey}`);
      return {
        kind: item.kind, group: item.group ?? null, source: item.source,
        translation: row ? { id: row.id, text: row.text, isEdited: row.isEdited, translatedBy: row.translatedBy, updatedAt: row.updatedAt } : null,
      };
    })
    .filter((item) => !kind || item.kind === kind)
    .filter((item) => {
      if (state === 'translated') return Boolean(item.translation?.text?.trim());
      if (state === 'missing') return !item.translation?.text?.trim();
      if (state === 'edited') return Boolean(item.translation?.isEdited);
      return true;
    })
    .filter((item) => !needle || item.source.toLowerCase().includes(needle) || item.translation?.text?.toLowerCase().includes(needle));

  const { page, pageSize, skip, take } = readPage(req.valid.query, 50);
  return paginated(res, all.slice(skip, skip + take), { page, pageSize, total: all.length });
};

/** PUT /api/admin/panchang/translation/items — a translation written or corrected by hand. */
export const saveItem = async (req, res) => {
  const { language, kind, source, text } = req.valid.body;
  if (!languageInfo(language)) throw notALanguage(language);

  // Only the calendar's own words: a stray source would never be looked up and would sit there for good.
  const sourceKey = sourceKeyOf(source);
  const items = await service.collectItems();
  if (!items.some((item) => item.kind === kind && item.sourceKey === sourceKey)) {
    throw notFound('Calendar word');
  }

  const where = { kind_languageCode_sourceKey: { kind, languageCode: language, sourceKey } };
  const data = { source: source.trim(), text, translatedBy: 'admin', isEdited: true };
  const row = await prisma.calendarTranslation.upsert({ where, create: { kind, languageCode: language, sourceKey, ...data }, update: data });
  await audit.record(req, { action: 'calendar.translation.save', entityType: 'CalendarTranslation', entityId: row.id, after: { kind, language, source: data.source } });
  return ok(res, row);
};

/** DELETE /api/admin/panchang/translation/items/:id — so a run can translate it again. */
export const deleteItem = async (req, res) => {
  const row = await prisma.calendarTranslation.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Translation');
  await prisma.calendarTranslation.delete({ where: { id: row.id } });
  await audit.record(req, { action: 'calendar.translation.delete', entityType: 'CalendarTranslation', entityId: row.id, before: { kind: row.kind, language: row.languageCode, source: row.source } });
  return ok(res, { deleted: true });
};

/* ---------- translation runs ---------- */

/** What the provider and model chosen would cost, from the catalogue's prices; null for a model it has none for. */
function costOf(provider, modelId, inputTokens, outputTokens) {
  const known = service.providers().find((p) => p.id === provider)?.models.find((m) => m.id === modelId);
  if (!known || known.inputPerMillion == null || known.outputPerMillion == null) return null;
  return Math.round(((inputTokens * known.inputPerMillion + outputTokens * known.outputPerMillion) / 1_000_000) * 10_000) / 10_000;
}

/** GET /api/admin/panchang/translation/estimate — what a run would do. Nothing is spent. */
export const estimate = async (req, res) => {
  const { language, force } = req.valid.query;
  if (!languageInfo(language)) throw notALanguage(language);
  const provider = req.valid.query.provider ?? service.defaultProvider();
  const modelId = req.valid.query.model ?? service.model(provider);

  const todo = await service.itemsToTranslate(language, force === 'true');
  const requests = Math.ceil(todo.length / calendar.batchSize);
  const perRequest = estimateTokens(SYSTEM_PROMPT);
  const inputTokens = todo.reduce((n, i) => n + estimateTokens(i.source) + ITEM_OVERHEAD_TOKENS, 0) + perRequest * requests;
  // Indic scripts take several tokens a letter, so the answer is about three times the English that went in.
  const outputTokens = todo.reduce((n, i) => n + estimateTokens(i.source) * 3 + ITEM_OVERHEAD_TOKENS, 0);
  const byKind = Object.fromEntries(KINDS.map((k) => [k, todo.filter((i) => i.kind === k).length]));
  return ok(res, {
    language, provider, model: modelId,
    willTranslate: todo.length,
    byKind,
    requests,
    inputTokens,
    outputTokens,
    costUsd: costOf(provider, modelId, inputTokens, outputTokens),
    minutes: requests ? Math.max(1, Math.ceil((requests * SECONDS_PER_REQUEST) / 60)) : 0,
    unusable: whyNotUsable(provider, modelId),
  });
};

/** GET /api/admin/panchang/translation/runs */
export const listRuns = async (req, res) => {
  const { status, language } = req.valid.query;
  const { items, page } = await paginate(prisma.calendarRun, {
    where: { ...(status && { status }), ...(language && { language }) },
    orderBy: { createdAt: 'desc' },
    query: req.valid.query,
    defaultPageSize: 20,
  });
  const now = new Date();
  return paginated(res, items.map((row) => presentRun(row, now)), page);
};

/** GET /api/admin/panchang/translation/runs/:id — one run and its activity feed. */
export const getRun = async (req, res) => {
  const row = await prisma.calendarRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Calendar translation run');
  return ok(res, { run: presentRun(row), feed: await service.readFeed(row.id, 100) });
};

/** POST /api/admin/panchang/translation/runs */
export const startRun = async (req, res) => {
  const { language, force } = req.valid.body;
  if (!languageInfo(language)) throw notALanguage(language);
  const provider = req.valid.body.provider ?? service.defaultProvider();
  const modelId = req.valid.body.model ?? service.model(provider);

  const info = service.providers().find((p) => p.id === provider);
  if (!info.apiKeyConfigured) throw unprocessable(`${info.keyEnv} is not set on the server, so ${info.company} cannot be called.`);
  // A model that cannot run without extended thinking would fail on its first call; say so now, not after the queue.
  const unusable = whyNotUsable(provider, modelId);
  if (unusable) throw unprocessable(unusable);

  const gotLock = await redis.set(LOCK_KEY, req.auth.user.id, 'EX', START_LOCK_SECONDS, 'NX');
  if (!gotLock) throw conflict('A run is being started. Try again in a moment.');

  try {
    const sameLanguage = await prisma.calendarRun.findFirst({ where: { language, status: { in: ACTIVE_STATUSES } }, select: { id: true } });
    if (sameLanguage) throw conflict(`A run into ${languageInfo(language).name} is already waiting or working. Cancel it first, or let it finish.`);

    const todo = await service.itemsToTranslate(language, force ?? false);
    if (todo.length === 0) throw conflict(`Everything the calendar shows is already translated into ${languageInfo(language).name}. Choose “Translate again” to replace it (words an editor wrote are kept).`, { upToDate: true });

    // A run started while another is going waits its turn: the worker takes them in the order they were made, one at a time.
    const row = await prisma.calendarRun.create({
      data: {
        language, provider, model: modelId, force: force ?? false,
        status: 'QUEUED', statusMessage: 'Waiting for the worker.',
        requestedById: req.auth.user.id, requestedByName: req.auth.user.name || req.auth.user.email || null,
      },
    });

    let current = row;
    try {
      const jobId = service.newJobId(row.id);
      current = await prisma.calendarRun.update({ where: { id: row.id }, data: { jobId } });
      await service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Queued by ${row.requestedByName || 'an admin'}: ${todo.length} words into ${languageInfo(language).name} with ${provider} ${modelId}.` });
      await service.addRunJob(row.id, jobId);
    } catch (err) {
      logger.error({ err: err.message, runId: row.id }, 'could not queue a calendar run');
      current = await prisma.calendarRun.update({ where: { id: row.id }, data: { status: 'FAILED', finishedAt: new Date(), statusMessage: `Could not be queued: ${err.message}` } });
      service.publishRun(current);
      throw unprocessable('The run could not be put on the queue. Is Redis reachable?');
    }

    await audit.record(req, { action: 'calendar.run.start', entityType: 'CalendarRun', entityId: row.id, after: { language, force: row.force, provider, model: modelId, items: todo.length } });
    service.publishRun(current);
    return created(res, presentRun(current));
  } finally {
    await redis.del(LOCK_KEY).catch(() => {});
  }
};

/** POST /api/admin/panchang/translation/runs/:id/resume */
export const resumeRun = async (req, res) => {
  const row = await prisma.calendarRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Calendar translation run');
  if (row.status !== 'PAUSED' && row.status !== 'FAILED') throw conflict(`Only a paused or failed run can be resumed — this one is ${row.status.toLowerCase()}.`);
  const next = await prisma.calendarRun.update({
    where: { id: row.id },
    data: { status: 'QUEUED', pauseReason: null, statusMessage: 'Resumed. Waiting for the worker.', stopReason: null, resumeAt: null, retriesInARow: 0, cancelRequested: false, finishedAt: null },
  });
  await service.ensureRunJob(next);
  const fresh = await prisma.calendarRun.findUnique({ where: { id: row.id } });

  await audit.record(req, { action: 'calendar.run.resume', entityType: 'CalendarRun', entityId: row.id, before: { id: row.id, status: row.status, language: row.language }, after: { status: 'QUEUED' } });
  service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Resumed by ${who(req)}.` });
  service.publishRun(fresh);
  return ok(res, presentRun(fresh));
};

/** POST /api/admin/panchang/translation/runs/:id/cancel */
export const cancelRun = async (req, res) => {
  const row = await prisma.calendarRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Calendar translation run');
  if (!ACTIVE_STATUSES.includes(row.status)) throw conflict(`This run is already ${row.status.toLowerCase()}.`);

  const askOnly = row.status === 'RUNNING' && !presentRun(row).stalled;
  let next;
  if (askOnly) {
    next = await prisma.calendarRun.update({ where: { id: row.id }, data: { cancelRequested: true, statusMessage: 'Cancelling after the request in progress…' } });
  } else {
    const done = await prisma.calendarRun.updateMany({
      where: { id: row.id, status: row.status, jobId: row.jobId },
      data: { status: 'CANCELLED', cancelRequested: false, resumeAt: null, finishedAt: new Date(), statusMessage: `Cancelled by ${who(req)}.` },
    });
    if (done.count === 0) throw conflict('The run changed while it was being cancelled. Look again.');
    await service.dropRunJob(row);
    next = await prisma.calendarRun.findUnique({ where: { id: row.id } });
  }

  await audit.record(req, { action: 'calendar.run.cancel', entityType: 'CalendarRun', entityId: row.id, before: { id: row.id, status: row.status, language: row.language }, after: { status: next.status, cancelRequested: next.cancelRequested } });
  service.pushFeed(row.id, { kind: 'status', level: 'warn', text: `Cancel requested by ${who(req)}.` });
  service.publishRun(next);
  return ok(res, presentRun(next));
};
