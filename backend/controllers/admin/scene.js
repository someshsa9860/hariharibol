// Scene prompts for reels, written for a whole chapter at a time and started and watched from the admin panel.
// The same shape as controllers/admin/translation.js: a run is a `SceneRun` row, the BullMQ job
// (jobs/processors/scenes.js) only works it, Cancel on a running run only sets `cancelRequested`, Resume is for a
// paused or failed run and carries on from the first chapter not yet written. What is different: one provider and
// model per run (Gemini unless a run says otherwise), no language (the input is always the Hindi meanings), and a
// chapter already written is skipped unless the run is told to write it again (`force`).

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import logger from '../../config/logger.js';
import { scenes } from '../../config/scenes.js';
import * as audit from '../../services/audit.js';
import * as translationService from '../../services/translation.js';
import * as service from '../../services/scenes.js';
import { ACTIVE_STATUSES } from '../../utils/translation-run.js';
import { PROMPT_VERSION, SYSTEM_PROMPT, estimateTokens, presentRun } from '../../utils/scenes.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { readPage } from '../../utils/pagination.js';
import { badRequest, conflict, notFound, unprocessable } from '../../utils/errors.js';
import { bookOf, chapterLabel } from '../../scripts/lib/claude-translate-source.js';

const START_LOCK_SECONDS = 20;
const lockKey = (book) => `scenes:start:${book}`;
const forget = (entity) => ({ id: entity.id, status: entity.status, book: entity.book });

function pickChapters(book, asked) {
  const all = bookOf(book).chapters;
  const picked = [...new Set(asked ?? all)].sort((a, b) => a - b);
  const bad = picked.find((id) => !all.includes(id));
  if (bad !== undefined) throw badRequest(`Chapter ${bad} is not in ${bookOf(book).title}.`);
  return picked;
}

/** GET /api/admin/scenes/overview — what the page needs before anything is chosen. */
export const overview = async (req, res) => {
  const provider = service.defaultProvider();
  const modelId = service.model(provider);
  const [storage, workerOnline, active, minute, today] = await Promise.all([
    service.storageStatus(),
    translationService.workerOnline(),
    prisma.sceneRun.findMany({ where: { status: { in: ACTIVE_STATUSES } }, orderBy: { createdAt: 'asc' } }),
    service.minuteUsage(),
    service.todayFor(provider, modelId),
  ]);

  return ok(res, {
    settings: {
      providers: service.providers(),
      defaultProvider: provider,
      model: modelId,
      apiKeyConfigured: service.providers().find((p) => p.id === provider)?.apiKeyConfigured ?? false,
      storage,
      workerOnline,
      limits: service.limits(),
      promptVersion: PROMPT_VERSION,
      outputFolder: `json/${bookOf(service.BOOK).folder}/${scenes.folder}/`,
      fileExample: 'sk-1-ch-1.json',
    },
    usage: { minute, today },
    books: service.books(),
    active: active.map((row) => presentRun(row)),
  });
};

/** GET /api/admin/scenes/chapters — every chapter of the book and whether its scene file is written. */
export const chapters = async (req, res) => {
  const data = await service.coverage(req.valid.query.book ?? service.BOOK).catch((err) => {
    throw unprocessable(`Could not read the scene index from storage: ${err.message}`);
  });
  return ok(res, data);
};

/** GET /api/admin/scenes/estimate — what a run would do, from a sample of the chapters it would write. Nothing is spent. */
export const estimate = async (req, res) => {
  const { book = service.BOOK, chapters: asked, force } = req.valid.query;
  const picked = pickChapters(book, asked);
  const todo = await service.chaptersToWrite(book, picked, force === 'true').catch((err) => {
    throw unprocessable(`Could not read the scene index from storage: ${err.message}`);
  });

  // Reading every chapter would be hundreds of files; a spread of at most 12 says enough.
  const step = Math.max(1, Math.floor(todo.length / 12));
  const sample = todo.filter((_, i) => i % step === 0).slice(0, 12);
  const sources = await Promise.all(sample.map((id) => service.loadSource(book, id).catch(() => null)));
  const readable = sources.filter((s) => s && s.verses.length);
  const perChapter = readable.length
    ? Math.round(readable.reduce((n, s) => n + estimateTokens(SYSTEM_PROMPT, ...s.verses.map((v) => v.hindi)), 0) / readable.length)
    : 0;

  const { rpm, tpm } = service.limits();
  const inputTokens = perChapter * todo.length;
  // Whichever is slowest: the request limit, the token limit, or the model's own time to write a storyboard (about 40 s).
  const minutes = todo.length ? Math.ceil(Math.max(todo.length / rpm, inputTokens / tpm, (todo.length * 40) / 60)) : 0;

  return ok(res, {
    book,
    requested: picked.length,
    alreadyWritten: picked.length - todo.length,
    willWrite: todo.length,
    sampled: readable.length,
    sampleWithoutHindi: sample.length - readable.length,
    inputTokensPerChapter: perChapter,
    inputTokens,
    requests: todo.length,
    minutes,
    limits: { rpm, tpm },
  });
};

