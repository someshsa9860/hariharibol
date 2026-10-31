// Narration (AI voices): verse translations spoken by a text-to-speech engine and stored in S3, started and watched from the
// admin panel. The same shape as controllers/admin/scene.js: a run is a `NarrationRun` row, the BullMQ job
// (jobs/processors/narration.js) only works it, Cancel on a running run only sets `cancelRequested`, and Resume is for a
// paused or failed run. Two kinds of run: NARRATION (many chapters, one voice) and COMPARE (one verse, up to
// `narration.maxTargets` voices, to listen before choosing). Nothing here calls an engine; only the worker does.

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import logger from '../../config/logger.js';
import { narration } from '../../config/narration.js';
import * as audit from '../../services/audit.js';
import * as translationService from '../../services/translation.js';
import * as service from '../../services/narration.js';
import { ACTIVE_STATUSES } from '../../utils/translation-run.js';
import { clipStands, estimate as estimateText, presentClip, presentRun, targetKey, targetProblem, textHash } from '../../utils/narration.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { readPage } from '../../utils/pagination.js';
import { conflict, notFound, unprocessable, badRequest } from '../../utils/errors.js';
import { bookOf, chapterIdOfVerse, chapterLabel } from '../../scripts/lib/claude-translate-source.js';

const START_LOCK_SECONDS = 20;
const lockKey = (book) => `narration:start:${book}`;
const forget = (entity) => ({ id: entity.id, status: entity.status, kind: entity.kind, book: entity.book });
const who = (req) => req.auth.user.name || req.auth.user.email || 'an admin';

// Reading every chapter of the Bhagavatam for an estimate would be hundreds of files; a spread of this many says enough.
const SAMPLE_CHAPTERS = 12;

export function pickChapters(book, asked) {
  const all = bookOf(book).chapters;
  const picked = [...new Set(asked ?? all)].sort((a, b) => a - b);
  const bad = picked.find((id) => !all.includes(id));
  if (bad !== undefined) throw badRequest(`Chapter ${bad} is not in ${bookOf(book).title}.`);
  return picked;
}

/** The first problem with one engine/model/voice/language choice, as an HTTP error; null when it can be used. */
export function checkTarget(target, language) {
  const problem = targetProblem({ ...target, language });
  if (problem) throw unprocessable(problem);
  if (service.keyMissing(target.engine)) {
    const engine = narration.engines[target.engine];
    throw unprocessable(`${engine.keyEnv} is not set on the server, so ${engine.label} cannot be called.`);
  }
}

/** GET /api/admin/narration/overview */
export const overview = async (req, res) => {
  const [storage, workerOnline, active] = await Promise.all([
    service.storageStatus(),
    translationService.workerOnline(),
    prisma.narrationRun.findMany({ where: { status: { in: ACTIVE_STATUSES } }, orderBy: { createdAt: 'asc' } }),
  ]);
  return ok(res, {
    settings: {
      engines: service.engineChoices(),
      languages: service.languageChoices(),
      defaults: narration.defaults,
      defaultBook: service.DEFAULT_BOOK,
      pipelineVersion: narration.pipelineVersion,
      maxTargets: narration.maxTargets,
      outputFolder: `${narration.folder}/`,
      storage,
      workerOnline,
    },
    books: service.books(),
    active: active.map((row) => presentRun(row)),
  });
};

/** GET /api/admin/narration/voices */
export const voices = async (req, res) => ok(res, service.engineChoices());

/** GET /api/admin/narration/languages */
export const languages = async (req, res) => ok(res, service.languageChoices());

/**
 * GET /api/admin/narration/estimate — characters, requests, price (where one is known) and least time for a run. Up to 20
 * chapters are all read, and that estimate also leaves out the clips already made; more are sampled and scaled up. Nothing is spent.
 */
