// Prayers in the admin panel: the prayers (add, edit, publish, hold back, delete), their verses (saved as one ordered
// list), what each language holds for a prayer (see, write by hand, delete), and the runs that write the translations and
// the other-script renderings with the provider and model the admin picks.
//
// A prayer is PUBLISHED (readers see it and a run writes it) or DRAFT (neither). Its verses are written in the script of
// its `originalLanguage`; a reader of another script gets them from a rule at read time or from a run (`howText`,
// config/prayer.js). A row a person wrote or corrected is marked `isEdited`, and a run never writes over what is in it.
//
// A run is a `PrayerRun` row worked by the worker (jobs/processors/prayer.js), the same shape as Etiquette and the Hindu
// calendar: Cancel on a running run only sets `cancelRequested`, Resume is for a paused or failed run and carries on from
// the first prayer that still has something to write.

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import logger from '../../config/logger.js';
import { prayer as cfg, categories, howText, languages } from '../../config/prayer.js';
import { DEFAULT_LANGUAGE } from '../../config/constants.js';
import * as audit from '../../services/audit.js';
import * as translationService from '../../services/translation.js';
import * as service from '../../services/prayer.js';
import { whyNotUsable } from '../../scripts/lib/translate-providers.js';
import { ACTIVE_STATUSES } from '../../utils/translation-run.js';
import { PROMPT_VERSION, SYSTEM_PROMPT, editorOf, estimateTokens, languageInfo, languageSummaries, presentItem, presentRun, presentVerse } from '../../utils/prayer.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { paginate, readSort } from '../../utils/pagination.js';
import { badRequest, conflict, notFound, unprocessable } from '../../utils/errors.js';

export const SORT_COLUMNS = { title: 'title', category: 'category', status: 'status', sortOrder: 'sortOrder', updatedAt: 'updatedAt' };

/** Every language a prayer can be written in: English (the Roman spelling of the verses) and the 11 app languages. */
export const LANGUAGE_CODES = languages.map((l) => l.code);

const START_LOCK_SECONDS = 20;
const LOCK_KEY = 'prayer:start';
const who = (req) => req.auth.user.name || req.auth.user.email || 'an admin';
/** What `translatedBy` says of a row written by hand: the admin's name (the column holds 60 characters). */
const editor = (req) => (req.auth.user.name || req.auth.user.email || 'admin').slice(0, 60);
const filled = (value) => typeof value === 'string' && value.trim().length > 0;

// A request carries its items as JSON lines: the keys and quotes around the text are tokens too.
const ITEM_OVERHEAD_TOKENS = 18;
const SECONDS_PER_REQUEST = 25;
// An answer in an Indic script takes several tokens a letter, so a meaning or a heading comes back at about three times the
// English that went in; a verse written out in another script is about the length of the original (Roman letters with
// their marks a little more).
const WORDING_OUTPUT_FACTOR = 3;
const RENDERING_OUTPUT_FACTOR = 1.5;

const notALanguage = (code) => badRequest(`"${code}" is not a language prayers are written in.`);
const summaryOf = (prayer) => ({ id: prayer.id, slug: prayer.slug, category: prayer.category, status: prayer.status, title: prayer.title });

