// Everything the Narration pages and their worker share that talks to something: the verse texts read from the book's
// storage, the clips written to S3, the run's job on the queue, the activity feed in Redis and the live channel to the
// admin panel. The run itself is jobs/processors/narration.js; the pure rules are utils/narration.js; the two text-to-speech
// engines are services/narration-engines.js.
//
// Verse texts are read through the translation workspace, as the Scenes page reads them. The clips and the index are
// written with putObject: the workspace's store writes JSON only, and a clip is audio.

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { redis } from '../config/redis.js';
import { engines, languages, narration } from '../config/narration.js';
import { JOBS, queues } from '../jobs/index.js';
import { presignGet, putObject } from './s3.js';
import { EVENTS, toPermission } from './websocket.js';
import * as translationService from './translation.js';
import { BOOK_IDS, TRANSLATOR, bookOf, chapterIdOfVerse, chapterKey, chapterLabel, chapterParts } from '../scripts/lib/claude-translate-source.js';
import { langChapterKey } from '../scripts/lib/claude-translate-store.js';
import { clipKey, indexKey, presentClip, presentRun } from '../utils/narration.js';

const queue = queues.narration;

export const DEFAULT_BOOK = 'bhagavat-gita';

/* ---------- what the server is set up with ---------- */

/** Each engine with its voices, models and price, and whether its key is set. The key itself is never sent. */
export function engineChoices() {
  return Object.entries(engines).map(([id, engine]) => ({
    id,
    label: engine.label,
    company: engine.company,
    keyEnv: engine.keyEnv,
    configured: Boolean(env[engine.keyEnv]),
    models: engine.models,
    voices: engine.voices,
    price: { usdPerMillionChars: engine.price.usdPerMillionChars, verified: engine.price.verified, source: engine.price.source },
    limits: { requestsPerMinute: engine.rpm, bytesPerRequest: engine.maxBytes },
  }));
}

export const languageChoices = () => Object.entries(languages).map(([id, language]) => ({ id, label: language.label }));

/** True when the key an engine needs is not set on the server. A run on that engine pauses before its first verse. */
export const keyMissing = (engine) => !env[engines[engine]?.keyEnv];

export function books() {
  return BOOK_IDS.map((id) => ({
    id,
    title: bookOf(id).title,
    chapters: bookOf(id).chapters.map((chapter) => ({ id: chapter, canto: chapterParts(chapter, id).canto, label: chapterLabel(chapter, id) })),
  }));
}

/** `{ ok, describe }` or `{ ok: false, error }` for the page's checklist. Never throws. */
export async function storageStatus(book = DEFAULT_BOOK) {
  try {
    const { describe, getSource } = await translationService.openWorkspace();
    await getSource(chapterKey(bookOf(book).chapters[0], book));
    return { ok: true, describe };
  } catch (err) {
    const why = err?.name === 'NoSuchKey' ? err.message : `${err?.name && err.name !== 'Error' ? `${err.name}: ` : ''}${err?.message || 'unknown problem'}`;
    return { ok: false, error: why };
  }
}

/* ---------- the verse texts ---------- */

/** A chapter that cannot be read at all. The run stops on it; the message is shown as it is. */
export class SourceError extends Error {
  constructor(message, chapter) {
    super(message);
    this.name = 'SourceError';
    this.chapter = chapter;
  }
}

// The Prabhupāda translation of a verse in one language: the meaning the book gives, not the purport.
const translationIn = (verse, language) =>
  (verse?.commentaries || []).find((c) => c.translatorSlug === TRANSLATOR && c.language === language && c.type === 'translation')?.text?.trim() || '';

/**
 * One chapter's verses in one language. The English chapter file gives the verse ids and their numbers; each verse's text is
 * its translation in `language` (for English, the English file itself; for Hindi, the file the Translations page saved). A
 * verse that file lacks is read from the database. → `{ chapterName, verses: [{ verseId, verseNumber, ref, text }], missing: [ref] }`,
 * where `verses` holds only the verses that have text.
 */