export const estimate = async (req, res) => {
  const { book = service.DEFAULT_BOOK, language = narration.defaults.language, chapters: asked, force } = req.valid.query;
  const target = {
    engine: req.valid.query.engine ?? narration.defaults.engine,
    model: req.valid.query.model ?? narration.defaults.model,
    voice: req.valid.query.voice ?? narration.defaults.voice,
  };
  const problem = targetProblem({ ...target, language });
  if (problem) throw unprocessable(problem);

  const picked = pickChapters(book, asked);
  const exact = picked.length <= 20;
  const step = Math.max(1, Math.floor(picked.length / SAMPLE_CHAPTERS));
  const sample = exact ? picked : picked.filter((_, i) => i % step === 0).slice(0, SAMPLE_CHAPTERS);

  const texts = [];
  let alreadyMade = 0;
  let withoutText = 0;
  try {
    for (const chapterId of sample) {
      const source = await service.loadNarrationSource(book, chapterId, language);
      withoutText += source.missing.length;
      const clips = exact && force !== 'true' ? await service.existingClips({ book, language, ...target }, source.verses.map((v) => v.verseId)) : new Map();
      for (const verse of source.verses) {
        const hash = textHash({ text: verse.text, language, ...target });
        if (clipStands(clips.get(verse.verseId), hash, {})) alreadyMade += 1;
        else texts.push(verse.text);
      }
    }
  } catch (err) {
    throw unprocessable(`Could not read the verse texts from storage: ${err.message}`);
  }

  const scale = exact ? 1 : picked.length / sample.length;
  const base = estimateText({ engine: target.engine, texts });
  const rounded = (n) => Math.round(n * scale);
  return ok(res, {
    book,
    language,
    ...target,
    chapters: picked.length,
    sampledChapters: sample.length,
    sampled: !exact,
    verses: rounded(base.verses),
    alreadyMade: rounded(alreadyMade),
    versesWithoutText: rounded(withoutText),
    characters: rounded(base.characters),
    requests: rounded(base.requests),
    priced: base.priced,
    priceVerified: base.priceVerified,
    costUsd: base.costUsd == null ? null : base.costUsd * scale,
    minutesAtLimit: Math.ceil(base.minutesAtLimit * scale),
  });
};

/** GET /api/admin/narration/runs */
export const list = async (req, res) => {
  const { status, book, kind } = req.valid.query;
  const { skip, take, page, pageSize } = readPage(req.valid.query, 20);
  const where = { ...(status && { status }), ...(book && { book }), ...(kind && { kind }) };
  const [rows, total] = await Promise.all([
    prisma.narrationRun.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.narrationRun.count({ where }),
  ]);
  const now = new Date();
  return paginated(res, rows.map((row) => presentRun(row, now)), { page, pageSize, total });
};

/** GET /api/admin/narration/runs/:id — one run and its activity feed. */
export const get = async (req, res) => {
  const row = await prisma.narrationRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Narration run');
  return ok(res, { run: presentRun(row), feed: await service.readFeed(row.id, 100) });
};

/** GET /api/admin/narration/compare/:id — a comparison with each target's clip and a short-lived address to play it. */
export const compare = async (req, res) => {
  const row = await prisma.narrationRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row || row.kind !== 'COMPARE') throw notFound('Voice comparison');
  const verseId = row.verseIds?.[0];
  const clips = verseId
    ? await prisma.narrationClip.findMany({ where: { book: row.book, language: row.language, verseId, OR: (row.targets || []).map(({ engine, model, voice }) => ({ engine, model, voice })) } })
    : [];
  const byTarget = new Map(clips.map((clip) => [targetKey(clip), clip]));
  const cells = await Promise.all(
    (row.targets || []).map(async (target) => {
      const clip = byTarget.get(targetKey(target));
      return { ...target, key: targetKey(target), clip: clip ? { ...presentClip(clip), url: await service.clipUrl(clip) } : null };
    })
  );
  return ok(res, { run: presentRun(row), verseId, cells, feed: await service.readFeed(row.id, 50) });
};

