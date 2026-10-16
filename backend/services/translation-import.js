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
//   - **Importing twice is harmless.** A row that already matches the file is counted `unchanged` and not
//     written. `dryRun` does the same work and writes nothing, so the page can say what an import would do.
//   - **Visibility is a decision, not a side effect.** A new row is hidden (`isPublished: false`) unless
//     `publish` is set; an existing row's visibility is never lowered, and `publish` raises it. Claude's
//     text has not been read by a native speaker when it arrives.
//
// A chapter is written in one transaction. A chapter that fails is reported and the others carry on; the
// import can be run again at any point.

import { Prisma } from '@prisma/client';

import { prisma } from '../config/database.js';
import { unprocessable } from '../utils/errors.js';
import { changedColumns, emptyChapter, placeProblem, reasonOf, rowFromEntry, totalsOf } from '../utils/translation-import.js';
import { BOOK, BOOKS, CHAPTERS, TRANSLATOR, bookOf, chapterParts } from '../scripts/lib/claude-translate-source.js';
import { MADE_BY_LABELS } from '../scripts/lib/claude-translate-parts.js';
import { langChapterKey } from '../scripts/lib/claude-translate-store.js';

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
 * → { language, publish, dryRun, totals, chapters: [one `emptyChapter` line each] }
 */
export async function importLanguage({ language, book: bookId = BOOK, chapters = null, publish = false, dryRun = false, folder = null, bookNumber = null, store = null }) {
  // `folder` and `bookNumber` are for a test's throwaway book; a real one is named by `book`.
  const named = folder == null && BOOKS[bookId] ? bookOf(bookId) : null;
  chapters ??= named?.chapters ?? CHAPTERS;
  folder ??= bookId;
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
      await importChapter({ file, line, versions, language, publish, dryRun, bookId: book.id, translatorId: translator.id, parts: chapterParts(number, named ? bookId : BOOK) });
    } catch (err) {
      line.error = reasonOf(err);
    }
  }

  return { language, publish, dryRun, totals: totalsOf(lines, versions), chapters: lines };
}

/** One chapter file → `line` (its counts), and the database unless `dryRun`. Throws if the database does. */
async function importChapter({ file, line, versions, language, publish, dryRun, bookId, translatorId, parts }) {
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

  line.updated = toUpdate.length;
  line.created = toCreate.length;
  if (dryRun || (!toCreate.length && !toUpdate.length)) return;

  let results;
  try {
    results = await prisma.$transaction([
      ...toUpdate.map((u) => prisma.verseTranslation.update({ where: { id: u.id }, data: u.data })),
      ...(toCreate.length ? [prisma.verseTranslation.createMany({ data: toCreate, skipDuplicates: true })] : []),
    ]);
  } catch (err) {
    // The transaction rolled back, so none of this chapter was written and its line must not say it was.
    line.created = 0;
    line.updated = 0;
    line.replacedVisible = 0;
    throw err;
  }
  // createMany says how many it really made; a row that appeared since the lookup is skipped, not doubled.
  if (toCreate.length) line.created = results[results.length - 1].count;
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
