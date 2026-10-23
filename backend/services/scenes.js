// Everything the Scenes page and its worker share that talks to something: the S3 bucket the Hindi meanings are read
// from and the scene files written to, the run's job on the queue, the activity feed in Redis and the live channel to
// the admin panel. The run itself is jobs/processors/scenes.js; the pure rules are utils/scenes.js.
//
// It reuses the translation workspace (services/translation.js `openWorkspace`) for the bucket, so the two pages read
// and write the same place with the same credentials.

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { redis } from '../config/redis.js';
import { scenes } from '../config/scenes.js';
import { JOBS, queues } from '../jobs/index.js';
import { EVENTS, toPermission } from './websocket.js';
import * as translationService from './translation.js';
import * as tally from './ai/token-tally.js';
import { PROVIDER_IDS, providerChoices, providerOf } from '../scripts/lib/translate-providers.js';
import { TRANSLATOR, bookOf, chapterKey, chapterLabel, chapterParts } from '../scripts/lib/claude-translate-source.js';
import { langChapterKey } from '../scripts/lib/claude-translate-store.js';
import { indexKey, presentFile, presentRun, sceneKey } from '../utils/scenes.js';

const queue = queues.scenes;

export const BOOK = 'srimad-bhagavatam';
/** The books that can have scene prompts: the one this was built for. The code is not specific to it. */
export const BOOK_IDS = [BOOK];

/* ---------- what the server is set up with ---------- */

export const defaultProvider = () => (PROVIDER_IDS.includes(scenes.provider) ? scenes.provider : 'gemini');
export const apiKey = (provider = defaultProvider()) => env[providerOf(provider).keyEnv] || '';
/** Gemini's model for scenes is SCENES_GEMINI_MODEL; the other providers use their translation model. */
export const model = (provider = defaultProvider()) =>
  (provider === 'gemini' && env.SCENES_GEMINI_MODEL) || env[providerOf(provider).modelEnv] || providerOf(provider).defaultModel;

/** Every provider with the models the page can offer (priced ones, the server's own, and why one cannot be used). */
export const providers = () => providerChoices({ apiKey, model });

/** Google's free-tier numbers from the environment. */
export const limits = () => ({ rpm: scenes.rpm, tpm: scenes.tpm, rpd: scenes.rpd });

/**
 * The per-minute limits a run on this provider keeps to. They are Gemini's free tier, so only a Gemini run is held to
 * them; the other providers are paid by the call and have limits of their own that a 429 reports (the run then waits).
 * `null` means no limit of our own.
 */
export const limitsFor = (provider) => (provider === 'gemini' ? { rpm: scenes.rpm, tpm: scenes.tpm } : { rpm: null, tpm: null });

export const books = () =>
  BOOK_IDS.map((id) => ({
    id,
    title: bookOf(id).title,
    chapters: bookOf(id).chapters.map((chapter) => ({ id: chapter, canto: chapterParts(chapter, id).canto, label: chapterLabel(chapter, id) })),
  }));

/**
 * `{ ok, describe }` or `{ ok: false, error }` — for the page's checklist, never throws. Reads the book's first chapter
 * (kept for ten minutes), so a bucket the server cannot reach, or one without the book in it, shows up here.
 */
export async function storageStatus(book = BOOK) {
  try {
    const { describe, getSource } = await translationService.openWorkspace();
    await getSource(chapterKey(bookOf(book).chapters[0], book));
    return { ok: true, describe };
  } catch (err) {
    const why = err?.name === 'NoSuchKey' ? err.message : `${err?.name && err.name !== 'Error' ? `${err.name}: ` : ''}${err?.message || 'unknown problem'}`;
    return { ok: false, error: why };
  }
}

/* ---------- the index of what is written ---------- */

/** `{ updatedAt, chapters: { [chapterId]: { file, scenes, seconds, provider, model, generatedAt, inputTokens, outputTokens } } }` */
export async function readIndex(book = BOOK) {
  const { store } = await translationService.openWorkspace();
  return (await store.getJson(indexKey(book))) ?? { updatedAt: null, chapters: {} };
}

/** Adds one chapter to the index. Only one run works at a time, so a read-change-write cannot lose another's entry. */
export async function addToIndex(book, entry) {
  const { store } = await translationService.openWorkspace();
  const index = await readIndex(book);
  index.chapters[entry.chapterId] = entry;
  index.updatedAt = new Date().toISOString();
  await store.put(indexKey(book), JSON.stringify(index));
}

