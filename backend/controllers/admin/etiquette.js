// Devotee etiquette in the admin panel: the English items (see, edit, publish, exclude), their translations (see,
// edit by hand, delete), and the runs that translate the items into a language.
//
// An item is PUBLISHED (readers see it and it can be the day's push), DRAFT (not yet) or EXCLUDED (kept, with the reason,
// and never shown or pushed — for etiquette that would speak ill of a faith or a deity). Anything an admin changes
// is marked `isEdited`, which is what stops the seed (and a translation run) from writing over it.
//
// A run is an `EtiquetteRun` row worked by the worker (jobs/processors/etiquette.js), the same shape as Scenes: Cancel on
// a running run only sets `cancelRequested`, Resume is for a paused or failed run and carries on from the first item
// that has no translation.

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import logger from '../../config/logger.js';
import { etiquette, categories, languages } from '../../config/etiquette.js';
import { ETIQUETTE_DEFAULT_DELIVERY_TIME, SETTING_KEYS } from '../../config/constants.js';
import * as audit from '../../services/audit.js';
import * as settings from '../../services/setting.js';
import * as translationService from '../../services/translation.js';
import * as service from '../../services/etiquette.js';
import { ACTIVE_STATUSES } from '../../utils/translation-run.js';
import { PROMPT_VERSION, STATUSES, SYSTEM_PROMPT, estimateTokens, isCategory, languageInfo, presentRun } from '../../utils/etiquette.js';
import { localDateString, toDateColumn } from '../../utils/date.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { paginate, readSort } from '../../utils/pagination.js';
import { badRequest, conflict, notFound, unprocessable } from '../../utils/errors.js';

export const SORT_COLUMNS = { title: 'title', category: 'category', sortOrder: 'sortOrder', status: 'status', updatedAt: 'updatedAt' };

const START_LOCK_SECONDS = 20;
const LOCK_KEY = 'etiquette:start';
const who = (req) => req.auth.user.name || req.auth.user.email || 'an admin';

const summaryOf = (item) => ({ id: item.id, slug: item.slug, category: item.category, status: item.status, title: item.title });

