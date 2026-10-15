// Everything the Translations page and its worker share that talks to something: the S3 bucket the
// Gita is read from and the translations are written to, the run's jobs on the queue, the activity
// feed in Redis and the live channel to the admin panel.
//
// The translating itself is scripts/lib/claude-translate-*.js — the same code `npm run
// translate:claude` runs. This file only opens it up to the API and the worker.

import { redis } from '../config/redis.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { prisma } from '../config/database.js';
import { translation } from '../config/translation.js';
import { JOBS, queues } from '../jobs/index.js';
import { EVENTS, toPermission } from './websocket.js';
import { BUCKET as S3_BUCKET, client as s3Client } from './s3.js';
import { describeEvent, presentRun } from '../utils/translation-run.js';

import { DEFAULT_PROVIDER, PROVIDERS, PROVIDER_IDS, costFor, providerOf } from '../scripts/lib/translate-providers.js';
import { LANGUAGES, LANGUAGE_CODES } from '../scripts/lib/claude-translate-languages.js';
import { dryRun, hasTranslation, isCurrent, verifyEntry } from '../scripts/lib/claude-translate-run.js';
import { BOOK, BOOKS, BOOK_IDS, DEFAULT_GROUP_BUDGET, TRANSLATOR, bookOf, bookOfVerseId, chapterIdOfVerse, chapterKey, chapterLabel, loadChapter } from '../scripts/lib/claude-translate-source.js';
import { dirStore, langChapterKey, s3Store, versionFrom } from '../scripts/lib/claude-translate-store.js';

const queue = queues.translation;

/* ---------- what the server is set up with ---------- */

/** The provider a run uses unless the admin picks another (TRANSLATION_PROVIDER, else Claude). */
export const defaultProvider = () => (PROVIDER_IDS.includes(env.TRANSLATION_PROVIDER) ? env.TRANSLATION_PROVIDER : DEFAULT_PROVIDER);
export const apiKey = (provider = defaultProvider()) => env[providerOf(provider).keyEnv] || '';
/** The model a provider uses unless told otherwise: its env setting (ANTHROPIC_MODEL, TRANSLATION_OPENAI_MODEL), else its built-in default. */
export const model = (provider = defaultProvider()) => env[providerOf(provider).modelEnv] || providerOf(provider).defaultModel;

/** Every provider, with whether its key is set and the model it defaults to; what the start dialog offers. */
export const providers = () =>
  PROVIDER_IDS.map((id) => ({ id, label: PROVIDERS[id].label, company: PROVIDERS[id].company, keyEnv: PROVIDERS[id].keyEnv, apiKeyConfigured: Boolean(apiKey(id)), defaultModel: model(id) }));

/** The version every verse of a new run is stamped with (TRANSLATION_VERSION, else the default). Throws if the setting is malformed. */
export const currentVersion = () => versionFrom(env.TRANSLATION_VERSION);

export const languages = () => LANGUAGES.map(({ code, name, endonym }) => ({ code, name, endonym }));

/* ---------- the bucket ---------- */

let workspaceOnce = null;

/**
 * The store translations are saved to and the function that reads the English from. On the server this is
 * **the app's own bucket** (`S3_BUCKET`, with the credentials the API already has), where `json/bhagavat-gita/`
 * already sits beside the book text. `SOURCE_S3_BUCKET` (the command line's setting, in `.env.scripts`) is
 * honoured only when it is set, to point a server at some other bucket; `SOURCE_LOCAL_DIR` (a folder laid out
 * like the bucket) is used for both when set, for tests. Opened on first use.
 */
export function openWorkspace() {
  workspaceOnce ||= (async () => {
    if (process.env.SOURCE_LOCAL_DIR) {
      const source = await import('../scripts/lib/source-s3.js');
      const store = dirStore(process.env.SOURCE_LOCAL_DIR);
      return { store, getSource: memoised(source.getJson), describe: store.describe };
    }
    const store = process.env.SOURCE_S3_BUCKET ? await s3Store() : await s3Store({ client: s3Client, bucket: S3_BUCKET });
    return { store, getSource: memoised(readFrom(store)), describe: store.describe };
  })();
  return workspaceOnce;
}

