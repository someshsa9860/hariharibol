// Puts the translations a run saved in storage (json/<book>/<language>/ch-N.json) into the database, where
// the app reads them. Storage is where a run works, one verse at a time; this is the step that publishes
// the result to `VerseTranslation`. The rules, in the order they matter:
//
//   - **The verse is found by its place in the book, and checked.** The database verse is looked up by
//     `verseId` inside the book, and the file's book, canto, chapter and verse numbers must agree with the
//     row's (utils/translation-import.js `placeProblem`). A verse that is not in the database, or that
//     disagrees, is reported and left alone. An import never creates a Verse and never puts text on the
//     wrong one.
//   - **A row that exists is updated in place.** The key is (verse, translator, language, type) — the
//     table's unique key — so the row keeps its id and its createdAt, and anything that points at it still
//     does. One that does not exist is created. Nothing is deleted, and other translators' rows, other
//     languages and the English are never touched.
//   - **Everything the file has for the verse goes in:** the translation (`meaning`), the purport, the
//     transliteration and the word-by-word meanings — the last two on the translation row, because in this
//     language they are not the Roman text and English meanings that live on `Verse`. `translatedBy` and
//     `version` record which run made the text.
//   - **Marathi Bhagavatam files also link the six vikaras.** Unknown slugs are ignored; if a verse already
//     has any `VerseIssue` links, all issue links from the file are skipped for that verse.
//   - **Importing twice is harmless.** A row that already matches the file is counted `unchanged` and not
//     written. `dryRun` does the same work and writes nothing, so the page can say what an import would do.
//   - **Visibility is a decision, not a side effect.** A new row is hidden (`isPublished: false`) unless
//     `publish` is set; an existing row's visibility is never lowered, and `publish` raises it. Claude's
//     text has not been read by a native speaker when it arrives.
//
// A chapter is written in one transaction. A chapter that fails is reported and the others carry on; the
// import can be run again at any point.

import { Prisma } from '@prisma/client';

import { redis } from '../config/redis.js';
import logger from '../config/logger.js';
import { prisma } from '../config/database.js';
import { translation } from '../config/translation.js';
import { JOBS, queues } from '../jobs/index.js';
import { EVENTS, toPermission } from './websocket.js';
import { unprocessable } from '../utils/errors.js';
import { LIVE_IMPORT_STATUSES, changedColumns, emptyChapter, placeProblem, presentImportRun, reasonOf, rowFromEntry, totalsOf } from '../utils/translation-import.js';
import { BOOK, BOOKS, CHAPTERS, TRANSLATOR, bookOf, chapterParts } from '../scripts/lib/claude-translate-source.js';
import { MADE_BY_LABELS } from '../scripts/lib/claude-translate-parts.js';
import { VIKARA_SLUGS } from '../scripts/lib/claude-translate-prompt.js';
import { langChapterKey } from '../scripts/lib/claude-translate-store.js';

const queue = queues['translation-import'];
const IMPORTABLE_VIKARAS = new Set(VIKARA_SLUGS);

/** The Gita's `Book.bookNumber`, as scripts/import-bg.js has it. Its storage folder (`BOOK`) has another spelling than its slug. */
export const GITA_BOOK_NUMBER = 1;

// A row's translated columns as Prisma wants them: an absent word list is a database NULL, not JSON null.
const columnsOf = (row) => ({
  meaning: row.meaning,
  purport: row.purport,
  transliteration: row.transliteration,
  wordMeanings: row.wordMeanings ?? Prisma.DbNull,
  translatedBy: row.translatedBy,
  version: row.version,
});

// Opened when needed: the workspace pulls in the queue and the websocket, which a caller that passes its own store does not want.
async function workspaceStore() {
  const { openWorkspace } = await import('./translation.js');
  return (await openWorkspace()).store;
}

/**
 * Imports `language`'s chapter files for the book into the database (or, with `dryRun`, only works out what
 * that would do). `folder` and `bookNumber` name the book — the Gita unless a test says otherwise — and `store`
 * is where the files are read from (the app's bucket unless a test passes a folder).
 *
 * `onChapter(line, done, total)` — given a job by the worker — hears about each chapter right after it is
 * worked, so a run row can show progress; `shouldStop()`, checked before each one, lets a cancelled run
 * leave the rest undone instead of ploughing through them.
 *
 * → { language, publish, dryRun, totals, chapters: [one `emptyChapter` line each] }
 */
