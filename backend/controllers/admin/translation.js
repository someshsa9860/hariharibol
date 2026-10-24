// Translating the Gita into other languages, started and watched from the admin panel.
//
// A run is a `TranslationRun` row: that row is the truth, the BullMQ job is only the thing that works
// on it (jobs/processors/translation.js). What is not obvious from reading this file:
//
//   - One live run per language. `start` takes a short Redis lock so two clicks cannot both pass the
//     "is there one already?" check; the check itself is the database's answer.
//   - Several languages may be queued, but the queue runs one run at a time (global concurrency 1).
//   - Cancel on a RUNNING run only sets `cancelRequested`; the worker notices on its next heartbeat and
//     stops cleanly. A queued, paused or stalled run is cancelled here directly.
//   - Resume is for a PAUSED run (credit, auth, a budget, a bad config) or a FAILED one. It never
//     re-translates what is saved: the next job starts at the first unsaved verse.
//   - A run is for one version (TRANSLATION_VERSION, copied onto the row when it starts). A verse already
//     translated under that version is never translated again, so `start` refuses a run that would have
//     nothing to do; a verse Claude made under another version is outdated and is translated again.
//   - Import copies what is in storage into the database (services/translation-import.js). A real import
//     reads and writes a chapter at a time for as long as the book is long, so it is a job like a run: a
//     `TranslationImportRun` row that the worker works (jobs/processors/translation-import.js), never the
//     request. As with a run, one live import per language and book: a short Redis lock guards the
//     creation of the row and the database answers "is there one already?". Only a `dryRun` preview, which
//     writes nothing, still answers the request.
//   - Cancel on a RUNNING import sets `cancelRequested` and the worker stops after the chapter in progress;
//     chapters already imported stay imported (each is its own transaction).

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import logger from '../../config/logger.js';
import { translation } from '../../config/translation.js';
import * as audit from '../../services/audit.js';
import * as service from '../../services/translation.js';
import * as importer from '../../services/translation-import.js';
import { ACTIVE_STATUSES, microsOf, presentRun } from '../../utils/translation-run.js';
import { LIVE_IMPORT_STATUSES, presentImportRun } from '../../utils/translation-import.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { readPage } from '../../utils/pagination.js';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../../utils/errors.js';
import { BOOK, bookOf } from '../../scripts/lib/claude-translate-source.js';

const chaptersOf = (book) => bookOf(book).chapters;

/** The chapters asked for, or all of the book's; one that is not in the book is a 400. */
function pickChapters(book, asked) {
  const all = chaptersOf(book);
  const picked = [...new Set(asked ?? all)].sort((a, b) => a - b);
  const bad = picked.find((id) => !all.includes(id));
  if (bad !== undefined) throw badRequest(`Chapter ${bad} is not in ${bookOf(book).title}.`);
  return picked;
}

const START_LOCK_SECONDS = 20;
const lockKey = (book, language) => `translation:start:${book}:${language}`;
const importLockKey = (book, language) => `translation:import:${book}:${language}`;

const forget = (entity) => ({ id: entity.id, status: entity.status, language: entity.language, book: entity.book });

/** GET /api/admin/translations/overview — what the page needs before anything is chosen. */
export const overview = async (req, res) => {
  const [storage, workerOnline, active, activeImports] = await Promise.all([
    service.storageStatus(),
    service.workerOnline(),
    prisma.translationRun.findMany({ where: { status: { in: ACTIVE_STATUSES } }, orderBy: { createdAt: 'asc' } }),
    prisma.translationImportRun.findMany({ where: { status: { in: LIVE_IMPORT_STATUSES } }, orderBy: { createdAt: 'asc' } }),
  ]);

  let version = null;
  let versionError = null;
  try {
    version = service.currentVersion();
  } catch (err) {
    versionError = err.message;
  }

  return ok(res, {
    settings: {
      apiKeyConfigured: service.providers().some((p) => p.apiKeyConfigured),
      providers: service.providers(),
      defaultProvider: service.defaultProvider(),
      storage,
      workerOnline,
      model: service.model(),
      version,
      versionError,
      effort: translation.effort,
    },
    languages: service.languages(),
    books: service.books(),
    chapters: chaptersOf(BOOK),
    active: active.map((row) => presentRun(row)),
    activeImports: activeImports.map((row) => presentImportRun(row)),
  });
};

