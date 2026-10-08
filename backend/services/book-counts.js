// Book, canto and chapter counts, rebuilt from the rows that are really there.
//
// `Book.totalCantos / totalChapters / totalVerses`, `Canto.totalChapters / totalVerses` and
// `Chapter.totalVerses` are rollups the reading screens lean on: the app decides from
// `totalCantos` whether a book has cantos at all, and draws a chapter's length from its
// `totalVerses`. A wrong one shows up as a canto that says "0 verses" or a progress bar that
// never reaches the end.
//
// They are derived data — the same arrangement as `User.isPremium` — so this is the only place
// that writes them. An importer, the admin panel and `scripts/recount-books.js` all call
// `recountBook`; none keeps a tally of its own, and none trusts a count that arrived with a
// source file. That last part is the point: cantos 10-12 of the Bhagavatam were once imported
// with every chapter at zero because the scraped files carried no total and the importer copied
// the gap.

import { prisma } from '../config/database.js';

// The fields of `row` that differ from `wanted`, or null when the row is already right.
function differences(row, wanted) {
  const data = {};
  for (const [field, value] of Object.entries(wanted)) {
    if (row[field] !== value) data[field] = value;
  }
  return Object.keys(data).length > 0 ? data : null;
}

/**
 * Makes every count under a book match its rows.
 *
 * Writes only what is wrong, all in one transaction, so running it on a healthy book changes
 * nothing (not even `updatedAt`). Returns how many chapters and cantos were corrected, whether
 * the book itself was, and a line per correction in `changes`. With `dryRun` it reports the
 * same thing and writes nothing.
 */
export async function recountBook(bookId, { dryRun = false } = {}) {
  const [book, cantos, chapters, versesTotal, versesPerChapter, versesPerCanto] = await Promise.all([
    prisma.book.findUniqueOrThrow({ where: { id: bookId } }),
    prisma.canto.findMany({ where: { bookId } }),
    prisma.chapter.findMany({ where: { bookId } }),
    prisma.verse.count({ where: { bookId } }),
    prisma.verse.groupBy({ by: ['chapterId'], where: { bookId, chapterId: { not: null } }, _count: { _all: true } }),
    prisma.verse.groupBy({ by: ['cantoNumber'], where: { bookId, cantoNumber: { not: null } }, _count: { _all: true } }),
  ]);

  const versesInChapter = new Map(versesPerChapter.map((g) => [g.chapterId, g._count._all]));
  const versesInCanto = new Map(versesPerCanto.map((g) => [g.cantoNumber, g._count._all]));
  const chaptersInCanto = new Map();
  for (const chapter of chapters) {
    if (chapter.cantoId) chaptersInCanto.set(chapter.cantoId, (chaptersInCanto.get(chapter.cantoId) ?? 0) + 1);
  }

  const changes = [];
  const writes = [];

  // True when `row` was wrong. Records the correction, and queues the write unless this is a dry run.
  function correct(delegate, row, label, wanted) {
    const data = differences(row, wanted);
    if (!data) return false;
    changes.push(`${label}: ${Object.entries(data).map(([field, value]) => `${field} ${row[field]} → ${value}`).join(', ')}`);
    if (!dryRun) writes.push(delegate.update({ where: { id: row.id }, data }));
    return true;
  }

  let chaptersFixed = 0;
  for (const chapter of chapters) {
    const label = chapter.cantoNumber ? `canto ${chapter.cantoNumber} chapter ${chapter.number}` : `chapter ${chapter.number}`;
    if (correct(prisma.chapter, chapter, label, { totalVerses: versesInChapter.get(chapter.id) ?? 0 })) chaptersFixed += 1;
  }

  let cantosFixed = 0;
  for (const canto of cantos) {
    const wanted = { totalChapters: chaptersInCanto.get(canto.id) ?? 0, totalVerses: versesInCanto.get(canto.number) ?? 0 };
    if (correct(prisma.canto, canto, `canto ${canto.number}`, wanted)) cantosFixed += 1;
  }

  const bookFixed = correct(prisma.book, book, `book ${book.slug}`, {
    totalCantos: cantos.length,
    totalChapters: chapters.length,
    totalVerses: versesTotal,
  });

  if (writes.length > 0) await prisma.$transaction(writes);

  return { chapters: chaptersFixed, cantos: cantosFixed, book: bookFixed, changes };
}
