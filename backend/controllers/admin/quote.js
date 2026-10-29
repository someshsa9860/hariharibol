// The chanting-page quotes in the admin panel: the English items (see, edit, publish, exclude), their translations (see,
// edit by hand, delete), and the runs that translate the items into a language.
//
// A quote is PUBLISHED (readers see it), DRAFT (not yet) or EXCLUDED (kept, with the reason, and never shown). Anything an admin changes
// is marked `isEdited`, which is what stops the seed (and a translation run) from writing over it.
//
// A run is a `QuoteRun` row worked by the worker (jobs/processors/quote.js), the same shape as Scenes: Cancel on
// a running run only sets `cancelRequested`, Resume is for a paused or failed run and carries on from the first item
// that has no translation.

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import logger from '../../config/logger.js';
import { quote, languages } from '../../config/quote.js';
import * as audit from '../../services/audit.js';
import * as translationService from '../../services/translation.js';
import * as service from '../../services/quote.js';
import { ACTIVE_STATUSES } from '../../utils/translation-run.js';
import { PROMPT_VERSION, STATUSES, SYSTEM_PROMPT, estimateTokens, languageInfo, presentRun } from '../../utils/quote.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { paginate, readSort } from '../../utils/pagination.js';
import { badRequest, conflict, notFound, unprocessable } from '../../utils/errors.js';

export const SORT_COLUMNS = { text: 'text', sortOrder: 'sortOrder', status: 'status', updatedAt: 'updatedAt' };

const START_LOCK_SECONDS = 20;
const LOCK_KEY = 'quote:start';
const who = (req) => req.auth.user.name || req.auth.user.email || 'an admin';

const summaryOf = (item) => ({ id: item.id, slug: item.slug, status: item.status, text: item.text });