/** Chapters a run still has to write: all it was asked for, minus those already in the index (unless `force`). */
export async function chaptersToWrite(book, chapters, force) {
  if (force) return chapters;
  const index = await readIndex(book);
  return chapters.filter((id) => !index.chapters[id]);
}

/** Every chapter of the book with what is known of its file — the grid the page shows. */
export async function coverage(book = BOOK) {
  const index = await readIndex(book);
  const all = bookOf(book).chapters;
  return {
    book,
    updatedAt: index.updatedAt,
    total: all.length,
    written: all.filter((id) => index.chapters[id]).length,
    chapters: all.map((id) => ({ id, canto: chapterParts(id, book).canto, label: chapterLabel(id, book), ...(index.chapters[id] ? { written: true, ...index.chapters[id] } : { written: false }) })),
  };
}

/* ---------- the input and the output ---------- */

/** A source problem a run cannot get past: the chapter file is not there. The message is shown as it is. */
export class SourceError extends Error {
  constructor(message, chapter) {
    super(message);
    this.name = 'SourceError';
    this.chapter = chapter;
  }
}

const prabhupada = (verse, lang, type = 'translation') =>
  (verse?.commentaries || []).find((c) => c.translatorSlug === TRANSLATOR && c.language === lang && c.type === type)?.text?.trim() || '';

/**
 * One chapter's input: the English chapter file gives the verses and their order, the Hindi meaning of each is
 * read from `hi/` in the same bucket (what the Translations page saved) and, for a verse that file does not have,
 * from the database. → `{ chapterName, verses: [{ verseId, ref, hindi }], missingHindi: [ref] }`; `verses` holds only those with Hindi.
 */
export async function loadSource(book, chapterId) {
  const { getSource, store } = await translationService.openWorkspace();
  let en;
  try {
    en = await getSource(chapterKey(chapterId, book));
  } catch (err) {
    if (err?.name === 'NoSuchKey') throw new SourceError(`The book text for chapter ${chapterLabel(chapterId, book)} is not in storage (${chapterKey(chapterId, book)}).`, chapterId);
    throw err;
  }
  const hi = await store.getJson(langChapterKey('hi', chapterId, book));
  const hiById = new Map((hi?.verses || []).map((v) => [v.verseId, v]));

  const listed = (en.verses || []).map((verse) => ({
    verseId: verse.verseId,
    ref: `${verse.cantoNumber ? `${verse.cantoNumber}.` : ''}${verse.chapterNumber}.${verse.verseNumber}${verse.verseNumberEnd ? `-${verse.verseNumberEnd}` : ''}`,
    hindi: prabhupada(hiById.get(verse.verseId), 'hi'),
  }));

  const lacking = listed.filter((v) => !v.hindi);
  if (lacking.length) {
    // VerseTranslation points at the verse's own id, not the dotted key — so the verses are looked up by their key.
    const found = await prisma.verse.findMany({
      where: { verseId: { in: lacking.map((v) => v.verseId) } },
      select: { verseId: true, translations: { where: { languageCode: 'hi', type: 'TRANSLATION' }, select: { meaning: true, translator: { select: { slug: true } } } } },
    });
    const byVerse = new Map();
    for (const v of found) {
      const rows = v.translations.filter((t) => t.meaning?.trim());
      const best = rows.find((t) => t.translator?.slug === TRANSLATOR) ?? rows[0];
      if (best) byVerse.set(v.verseId, best.meaning.trim());
    }
    for (const v of lacking) v.hindi = byVerse.get(v.verseId) || '';
  }

  return {
    chapterName: en.meta?.chapterName || en.meta?.chapterTitleEn || null,
    verses: listed.filter((v) => v.hindi),
    missingHindi: listed.filter((v) => !v.hindi).map((v) => v.ref),
  };
}

/** A chapter's saved file ready for the page (with the copyable prompt text), or null when it is not written. */
export async function readOutput(book, chapterId) {
  const { store } = await translationService.openWorkspace();
  const file = await store.getJson(sceneKey(chapterId, book));
  return file ? presentFile(file) : null;
}

/** The saved file exactly as stored, for download. */
export async function readRaw(book, chapterId) {
  const { store } = await translationService.openWorkspace();
  return store.getJson(sceneKey(chapterId, book));
}