/** GET /api/admin/translations/coverage — saved verses per language and chapter. */
export const coverage = async (req, res) => {
  const { refresh, book = BOOK } = req.valid.query;
  const data = await service.coverage({ book, refresh: refresh === 'true' }).catch((err) => {
    throw unprocessable(`Could not read the translations from storage: ${err.message}`);
  });
  return ok(res, data);
};

/** GET /api/admin/translations/estimate — what a run would do and cost, before it is started. */
export const estimate = async (req, res) => {
  const { language, book = BOOK, chapters, limit, provider, model, plan } = req.valid.query;
  const data = await service
    .estimate({ language, book, provider, model, plan, chapters: pickChapters(book, chapters), limit: limit ?? 0 })
    .catch((err) => {
      throw unprocessable(`Could not work out an estimate: ${err.message}`);
    });
  return ok(res, data);
};

/** GET /api/admin/translations/runs */
export const list = async (req, res) => {
  const { status, language, book } = req.valid.query;
  const { skip, take, page, pageSize } = readPage(req.valid.query, 20);

  const where = { ...(status && { status }), ...(language && { language }), ...(book && { book }) };
  const [rows, total] = await Promise.all([
    prisma.translationRun.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.translationRun.count({ where }),
  ]);

  const now = new Date();
  return paginated(res, rows.map((row) => presentRun(row, now)), { page, pageSize, total });
};

/** GET /api/admin/translations/runs/:id — one run and its activity feed. */
export const get = async (req, res) => {
  const row = await prisma.translationRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Translation run');

  const feed = await service.readFeed(row.id, 100);
  return ok(res, { run: presentRun(row), feed });
};