/** A source file read from the store; absent is an error, as the file reader expects. */
const readFrom = (store) => async (key) => {
  const file = await store.read(key);
  if (!file) {
    const err = new Error(`${key} is not in ${store.describe}`);
    err.name = 'NoSuchKey';
    throw err;
  }
  return file.json;
};

/**
 * `{ ok, describe }` or `{ ok: false, error }` — for the page's checklist, never throws. It reads the first
 * English chapter (kept for ten minutes, and needed by every estimate anyway), so a bucket the server cannot
 * reach, or one without the scripture in it, shows up here and not as a page full of zeros.
 */
export async function storageStatus() {
  try {
    const { describe, getSource } = await openWorkspace();
    await getSource(chapterKey(1));
    return { ok: true, describe };
  } catch (err) {
    const why = err?.name === 'NoSuchKey' ? err.message : `${err?.name && err.name !== 'Error' ? `${err.name}: ` : ''}${err?.message || 'unknown problem'}`;
    return { ok: false, error: why };
  }
}

/** Reads of the English and Sanskrit chapter files, remembered for a while: they do not change under a run. */
function memoised(getJson) {
  const seen = new Map();
  return async (key) => {
    const hit = seen.get(key);
    if (hit && hit.until > Date.now()) return hit.value;
    const value = await getJson(key);
    seen.set(key, { value, until: Date.now() + translation.sourceCacheSeconds * 1000 });
    return value;
  };
}

/** Is a worker connected to the translation queue? `null` when Redis would not say. */
export async function workerOnline() {
  try {
    return (await queue.getWorkers()).length > 0;
  } catch (err) {
    logger.warn({ err: err.message }, 'could not list translation workers');
    return null;
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const at = next++;
        results[at] = await fn(items[at], at);
      }
    })
  );
  return results;
}

/* ---------- what is saved, and what a run would do ---------- */

const emptyScores = () => ({ 1: 0, 2: 0, 3: 0, unscored: 0 });
const coverageInFlight = new Map();

/** The version new runs use, or null when TRANSLATION_VERSION is malformed (the overview reports that; coverage just goes on). */
function versionOrNull() {
  try {
    return currentVersion();
  } catch {
    return null;
  }
}

/**
 * How much of the Gita each language has: per language the verses saved, how many of those are up to date
 * for the version new runs use (`upToDate`: made under it, or not by Claude), how many Claude made and
 * their scores, and per chapter the saved and up-to-date counts. Reads every chapter file, so it is kept in
 * Redis for `coverageCacheSeconds` and dropped when a run stops (`forgetCoverage`) — and when it was worked
 * out for another version, which is what a restart with a new TRANSLATION_VERSION leaves behind.
 */
export async function coverage({ book = BOOK, refresh = false } = {}) {
  if (!refresh) {
    const cached = await redis.get(coverageKey(book)).catch(() => null);
    const found = cached ? JSON.parse(cached) : null;
    if (found && found.version === versionOrNull()) return found;
  }
  if (!coverageInFlight.has(book)) coverageInFlight.set(book, computeCoverage(book).finally(() => coverageInFlight.delete(book)));
  return coverageInFlight.get(book);
}