/** The first words of a quote as a slug (ASCII, at most 70 characters), unique among the quotes. */
async function slugFor(text) {
  const base = text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').split('-').slice(0, 8).join('-').slice(0, 70).replace(/-+$/, '') || 'quote';
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`;
    if (!(await prisma.quote.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** GET /api/admin/quotes/overview — what the page needs before anything is chosen. */
export const overview = async (req, res) => {
  const provider = service.defaultProvider();
  const [byStatus, coverage, workerOnline, active] = await Promise.all([
    prisma.quote.groupBy({ by: ['status'], _count: { _all: true } }),
    service.coverage(),
    translationService.workerOnline(),
    prisma.quoteRun.findMany({ where: { status: { in: ACTIVE_STATUSES } }, orderBy: { createdAt: 'asc' } }),
  ]);

  const count = (status) => byStatus.find((r) => r.status === status)?._count._all ?? 0;
  const providers = service.providers();
  return ok(res, {
    counts: { published: count('PUBLISHED'), draft: count('DRAFT'), excluded: count('EXCLUDED'), total: byStatus.reduce((n, r) => n + r._count._all, 0) },
    statuses: STATUSES,
    languages: coverage.languages,
    publishedTotal: coverage.total,
    translation: {
      providers,
      defaultProvider: provider,
      model: service.model(provider),
      apiKeyConfigured: providers.find((p) => p.id === provider)?.apiKeyConfigured ?? false,
      workerOnline,
      batchSize: quote.batchSize,
      promptVersion: PROMPT_VERSION,
    },
    active: active.map((row) => presentRun(row)),
  });
};

/** GET /api/admin/quotes/items */
export const list = async (req, res) => {
  const { q, status, language, untranslated } = req.valid.query;
  const where = {
    ...(status ? { status } : {}),
    ...(language && untranslated === 'true' ? { translations: { none: { languageCode: language, text: { not: '' } } } } : {}),
    ...(q
      ? {
          OR: [
            { text: { contains: q, mode: 'insensitive' } },
            { reference: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const { items, page } = await paginate(prisma.quote, {
    where,
    orderBy: readSort(req.valid.query, SORT_COLUMNS, [{ sortOrder: 'asc' }, { id: 'asc' }]),
    select: {
      id: true, slug: true, sortOrder: true, text: true, status: true, excludedReason: true,
      reference: true, sourceName: true, author: true, isEdited: true, updatedAt: true,
      translations: { select: { languageCode: true, isEdited: true, isPublished: true } },
    },
    query: req.valid.query,
  });

  return paginated(
    res,
    items.map(({ translations, ...item }) => ({ ...item, translations: translations.map((t) => ({ language: t.languageCode, isEdited: t.isEdited, isPublished: t.isPublished })) })),
    page
  );
};

/** GET /api/admin/quotes/items/:id — one item with every translation. */
export const get = async (req, res) => {
  const row = await prisma.quote.findUnique({
    where: { id: req.valid.params.id },
    include: { translations: { orderBy: { languageCode: 'asc' } } },
  });
  if (!row) throw notFound('Quote');
  const { translations, ...item } = row;
  return ok(res, {
    ...item,
    translations: translations.map((t) => ({
      language: t.languageCode, text: t.text, translatedBy: t.translatedBy, isEdited: t.isEdited, isPublished: t.isPublished, updatedAt: t.updatedAt,
    })),
  });
};

/** POST /api/admin/quotes/items — a new English item. */
export const create = async (req, res) => {
  const data = req.valid.body;
  const top = await prisma.quote.aggregate({ _max: { sortOrder: true } });
  const status = data.status ?? 'DRAFT';
  if (status === 'EXCLUDED' && !data.excludedReason) throw badRequest('Say why it is excluded.');

  const row = await prisma.quote.create({
    data: {
      slug: await slugFor(data.text),
      sortOrder: data.sortOrder ?? (top._max.sortOrder ?? 0) + 10,
      text: data.text,
      reference: data.reference ?? null,
      author: data.author ?? null,
      sourceName: data.sourceName ?? null,
      sourceUrl: data.sourceUrl ?? null,
      status,
      excludedReason: status === 'EXCLUDED' ? data.excludedReason : null,
      isEdited: true,
    },
  });
  await audit.record(req, { action: 'quote.create', entityType: 'Quote', entityId: row.id, after: summaryOf(row) });
  return created(res, row);
};

/** PATCH /api/admin/quotes/items/:id — the English wording, order, author and source. */
export const update = async (req, res) => {
  const { id } = req.valid.params;
  const before = await prisma.quote.findUnique({ where: { id } });
  if (!before) throw notFound('Quote');
  const data = req.valid.body;

  const row = await prisma.quote.update({ where: { id }, data: { ...data, isEdited: true } });
  await audit.record(req, { action: 'quote.update', entityType: 'Quote', entityId: id, before: summaryOf(before), after: { ...summaryOf(row), changed: Object.keys(data) } });
  return ok(res, row);
};

/** POST /api/admin/quotes/items/:id/status — publish, hold back as a draft, or exclude with a reason. */
export const setStatus = async (req, res) => {
  const { id } = req.valid.params;
  const { status, reason } = req.valid.body;
  const before = await prisma.quote.findUnique({ where: { id } });
  if (!before) throw notFound('Quote');
  if (status === 'EXCLUDED' && !reason?.trim()) throw badRequest('Say why it is excluded, so the next person knows.');

  const row = await prisma.quote.update({
    where: { id },
    data: { status, excludedReason: status === 'EXCLUDED' ? reason.trim() : null, isEdited: true },
  });
  await audit.record(req, { action: `quote.${status.toLowerCase()}`, entityType: 'Quote', entityId: id, before: summaryOf(before), after: { ...summaryOf(row), reason: row.excludedReason } });
  return ok(res, row);
};

/** PUT /api/admin/quotes/items/:id/translations/:language — a translation written or corrected by hand. */
export const saveTranslation = async (req, res) => {
  const { id, language } = req.valid.params;
  if (!languageInfo(language)) throw badRequest(`"${language}" is not a language quotes are translated into.`);
  const item = await prisma.quote.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!item) throw notFound('Quote');
  const { text, isPublished } = req.valid.body;

  const where = { quoteId_languageCode: { quoteId: id, languageCode: language } };
  const data = { text, isPublished: isPublished ?? true, translatedBy: 'admin', isEdited: true };
  const row = await prisma.quoteTranslation.upsert({ where, create: { quoteId: id, languageCode: language, ...data }, update: data });
  await audit.record(req, { action: 'quote.translation.save', entityType: 'QuoteTranslation', entityId: row.id, after: { slug: item.slug, language } });
  return ok(res, row);
};

/** DELETE /api/admin/quotes/items/:id/translations/:language — so a run can translate it again. */
export const deleteTranslation = async (req, res) => {
  const { id, language } = req.valid.params;
  const row = await prisma.quoteTranslation.findUnique({ where: { quoteId_languageCode: { quoteId: id, languageCode: language } } });
  if (!row) throw notFound('Translation');
  await prisma.quoteTranslation.delete({ where: { id: row.id } });
  await audit.record(req, { action: 'quote.translation.delete', entityType: 'QuoteTranslation', entityId: row.id, before: { quoteId: id, language } });
  return ok(res, { deleted: true });
};

/* ---------- translation runs ---------- */

/** GET /api/admin/quotes/estimate — what a run would do. Nothing is spent. */
export const estimate = async (req, res) => {
  const { language, force } = req.valid.query;
  if (!languageInfo(language)) throw badRequest(`"${language}" is not a language quotes are translated into.`);
  const todo = await service.itemsToTranslate(language, force === 'true');
  const inputTokens = todo.reduce((n, i) => n + estimateTokens(i.text), 0);
  const requests = Math.ceil(todo.length / quote.batchSize);
  const system = estimateTokens(SYSTEM_PROMPT) * requests;
  return ok(res, {
    language,
    willTranslate: todo.length,
    requests,
    inputTokens: inputTokens + system,
    // Indic scripts take several tokens a letter, so the answer is about three times the English that went in.
    outputTokens: inputTokens * 3,
    minutes: requests ? Math.max(1, Math.ceil((requests * 30) / 60)) : 0,
  });
};

/** GET /api/admin/quotes/runs */
export const listRuns = async (req, res) => {
  const { status, language } = req.valid.query;
  const { items, page } = await paginate(prisma.quoteRun, {
    where: { ...(status && { status }), ...(language && { language }) },
    orderBy: { createdAt: 'desc' },
    query: req.valid.query,
    defaultPageSize: 20,
  });
  const now = new Date();
  return paginated(res, items.map((row) => presentRun(row, now)), page);
};

/** GET /api/admin/quotes/runs/:id — one run and its activity feed. */
export const getRun = async (req, res) => {
  const row = await prisma.quoteRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Quote run');
  return ok(res, { run: presentRun(row), feed: await service.readFeed(row.id, 100) });
};

/** POST /api/admin/quotes/runs */
export const startRun = async (req, res) => {
  const { language, force } = req.valid.body;
  if (!languageInfo(language)) throw badRequest(`"${language}" is not a language quotes are translated into.`);
  const provider = req.valid.body.provider ?? service.defaultProvider();
  const modelId = req.valid.body.model ?? service.model(provider);

  const info = service.providers().find((p) => p.id === provider);
  if (!info.apiKeyConfigured) throw unprocessable(`${info.keyEnv} is not set on the server, so ${info.company} cannot be called.`);

  const gotLock = await redis.set(LOCK_KEY, req.auth.user.id, 'EX', START_LOCK_SECONDS, 'NX');
  if (!gotLock) throw conflict('A run is being started. Try again in a moment.');

  try {
    const sameLanguage = await prisma.quoteRun.findFirst({ where: { language, status: { in: ACTIVE_STATUSES } }, select: { id: true } });
    if (sameLanguage) throw conflict(`A run into ${languageInfo(language).name} is already waiting or working. Cancel it first, or let it finish.`);

    const todo = await service.itemsToTranslate(language, force ?? false);
    if (todo.length === 0) throw conflict(`Every published item is already translated into ${languageInfo(language).name}. Choose “Translate again” to replace them (words an editor wrote are kept).`, { upToDate: true });

    // A run started while another is going waits its turn: the worker takes them in the order they were made, one at a time.
    const row = await prisma.quoteRun.create({
      data: {
        language, provider, model: modelId, force: force ?? false,
        status: 'QUEUED', statusMessage: 'Waiting for the worker.',
        requestedById: req.auth.user.id, requestedByName: req.auth.user.name || req.auth.user.email || null,
      },
    });

    let current = row;
    try {
      const jobId = service.newJobId(row.id);
      current = await prisma.quoteRun.update({ where: { id: row.id }, data: { jobId } });
      await service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Queued by ${row.requestedByName || 'an admin'}: ${todo.length} items into ${languageInfo(language).name} with ${provider} ${modelId}.` });
      await service.addRunJob(row.id, jobId);
    } catch (err) {
      logger.error({ err: err.message, runId: row.id }, 'could not queue a quote run');
      current = await prisma.quoteRun.update({ where: { id: row.id }, data: { status: 'FAILED', finishedAt: new Date(), statusMessage: `Could not be queued: ${err.message}` } });
      service.publishRun(current);
      throw unprocessable('The run could not be put on the queue. Is Redis reachable?');
    }

    await audit.record(req, { action: 'quote.run.start', entityType: 'QuoteRun', entityId: row.id, after: { language, force: row.force, provider, model: modelId, items: todo.length } });
    service.publishRun(current);
    return created(res, presentRun(current));
  } finally {
    await redis.del(LOCK_KEY).catch(() => {});
  }
};