/** GET /api/admin/scenes/runs */
export const list = async (req, res) => {
  const { status, book } = req.valid.query;
  const { skip, take, page, pageSize } = readPage(req.valid.query, 20);
  const where = { ...(status && { status }), ...(book && { book }) };
  const [rows, total] = await Promise.all([
    prisma.sceneRun.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.sceneRun.count({ where }),
  ]);
  const now = new Date();
  return paginated(res, rows.map((row) => presentRun(row, now)), { page, pageSize, total });
};

/** GET /api/admin/scenes/runs/:id — one run and its activity feed. */
export const get = async (req, res) => {
  const row = await prisma.sceneRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Scene run');
  return ok(res, { run: presentRun(row), feed: await service.readFeed(row.id, 100) });
};

/** POST /api/admin/scenes/runs */
export const start = async (req, res) => {
  const { chapters: asked, force } = req.valid.body;
  const book = req.valid.body.book ?? service.BOOK;
  const provider = req.valid.body.provider ?? service.defaultProvider();
  const modelId = req.valid.body.model ?? service.model(provider);

  const info = service.providers().find((p) => p.id === provider);
  if (!info.apiKeyConfigured) throw unprocessable(`${info.keyEnv} is not set on the server, so ${info.company} cannot be called.`);
  const storage = await service.storageStatus(book);
  if (!storage.ok) throw unprocessable(`Storage is not set up: ${storage.error}`);

  const gotLock = await redis.set(lockKey(book), req.auth.user.id, 'EX', START_LOCK_SECONDS, 'NX');
  if (!gotLock) throw conflict('A run is being started. Try again in a moment.');

  try {
    // One run at a time: the model's free limits are the project's, so two would only meet them sooner.
    const existing = await prisma.sceneRun.findFirst({ where: { status: { in: ACTIVE_STATUSES } }, select: { id: true, status: true } });
    if (existing) throw conflict(`There is already a ${existing.status.toLowerCase()} scene run. Cancel it or wait for it to finish.`, { runId: existing.id });

    const picked = pickChapters(book, asked);
    const todo = await service.chaptersToWrite(book, picked, force ?? false);
    if (todo.length === 0) throw conflict('Every chapter asked for already has its scene file. Choose “Write again” to replace them.', { upToDate: true });

    const row = await prisma.sceneRun.create({
      data: {
        book, provider, model: modelId, chapters: picked, force: force ?? false,
        status: 'QUEUED', statusMessage: 'Waiting for the worker.',
        requestedById: req.auth.user.id, requestedByName: req.auth.user.name || req.auth.user.email || null,
      },
    });

    let current = row;
    try {
      const jobId = service.newJobId(row.id);
      current = await prisma.sceneRun.update({ where: { id: row.id }, data: { jobId } });
      await service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Queued by ${row.requestedByName || 'an admin'}: ${todo.length} chapters with ${provider} ${modelId}.` });
      await service.addRunJob(row.id, jobId);
    } catch (err) {
      logger.error({ err: err.message, runId: row.id }, 'could not queue a scene run');
      current = await prisma.sceneRun.update({ where: { id: row.id }, data: { status: 'FAILED', finishedAt: new Date(), statusMessage: `Could not be queued: ${err.message}` } });
      service.publishRun(current);
      throw unprocessable('The run could not be put on the queue. Is Redis reachable?');
    }

    await audit.record(req, { action: 'scenes.start', entityType: 'SceneRun', entityId: row.id, after: { book, chapters: picked.length, force: row.force, provider, model: modelId } });
    service.publishRun(current);
    return created(res, presentRun(current));
  } finally {
    await redis.del(lockKey(book)).catch(() => {});
  }
};

/** POST /api/admin/scenes/runs/:id/resume */
export const resume = async (req, res) => {
  const row = await prisma.sceneRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Scene run');
  if (row.status !== 'PAUSED' && row.status !== 'FAILED') throw conflict(`Only a paused or failed run can be resumed — this one is ${row.status.toLowerCase()}.`);
  const other = await prisma.sceneRun.findFirst({ where: { status: { in: ACTIVE_STATUSES }, id: { not: row.id } }, select: { id: true, status: true } });
  if (other) throw conflict(`Another scene run is ${other.status.toLowerCase()}. Cancel it first.`, { runId: other.id });

  const next = await prisma.sceneRun.update({
    where: { id: row.id },
    data: { status: 'QUEUED', pauseReason: null, statusMessage: 'Resumed. Waiting for the worker.', stopReason: null, errorChapter: null, resumeAt: null, retriesInARow: 0, cancelRequested: false, finishedAt: null },
  });
  await service.ensureRunJob(next);
  const fresh = await prisma.sceneRun.findUnique({ where: { id: row.id } });

  await audit.record(req, { action: 'scenes.resume', entityType: 'SceneRun', entityId: row.id, before: forget(row), after: { status: 'QUEUED' } });
  service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Resumed by ${req.auth.user.name || req.auth.user.email || 'an admin'}.` });
  service.publishRun(fresh);
  return ok(res, presentRun(fresh));
};

