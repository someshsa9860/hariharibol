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

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import logger from '../../config/logger.js';
import { translation } from '../../config/translation.js';
import * as audit from '../../services/audit.js';
import * as service from '../../services/translation.js';
import { ACTIVE_STATUSES, microsOf, presentRun } from '../../utils/translation-run.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { readPage } from '../../utils/pagination.js';
import { conflict, notFound, unprocessable } from '../../utils/errors.js';
import { CHAPTERS } from '../../scripts/lib/claude-translate-source.js';

const START_LOCK_SECONDS = 20;
const lockKey = (language) => `translation:start:${language}`;

const forget = (entity) => ({ id: entity.id, status: entity.status, language: entity.language });

/** GET /api/admin/translations/overview — what the page needs before anything is chosen. */
export const overview = async (req, res) => {
  const [storage, workerOnline, active] = await Promise.all([
    service.storageStatus(),
    service.workerOnline(),
    prisma.translationRun.findMany({ where: { status: { in: ACTIVE_STATUSES } }, orderBy: { createdAt: 'asc' } }),
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
      apiKeyConfigured: Boolean(service.apiKey()),
      storage,
      workerOnline,
      model: service.model(),
      version,
      versionError,
      effort: translation.effort,
    },
    languages: service.languages(),
    chapters: CHAPTERS,
    active: active.map((row) => presentRun(row)),
  });
};

/** GET /api/admin/translations/coverage — saved verses per language and chapter. */
export const coverage = async (req, res) => {
  const { refresh } = req.valid.query;
  const data = await service.coverage({ refresh: refresh === 'true' }).catch((err) => {
    throw unprocessable(`Could not read the translations from storage: ${err.message}`);
  });
  return ok(res, data);
};

/** GET /api/admin/translations/estimate — what a run would do and cost, before it is started. */
export const estimate = async (req, res) => {
  const { language, chapters, limit } = req.valid.query;
  const data = await service
    .estimate({ language, chapters: chapters ?? CHAPTERS, limit: limit ?? 0 })
    .catch((err) => {
      throw unprocessable(`Could not work out an estimate: ${err.message}`);
    });
  return ok(res, data);
};

/** GET /api/admin/translations/runs */
export const list = async (req, res) => {
  const { status, language } = req.valid.query;
  const { skip, take, page, pageSize } = readPage(req.valid.query, 20);

  const where = { ...(status && { status }), ...(language && { language }) };
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

  // Say what is wrong before a run exists that can only fail: a key, a bucket and a version are checked here.
  if (!service.apiKey()) throw unprocessable('ANTHROPIC_API_KEY is not set on the server, so Claude cannot be called.');
  const storage = await service.storageStatus();
  if (!storage.ok) throw unprocessable(`Storage is not set up: ${storage.error}`);
  let version;
  try {
    version = service.currentVersion();
  } catch (err) {
    throw unprocessable(err.message);
  }

  const gotLock = await redis.set(lockKey(language), req.auth.user.id, 'EX', START_LOCK_SECONDS, 'NX');
  if (!gotLock) throw conflict('A run for this language is being started. Try again in a moment.');

  try {
    const existing = await prisma.translationRun.findFirst({
      where: { language, status: { in: ACTIVE_STATUSES } },
      select: { id: true, status: true },
    });
    if (existing) {
      throw conflict(`There is already a ${existing.status.toLowerCase()} run for this language. Cancel it or wait for it to finish.`, {
        runId: existing.id,
      });
    }

    const picked = [...new Set(chapters ?? CHAPTERS)].sort((a, b) => a - b);
    const row = await prisma.translationRun.create({
      data: {
        language,
        version,
        model: service.model(),
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
      after: { language, chapters: picked, verseLimit: row.verseLimit, budgetUsd: budgetUsd ?? null, version, model: row.model },
    });
    service.publishRun(current);

    return created(res, presentRun(current));
  } finally {
    await redis.del(lockKey(language)).catch(() => {});
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
    where: { language: row.language, status: { in: ACTIVE_STATUSES }, id: { not: row.id } },
    select: { id: true, status: true },
  });
  if (other) throw conflict(`Another run for this language is ${other.status.toLowerCase()}. Cancel it first.`, { runId: other.id });

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
    await service.forgetCoverage();
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
  const data = await service.chapterIndex(language, number).catch((err) => {
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