async function computeCoverage(book) {
  const { store, getSource } = await openWorkspace();
  const version = versionOrNull();
  const byLang = Object.fromEntries(LANGUAGE_CODES.map((code) => [code, { code, saved: 0, upToDate: 0, byClaude: 0, scores: emptyScores(), versions: {}, chapters: [] }]));
  let total = 0;

  const chapters = await mapLimit(bookOf(book).chapters, translation.readConcurrency, async (n) => {
    const { units } = await loadChapter(getSource, n, book);
    const files = await Promise.all(LANGUAGE_CODES.map((code) => store.getJson(langChapterKey(code, n, book))));
    return { n, units, files };
  });

  for (const { n, units, files } of chapters) {
    total += units.length;
    LANGUAGE_CODES.forEach((code, i) => {
      const file = files[i];
      const by = byLang[code];
      const have = new Map((file?.verses || []).map((v) => [v.verseId, v]));
      let saved = 0;
      let upToDate = 0;
      for (const unit of units) {
        if (!hasTranslation(file, unit.verseId, code)) continue;
        saved++;
        if (isCurrent(file, unit.verseId, code, version)) upToDate++;
        const ai = have.get(unit.verseId)?.aiTranslation;
        if (!ai) continue;
        by.byClaude++;
        by.scores[[1, 2, 3].includes(ai.correctness) ? ai.correctness : 'unscored']++;
        by.versions[ai.version ?? 'unversioned'] = (by.versions[ai.version ?? 'unversioned'] || 0) + 1;
      }
      by.saved += saved;
      by.upToDate += upToDate;
      by.chapters.push({ chapter: n, total: units.length, saved, upToDate });
    });
  }

  const result = { book, generatedAt: new Date().toISOString(), version, total, languages: Object.values(byLang) };
  await redis.set(coverageKey(book), JSON.stringify(result), 'EX', translation.coverageCacheSeconds).catch(() => {});
  return result;
}

const coverageKey = (book) => `${translation.coverageCacheKey}:${book}`;
export const forgetCoverage = () => redis.del(...BOOK_IDS.map(coverageKey)).catch(() => {});

/** Every book that can be translated, with its chapter ids and how to label them; what the page builds its book tabs from. */
export const books = () => BOOK_IDS.map((id) => ({ id, title: BOOKS[id].title, chapters: BOOKS[id].chapters.map((chapter) => ({ id: chapter, label: chapterLabel(chapter, id) })) }));

/**
 * What a run for `language` over `chapters` has left under `version`, and a guess at its cost: the
 * pipeline's dry run, one chapter at a time in parallel and added up. `limit` caps how many verses (the
 * cost is scaled to match). A verse already translated under `version` is `saved` and costs nothing; one
 * Claude translated under another version is `outdated` and is left to do, like a verse never translated.
 */
export async function estimate({ language, book = BOOK, chapters, limit = 0, provider = defaultProvider(), model: modelId = model(provider), version = currentVersion() }) {
  const { store, getSource } = await openWorkspace();
  const parts = await mapLimit(chapters, translation.readConcurrency, (n) =>
    dryRun({ store, getSource, cfg: { book, langs: [language], chapters: [n], only: null, groupBudget: DEFAULT_GROUP_BUDGET, version } })
  );
  const sum = (pick) => parts.reduce((total, part) => total + pick(part.totals), 0);
  const totals = { verses: sum((t) => t.verses), done: sum((t) => t.done), todo: sum((t) => t.todo), outdated: sum((t) => t.outdated), calls: sum((t) => t.calls), inTokens: sum((t) => t.inTokens), outTokens: sum((t) => t.outTokens), systemTokens: sum((t) => t.systemTokens) };
  const verses = limit ? Math.min(limit, totals.todo) : totals.todo;
  const share = totals.todo ? verses / totals.todo : 0;
  const cost = costFor(provider, modelId, { inputTokens: totals.inTokens, outputTokens: totals.outTokens, cacheReadTokens: totals.systemTokens, cacheWriteTokens: 0 });
  return {
    language,
    book,
    chapters,
    provider,
    model: modelId,
    version,
    verses: totals.verses,
    saved: totals.done,
    outdated: totals.outdated,
    todo: totals.todo,
    willTranslate: verses,
    calls: Math.round(totals.calls * share),
    inputTokens: Math.round(totals.inTokens * share),
    outputTokens: Math.round(totals.outTokens * share),
    // A guess from the verses' length with thinking off; the run records what each call really cost.
    costUsd: cost == null ? null : cost * share,
  };
}

/* ---------- reading the output ---------- */