export async function importLanguage({ language, book: bookSlug = BOOK, chapters = null, publish = false, dryRun = false, folder = null, bookNumber = null, store = null, onChapter = null, shouldStop = null }) {
  // `folder` and `bookNumber` are for a test's throwaway book; a real one is named by `book`.
  const named = folder == null && BOOKS[bookSlug] ? bookOf(bookSlug) : null;
  chapters ??= named?.chapters ?? CHAPTERS;
  folder ??= bookSlug;
  bookNumber ??= named?.bookNumber ?? GITA_BOOK_NUMBER;
  const [book, translator] = await Promise.all([
    prisma.book.findUnique({ where: { bookNumber }, select: { id: true } }),
    prisma.translator.findUnique({ where: { slug: TRANSLATOR }, select: { id: true } }),
  ]);
  if (!book) throw unprocessable(`The book (number ${bookNumber}) is not in the database yet. Import it first: node scripts/import-bg.js.`);
  if (!translator) throw unprocessable(`The translator "${TRANSLATOR}" is not in the database. Run the seed first.`);
  const files = store ?? (await workspaceStore());

  const picked = [...new Set(chapters)].sort((a, b) => a - b);
  const lines = [];
  const versions = {};

  for (const number of picked) {
    if (shouldStop?.()) break;
    const line = emptyChapter(number);
    lines.push(line);
    const key = langChapterKey(language, number, named ? bookId : folder);
    try {
      const file = await files.getJson(key).catch((err) => {
        throw new Error(`Could not read ${key}: ${reasonOf(err)}`);
      });
      if (!file) {
        line.found = false;
        continue;
      }
      await importChapter({
        file,
        line,
        versions,
        language,
        publish,
        dryRun,
        bookId: book.id,
        translatorId: translator.id,
        parts: chapterParts(number, named ? bookSlug : BOOK),
        importIssues: bookSlug === 'srimad-bhagavatam' && language === 'mr',
      });
    } catch (err) {
      line.error = reasonOf(err);
    } finally {
      await onChapter?.(line, lines.length, picked.length);
    }
  }

  return { language, publish, dryRun, totals: totalsOf(lines, versions), chapters: lines };
}