/** "Offer the right place" → "offer-the-right-place" (ASCII, at most 70 characters), unique among the items. */
async function slugFor(title) {
  const base = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '') || 'etiquette';
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`;
    if (!(await prisma.etiquette.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** GET /api/admin/etiquette/overview — what the page needs before anything is chosen. */
export const overview = async (req, res) => {
  const provider = service.defaultProvider();
  const [byStatus, byCategory, coverage, deliveryTime, workerOnline, active, todayRow] = await Promise.all([
    prisma.etiquette.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.etiquette.groupBy({ by: ['category', 'status'], _count: { _all: true } }),
    service.coverage(),
    settings.get(SETTING_KEYS.ETIQUETTE_DELIVERY_TIME),
    translationService.workerOnline(),
    prisma.etiquetteRun.findMany({ where: { status: { in: ACTIVE_STATUSES } }, orderBy: { createdAt: 'asc' } }),
    // Today's item as readers in India see it — only when it has been made, so looking at this page never decides the day.
    prisma.etiquetteDay.findUnique({ where: { date: toDateColumn(localDateString('Asia/Kolkata')) }, include: { etiquette: { select: { id: true, slug: true, title: true, category: true } } } }),
  ]);

  const count = (status) => byStatus.find((r) => r.status === status)?._count._all ?? 0;
  const providers = service.providers();
  return ok(res, {
    counts: { published: count('PUBLISHED'), draft: count('DRAFT'), excluded: count('EXCLUDED'), total: byStatus.reduce((n, r) => n + r._count._all, 0) },
    categories: categories.map((c) => ({
      ...c,
      published: byCategory.find((r) => r.category === c.id && r.status === 'PUBLISHED')?._count._all ?? 0,
      total: byCategory.filter((r) => r.category === c.id).reduce((n, r) => n + r._count._all, 0),
    })),
    statuses: STATUSES,
    languages: coverage.languages,
    publishedTotal: coverage.total,
    delivery: { time: deliveryTime || ETIQUETTE_DEFAULT_DELIVERY_TIME, defaultTime: ETIQUETTE_DEFAULT_DELIVERY_TIME, settingKey: SETTING_KEYS.ETIQUETTE_DELIVERY_TIME, today: todayRow?.etiquette ?? null },
    translation: {
      providers,
      defaultProvider: provider,
      model: service.model(provider),
      apiKeyConfigured: providers.find((p) => p.id === provider)?.apiKeyConfigured ?? false,
      workerOnline,
      batchSize: etiquette.batchSize,
      promptVersion: PROMPT_VERSION,
    },
    active: active.map((row) => presentRun(row)),
  });
};

/** GET /api/admin/etiquette/items */
export const list = async (req, res) => {
  const { q, category, status, language, untranslated } = req.valid.query;
  const where = {
    ...(category ? { category } : {}),
    ...(status ? { status } : {}),
    ...(language && untranslated === 'true' ? { translations: { none: { languageCode: language, title: { not: '' } } } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { summary: { contains: q, mode: 'insensitive' } },
            { body: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const { items, page } = await paginate(prisma.etiquette, {
    where,
    orderBy: readSort(req.valid.query, SORT_COLUMNS, [{ category: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }]),
    select: {
      id: true, slug: true, category: true, sortOrder: true, title: true, summary: true, status: true, excludedReason: true,
      sourceName: true, author: true, isEdited: true, updatedAt: true,
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

/** GET /api/admin/etiquette/items/:id — one item with every translation. */
export const get = async (req, res) => {
  const row = await prisma.etiquette.findUnique({
    where: { id: req.valid.params.id },
    include: { translations: { orderBy: { languageCode: 'asc' } }, _count: { select: { days: true, deliveries: true } } },
  });
  if (!row) throw notFound('Etiquette');
  const { _count, translations, ...item } = row;
  return ok(res, {
    ...item,
    timesShown: _count.days,
    timesPushed: _count.deliveries,
    translations: translations.map((t) => ({
      language: t.languageCode, title: t.title, summary: t.summary, body: t.body, translatedBy: t.translatedBy, isEdited: t.isEdited, isPublished: t.isPublished, updatedAt: t.updatedAt,
    })),
  });
};

/** POST /api/admin/etiquette/items — a new English item. */
export const create = async (req, res) => {
  const data = req.valid.body;
  if (!isCategory(data.category)) throw badRequest(`"${data.category}" is not a category.`);
  const top = await prisma.etiquette.aggregate({ where: { category: data.category }, _max: { sortOrder: true } });
  const status = data.status ?? 'DRAFT';
  if (status === 'EXCLUDED' && !data.excludedReason) throw badRequest('Say why it is excluded.');

  const row = await prisma.etiquette.create({
    data: {
      slug: await slugFor(data.title),
      category: data.category,
      sortOrder: data.sortOrder ?? (top._max.sortOrder ?? 0) + 10,
      title: data.title,
      summary: data.summary,
      body: data.body,
      reference: data.reference ?? null,
      author: data.author ?? null,
      sourceName: data.sourceName ?? null,
      sourceUrl: data.sourceUrl ?? null,
      status,
      excludedReason: status === 'EXCLUDED' ? data.excludedReason : null,
      isEdited: true,
    },
  });
  await audit.record(req, { action: 'etiquette.create', entityType: 'Etiquette', entityId: row.id, after: summaryOf(row) });
  return created(res, row);
};

/** PATCH /api/admin/etiquette/items/:id — the English wording, category, order, author and source. */
export const update = async (req, res) => {
  const { id } = req.valid.params;
  const before = await prisma.etiquette.findUnique({ where: { id } });
  if (!before) throw notFound('Etiquette');
  const data = req.valid.body;
  if (data.category !== undefined && !isCategory(data.category)) throw badRequest(`"${data.category}" is not a category.`);

  const row = await prisma.etiquette.update({ where: { id }, data: { ...data, isEdited: true } });
  await audit.record(req, { action: 'etiquette.update', entityType: 'Etiquette', entityId: id, before: summaryOf(before), after: { ...summaryOf(row), changed: Object.keys(data) } });
  return ok(res, row);
};

/** POST /api/admin/etiquette/items/:id/status — publish, hold back as a draft, or exclude with a reason. */
export const setStatus = async (req, res) => {
  const { id } = req.valid.params;
  const { status, reason } = req.valid.body;
  const before = await prisma.etiquette.findUnique({ where: { id } });
  if (!before) throw notFound('Etiquette');
  if (status === 'EXCLUDED' && !reason?.trim()) throw badRequest('Say why it is excluded, so the next person knows.');

  const row = await prisma.etiquette.update({
    where: { id },
    data: { status, excludedReason: status === 'EXCLUDED' ? reason.trim() : null, isEdited: true },
  });
  await audit.record(req, { action: `etiquette.${status.toLowerCase()}`, entityType: 'Etiquette', entityId: id, before: summaryOf(before), after: { ...summaryOf(row), reason: row.excludedReason } });
  return ok(res, row);
};

/** PUT /api/admin/etiquette/items/:id/translations/:language — a translation written or corrected by hand. */
export const saveTranslation = async (req, res) => {
  const { id, language } = req.valid.params;
  if (!languageInfo(language)) throw badRequest(`"${language}" is not a language etiquette is translated into.`);
  const item = await prisma.etiquette.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!item) throw notFound('Etiquette');
  const { title, summary, body, isPublished } = req.valid.body;

  const where = { etiquetteId_languageCode: { etiquetteId: id, languageCode: language } };
  const data = { title, summary, body, isPublished: isPublished ?? true, translatedBy: 'admin', isEdited: true };
  const row = await prisma.etiquetteTranslation.upsert({ where, create: { etiquetteId: id, languageCode: language, ...data }, update: data });
  await audit.record(req, { action: 'etiquette.translation.save', entityType: 'EtiquetteTranslation', entityId: row.id, after: { slug: item.slug, language } });
  return ok(res, row);
};

/** DELETE /api/admin/etiquette/items/:id/translations/:language — so a run can translate it again. */
export const deleteTranslation = async (req, res) => {
  const { id, language } = req.valid.params;
  const row = await prisma.etiquetteTranslation.findUnique({ where: { etiquetteId_languageCode: { etiquetteId: id, languageCode: language } } });
  if (!row) throw notFound('Translation');
  await prisma.etiquetteTranslation.delete({ where: { id: row.id } });
  await audit.record(req, { action: 'etiquette.translation.delete', entityType: 'EtiquetteTranslation', entityId: row.id, before: { etiquetteId: id, language } });
  return ok(res, { deleted: true });
};

/* ---------- translation runs ---------- */

/** GET /api/admin/etiquette/estimate — what a run would do. Nothing is spent. */
export const estimate = async (req, res) => {
  const { language, force } = req.valid.query;
  if (!languageInfo(language)) throw badRequest(`"${language}" is not a language etiquette is translated into.`);
  const todo = await service.itemsToTranslate(language, force === 'true');
  const inputTokens = todo.reduce((n, i) => n + estimateTokens(i.title, i.summary, i.body), 0);
  const requests = Math.ceil(todo.length / etiquette.batchSize);
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

/** GET /api/admin/etiquette/runs */
export const listRuns = async (req, res) => {
  const { status, language } = req.valid.query;
  const { items, page } = await paginate(prisma.etiquetteRun, {
    where: { ...(status && { status }), ...(language && { language }) },
    orderBy: { createdAt: 'desc' },
    query: req.valid.query,
    defaultPageSize: 20,
  });
  const now = new Date();
  return paginated(res, items.map((row) => presentRun(row, now)), page);
};

/** GET /api/admin/etiquette/runs/:id — one run and its activity feed. */
export const getRun = async (req, res) => {
  const row = await prisma.etiquetteRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Etiquette run');
  return ok(res, { run: presentRun(row), feed: await service.readFeed(row.id, 100) });
};

/** POST /api/admin/etiquette/runs */
export const startRun = async (req, res) => {
  const { language, force } = req.valid.body;
  if (!languageInfo(language)) throw badRequest(`"${language}" is not a language etiquette is translated into.`);
  const provider = req.valid.body.provider ?? service.defaultProvider();
  const modelId = req.valid.body.model ?? service.model(provider);

  const info = service.providers().find((p) => p.id === provider);
  if (!info.apiKeyConfigured) throw unprocessable(`${info.keyEnv} is not set on the server, so ${info.company} cannot be called.`);

  const gotLock = await redis.set(LOCK_KEY, req.auth.user.id, 'EX', START_LOCK_SECONDS, 'NX');
  if (!gotLock) throw conflict('A run is being started. Try again in a moment.');

  try {
    const sameLanguage = await prisma.etiquetteRun.findFirst({ where: { language, status: { in: ACTIVE_STATUSES } }, select: { id: true } });
    if (sameLanguage) throw conflict(`A run into ${languageInfo(language).name} is already waiting or working. Cancel it first, or let it finish.`);

    const todo = await service.itemsToTranslate(language, force ?? false);
    if (todo.length === 0) throw conflict(`Every published item is already translated into ${languageInfo(language).name}. Choose “Translate again” to replace them (words an editor wrote are kept).`, { upToDate: true });

    // A run started while another is going waits its turn: the worker takes them in the order they were made, one at a time.
    const row = await prisma.etiquetteRun.create({
      data: {
        language, provider, model: modelId, force: force ?? false,
        status: 'QUEUED', statusMessage: 'Waiting for the worker.',
        requestedById: req.auth.user.id, requestedByName: req.auth.user.name || req.auth.user.email || null,
      },
    });

    let current = row;
    try {
      const jobId = service.newJobId(row.id);
      current = await prisma.etiquetteRun.update({ where: { id: row.id }, data: { jobId } });
      await service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Queued by ${row.requestedByName || 'an admin'}: ${todo.length} items into ${languageInfo(language).name} with ${provider} ${modelId}.` });
      await service.addRunJob(row.id, jobId);
    } catch (err) {
      logger.error({ err: err.message, runId: row.id }, 'could not queue an etiquette run');
      current = await prisma.etiquetteRun.update({ where: { id: row.id }, data: { status: 'FAILED', finishedAt: new Date(), statusMessage: `Could not be queued: ${err.message}` } });
      service.publishRun(current);
      throw unprocessable('The run could not be put on the queue. Is Redis reachable?');
    }

    await audit.record(req, { action: 'etiquette.run.start', entityType: 'EtiquetteRun', entityId: row.id, after: { language, force: row.force, provider, model: modelId, items: todo.length } });
    service.publishRun(current);
    return created(res, presentRun(current));
  } finally {
    await redis.del(LOCK_KEY).catch(() => {});
  }
};