export async function loadNarrationSource(book, chapterId, language) {
  const { getSource, store } = await translationService.openWorkspace();
  let english;
  try {
    english = await getSource(chapterKey(chapterId, book));
  } catch (err) {
    if (err?.name === 'NoSuchKey') throw new SourceError(`The book text for chapter ${chapterLabel(chapterId, book)} is not in storage (${chapterKey(chapterId, book)}).`, chapterId);
    throw err;
  }
  const translated = language === 'en' ? english : await store.getJson(langChapterKey(language, chapterId, book));
  const byId = new Map((translated?.verses || []).map((v) => [v.verseId, v]));

  const listed = (english.verses || []).map((verse) => ({
    verseId: verse.verseId,
    // The number the book gives: "47", or "51-53" for a grouped verse.
    verseNumber: verse.verseNumberEnd ? `${verse.verseNumber}-${verse.verseNumberEnd}` : String(verse.verseNumber),
    ref: `${verse.cantoNumber ? `${verse.cantoNumber}.` : ''}${verse.chapterNumber}.${verse.verseNumber}${verse.verseNumberEnd ? `-${verse.verseNumberEnd}` : ''}`,
    text: translationIn(byId.get(verse.verseId), language),
  }));

  // VerseTranslation points at the verse's own id, not the dotted key, so the database is asked by the key.
  const lacking = listed.filter((v) => !v.text);
  if (lacking.length) {
    const found = await prisma.verse.findMany({
      where: { verseId: { in: lacking.map((v) => v.verseId) } },
      select: { verseId: true, translations: { where: { languageCode: language, type: 'TRANSLATION' }, select: { meaning: true, translator: { select: { slug: true } } } } },
    });
    const byVerse = new Map();
    for (const v of found) {
      const rows = v.translations.filter((t) => t.meaning?.trim());
      const best = rows.find((t) => t.translator?.slug === TRANSLATOR) ?? rows[0];
      if (best) byVerse.set(v.verseId, best.meaning.trim());
    }
    for (const v of lacking) v.text = byVerse.get(v.verseId) || '';
  }

  return {
    chapterName: english.meta?.chapterName || english.meta?.chapterTitleEn || null,
    verses: listed.filter((v) => v.text),
    missing: listed.filter((v) => !v.text).map((v) => v.ref),
  };
}

/* ---------- the clips and the index ---------- */

// A voice's clips are the rows with this target in them; the same six columns the unique key names.
const clipWhere = ({ book, language, engine, model, voice }) => ({ book, language, engine, model, voice });

/** The clips already made for these verses in one voice: a Map of verseId → row. */
export async function existingClips(target, verseIds) {
  const rows = await prisma.narrationClip.findMany({ where: { ...clipWhere(target), verseId: { in: verseIds } } });
  return new Map(rows.map((row) => [row.verseId, row]));
}

/**
 * Writes one verse's audio to S3 under its clip key and records it. A clip made again for the same verse in the same voice
 * replaces the old one (the key is the same); the new one is announced to the watchers.
 */
export async function putClip({ target, chapterId, verseNumber, verseId, audio, contentType, ext, seconds, characters, hash, runId }) {
  const key = clipKey({ ...target, chapterId, verseNumber, ext });
  await putObject(key, audio, contentType);
  const scope = { book: target.book, language: target.language, engine: target.engine, model: target.model, voice: target.voice, verseId };
  const data = { s3Key: key, contentType, bytes: audio.length, seconds, characters, textHash: hash, runId };
  const row = await prisma.narrationClip.upsert({
    where: { book_language_engine_model_voice_verseId: scope },
    create: { ...scope, ...data },
    update: data,
  });
  toPermission('narration.read', EVENTS.NARRATION_CLIP, presentClip(row));
  return row;
}

/**
 * Rewrites a voice's _index.json from its clip rows: for each chapter, the file, length, size and characters of every verse
 * with audio. It is read from the database, so it is the same whichever run made a clip.
 */
