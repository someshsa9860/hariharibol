// Puts the Bhagavatam's vikara tags from storage (issues/json/srimad-bhagavatam/c<canto>-ch-<n>.json, written by a
// Marathi translation run) into the database, where the app's "what are you struggling with" picker reads them
// (`VerseIssue`). It is the sibling of services/translation-import.js and shares its run row, queue and worker;
// the two never touch each other's tables. The rules:
//
//   - **The verse is found by its place in the book, and checked** with the same `placeProblem` the translation
//     import uses. A verse the database lacks, or that disagrees with the file, is reported and left alone. An
//     import never creates a Verse.
//   - **A verse that already has links is left alone.** Links put there by the seed (scripts/seed-verse-issues.js)
//     or by hand are not overwritten, and nothing is ever deleted, so a second import of the same file changes nothing.
//   - **A verse with no tags is not an error.** `issues: []` is the usual answer; nothing is written for it.
//   - **Only the six vikaras.** A name that is not one of them is ignored and counted. If one of the six has no `Issue`
//     row (the seed has not run) the import stops before it writes anything.
//
// A chapter is written in one transaction. A chapter that fails is reported and the others carry on; the import
// can be run again at any point. The run itself — queue, progress, cancel, live events — is
// services/translation-import.js's (`kind: 'VIKARA'` on the row).

import { Prisma } from '@prisma/client';

import { prisma } from '../config/database.js';
import { unprocessable } from '../utils/errors.js';
import { placeProblem, reasonOf } from '../utils/translation-import.js';
import { emptyVikaraChapter, slugsOf, vikaraTotalsOf } from '../utils/vikara-import.js';
import { ISSUES_BOOK } from '../scripts/lib/claude-translate-prompt.js';
import { VIKARA_SLUGS } from '../scripts/lib/claude-translate-validate.js';
import { BOOK, bookOf, chapterParts } from '../scripts/lib/claude-translate-source.js';
import { issuesChapterKey } from '../scripts/lib/claude-translate-store.js';

// Opened when needed: the workspace pulls in the queue and the websocket, which a caller that passes its own store does not want.
async function workspaceStore() {
  const { openWorkspace } = await import('./translation.js');
  return (await openWorkspace()).store;
}

/** The chapters a vikara import covers by default: every chapter of the Bhagavatam. */
export const vikaraChapters = () => bookOf(ISSUES_BOOK).chapters;

/**
 * Imports the Bhagavatam's tag files into the database (or, with `dryRun`, only works out what that would do).
 * `store` is where the files are read from (the app's bucket unless a test passes a folder); `onChapter` and
 * `shouldStop` are the worker's, as in `importLanguage`. `folder` and `bookNumber` are for a test's throwaway book
 * (a canto-less one, like the translation import's); a real import is always the Bhagavatam.
 *
 * → { dryRun, totals, chapters: [one `emptyVikaraChapter` line each] }
 */
export async function importVikaras({ chapters = null, dryRun = false, folder = null, bookNumber = null, store = null, onChapter = null, shouldStop = null } = {}) {
  const book = bookOf(ISSUES_BOOK);
  const kept = folder ?? ISSUES_BOOK; // where the tag files are: the Bhagavatam's folder unless a test says otherwise
  chapters ??= book.chapters;
  bookNumber ??= book.bookNumber;
  const [bookRow, issues] = await Promise.all([
    prisma.book.findUnique({ where: { bookNumber }, select: { id: true } }),
    prisma.issue.findMany({ where: { slug: { in: VIKARA_SLUGS } }, select: { id: true, slug: true } }),
  ]);
  if (!bookRow) throw unprocessable(`${book.title} (book number ${bookNumber}) is not in the database yet.`);
  const issueIdBySlug = new Map(issues.map((i) => [i.slug, i.id]));
  const absent = VIKARA_SLUGS.filter((slug) => !issueIdBySlug.has(slug));
  if (absent.length) throw unprocessable(`The vikara(s) ${absent.join(', ')} are not in the database. Run the seed first: npm run seed.`);
  const files = store ?? (await workspaceStore());

  const picked = [...new Set(chapters)].sort((a, b) => a - b);
  const lines = [];

  for (const number of picked) {
    if (shouldStop?.()) break;
    const line = emptyVikaraChapter(number);
    lines.push(line);
    const key = issuesChapterKey(number, kept);
    try {
      const file = await files.getJson(key).catch((err) => {
        throw new Error(`Could not read ${key}: ${reasonOf(err)}`);
      });
      if (!file) {
        line.found = false;
        continue;
      }
      await importChapter({ file, line, dryRun, bookId: bookRow.id, issueIdBySlug, parts: chapterParts(number, folder ? BOOK : ISSUES_BOOK) });
    } catch (err) {
      line.error = reasonOf(err);
    } finally {
      await onChapter?.(line, lines.length, picked.length);
    }
  }

  return { dryRun, totals: vikaraTotalsOf(lines), chapters: lines };
}