/** POST /api/admin/etiquette/runs/:id/resume */
export const resumeRun = async (req, res) => {
  const row = await prisma.etiquetteRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Etiquette run');
  if (row.status !== 'PAUSED' && row.status !== 'FAILED') throw conflict(`Only a paused or failed run can be resumed — this one is ${row.status.toLowerCase()}.`);
  const next = await prisma.etiquetteRun.update({
    where: { id: row.id },
    data: { status: 'QUEUED', pauseReason: null, statusMessage: 'Resumed. Waiting for the worker.', stopReason: null, resumeAt: null, retriesInARow: 0, cancelRequested: false, finishedAt: null },
  });
  await service.ensureRunJob(next);
  const fresh = await prisma.etiquetteRun.findUnique({ where: { id: row.id } });

  await audit.record(req, { action: 'etiquette.run.resume', entityType: 'EtiquetteRun', entityId: row.id, before: { id: row.id, status: row.status, language: row.language }, after: { status: 'QUEUED' } });
  service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Resumed by ${who(req)}.` });
  service.publishRun(fresh);
  return ok(res, presentRun(fresh));
};

/** POST /api/admin/etiquette/runs/:id/cancel */
export const cancelRun = async (req, res) => {
  const row = await prisma.etiquetteRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Etiquette run');
  if (!ACTIVE_STATUSES.includes(row.status)) throw conflict(`This run is already ${row.status.toLowerCase()}.`);

  const askOnly = row.status === 'RUNNING' && !presentRun(row).stalled;
  let next;
  if (askOnly) {
    next = await prisma.etiquetteRun.update({ where: { id: row.id }, data: { cancelRequested: true, statusMessage: 'Cancelling after the request in progress…' } });
  } else {
    const done = await prisma.etiquetteRun.updateMany({
      where: { id: row.id, status: row.status, jobId: row.jobId },
      data: { status: 'CANCELLED', cancelRequested: false, resumeAt: null, finishedAt: new Date(), statusMessage: `Cancelled by ${who(req)}.` },
    });
    if (done.count === 0) throw conflict('The run changed while it was being cancelled. Look again.');
    await service.dropRunJob(row);
    next = await prisma.etiquetteRun.findUnique({ where: { id: row.id } });
  }

  await audit.record(req, { action: 'etiquette.run.cancel', entityType: 'EtiquetteRun', entityId: row.id, before: { id: row.id, status: row.status, language: row.language }, after: { status: next.status, cancelRequested: next.cancelRequested } });
  service.pushFeed(row.id, { kind: 'status', level: 'warn', text: `Cancel requested by ${who(req)}.` });
  service.publishRun(next);
  return ok(res, presentRun(next));
};

export const LANGUAGE_CODES = languages.map((l) => l.code);