/** One chapter file → `line` (its counts), and the database unless `dryRun`. Throws if the database does. */
async function importChapter({ file, line, versions, language, publish, dryRun, bookId, translatorId, parts, importIssues }) {
  const entries = Array.isArray(file.verses) ? file.verses : [];
  const verses = await prisma.verse.findMany({
    where: { bookId, verseId: { in: entries.map((e) => e.verseId).filter(Boolean) } },
    select: { id: true, verseId: true, bookNumber: true, cantoNumber: true, chapterNumber: true, verseNumber: true, verseNumberEnd: true },
  });
  const verseById = new Map(verses.map((v) => [v.verseId, v]));
  const rows = await prisma.verseTranslation.findMany({
    where: { translatorId, languageCode: language, type: 'TRANSLATION', verseId: { in: verses.map((v) => v.id) } },
    select: { id: true, verseId: true, meaning: true, purport: true, transliteration: true, wordMeanings: true, translatedBy: true, version: true, isPublished: true },
  });
  const rowByVerse = new Map(rows.map((r) => [r.verseId, r]));

  const toCreate = [];
  const toUpdate = [];
  const seen = new Set();

  for (const entry of entries) {
    const want = rowFromEntry(entry, language);
    if (!want) {
      line.noTranslation++;
      continue;
    }
    line.inStorage++;
    versions[want.version ?? 'unversioned'] = (versions[want.version ?? 'unversioned'] || 0) + 1;

    const verse = verseById.get(entry.verseId);
    if (!verse) {
      line.missing.push(entry.verseId);
      continue;
    }
    const problem = seen.has(verse.id) ? 'the file has this verse twice' : placeProblem(entry, verse, parts.chapter, parts.canto);
    if (problem) {
      line.conflicts.push({ verseId: entry.verseId, reason: problem });
      continue;
    }
    seen.add(verse.id);

    const row = rowByVerse.get(verse.id);
    if (!row) {
      toCreate.push({ verseId: verse.id, translatorId, languageCode: language, type: 'TRANSLATION', ...columnsOf(want), isPublished: publish });
      continue;
    }
    const changed = changedColumns(row, want).length > 0;
    if (!changed && !(publish && !row.isPublished)) {
      line.unchanged++;
      continue;
    }
    toUpdate.push({ id: row.id, data: { ...columnsOf(want), ...(publish ? { isPublished: true } : {}) } });
    if (changed && row.isPublished) line.replacedVisible++;
  }

  const issueCandidates = new Map();
  if (importIssues) {
    const issueSeen = new Set();
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || !Array.isArray(entry.issues)) continue;
      const verse = verseById.get(entry.verseId);
      if (!verse || issueSeen.has(verse.id) || placeProblem(entry, verse, parts.chapter, parts.canto)) continue;
      issueSeen.add(verse.id);
      const slugs = [...new Set(entry.issues.filter((slug) => IMPORTABLE_VIKARAS.has(slug)))];
      if (slugs.length) issueCandidates.set(verse.id, slugs);
    }
  }

  const slugs = [...new Set([...issueCandidates.values()].flat())];
  const issues = slugs.length
    ? await prisma.issue.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } })
    : [];
  const issueIdBySlug = new Map(issues.map((issue) => [issue.slug, issue.id]));
  const importableIssueCandidates = new Map(
    [...issueCandidates]
      .map(([verseId, candidateSlugs]) => [verseId, candidateSlugs.filter((slug) => issueIdBySlug.has(slug))])
      .filter(([, candidateSlugs]) => candidateSlugs.length)
  );

  line.updated = toUpdate.length;
  line.created = toCreate.length;
  if (dryRun && importableIssueCandidates.size) {
    const existingLinks = await prisma.verseIssue.findMany({
      where: { verseId: { in: [...importableIssueCandidates.keys()] } },
      select: { verseId: true },
    });
    const alreadyLinked = new Set(existingLinks.map((link) => link.verseId));
    line.issueVersesSkipped = [...importableIssueCandidates.keys()].filter((verseId) => alreadyLinked.has(verseId)).length;
    line.issueLinksCreated = [...importableIssueCandidates]
      .filter(([verseId]) => !alreadyLinked.has(verseId))
      .reduce((count, [, candidateSlugs]) => count + candidateSlugs.length, 0);
  }
  if (dryRun || (!toCreate.length && !toUpdate.length && !importableIssueCandidates.size)) return;

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      if (importableIssueCandidates.size) {
        const candidateVerseIds = [...importableIssueCandidates.keys()].sort();
        await tx.$queryRaw`
          SELECT "id"
          FROM "Verse"
          WHERE "id" IN (${Prisma.join(candidateVerseIds)})
          ORDER BY "id"
          FOR UPDATE
        `;
        const existingLinks = await tx.verseIssue.findMany({
          where: { verseId: { in: candidateVerseIds } },
          select: { verseId: true },
        });
        const alreadyLinked = new Set(existingLinks.map((link) => link.verseId));
        line.issueVersesSkipped = candidateVerseIds.filter((verseId) => alreadyLinked.has(verseId)).length;
        const linksToCreate = candidateVerseIds
          .filter((verseId) => !alreadyLinked.has(verseId))
          .flatMap((verseId) =>
            importableIssueCandidates
              .get(verseId)
              .map((slug) => ({ verseId, issueId: issueIdBySlug.get(slug) }))
          );
        if (linksToCreate.length) {
          const result = await tx.verseIssue.createMany({ data: linksToCreate, skipDuplicates: true });
          line.issueLinksCreated = result.count;
        }
      }

      await Promise.all(toUpdate.map((u) => tx.verseTranslation.update({ where: { id: u.id }, data: u.data })));
      if (!toCreate.length) return 0;
      const result = await tx.verseTranslation.createMany({ data: toCreate, skipDuplicates: true });
      return result.count;
    });
  } catch (err) {
    // The transaction rolled back, so none of this chapter was written and its line must not say it was.
    line.created = 0;
    line.updated = 0;
    line.replacedVisible = 0;
    line.issueLinksCreated = 0;
    line.issueVersesSkipped = 0;
    throw err;
  }
  // createMany says how many it really made; a row that appeared since the lookup is skipped, not doubled.
  if (toCreate.length) line.created = created;
}

/**
 * What the database already holds from the translation runs (any provider), per language: rows, how many were made under `version`
 * (the one a new run uses), how many readers can see, and when one last changed. For the Translations page.
 */