/** One tag file → `line` (its counts), and the database unless `dryRun`. Throws if the database does. */
async function importChapter({ file, line, dryRun, bookId, issueIdBySlug, parts }) {
  const entries = Array.isArray(file.verses) ? file.verses : [];
  const verses = await prisma.verse.findMany({
    where: { bookId, verseId: { in: entries.map((e) => e?.verseId).filter(Boolean) } },
    select: { id: true, verseId: true, bookNumber: true, cantoNumber: true, chapterNumber: true, verseNumber: true, verseNumberEnd: true },
  });
  const verseById = new Map(verses.map((v) => [v.verseId, v]));

  const wanted = new Map(); // verse id → the slugs to link
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
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
    line.inStorage++;

    const { slugs, ignored } = slugsOf(entry);
    line.ignored += ignored;
    if (!slugs.length) {
      line.noTags++;
      continue;
    }
    line.tagged++;
    wanted.set(verse.id, slugs);
  }
  if (!wanted.size) return;

  const linked = await prisma.verseIssue.findMany({ where: { verseId: { in: [...wanted.keys()] } }, select: { verseId: true } });
  const alreadyLinked = new Set(linked.map((l) => l.verseId));
  const toLink = [...wanted].filter(([verseId]) => !alreadyLinked.has(verseId));
  line.alreadyLinked = alreadyLinked.size;
  line.verses = toLink.length;
  line.links = toLink.reduce((n, [, slugs]) => n + slugs.length, 0);
  if (dryRun || !toLink.length) return;

  try {
    await prisma.$transaction(async (tx) => {
      // Lock the verses so that two imports at once (or a seed) cannot both find a verse unlinked and double its links.
      const ids = toLink.map(([verseId]) => verseId).sort();
      await tx.$queryRaw`SELECT "id" FROM "Verse" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
      const now = await tx.verseIssue.findMany({ where: { verseId: { in: ids } }, select: { verseId: true } });
      const taken = new Set(now.map((l) => l.verseId));
      const data = toLink.filter(([verseId]) => !taken.has(verseId)).flatMap(([verseId, slugs]) => slugs.map((slug) => ({ verseId, issueId: issueIdBySlug.get(slug) })));
      const result = data.length ? await tx.verseIssue.createMany({ data, skipDuplicates: true }) : { count: 0 };
      // What the transaction found is what the line says: a verse linked since the lookup above is "already linked", not ours.
      line.links = result.count;
      line.verses = new Set(data.map((d) => d.verseId)).size;
      line.alreadyLinked = alreadyLinked.size + (toLink.length - line.verses);
    }, { timeout: 60_000 });
  } catch (err) {
    // The transaction rolled back, so none of this chapter was written and its line must not say it was.
    line.links = 0;
    line.verses = 0;
    line.alreadyLinked = 0;
    throw err;
  }
}

/**
 * What the database holds from these tags, for the Translations page: how many verses of the Bhagavatam have a
 * vikara link and how many links each vikara has.
 */
export async function vikaraStatus() {
  const book = bookOf(ISSUES_BOOK);
  const [groups, verses] = await Promise.all([
    prisma.verseIssue.groupBy({
      by: ['issueId'],
      where: { issue: { slug: { in: VIKARA_SLUGS } }, verse: { bookNumber: book.bookNumber } },
      _count: { _all: true },
    }),
    prisma.verse.count({ where: { bookNumber: book.bookNumber, issueLinks: { some: { issue: { slug: { in: VIKARA_SLUGS } } } } } }),
  ]);
  const issues = await prisma.issue.findMany({ where: { slug: { in: VIKARA_SLUGS } }, select: { id: true, slug: true, name: true } });
  const countById = new Map(groups.map((g) => [g.issueId, g._count._all]));
  return {
    book: ISSUES_BOOK,
    verses,
    links: groups.reduce((n, g) => n + g._count._all, 0),
    vikaras: VIKARA_SLUGS.map((slug) => {
      const issue = issues.find((i) => i.slug === slug);
      return { slug, name: issue?.name ?? slug, inDatabase: Boolean(issue), links: issue ? countById.get(issue.id) ?? 0 : 0 };
    }),
  };
}