const ownRows = (verse, lang) => (verse?.commentaries || []).filter((c) => c.translatorSlug === TRANSLATOR && c.language === lang);
const rowText = (rows, type) => rows.find((r) => r.type === type)?.text ?? null;

/** One chapter of one language, verse by verse: which are saved, by whom, how they scored, and the start of the translation. */
export async function chapterIndex(language, chapter, book = BOOK) {
  const { store, getSource } = await openWorkspace();
  const [{ units, meta }, file] = await Promise.all([loadChapter(getSource, chapter, book), store.getJson(langChapterKey(language, chapter, book))]);
  const have = new Map((file?.verses || []).map((v) => [v.verseId, v]));
  const verses = units.map((unit) => {
    const verse = have.get(unit.verseId);
    const saved = hasTranslation(file, unit.verseId, language);
    const ai = verse?.aiTranslation;
    const text = saved ? rowText(ownRows(verse, language), 'translation') : null;
    return {
      verseId: unit.verseId,
      ref: unit.ref,
      saved,
      byClaude: Boolean(ai),
      correctness: ai?.correctness ?? null,
      warnings: ai?.warnings?.length ?? 0,
      version: ai?.version ?? null,
      generatedAt: ai?.generatedAt ?? null,
      preview: text ? text.slice(0, 140) : null,
    };
  });
  return {
    language,
    book,
    chapter,
    chapterLabel: chapterLabel(chapter, book),
    title: file?.meta?.chapterName ?? meta?.chapterName ?? null,
    titleEn: meta?.chapterTitleEn ?? null,
    total: units.length,
    saved: verses.filter((v) => v.saved).length,
    verses,
  };
}

/** One verse, the English beside what was saved: everything the output viewer shows. `translated` is null while it is not saved. */
export async function verseOutput(language, verseId) {
  const book = bookOfVerseId(verseId);
  const chapter = chapterIdOfVerse(verseId);
  const { store, getSource } = await openWorkspace();
  const [{ units }, file] = await Promise.all([loadChapter(getSource, chapter, book), store.getJson(langChapterKey(language, chapter, book))]);
  const unit = units.find((u) => u.verseId === verseId);
  if (!unit) return null;

  const verse = (file?.verses || []).find((v) => v.verseId === verseId);
  const saved = hasTranslation(file, verseId, language);
  const rows = ownRows(verse, language);
  const ai = verse?.aiTranslation ?? null;
  const siblings = units.map((u) => u.verseId);
  const at = siblings.indexOf(verseId);

  return {
    verseId,
    book,
    ref: unit.ref,
    chapter,
    language,
    previous: siblings[at - 1] ?? null,
    next: siblings[at + 1] ?? null,
    source: {
      translation: unit.translation,
      purport: unit.purport,
      transliteration: unit.transliteration,
      wordMeanings: unit.wordMeanings,
    },
    translated: saved
      ? {
          translation: rowText(rows, 'translation'),
          purport: (rowText(rows, 'purport') ?? '').split('\n').filter(Boolean),
          transliteration: verse.transliteration ? verse.transliteration.split('\n') : [],
          wordMeanings: verse.wordMeanings ?? [],
        }
      : null,
    ai: ai && {
      version: ai.version,
      provider: ai.provider || 'anthropic',
      model: ai.model,
      effort: ai.effort,
      generatedAt: ai.generatedAt,
      correctness: ai.correctness,
      partScores: ai.partScores,
      note: ai.note || null,
      warnings: ai.warnings ?? [],
    },
    // The saved verse re-checked against the English now: null when Claude did not make it.
    problems: saved && ai ? verifyEntry(verse, unit, language) : null,
  };
}

/* ---------- the live channel and the activity feed ---------- */

const feedKey = (runId) => `translation:feed:${runId}`;

/** Sends a run's whole state to every admin who may watch translations. */
export function publishRun(row) {
  toPermission('translation.read', EVENTS.TRANSLATION_RUN, presentRun(row));
}