/** POST /api/admin/quotes/runs/:id/resume */
export const resumeRun = async (req, res) => {
  const row = await prisma.quoteRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Quote run');
  if (row.status !== 'PAUSED' && row.status !== 'FAILED') throw conflict(`Only a paused or failed run can be resumed — this one is ${row.status.toLowerCase()}.`);
  const next = await prisma.quoteRun.update({
    where: { id: row.id },
    data: { status: 'QUEUED', pauseReason: null, statusMessage: 'Resumed. Waiting for the worker.', stopReason: null, resumeAt: null, retriesInARow: 0, cancelRequested: false, finishedAt: null },
  });
  await service.ensureRunJob(next);
  const fresh = await prisma.quoteRun.findUnique({ where: { id: row.id } });

  await audit.record(req, { action: 'quote.run.resume', entityType: 'QuoteRun', entityId: row.id, before: { id: row.id, status: row.status, language: row.language }, after: { status: 'QUEUED' } });
  service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Resumed by ${who(req)}.` });
  service.publishRun(fresh);
  return ok(res, presentRun(fresh));
};

/** POST /api/admin/quotes/runs/:id/cancel */
export const cancelRun = async (req, res) => {
  const row = await prisma.quoteRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Quote run');
  if (!ACTIVE_STATUSES.includes(row.status)) throw conflict(`This run is already ${row.status.toLowerCase()}.`);

  const askOnly = row.status === 'RUNNING' && !presentRun(row).stalled;
  let next;
  if (askOnly) {
    next = await prisma.quoteRun.update({ where: { id: row.id }, data: { cancelRequested: true, statusMessage: 'Cancelling after the request in progress…' } });
  } else {
    const done = await prisma.quoteRun.updateMany({
      where: { id: row.id, status: row.status, jobId: row.jobId },
      data: { status: 'CANCELLED', cancelRequested: false, resumeAt: null, finishedAt: new Date(), statusMessage: `Cancelled by ${who(req)}.` },
    });
    if (done.count === 0) throw conflict('The run changed while it was being cancelled. Look again.');
    await service.dropRunJob(row);
    next = await prisma.quoteRun.findUnique({ where: { id: row.id } });
  }

  await audit.record(req, { action: 'quote.run.cancel', entityType: 'QuoteRun', entityId: row.id, before: { id: row.id, status: row.status, language: row.language }, after: { status: next.status, cancelRequested: next.cancelRequested } });
  service.pushFeed(row.id, { kind: 'status', level: 'warn', text: `Cancel requested by ${who(req)}.` });
  service.publishRun(next);
  return ok(res, presentRun(next));
};

export const LANGUAGE_CODES = languages.map((l) => l.code);