/** "Śrī Guru Vandanā" → "sri-guru-vandana" (ASCII, at most 70 characters), unique among the prayers. */
async function slugFor(title) {
  const base =
    title.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '') || 'prayer';
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`;
    if (!(await prisma.prayer.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* ---------- a prayer as the editor receives it ---------- */

const inReadingOrder = [{ position: 'asc' }, { id: 'asc' }];

/** The whole prayer: its headings in every language and its verses with theirs. */
const detailInclude = { translations: true, verses: { orderBy: inReadingOrder, include: { translations: true } } };

/** Only one language's rows, for the page that edits that language. */
const inLanguage = (language) => ({
  translations: { where: { languageCode: language } },
  verses: { orderBy: inReadingOrder, include: { translations: { where: { languageCode: language } } } },
});

const detailOf = (row) => ({
  ...presentItem(row),
  verses: [...row.verses].map(presentVerse),
  languages: languageSummaries(row).map((l) => ({ ...l, name: languageInfo(l.code)?.name ?? l.code })),
});

async function loadDetail(id) {
  const row = await prisma.prayer.findUnique({ where: { id }, include: detailInclude });
  if (!row) throw notFound('Prayer');
  return detailOf(row);
}

/** GET /api/admin/prayers/overview — what the page needs before anything is chosen. */
export const overview = async (req, res) => {
  const provider = service.defaultProvider();
  const [byStatus, byCategory, verses, coverage, workerOnline, active] = await Promise.all([
    prisma.prayer.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.prayer.groupBy({ by: ['category', 'status'], _count: { _all: true } }),
    prisma.prayerVerse.count(),
    service.coverage(),
    translationService.workerOnline(),
    prisma.prayerRun.findMany({ where: { status: { in: ACTIVE_STATUSES } }, orderBy: { createdAt: 'asc' } }),
  ]);

  const count = (status) => byStatus.find((r) => r.status === status)?._count._all ?? 0;
  const providers = service.providers();
  return ok(res, {
    counts: { published: count('PUBLISHED'), draft: count('DRAFT'), total: byStatus.reduce((n, r) => n + r._count._all, 0), verses },
    categories: categories.map((c) => ({
      ...c,
      published: byCategory.find((r) => r.category === c.id && r.status === 'PUBLISHED')?._count._all ?? 0,
      total: byCategory.filter((r) => r.category === c.id).reduce((n, r) => n + r._count._all, 0),
    })),
    languages: coverage.languages,
    publishedTotal: coverage.total,
    translation: {
      providers,
      defaultProvider: provider,
      model: service.model(provider),
      apiKeyConfigured: providers.find((p) => p.id === provider)?.apiKeyConfigured ?? false,
      workerOnline,
      batchSize: cfg.sliceVerses,
      promptVersion: PROMPT_VERSION,
    },
    active: active.map((row) => presentRun(row)),
  });
};

/* ---------- the prayers ---------- */

/** GET /api/admin/prayers/items */
export const list = async (req, res) => {
  const { q, category, status } = req.valid.query;
  const where = {
    ...(category ? { category } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { summary: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
            { author: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const { items, page } = await paginate(prisma.prayer, {
    where,
    orderBy: readSort(req.valid.query, SORT_COLUMNS, [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]),
    select: {
      id: true, slug: true, category: true, sortOrder: true, originalLanguage: true, title: true, summary: true, status: true, updatedAt: true,
      _count: { select: { verses: true, translations: true } },
    },
    query: req.valid.query,
  });

  // `translatedLanguages` counts the headings: a heading row exists only where there is a translated title.
  return paginated(res, items.map(({ _count, ...item }) => ({ ...item, verseCount: _count.verses, translatedLanguages: _count.translations })), page);
};

/** GET /api/admin/prayers/items/:id — one prayer with its verses and what each language holds. */
export const get = async (req, res) => ok(res, await loadDetail(req.valid.params.id));

/** POST /api/admin/prayers/items — a new prayer, a draft, with its verses when they are pasted in. */
export const create = async (req, res) => {
  const data = req.valid.body;
  const top = await prisma.prayer.aggregate({ where: { category: data.category }, _max: { sortOrder: true } });

  const row = await prisma.prayer.create({
    data: {
      slug: await slugFor(data.title),
      category: data.category,
      sortOrder: data.sortOrder ?? (top._max.sortOrder ?? 0) + 10,
      originalLanguage: data.originalLanguage,
      title: data.title,
      summary: data.summary ?? null,
      about: data.about ?? null,
      author: data.author ?? null,
      reference: data.reference ?? null,
      sourceName: data.sourceName ?? null,
      sourceUrl: data.sourceUrl ?? null,
      status: 'DRAFT',
      verses: { create: (data.verses ?? []).map((v, index) => ({ position: index + 1, text: v.text, meaning: v.meaning || null })) },
    },
    include: detailInclude,
  });
  await audit.record(req, { action: 'prayer.create', entityType: 'Prayer', entityId: row.id, after: { ...summaryOf(row), verses: row.verses.length } });
  return created(res, detailOf(row));
};

/** PATCH /api/admin/prayers/items/:id — the English wording, category, order, original language and source. */
export const update = async (req, res) => {
  const { id } = req.valid.params;
  const before = await prisma.prayer.findUnique({ where: { id } });
  if (!before) throw notFound('Prayer');
  const data = req.valid.body;

  // The verses were written in the old language's script, so every rendering made from them is out of date.
  const languageChanged = data.originalLanguage !== undefined && data.originalLanguage !== before.originalLanguage;
  const [row] = await prisma.$transaction([
    prisma.prayer.update({ where: { id }, data }),
    ...(languageChanged ? [prisma.prayerVerse.updateMany({ where: { prayerId: id }, data: { textChangedAt: new Date() } })] : []),
  ]);
  await audit.record(req, { action: 'prayer.update', entityType: 'Prayer', entityId: id, before: summaryOf(before), after: { ...summaryOf(row), changed: Object.keys(data) } });
  return ok(res, await loadDetail(id));
};

/**
 * PUT /api/admin/prayers/items/:id/verses — the whole list of verses, in display order. A row with an `id` keeps it (its
 * translations hang off it), a row without one is new, and a verse that is not in the list is deleted with its
 * translations. A verse whose text changed is stamped, so the renderings made from the old words show as out of date.
 */
export const saveVerses = async (req, res) => {
  const { id } = req.valid.params;
  const { verses } = req.valid.body;
  const prayer = await prisma.prayer.findUnique({ where: { id }, select: { id: true, slug: true, status: true } });
  if (!prayer) throw notFound('Prayer');
  if (prayer.status === 'PUBLISHED' && verses.length === 0) throw badRequest('A published prayer needs at least one verse. Hold it back as a draft first, or keep a verse.');

  const have = await prisma.prayerVerse.findMany({ where: { prayerId: id }, select: { id: true, position: true, text: true, meaning: true } });
  const byId = new Map(have.map((v) => [v.id, v]));
  const named = verses.filter((v) => v.id);
  if (new Set(named.map((v) => v.id)).size !== named.length) throw badRequest('A verse is in the list twice.');
  if (named.some((v) => !byId.has(v.id))) throw conflict('The verses changed since this prayer was opened. Reload it and try again.');

  const now = new Date();
  const kept = new Set(named.map((v) => v.id));
  const removed = have.filter((v) => !kept.has(v.id));
  const writes = [];
  let added = 0;
  let edited = 0;

  verses.forEach((v, index) => {
    const position = index + 1;
    const meaning = v.meaning || null;
    const old = v.id ? byId.get(v.id) : null;
    if (!old) {
      added += 1;
      writes.push(prisma.prayerVerse.create({ data: { prayerId: id, position, text: v.text, meaning, textChangedAt: now } }));
      return;
    }
    const textChanged = old.text !== v.text;
    const meaningChanged = (old.meaning ?? null) !== meaning;
    if (!textChanged && !meaningChanged && old.position === position) return;
    if (textChanged || meaningChanged) edited += 1;
    writes.push(prisma.prayerVerse.update({ where: { id: old.id }, data: { position, text: v.text, meaning, ...(textChanged ? { textChangedAt: now } : {}) } }));
  });
  if (removed.length) writes.unshift(prisma.prayerVerse.deleteMany({ where: { id: { in: removed.map((v) => v.id) } } }));
  writes.push(prisma.prayer.update({ where: { id }, data: { updatedAt: now } }));
  await prisma.$transaction(writes);

  const saved = await prisma.prayerVerse.findMany({ where: { prayerId: id }, orderBy: inReadingOrder });
  await audit.record(req, {
    action: 'prayer.verses',
    entityType: 'Prayer',
    entityId: id,
    before: { slug: prayer.slug, verses: have.length },
    after: { slug: prayer.slug, verses: saved.length, added, removed: removed.length, edited },
  });
  return ok(res, saved.map(presentVerse));
};

/** POST /api/admin/prayers/items/:id/status — publish a prayer, or hold it back as a draft. */
export const setStatus = async (req, res) => {
  const { id } = req.valid.params;
  const { status } = req.valid.body;
  const before = await prisma.prayer.findUnique({ where: { id }, include: { _count: { select: { verses: true } } } });
  if (!before) throw notFound('Prayer');
  if (status === 'PUBLISHED' && before._count.verses === 0) throw badRequest('Add at least one verse before publishing this prayer.');

  if (before.status !== status) {
    const row = await prisma.prayer.update({ where: { id }, data: { status } });
    await audit.record(req, { action: 'prayer.status', entityType: 'Prayer', entityId: id, before: summaryOf(before), after: summaryOf(row) });
  }
  return ok(res, await loadDetail(id));
};

/** DELETE /api/admin/prayers/items/:id — the prayer, its verses and every translation of them. */
export const remove = async (req, res) => {
  const { id } = req.valid.params;
  const before = await prisma.prayer.findUnique({ where: { id }, include: { _count: { select: { verses: true } } } });
  if (!before) throw notFound('Prayer');
  await prisma.prayer.delete({ where: { id } });
  await audit.record(req, { action: 'prayer.delete', entityType: 'Prayer', entityId: id, before: { ...summaryOf(before), verses: before._count.verses } });
  return ok(res, { deleted: true });
};

/* ---------- one language of a prayer ---------- */

/** GET /api/admin/prayers/items/:id/translations/:language — the heading and each verse beside what is stored. */
export const getTranslation = async (req, res) => {
  const { id, language } = req.valid.params;
  const row = await prisma.prayer.findUnique({ where: { id }, include: inLanguage(language) });
  if (!row) throw notFound('Prayer');
  return ok(res, editorOf(row, language));
};

/**
 * PUT /api/admin/prayers/items/:id/translations/:language — a heading, meanings and verse spellings written or corrected
 * by hand. Whatever is written is marked as an admin's and a run never replaces it. A blank piece clears it (a row left
 * with nothing is deleted, so a run can fill it again); a blank title with a blank summary and about removes the heading.
 */
export const saveTranslation = async (req, res) => {
  const { id, language } = req.valid.params;
  const { header, verses } = req.valid.body;
  const isEnglish = language === DEFAULT_LANGUAGE;
  if (header && isEnglish) throw badRequest('English is the prayer itself: edit its title, summary and about on the prayer.');

  const row = await prisma.prayer.findUnique({ where: { id }, include: inLanguage(language) });
  if (!row) throw notFound('Prayer');
  const how = howText(row.originalLanguage, language);
  const byVerse = new Map(row.verses.map((v) => [v.id, v]));
  const by = editor(req);
  const now = new Date();
  const writes = [];

  if (header) {
    const stored = row.translations[0] ?? null;
    if (!header.title && (header.summary || header.about)) throw badRequest('Write the translated title first; the summary and about go with it.');
    if (!header.title) {
      if (stored) writes.push(prisma.prayerTranslation.delete({ where: { id: stored.id } }));
    } else {
      const data = { title: header.title, summary: header.summary || null, about: header.about || null, translatedBy: by, runId: null, isEdited: true };
      writes.push(
        stored
          ? prisma.prayerTranslation.update({ where: { id: stored.id }, data })
          : prisma.prayerTranslation.create({ data: { prayerId: id, languageCode: language, ...data } })
      );
    }
  }

  for (const item of verses) {
    const verse = byVerse.get(item.verseId);
    if (!verse) throw badRequest('A verse in the list is not part of this prayer. Reload it and try again.');
    const stored = verse.translations[0] ?? null;

    const data = {};
    if (item.text !== undefined) {
      if (how === 'same') throw badRequest(`${languageInfo(language).name} is written in the same script as this prayer, so there is no separate text to save.`);
      data.text = item.text || null;
      data.renderedAt = item.text ? now : null;
    }
    if (item.meaning !== undefined) {
      if (isEnglish) throw badRequest('English meanings are edited on the prayer’s verses.');
      data.meaning = item.meaning || null;
    }
    if (!Object.keys(data).length) continue;

    const left = { text: 'text' in data ? data.text : stored?.text, meaning: 'meaning' in data ? data.meaning : stored?.meaning };
    const empty = !filled(left.text) && !filled(left.meaning);
    if (!stored) {
      if (!empty) writes.push(prisma.prayerVerseTranslation.create({ data: { verseId: verse.id, languageCode: language, ...data, translatedBy: by, isEdited: true } }));
    } else if (empty) {
      writes.push(prisma.prayerVerseTranslation.delete({ where: { id: stored.id } }));
    } else {
      writes.push(prisma.prayerVerseTranslation.update({ where: { id: stored.id }, data: { ...data, translatedBy: by, runId: null, isEdited: true } }));
    }
  }

  if (writes.length) {
    await prisma.$transaction(writes);
    await audit.record(req, {
      action: 'prayer.translation.save',
      entityType: 'Prayer',
      entityId: id,
      after: { slug: row.slug, language, header: Boolean(header), verses: verses.length },
    });
  }

  const fresh = await prisma.prayer.findUnique({ where: { id }, include: inLanguage(language) });
  return ok(res, editorOf(fresh, language));
};

/** DELETE /api/admin/prayers/items/:id/translations/:language — everything written in the language, so a run can write it again. */
export const deleteTranslation = async (req, res) => {
  const { id, language } = req.valid.params;
  const prayer = await prisma.prayer.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!prayer) throw notFound('Prayer');

  const [verses, header] = await prisma.$transaction([
    prisma.prayerVerseTranslation.deleteMany({ where: { languageCode: language, verse: { prayerId: id } } }),
    prisma.prayerTranslation.deleteMany({ where: { prayerId: id, languageCode: language } }),
  ]);
  if (verses.count === 0 && header.count === 0) throw notFound('Translation');
  await audit.record(req, { action: 'prayer.translation.delete', entityType: 'Prayer', entityId: id, before: { slug: prayer.slug, language, header: header.count, verses: verses.count } });
  return ok(res, { deleted: true });
};

/* ---------- translation runs ---------- */

/** What the provider and model chosen would cost, from the catalogue's prices; null for a model it has none for. */
function costOf(provider, modelId, inputTokens, outputTokens) {
  const known = service.providers().find((p) => p.id === provider)?.models.find((m) => m.id === modelId);
  if (!known || known.inputPerMillion == null || known.outputPerMillion == null) return null;
  return Math.round(((inputTokens * known.inputPerMillion + outputTokens * known.outputPerMillion) / 1_000_000) * 10_000) / 10_000;
}

/**
 * GET /api/admin/prayers/estimate — what a run would do. Nothing is spent. It asks the same `needsOf` the run asks and
 * counts the requests the way the run makes them: one for a prayer's heading, then its verses twelve at a time.
 */
export const estimate = async (req, res) => {
  const { language, force } = req.valid.query;
  const provider = req.valid.query.provider ?? service.defaultProvider();
  const modelId = req.valid.query.model ?? service.model(provider);

  const todo = await service.prayersToTranslate(language, force === 'true');
  const byPiece = { headers: 0, renderings: 0, meanings: 0 };
  let requests = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const { prayer, needs } of todo) {
    byPiece.headers += needs.counts.headers;
    byPiece.renderings += needs.counts.renderings;
    byPiece.meanings += needs.counts.meanings;

    if (needs.header) {
      const english = estimateTokens(prayer.title, needs.header.summary ? prayer.summary : '', needs.header.about ? prayer.about : '');
      requests += 1;
      inputTokens += english + ITEM_OVERHEAD_TOKENS;
      outputTokens += english * WORDING_OUTPUT_FACTOR + ITEM_OVERHEAD_TOKENS;
    }
    requests += Math.ceil(needs.verses.length / cfg.sliceVerses);
    for (const { verse, rendering, meaning } of needs.verses) {
      const original = rendering ? estimateTokens(verse.text) : 0;
      const english = meaning ? estimateTokens(verse.meaning) : 0;
      inputTokens += original + english + ITEM_OVERHEAD_TOKENS;
      outputTokens += Math.ceil(original * RENDERING_OUTPUT_FACTOR + english * WORDING_OUTPUT_FACTOR) + ITEM_OVERHEAD_TOKENS;
    }
  }
  inputTokens += estimateTokens(SYSTEM_PROMPT) * requests;

  return ok(res, {
    language,
    provider,
    model: modelId,
    willTranslate: todo.length,
    byPiece,
    requests,
    inputTokens,
    outputTokens,
    costUsd: costOf(provider, modelId, inputTokens, outputTokens),
    minutes: requests ? Math.max(1, Math.ceil((requests * SECONDS_PER_REQUEST) / 60)) : 0,
    unusable: whyNotUsable(provider, modelId),
  });
};

/** GET /api/admin/prayers/runs */
export const listRuns = async (req, res) => {
  const { status, language } = req.valid.query;
  const { items, page } = await paginate(prisma.prayerRun, {
    where: { ...(status && { status }), ...(language && { language }) },
    orderBy: { createdAt: 'desc' },
    query: req.valid.query,
  });
  const now = new Date();
  return paginated(res, items.map((row) => presentRun(row, now)), page);
};

/** GET /api/admin/prayers/runs/:id — one run and its activity feed. */
export const getRun = async (req, res) => {
  const row = await prisma.prayerRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Prayer run');
  return ok(res, { run: presentRun(row), feed: await service.readFeed(row.id, 100) });
};

/** POST /api/admin/prayers/runs */
export const startRun = async (req, res) => {
  const { language, force } = req.valid.body;
  const name = languageInfo(language).name;
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
    // The admin panel opens this run when it is named, so the 409 carries its id.
    const sameLanguage = await prisma.prayerRun.findFirst({ where: { language, status: { in: ACTIVE_STATUSES } }, select: { id: true } });
    if (sameLanguage) throw conflict(`A run into ${name} is already waiting or working. Cancel it first, or let it finish.`, { runId: sameLanguage.id });

    const todo = await service.prayersToTranslate(language, force ?? false);
    if (todo.length === 0) {
      const published = await prisma.prayer.count({ where: { status: 'PUBLISHED', verses: { some: {} } } });
      throw conflict(
        published === 0
          ? 'No prayer is published with verses yet, so there is nothing to write. Publish a prayer first.'
          : `Every published prayer is already written in ${name}. Choose “Translate again” to replace it (words an editor wrote are kept).`,
        { upToDate: true }
      );
    }

    // A run started while another is going waits its turn: the worker takes them in the order they were made, one at a time.
    const row = await prisma.prayerRun.create({
      data: {
        language, provider, model: modelId, force: force ?? false,
        status: 'QUEUED', statusMessage: 'Waiting for the worker.',
        requestedById: req.auth.user.id, requestedByName: req.auth.user.name || req.auth.user.email || null,
      },
    });

    let current = row;
    try {
      const jobId = service.newJobId(row.id);
      current = await prisma.prayerRun.update({ where: { id: row.id }, data: { jobId } });
      await service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Queued by ${row.requestedByName || 'an admin'}: ${todo.length} prayer${todo.length === 1 ? '' : 's'} into ${name} with ${provider} ${modelId}.` });
      await service.addRunJob(row.id, jobId);
    } catch (err) {
      logger.error({ err: err.message, runId: row.id }, 'could not queue a prayer run');
      current = await prisma.prayerRun.update({ where: { id: row.id }, data: { status: 'FAILED', finishedAt: new Date(), statusMessage: `Could not be queued: ${err.message}` } });
      service.publishRun(current);
      throw unprocessable('The run could not be put on the queue. Is Redis reachable?');
    }

    await audit.record(req, { action: 'prayer.run.start', entityType: 'PrayerRun', entityId: row.id, after: { language, force: row.force, provider, model: modelId, prayers: todo.length } });
    service.publishRun(current);
    return created(res, presentRun(current));
  } finally {
    await redis.del(LOCK_KEY).catch(() => {});
  }
};