export async function importStatus({ version = null, book: bookId = BOOK, bookNumber = bookOf(bookId).bookNumber } = {}) {
  const groups = await prisma.verseTranslation.groupBy({
    by: ['languageCode', 'version', 'isPublished'],
    where: { type: 'TRANSLATION', translatedBy: { in: MADE_BY_LABELS }, translator: { slug: TRANSLATOR }, verse: { bookNumber } },
    _count: { _all: true },
    _max: { updatedAt: true },
  });

  const byLanguage = new Map();
  for (const g of groups) {
    const entry = byLanguage.get(g.languageCode) ?? { code: g.languageCode, rows: 0, current: 0, published: 0, versions: {}, updatedAt: null };
    const count = g._count._all;
    entry.rows += count;
    if (version && g.version === version) entry.current += count;
    if (g.isPublished) entry.published += count;
    entry.versions[g.version ?? 'unversioned'] = (entry.versions[g.version ?? 'unversioned'] || 0) + count;
    const at = g._max.updatedAt;
    if (at && (!entry.updatedAt || at > entry.updatedAt)) entry.updatedAt = at;
    byLanguage.set(g.languageCode, entry);
  }
  return { version, book: bookId, languages: [...byLanguage.values()].map((l) => ({ ...l, updatedAt: l.updatedAt?.toISOString() ?? null })) };
}

/* ---------- the live channel and the activity feed ---------- */
// Same shape as services/translation.js's — a separate feed key and event pair so an import's lines
// never land in a translation run's own feed.

const feedKey = (runId) => `translation-import:feed:${runId}`;

/** Sends an import run's whole state to every admin who may watch translations. */
export function publishImportRun(row) {
  toPermission('translation.read', EVENTS.TRANSLATION_IMPORT_RUN, presentImportRun(row));
}

/**
 * Adds a line to an import run's activity feed (kept in Redis, newest first, capped) and sends it to the
 * watchers. Never throws: the feed is a convenience, a failure here must not stop a run.
 */
export async function pushImportFeed(runId, line) {
  const entry = { at: new Date().toISOString(), ...line };
  toPermission('translation.read', EVENTS.TRANSLATION_IMPORT_ACTIVITY, { runId, ...entry });
  try {
    await redis.multi().lpush(feedKey(runId), JSON.stringify(entry)).ltrim(feedKey(runId), 0, translation.feedLines - 1).expire(feedKey(runId), translation.feedDays * 86400).exec();
  } catch (err) {
    logger.warn({ err: err.message, runId }, 'translation import feed write failed');
  }
}

export async function readImportFeed(runId, count = 100) {
  const lines = await redis.lrange(feedKey(runId), 0, Math.min(count, translation.feedLines) - 1).catch(() => []);
  return lines.map((l) => JSON.parse(l));
}

/* ---------- a run's job on the queue ---------- */

const LIVE_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'];
export const newImportJobId = (runId) => `translation-import-${runId}-${Date.now().toString(36)}`;

/** Adds the job that works a run. The run row names it (`jobId`); a job whose id the row does not name does nothing. */
export async function addImportRunJob(runId, jobId = newImportJobId(runId)) {
  await queue.add(JOBS.TRANSLATION_IMPORT_RUN, { runId }, { jobId });
  return jobId;
}

/** Takes a run's job off the queue if it has not started. A running one is stopped by the run itself (cancelRequested). */
export async function dropImportRunJob(run) {
  if (!run.jobId) return;
  const job = await queue.getJob(run.jobId).catch(() => null);
  if (job) await job.remove().catch(() => {});
}

/**
 * The safety net: a run that should be working but whose job is gone (Redis was flushed, a job failed for
 * good) gets a new one. Called by the worker on boot and every `reconcileEveryMs`.
 * @returns {Promise<string[]>} ids of the runs it re-queued
 */
export async function reconcileImportRuns() {
  const youngerThan = new Date(Date.now() - 30_000);
  const rows = await prisma.translationImportRun.findMany({
    where: { updatedAt: { lt: youngerThan }, status: { in: LIVE_IMPORT_STATUSES } },
  });
  const requeued = [];
  for (const row of rows) {
    const job = row.jobId ? await queue.getJob(row.jobId).catch(() => null) : null;
    const state = job ? await job.getState().catch(() => 'unknown') : 'missing';
    if (LIVE_STATES.includes(state)) continue;
    if (job) await job.remove().catch(() => {});
    const jobId = newImportJobId(row.id);
    const next = await prisma.translationImportRun.update({
      where: { id: row.id },
      data: { jobId, status: 'QUEUED', statusMessage: 'Picked up again after its background job was lost.' },
    });
    await addImportRunJob(row.id, jobId);
    publishImportRun(next);
    pushImportFeed(row.id, { kind: 'status', level: 'warn', text: 'Its background job was lost; queued again.' });
    logger.warn({ runId: row.id, was: state }, 'translation import run re-queued');
    requeued.push(row.id);
  }
  return requeued;
}