/** GET /api/admin/narration/clips — the clips of one voice (or all), newest first. */
export const clips = async (req, res) => {
  const { book, language, engine, model, voice, verseId } = req.valid.query;
  const { skip, take, page, pageSize } = readPage(req.valid.query, 50);
  const where = {
    ...(book && { book }), ...(language && { language }), ...(engine && { engine }), ...(model && { model }), ...(voice && { voice }),
    ...(verseId && { verseId }),
  };
  const [rows, total] = await Promise.all([
    prisma.narrationClip.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take }),
    prisma.narrationClip.count({ where }),
  ]);
  return paginated(res, rows.map(presentClip), { page, pageSize, total });
};

/** GET /api/admin/narration/clips/:id — one clip with a short-lived address for its audio. */
export const clip = async (req, res) => {
  const row = await prisma.narrationClip.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Narration clip');
  return ok(res, { ...presentClip(row), url: await service.clipUrl(row) });
};

// The shared part of starting either kind: the storage check, the start lock, the row, the job. `data` is the kind-specific columns.
async function startRun(req, res, { book, kind, data, live, feedText, auditAction, auditAfter }) {
  const storage = await service.storageStatus(book);
  if (!storage.ok) throw unprocessable(`Storage is not set up: ${storage.error}`);

  const gotLock = await redis.set(lockKey(book), req.auth.user.id, 'EX', START_LOCK_SECONDS, 'NX');
  if (!gotLock) throw conflict('A run is being started. Try again in a moment.');

  try {
    const busy = await prisma.narrationRun.findFirst({ where: { book, kind, status: { in: ACTIVE_STATUSES }, ...live }, select: { id: true } });
    if (busy) throw conflict(`There is already a ${kind === 'COMPARE' ? 'voice comparison' : 'narration run'} going for this book. Wait for it, or cancel it.`, { runId: busy.id });

    const row = await prisma.narrationRun.create({
      data: {
        kind, book, status: 'QUEUED', statusMessage: 'Waiting for the worker.', ...data,
        requestedById: req.auth.user.id, requestedByName: req.auth.user.name || req.auth.user.email || null,
      },
    });

    let current = row;
    try {
      const jobId = service.newJobId(row.id);
      current = await prisma.narrationRun.update({ where: { id: row.id }, data: { jobId } });
      await service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Queued by ${row.requestedByName || 'an admin'}: ${feedText}` });
      await service.addRunJob(row.id, jobId);
    } catch (err) {
      logger.error({ err: err.message, runId: row.id }, 'could not queue a narration run');
      current = await prisma.narrationRun.update({ where: { id: row.id }, data: { status: 'FAILED', finishedAt: new Date(), statusMessage: `Could not be queued: ${err.message}` } });
      service.publishRun(current);
      throw unprocessable('The run could not be put on the queue. Is Redis reachable?');
    }

    await audit.record(req, { action: auditAction, entityType: 'NarrationRun', entityId: row.id, after: { book, ...auditAfter } });
    service.publishRun(current);
    return created(res, presentRun(current));
  } finally {
    await redis.del(lockKey(book)).catch(() => {});
  }
}

/** POST /api/admin/narration/runs */
export const start = async (req, res) => {
  const { chapters: asked, force } = req.valid.body;
  const book = req.valid.body.book ?? service.DEFAULT_BOOK;
  const language = req.valid.body.language ?? narration.defaults.language;
  const target = {
    engine: req.valid.body.engine ?? narration.defaults.engine,
    model: req.valid.body.model ?? narration.defaults.model,
    voice: req.valid.body.voice ?? narration.defaults.voice,
  };
  checkTarget(target, language);
  const picked = pickChapters(book, asked);

  return startRun(req, res, {
    book, kind: 'NARRATION',
    data: { language, ...target, chapters: picked, force: force ?? false },
    live: {},
    feedText: `${picked.length} chapter(s) in ${narration.languages[language].label} with ${narration.engines[target.engine].label} (${target.voice}).`,
    auditAction: 'narration.start',
    auditAfter: { language, ...target, chapters: picked.length, force: force ?? false },
  });
};

/** POST /api/admin/narration/compare — one verse in up to `maxTargets` voices. */
export const startCompare = async (req, res) => {
  const { verseId, targets: asked } = req.valid.body;
  const book = req.valid.body.book ?? service.DEFAULT_BOOK;
  const language = req.valid.body.language ?? narration.defaults.language;

  const seen = new Set();
  const targets = asked.filter((t) => !seen.has(targetKey(t)) && seen.add(targetKey(t)));
  if (targets.length > narration.maxTargets) throw unprocessable(`A comparison takes at most ${narration.maxTargets} voices.`);
  for (const target of targets) checkTarget(target, language);

  // The verse must be in the book and have text in this language, or the run would have nothing to say.
  let chapterId;
  try {
    chapterId = chapterIdOfVerse(verseId);
  } catch {
    throw badRequest(`"${verseId}" is not a verse id.`);
  }
  const [chapter] = pickChapters(book, [chapterId]);
  const source = await service.loadNarrationSource(book, chapter, language).catch((err) => {
    throw unprocessable(`Could not read the verse text: ${err.message}`);
  });
  const verse = source.verses.find((v) => v.verseId === verseId);
  if (!verse) throw unprocessable(`Verse ${verseId} has no ${narration.languages[language].label} text to narrate.`);

  return startRun(req, res, {
    book, kind: 'COMPARE',
    data: { language, targets, chapters: [chapter], verseIds: [verseId], force: true },
    live: {},
    feedText: `verse ${verse.ref} in ${targets.length} voice(s).`,
    auditAction: 'narration.compare',
    auditAfter: { language, verseId, targets: targets.length },
  });
};

/** POST /api/admin/narration/runs/:id/resume */
export const resume = async (req, res) => {
  const row = await prisma.narrationRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Narration run');
  if (row.status !== 'PAUSED' && row.status !== 'FAILED') throw conflict(`Only a paused or failed run can be resumed — this one is ${row.status.toLowerCase()}.`);
  const next = await prisma.narrationRun.update({
    where: { id: row.id },
    data: { status: 'QUEUED', pauseReason: null, statusMessage: 'Resumed. Waiting for the worker.', stopReason: null, errorVerse: null, resumeAt: null, retriesInARow: 0, cancelRequested: false, finishedAt: null },
  });
  await service.ensureRunJob(next);
  const fresh = await prisma.narrationRun.findUnique({ where: { id: row.id } });

  await audit.record(req, { action: 'narration.resume', entityType: 'NarrationRun', entityId: row.id, before: forget(row), after: { status: 'QUEUED' } });
  service.pushFeed(row.id, { kind: 'status', level: 'info', text: `Resumed by ${who(req)}.` });
  service.publishRun(fresh);
  return ok(res, presentRun(fresh));
};

/** POST /api/admin/narration/runs/:id/cancel */
export const cancel = async (req, res) => {
  const row = await prisma.narrationRun.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Narration run');
  if (!ACTIVE_STATUSES.includes(row.status)) throw conflict(`This run is already ${row.status.toLowerCase()}.`);

  const name = who(req);
  const askOnly = row.status === 'RUNNING' && !presentRun(row).stalled;

  let next;
  if (askOnly) {
    next = await prisma.narrationRun.update({ where: { id: row.id }, data: { cancelRequested: true, statusMessage: 'Cancelling after the verse in progress…' } });
  } else {
    const done = await prisma.narrationRun.updateMany({
      where: { id: row.id, status: row.status, jobId: row.jobId },
      data: { status: 'CANCELLED', cancelRequested: false, resumeAt: null, finishedAt: new Date(), statusMessage: `Cancelled by ${name}.` },
    });
    if (done.count === 0) throw conflict('The run changed while it was being cancelled. Look again.');
    await service.dropRunJob(row);
    next = await prisma.narrationRun.findUnique({ where: { id: row.id } });
  }

  await audit.record(req, { action: 'narration.cancel', entityType: 'NarrationRun', entityId: row.id, before: forget(row), after: { status: next.status, cancelRequested: next.cancelRequested } });
  service.pushFeed(row.id, { kind: 'status', level: 'warn', text: `Cancel requested by ${name}.` });
  service.publishRun(next);
  return ok(res, presentRun(next));
};