/** POST /api/admin/prayers/runs/:id/resume */
export const resumeRun = async (req, res) => {
  const row = await prisma.prayerRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Prayer run');
  if (row.status !== 'PAUSED' && row.status !== 'FAILED') throw conflict(`Only a paused or failed run can be resumed — this one is ${row.status.toLowerCase()}.`);
  const next = await prisma.prayerRun.update({
    where: { id: row.id },
    data: { status: 'QUEUED', pauseReason: null, statusMessage: 'Resumed. Waiting for the worker.', stopReason: null, resumeAt: null, retriesInARow: 0, cancelRequested: false, finishedAt: null },
  });
  await service.ensureRunJob(next);
  const fresh = await prisma.prayerRun.findUnique({ where: { id: row.id } });

  await audit.record(req, { action: 'prayer.run.resume', entityType: 'PrayerRun', entityId: row.id, before: { id: row.id, status: row.status, language: row.language }, after: { status: 'QUEUED' } });
  service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Resumed by ${who(req)}.` });
  service.publishRun(fresh);
  return ok(res, presentRun(fresh));
};

/** POST /api/admin/prayers/runs/:id/cancel */
export const cancelRun = async (req, res) => {
  const row = await prisma.prayerRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Prayer run');
  if (!ACTIVE_STATUSES.includes(row.status)) throw conflict(`This run is already ${row.status.toLowerCase()}.`);

  const askOnly = row.status === 'RUNNING' && !presentRun(row).stalled;
  let next;
  if (askOnly) {
    next = await prisma.prayerRun.update({ where: { id: row.id }, data: { cancelRequested: true, statusMessage: 'Cancelling after the request in progress…' } });
  } else {
    const done = await prisma.prayerRun.updateMany({
      where: { id: row.id, status: row.status, jobId: row.jobId },
      data: { status: 'CANCELLED', cancelRequested: false, resumeAt: null, finishedAt: new Date(), statusMessage: `Cancelled by ${who(req)}.` },
    });
    if (done.count === 0) throw conflict('The run changed while it was being cancelled. Look again.');
    await service.dropRunJob(row);
    next = await prisma.prayerRun.findUnique({ where: { id: row.id } });
  }

  await audit.record(req, { action: 'prayer.run.cancel', entityType: 'PrayerRun', entityId: row.id, before: { id: row.id, status: row.status, language: row.language }, after: { status: next.status, cancelRequested: next.cancelRequested } });
  service.pushFeed(row.id, { kind: 'status', level: 'warn', text: `Cancel requested by ${who(req)}.` });
  service.publishRun(next);
  return ok(res, presentRun(next));
};