export async function saveOutput(book, chapterId, file) {
  const { store } = await translationService.openWorkspace();
  // Always the latest answer: writing a chapter again (`force`) replaces the file, and the old one is kept as a backup.
  await store.backup(sceneKey(chapterId, book));
  await store.put(sceneKey(chapterId, book), JSON.stringify(file, null, 2));
}

/* ---------- tokens and the minute ---------- */

/** Counts a finished call in the token calculator (the AI usage page) under its provider and model. */
export const countTokens = ({ provider, model: modelId, inputTokens, outputTokens }) => tally.record({ provider, model: modelId, inputTokens, outputTokens });

/**
 * The worker tells the page how full its minute is: kept in Redis for the page's first load (it expires, so an idle worker
 * shows nothing) and sent over the websocket with today's tokens, so the meters move as the run does.
 */
export async function rememberMinute(usage, { provider, model: modelId } = {}) {
  const minute = { at: new Date().toISOString(), ...usage };
  await redis.set(scenes.statusKey, JSON.stringify(minute), 'EX', 120).catch(() => {});
  const today = provider && modelId ? await todayFor(provider, modelId).catch(() => null) : null;
  toPermission('scenes.read', EVENTS.SCENES_USAGE, { minute, today });
}
export async function minuteUsage() {
  const text = await redis.get(scenes.statusKey).catch(() => null);
  return text ? JSON.parse(text) : null;
}

/** What this app has spent today (UTC) on the provider and model a new run would use. */
export async function todayFor(provider, modelId) {
  const rows = await tally.today();
  const row = rows.find((r) => r.provider === provider && r.model === modelId);
  return { inputTokens: row?.inputTokens ?? 0, outputTokens: row?.outputTokens ?? 0, calls: row?.calls ?? 0 };
}

/* ---------- the live channel and the activity feed ---------- */

const feedKey = (runId) => `${scenes.feedKey}:${runId}`;

export function publishRun(row) {
  toPermission('scenes.read', EVENTS.SCENES_RUN, presentRun(row));
}

/** Adds a line to a run's feed (Redis, newest first, capped) and sends it to the watchers. Never throws. */
export async function pushFeed(runId, line) {
  const entry = { at: new Date().toISOString(), ...line };
  toPermission('scenes.read', EVENTS.SCENES_ACTIVITY, { runId, ...entry });
  try {
    await redis.multi().lpush(feedKey(runId), JSON.stringify(entry)).ltrim(feedKey(runId), 0, scenes.feedLines - 1).expire(feedKey(runId), scenes.feedDays * 86400).exec();
  } catch (err) {
    logger.warn({ err: err.message, runId }, 'scenes feed write failed');
  }
}

export async function readFeed(runId, count = 100) {
  const lines = await redis.lrange(feedKey(runId), 0, Math.min(count, scenes.feedLines) - 1).catch(() => []);
  return lines.map((l) => JSON.parse(l));
}

/* ---------- a run's job on the queue ---------- */

const LIVE_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'];
export const newJobId = (runId) => `scenes-${runId}-${Date.now().toString(36)}`;

export async function addRunJob(runId, jobId = newJobId(runId)) {
  await queue.add(JOBS.SCENES_RUN, { runId }, { jobId });
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
  await prisma.sceneRun.update({ where: { id: run.id }, data: { jobId } });
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
  const rows = await prisma.sceneRun.findMany({
    where: { updatedAt: { lt: youngerThan }, OR: [{ status: { in: ['QUEUED', 'RUNNING'] } }, { status: 'PAUSED', resumeAt: { not: null } }] },
  });
  const requeued = [];
  for (const row of rows) {
    const job = row.jobId ? await queue.getJob(row.jobId).catch(() => null) : null;
    const state = job ? await job.getState().catch(() => 'unknown') : 'missing';
    if (LIVE_STATES.includes(state)) continue;
    if (job) await job.remove().catch(() => {});
    const jobId = newJobId(row.id);
    const next = await prisma.sceneRun.update({
      where: { id: row.id },
      data: { jobId, status: 'QUEUED', resumeAt: null, pauseReason: null, statusMessage: 'Picked up again after its background job was lost.' },
    });
    await addRunJob(row.id, jobId);
    publishRun(next);
    pushFeed(row.id, { kind: 'status', level: 'warn', text: 'Its background job was lost; queued again.' });
    logger.warn({ runId: row.id, was: state }, 'scenes run re-queued');
    requeued.push(row.id);
  }
  return requeued;
}