export async function writeIndex(target) {
  const rows = await prisma.narrationClip.findMany({ where: clipWhere(target) });
  const chapters = {};
  for (const row of rows) {
    const chapterId = chapterIdOfVerse(row.verseId);
    const chapter = (chapters[chapterId] ||= { label: chapterLabel(chapterId, target.book), verses: {} });
    chapter.verses[row.verseId] = { file: row.s3Key, seconds: row.seconds, bytes: row.bytes, characters: row.characters };
  }
  const index = {
    updatedAt: new Date().toISOString(),
    book: target.book,
    language: target.language,
    engine: target.engine,
    model: target.model,
    voice: target.voice,
    clips: rows.length,
    seconds: rows.reduce((sum, row) => sum + row.seconds, 0),
    chapters,
  };
  await putObject(indexKey(target), Buffer.from(JSON.stringify(index, null, 2)), 'application/json');
  return index;
}

/** A short-lived address for a clip's audio, for the page to play. Null when the clip has no file. */
export const clipUrl = (row) => presignGet(row?.s3Key);

/* ---------- the live channel and the activity feed ---------- */

const feedKey = (runId) => `${narration.feedKey}:${runId}`;

export function publishRun(row) {
  toPermission('narration.read', EVENTS.NARRATION_RUN, presentRun(row));
}

/** Adds a line to a run's feed (Redis, newest first, capped) and sends it to the watchers. Never throws. */
export async function pushFeed(runId, line) {
  const entry = { at: new Date().toISOString(), ...line };
  toPermission('narration.read', EVENTS.NARRATION_ACTIVITY, { runId, ...entry });
  try {
    await redis.multi().lpush(feedKey(runId), JSON.stringify(entry)).ltrim(feedKey(runId), 0, narration.feedLines - 1).expire(feedKey(runId), narration.feedDays * 86400).exec();
  } catch (err) {
    logger.warn({ err: err.message, runId }, 'narration feed write failed');
  }
}

export async function readFeed(runId, count = 100) {
  const lines = await redis.lrange(feedKey(runId), 0, Math.min(count, narration.feedLines) - 1).catch(() => []);
  return lines.map((l) => JSON.parse(l));
}

/* ---------- a run's job on the queue ---------- */

const LIVE_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'];
export const newJobId = (runId) => `narration-${runId}-${Date.now().toString(36)}`;

export async function addRunJob(runId, jobId = newJobId(runId)) {
  await queue.add(JOBS.NARRATION_RUN, { runId }, { jobId });
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
  await prisma.narrationRun.update({ where: { id: run.id }, data: { jobId } });
  await addRunJob(run.id, jobId);
  return jobId;
}

export async function dropRunJob(run) {
  if (!run.jobId) return;
  const job = await queue.getJob(run.jobId).catch(() => null);
  if (job) await job.remove().catch(() => {});
}

/** The safety net: a run that should be working but has no live job gets a new one. */
export async function reconcileRuns() {
  const youngerThan = new Date(Date.now() - 30_000);
  const rows = await prisma.narrationRun.findMany({
    where: { updatedAt: { lt: youngerThan }, OR: [{ status: { in: ['QUEUED', 'RUNNING'] } }, { status: 'PAUSED', resumeAt: { not: null } }] },
  });
  const requeued = [];
  for (const row of rows) {
    const job = row.jobId ? await queue.getJob(row.jobId).catch(() => null) : null;
    const state = job ? await job.getState().catch(() => 'unknown') : 'missing';
    if (LIVE_STATES.includes(state)) continue;
    if (job) await job.remove().catch(() => {});
    const jobId = newJobId(row.id);
    const next = await prisma.narrationRun.update({
      where: { id: row.id },
      data: { jobId, status: 'QUEUED', resumeAt: null, pauseReason: null, statusMessage: 'Picked up again after its background job was lost.' },
    });
    await addRunJob(row.id, jobId);
    publishRun(next);
    pushFeed(row.id, { kind: 'status', level: 'warn', text: 'Its background job was lost; queued again.' });
    logger.warn({ runId: row.id, was: state }, 'narration run re-queued');
    requeued.push(row.id);
  }
  return requeued;
}