/** POST /api/admin/scenes/runs/:id/cancel */
export const cancel = async (req, res) => {
  const row = await prisma.sceneRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Scene run');
  if (!ACTIVE_STATUSES.includes(row.status)) throw conflict(`This run is already ${row.status.toLowerCase()}.`);

  const who = req.auth.user.name || req.auth.user.email || 'an admin';
  const askOnly = row.status === 'RUNNING' && !presentRun(row).stalled;

  let next;
  if (askOnly) {
    next = await prisma.sceneRun.update({ where: { id: row.id }, data: { cancelRequested: true, statusMessage: 'Cancelling after the chapter in progress…' } });
  } else {
    const done = await prisma.sceneRun.updateMany({
      where: { id: row.id, status: row.status, jobId: row.jobId },
      data: { status: 'CANCELLED', cancelRequested: false, resumeAt: null, finishedAt: new Date(), statusMessage: `Cancelled by ${who}.` },
    });
    if (done.count === 0) throw conflict('The run changed while it was being cancelled. Look again.');
    await service.dropRunJob(row);
    next = await prisma.sceneRun.findUnique({ where: { id: row.id } });
  }

  await audit.record(req, { action: 'scenes.cancel', entityType: 'SceneRun', entityId: row.id, before: forget(row), after: { status: next.status, cancelRequested: next.cancelRequested } });
  service.pushFeed(row.id, { kind: 'status', level: 'warn', text: `Cancel requested by ${who}.` });
  service.publishRun(next);
  return ok(res, presentRun(next));
};

/** GET /api/admin/scenes/output/:chapter — a chapter's scene file with the text to copy. */
export const output = async (req, res) => {
  const { chapter } = req.valid.params;
  const book = req.valid.query.book ?? service.BOOK;
  pickChapters(book, [chapter]);
  const file = await service.readOutput(book, chapter).catch((err) => {
    throw unprocessable(`Could not read the scene file from storage: ${err.message}`);
  });
  if (!file) throw notFound(`Scene file for chapter ${chapterLabel(chapter, book)}`);
  return ok(res, file);
};

/** GET /api/admin/scenes/output/:chapter/file — the file exactly as stored in S3, for download. */
export const file = async (req, res) => {
  const { chapter } = req.valid.params;
  const book = req.valid.query.book ?? service.BOOK;
  pickChapters(book, [chapter]);
  const raw = await service.readRaw(book, chapter).catch((err) => {
    throw unprocessable(`Could not read the scene file from storage: ${err.message}`);
  });
  if (!raw) throw notFound(`Scene file for chapter ${chapterLabel(chapter, book)}`);
  return ok(res, raw);
};