/** POST /api/admin/translations/runs — start a run for one language. */
export const start = async (req, res) => {
  const { language, chapters, verseLimit, budgetUsd } = req.valid.body;
  const book = req.valid.body.book ?? BOOK;
  const defaultProvider = req.valid.body.provider ?? service.defaultProvider();
  const defaultModel = req.valid.body.model ?? service.model(defaultProvider);

  // Say what is wrong before a run exists that can only fail: a plan, its keys, a bucket and a version are checked here.
  let plan;
  try {
    plan = service.resolvePlan({ plan: req.valid.body.plan ?? null, provider: defaultProvider, model: defaultModel });
  } catch (err) {
    throw unprocessable(err.message);
  }
  const missing = service.missingKeys(plan);
  if (missing.length) throw unprocessable(missing.map((m) => `${m.keyEnv} is not set on the server, so ${m.company} cannot be called.`).join(' '));
  const lead = plan.translation ?? Object.values(plan)[0]; // the row's own provider and model: the translation's, else the first part's
  const provider = lead.provider;
  const model = lead.model;
  const storage = await service.storageStatus();
  if (!storage.ok) throw unprocessable(`Storage is not set up: ${storage.error}`);
  let version;
  try {
    version = service.currentVersion();
  } catch (err) {
    throw unprocessable(err.message);
  }

  const gotLock = await redis.set(lockKey(book, language), req.auth.user.id, 'EX', START_LOCK_SECONDS, 'NX');
  if (!gotLock) throw conflict('A run for this language and book is being started. Try again in a moment.');

  try {
    const existing = await prisma.translationRun.findFirst({
      where: { language, book, status: { in: ACTIVE_STATUSES } },
      select: { id: true, status: true },
    });
    if (existing) {
      throw conflict(`There is already a ${existing.status.toLowerCase()} run for this language and book. Cancel it or wait for it to finish.`, {
        runId: existing.id,
      });
    }

    const picked = pickChapters(book, chapters);

    // Nothing to translate is not a run: if everything asked for is already translated under this version,
    // say so rather than queue a job that finishes at once with "0 verses translated".
    const left = await service.estimate({ language, book, chapters: picked, limit: verseLimit ?? 0, provider, model, plan, version }).catch((err) => {
      throw unprocessable(`Could not check what is already translated: ${err.message}`);
    });
    if (left.willTranslate === 0) {
      const name = service.languages().find((l) => l.code === language)?.name ?? language;
      throw conflict(
        `${name} is already translated with version ${version}, so there is nothing to translate. Set a new TRANSLATION_VERSION to translate it again.`,
        { upToDate: true, version }
      );
    }

    const row = await prisma.translationRun.create({
      data: {
        language,
        book,
        version,
        provider,
        model,
        plan,
        chapters: picked,
        verseLimit: verseLimit ?? null,
        budgetMicros: budgetUsd ? microsOf(budgetUsd) : null,
        status: 'QUEUED',
        statusMessage: 'Waiting for the worker.',
        requestedById: req.auth.user.id,
        requestedByName: req.auth.user.name || req.auth.user.email || null,
      },
    });

    // The row names the job that may work it; a job it does not name does nothing.
    let current = row;
    try {
      const jobId = service.newJobId(row.id);
      current = await prisma.translationRun.update({ where: { id: row.id }, data: { jobId } });
      // Before the job exists, so a worker that picks it up at once cannot write "Started." ahead of it.
      await service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Queued by ${row.requestedByName || 'an admin'}.` });
      await service.addRunJob(row.id, jobId);
    } catch (err) {
      logger.error({ err: err.message, runId: row.id }, 'could not queue a translation run');
      current = await prisma.translationRun.update({
        where: { id: row.id },
        data: { status: 'FAILED', finishedAt: new Date(), statusMessage: `Could not be queued: ${err.message}` },
      });
      service.publishRun(current);
      throw unprocessable('The run could not be put on the queue. Is Redis reachable?');
    }

    await audit.record(req, {
      action: 'translation.start',
      entityType: 'TranslationRun',
      entityId: row.id,
      after: { language, book, chapters: picked, verseLimit: row.verseLimit, budgetUsd: budgetUsd ?? null, version, provider, model: row.model, plan },
    });
    service.publishRun(current);

    return created(res, presentRun(current));
  } finally {
    await redis.del(lockKey(book, language)).catch(() => {});
  }
};

/** POST /api/admin/translations/runs/:id/resume */
export const resume = async (req, res) => {
  const row = await prisma.translationRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Translation run');
  if (row.status !== 'PAUSED' && row.status !== 'FAILED') {
    throw conflict(`Only a paused or failed run can be resumed — this one is ${row.status.toLowerCase()}.`);
  }

  const other = await prisma.translationRun.findFirst({
    where: { language: row.language, book: row.book, status: { in: ACTIVE_STATUSES }, id: { not: row.id } },
    select: { id: true, status: true },
  });
  if (other) throw conflict(`Another run for this language and book is ${other.status.toLowerCase()}. Cancel it first.`, { runId: other.id });

  // A new budget replaces the old one; `null` lifts it. Left out, the old one stays.
  const { budgetUsd } = req.valid.body ?? {};
  const budgetChange = budgetUsd === undefined ? {} : { budgetMicros: budgetUsd ? microsOf(budgetUsd) : null };

  const next = await prisma.translationRun.update({
    where: { id: row.id },
    data: {
      ...budgetChange,
      status: 'QUEUED',
      pauseReason: null,
      statusMessage: 'Resumed. Waiting for the worker.',
      stopReason: null,
      errorVerseId: null,
      resumeAt: null,
      retriesInARow: 0,
      cancelRequested: false,
      finishedAt: null,
    },
  });
  await service.ensureRunJob(next);
  const fresh = await prisma.translationRun.findUnique({ where: { id: row.id } });

  await audit.record(req, {
    action: 'translation.resume',
    entityType: 'TranslationRun',
    entityId: row.id,
    before: forget(row),
    after: { status: 'QUEUED', budgetUsd: budgetUsd ?? undefined },
  });
  service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Resumed by ${req.auth.user.name || req.auth.user.email || 'an admin'}.` });
  service.publishRun(fresh);

  return ok(res, presentRun(fresh));
};