/**
 * Adds a line to a run's activity feed (kept in Redis, newest first, capped) and sends it to the watchers.
 * Never throws: the feed is a convenience, a failure here must not stop a run.
 */
export async function pushFeed(runId, line) {
  const entry = { at: new Date().toISOString(), ...line };
  toPermission('translation.read', EVENTS.TRANSLATION_ACTIVITY, { runId, ...entry });
  try {
    await redis.multi().lpush(feedKey(runId), JSON.stringify(entry)).ltrim(feedKey(runId), 0, translation.feedLines - 1).expire(feedKey(runId), translation.feedDays * 86400).exec();
  } catch (err) {
    logger.warn({ err: err.message, runId }, 'translation feed write failed');
  }
}

/** Lines from a pipeline event, if it is worth one. */
export const feedFromEvent = (runId, name, fields) => {
  const line = describeEvent(name, fields);
  return line ? pushFeed(runId, line) : Promise.resolve();
};

export async function readFeed(runId, count = 100) {
  const lines = await redis.lrange(feedKey(runId), 0, Math.min(count, translation.feedLines) - 1).catch(() => []);
  return lines.map((l) => JSON.parse(l));
}

/* ---------- a run's job on the queue ---------- */

const LIVE_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'];
export const newJobId = (runId) => `translation-${runId}-${Date.now().toString(36)}`;

/** Adds the job that works a run. The run row names it (`jobId`); a job whose id the row does not name does nothing. */
export async function addRunJob(runId, jobId = newJobId(runId)) {
  await queue.add(JOBS.TRANSLATION_RUN, { runId }, { jobId });
  return jobId;
}

/**
 * Makes sure a run has a live job and that it will start soon: a delayed one (waiting out a retry) is
 * brought forward, a finished or missing one is replaced. Updates the row's `jobId` when it is replaced.
 */
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
  // The row names the job before the job exists: a worker that takes it at once would otherwise find a
  // row naming some other job and skip it as superseded.
  const jobId = newJobId(run.id);
  await prisma.translationRun.update({ where: { id: run.id }, data: { jobId } });
  await addRunJob(run.id, jobId);
  return jobId;
}

/** Takes a run's job off the queue if it has not started. A running one is stopped by the run itself (cancelRequested). */
export async function dropRunJob(run) {
  if (!run.jobId) return;
  const job = await queue.getJob(run.jobId).catch(() => null);
  if (job) await job.remove().catch(() => {});
}

/**
 * The safety net: a run that should be working but whose job is gone (Redis was flushed, a job failed for
 * good) gets a new one. A run is left alone while it is young — its job is being added — or its job is
 * live. Called by the worker on boot and every `reconcileEveryMs`.
 * @returns {Promise<string[]>} ids of the runs it re-queued
 */
export async function reconcileRuns() {
  const youngerThan = new Date(Date.now() - 30_000);
  const rows = await prisma.translationRun.findMany({
    where: { updatedAt: { lt: youngerThan }, OR: [{ status: { in: ['QUEUED', 'RUNNING'] } }, { status: 'PAUSED', resumeAt: { not: null } }] },
  });
  const requeued = [];
  for (const row of rows) {
    const job = row.jobId ? await queue.getJob(row.jobId).catch(() => null) : null;
    const state = job ? await job.getState().catch(() => 'unknown') : 'missing';
    if (LIVE_STATES.includes(state)) continue;
    if (job) await job.remove().catch(() => {});
    const jobId = newJobId(row.id);
    const next = await prisma.translationRun.update({
      where: { id: row.id },
      data: { jobId, status: 'QUEUED', resumeAt: null, pauseReason: null, statusMessage: 'Picked up again after its background job was lost.' },
    });
    await addRunJob(row.id, jobId);
    publishRun(next);
    pushFeed(row.id, { kind: 'status', level: 'warn', text: 'Its background job was lost; queued again.' });
    logger.warn({ runId: row.id, was: state }, 'translation run re-queued');
    requeued.push(row.id);
  }
  return requeued;
}
