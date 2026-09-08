// Reading progress — where someone left off in each book.
//
// One row per user per book, overwritten as they read. Not a history: the
// question this answers is "where do I resume", and keeping every position a
// reader ever held would be a table that grows per scroll and is never read.
//
// The canto, chapter and verse numbers are denormalised onto the row so the
// continue-reading list can render "Canto 3, Chapter 12" without loading the
// verse for every book in the list.

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import { ok } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';

/** GET /api/app/progress — the continue-reading list. */
export const list = async (req, res) => {
  const user = req.auth.user;

  const rows = await prisma.readingProgress.findMany({
    where: { userId: user.id },
    orderBy: { lastReadAt: 'desc' },
    take: 20,
    include: { book: true, verse: { select: { verseId: true } } },
  });

  return ok(
    res,
    await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        book: await present.book(row.book, user),
        verseId: row.verse?.verseId || null,
        cantoNumber: row.cantoNumber,
        chapterNumber: row.chapterNumber,
        verseNumber: row.verseNumber,
        versesRead: row.versesRead,
        // What the progress bar shows. Verses read against the book's own total
        // rather than against the whole library.
        percent: row.book.totalVerses
          ? Math.min(100, Math.round((row.versesRead / row.book.totalVerses) * 100))
          : 0,
        lastReadAt: row.lastReadAt,
      }))
    )
  );
};

/**
 * PUT /api/app/progress
 * Records the furthest point reached. `versesRead` only ever increases —
 * flipping back to re-read an earlier verse should not undo months of progress.
 */
export const save = async (req, res) => {
  const user = req.auth.user;
  const { verseId } = req.valid.body;

  const verse = await prisma.verse.findUnique({
    where: { verseId },
    select: {
      id: true,
      bookId: true,
      cantoNumber: true,
      chapterNumber: true,
      verseNumber: true,
    },
  });
  if (!verse) throw notFound('Verse');

  const existing = await prisma.readingProgress.findUnique({
    where: { userId_bookId: { userId: user.id, bookId: verse.bookId } },
    select: { versesRead: true },
  });

  const versesRead = Math.max(existing?.versesRead || 0, req.valid.body.versesRead ?? 0);

  const progress = await prisma.readingProgress.upsert({
    where: { userId_bookId: { userId: user.id, bookId: verse.bookId } },
    update: {
      verseId: verse.id,
      cantoNumber: verse.cantoNumber,
      chapterNumber: verse.chapterNumber,
      verseNumber: verse.verseNumber,
      versesRead,
      lastReadAt: new Date(),
    },
    create: {
      userId: user.id,
      bookId: verse.bookId,
      verseId: verse.id,
      cantoNumber: verse.cantoNumber,
      chapterNumber: verse.chapterNumber,
      verseNumber: verse.verseNumber,
      versesRead: versesRead || 1,
    },
  });

  return ok(res, progress);
};

/** DELETE /api/app/progress/:bookId — start a book over. */
export const reset = async (req, res) => {
  await prisma.readingProgress.deleteMany({
    where: { userId: req.auth.user.id, bookId: req.valid.params.bookId },
  });
  return ok(res, { reset: true });
};