/** POST /api/admin/translations/runs/:id/cancel */
export const cancel = async (req, res) => {
  const row = await prisma.translationRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Translation run');
  if (!ACTIVE_STATUSES.includes(row.status)) {
    throw conflict(`This run is already ${row.status.toLowerCase()}.`);
  }

  const who = req.auth.user.name || req.auth.user.email || 'an admin';
  const presented = presentRun(row);
  // A run that is working is asked to stop and does so at its next heartbeat. One that is not — waiting,
  // paused, or RUNNING with no heartbeat because its worker is gone — has nobody to ask.
  const askOnly = row.status === 'RUNNING' && !presented.stalled;

  let next;
  if (askOnly) {
    next = await prisma.translationRun.update({
      where: { id: row.id },
      data: { cancelRequested: true, statusMessage: 'Cancelling after the verse in progress…' },
    });
  } else {
    // Only while it is still in the state seen above, so a worker that just claimed it is not overruled.
    const done = await prisma.translationRun.updateMany({
      where: { id: row.id, status: row.status, jobId: row.jobId },
      data: {
        status: 'CANCELLED',
        cancelRequested: false,
        resumeAt: null,
        finishedAt: new Date(),
        statusMessage: `Cancelled by ${who}.`,
      },
    });
    if (done.count === 0) throw conflict('The run changed while it was being cancelled. Look again.');
    await service.dropRunJob(row);
    service.refreshRunProgress(row);
    next = await prisma.translationRun.findUnique({ where: { id: row.id } });
  }

  await audit.record(req, {
    action: 'translation.cancel',
    entityType: 'TranslationRun',
    entityId: row.id,
    before: forget(row),
    after: { status: next.status, cancelRequested: next.cancelRequested },
  });
  service.pushFeed(row.id, { kind: 'status', level: 'warn', text: `Cancel requested by ${who}.` });
  service.publishRun(next);

  return ok(res, presentRun(next));
};

/** GET /api/admin/translations/output/:language/chapters/:chapter */
export const chapter = async (req, res) => {
  const { language, chapter: number } = req.valid.params;
  const book = req.valid.query?.book ?? BOOK;
  const data = await service.chapterIndex(language, number, book).catch((err) => {
    throw unprocessable(`Could not read the chapter from storage: ${err.message}`);
  });
  return ok(res, data);
};

/** GET /api/admin/translations/output/:language/verses/:verseId */
export const verse = async (req, res) => {
  const { language, verseId } = req.valid.params;
  const data = await service.verseOutput(language, verseId).catch((err) => {
    throw unprocessable(`Could not read the verse from storage: ${err.message}`);
  });
  if (!data) throw notFound('Verse');
  return ok(res, data);
};

/** GET /api/admin/translations/imports — what Claude's runs have put in the database, per language. */
export const imports = async (req, res) => {
  let version = null;
  try {
    version = service.currentVersion();
  } catch {
    // A malformed TRANSLATION_VERSION is reported by the overview; here it only means no row counts as current.
  }
  return ok(res, await importer.importStatus({ version, book: req.valid.query?.book ?? BOOK }));
};

/**
 * POST /api/admin/translations/imports — copy a language's translated chapters from storage into the database.
 * A `dryRun` is answered here (it only reads); a real import is queued as a `TranslationImportRun` and the
 * worker does it.
 */
export const importTranslations = async (req, res) => {
  const { language, chapters, publish, dryRun } = req.valid.body;
  const book = req.valid.body.book ?? BOOK;
  if (publish && !req.auth.permissions.has('verse.publish')) {
    throw forbidden('Making translations visible to readers needs the permission: verse.publish');
  }
  // A chapter that is not in the book is a 400 before anything is taken or written.
  const picked = pickChapters(book, chapters);

  if (dryRun) {
    const preview = await importer.importLanguage({ language, book, chapters: picked, publish, dryRun }).catch((err) => {
      throw err.expected ? err : unprocessable(`Could not preview the import: ${err.message}`);
    });
    return ok(res, preview);
  }

  const gotLock = await redis.set(importLockKey(book, language), req.auth.user.id, 'EX', translation.importLockSeconds, 'NX');
  if (!gotLock) throw conflict('An import of this language and book is being started. Try again in a moment.');

  try {
    const existing = await prisma.translationImportRun.findFirst({
      where: { language, book, status: { in: LIVE_IMPORT_STATUSES } },
      select: { id: true, status: true },
    });
    if (existing) {
      throw conflict(`There is already a ${existing.status.toLowerCase()} import of this language and book. Wait for it to finish or cancel it.`, {
        runId: existing.id,
      });
    }

    const row = await prisma.translationImportRun.create({
      data: {
        language,
        book,
        publish,
        chapters: picked,
        totalChapters: picked.length,
        status: 'QUEUED',
        statusMessage: 'Waiting for the worker.',
        requestedById: req.auth.user.id,
        requestedByName: req.auth.user.name || req.auth.user.email || null,
      },
    });

    // The row names the job that may work it; a job it does not name does nothing.
    let current = row;
    try {
      const jobId = importer.newImportJobId(row.id);
      current = await prisma.translationImportRun.update({ where: { id: row.id }, data: { jobId } });
      // Before the job exists, so a worker that picks it up at once cannot write "Started." or announce RUNNING ahead of them.
      await importer.pushImportFeed(row.id, { kind: 'status', level: 'info', text: `Queued by ${row.requestedByName || 'an admin'}.` });
      importer.publishImportRun(current);
      await importer.addImportRunJob(row.id, jobId);
    } catch (err) {
      logger.error({ err: err.message, runId: row.id }, 'could not queue a translation import');
      current = await prisma.translationImportRun.update({
        where: { id: row.id },
        data: { status: 'FAILED', finishedAt: new Date(), statusMessage: `Could not be queued: ${err.message}` },
      });
      importer.publishImportRun(current);
      throw unprocessable('The import could not be put on the queue. Is Redis reachable?');
    }

    // What was asked for; what it came to is in the run's own result once the worker has finished.
    await audit.record(req, {
      action: 'translation.import',
      entityType: 'TranslationImportRun',
      entityId: row.id,
      after: { language, book, publish, chapters: chapters ?? 'all' },
    });

    return created(res, presentImportRun(current));
  } finally {
    await redis.del(importLockKey(book, language)).catch(() => {});
  }
};

/** GET /api/admin/translations/imports/runs */
export const importRuns = async (req, res) => {
  const { status, language, book } = req.valid.query;
  const { skip, take, page, pageSize } = readPage(req.valid.query, 20);

  const where = { ...(status && { status }), ...(language && { language }), ...(book && { book }) };
  const [rows, total] = await Promise.all([
    prisma.translationImportRun.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.translationImportRun.count({ where }),
  ]);

  const now = new Date();
  return paginated(res, rows.map((row) => presentImportRun(row, now)), { page, pageSize, total });
};

/** GET /api/admin/translations/imports/runs/:id — one import and its activity feed. */
export const importRun = async (req, res) => {
  const row = await prisma.translationImportRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Translation import');

  const feed = await importer.readImportFeed(row.id, 100);
  return ok(res, { run: presentImportRun(row), feed });
};

/** POST /api/admin/translations/imports/runs/:id/cancel */
export const cancelImportRun = async (req, res) => {
  const row = await prisma.translationImportRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Translation import');
  if (!LIVE_IMPORT_STATUSES.includes(row.status)) {
    throw conflict(`This import is already ${row.status.toLowerCase()}.`);
  }

  const who = req.auth.user.name || req.auth.user.email || 'an admin';
  // Same as cancelling a run: a working import is asked to stop and does so after its chapter; one that is
  // queued, or RUNNING with no heartbeat because its worker is gone, has nobody to ask.
  const askOnly = row.status === 'RUNNING' && !presentImportRun(row).stalled;

  let next;
  if (askOnly) {
    next = await prisma.translationImportRun.update({
      where: { id: row.id },
      data: { cancelRequested: true, statusMessage: 'Cancelling after the chapter in progress…' },
    });
  } else {
    // Only while it is still in the state seen above, so a worker that just claimed it is not overruled.
    const done = await prisma.translationImportRun.updateMany({
      where: { id: row.id, status: row.status, jobId: row.jobId },
      data: { status: 'CANCELLED', cancelRequested: false, finishedAt: new Date(), currentChapter: null, statusMessage: `Cancelled by ${who}.` },
    });
    if (done.count === 0) throw conflict('The import changed while it was being cancelled. Look again.');
    await importer.dropImportRunJob(row);
    next = await prisma.translationImportRun.findUnique({ where: { id: row.id } });
  }

  await audit.record(req, {
    action: 'translation.import.cancel',
    entityType: 'TranslationImportRun',
    entityId: row.id,
    before: forget(row),
    after: { status: next.status, cancelRequested: next.cancelRequested },
  });
  importer.pushImportFeed(row.id, { kind: 'status', level: 'warn', text: `Cancel requested by ${who}.` });
  importer.publishImportRun(next);

  return ok(res, presentImportRun(next));
};
