// Books, cantos and chapters — the navigation spine of the library.
//
// A Book is any complete work: a full scripture like Srimad Bhagavatam, or a
// single aarti. `type` decides the shape. SCRIPTURE has chapters, and Srimad
// Bhagavatam alone has cantos above them; everything short hangs its verses
// straight off the book, so a stotra has no chapter list to fetch.

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import * as language from '../../utils/language.js';
import { ok, paginated } from '../../utils/respond.js';
import { paginate } from '../../utils/pagination.js';
import { notFound, badRequest } from '../../utils/errors.js';

/** GET /api/app/books */
export const list = async (req, res) => {
  const { type, deity, tag } = req.valid.query;

  const where = {
    isPublished: true,
    ...(type ? { type } : {}),
    ...(deity ? { deity: { slug: deity } } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
  };

  const { items, page } = await paginate(prisma.book, {
    where,
    orderBy: [{ displayOrder: 'asc' }, { bookNumber: 'asc' }],
    include: { deity: { select: { id: true, slug: true, name: true } } },
    query: req.valid.query,
  });

  return paginated(res, await present.books(items, req.auth.user), page);
};

/** GET /api/app/books/:slug */
export const get = async (req, res) => {
  const book = await prisma.book.findFirst({
    where: { slug: req.valid.params.slug, isPublished: true },
    include: {
      deity: { select: { id: true, slug: true, name: true } },
      translators: {
        include: { translator: { select: { id: true, slug: true, name: true, imagePath: true } } },
      },
    },
  });
  if (!book) throw notFound('Book');

  const shaped = await present.book(book, req.auth.user);

  return ok(res, {
    ...shaped,
    // Which renderings this book is available in, and which one the reader gets
    // unless they pick another.
    translators: book.translators.map((link) => ({
      ...link.translator,
      seriesName: link.seriesName,
      publishedYear: link.publishedYear,
      isDefault: link.isDefault,
    })),
  });
};

/** GET /api/app/books/:slug/cantos — Srimad Bhagavatam only. */
export const cantos = async (req, res) => {
  const book = await prisma.book.findFirst({
    where: { slug: req.valid.params.slug, isPublished: true },
    select: { id: true, totalCantos: true },
  });
  if (!book) throw notFound('Book');

  const cantos = await prisma.canto.findMany({
    where: { bookId: book.id },
    orderBy: { number: 'asc' },
  });

  return ok(res, present.sections(cantos, req.auth.user));
};

/**
 * GET /api/app/books/:slug/chapters
 * Filtered by `canto` for Srimad Bhagavatam. Bhagavad Gita has no cantos, so
 * the whole chapter list comes back in one call.
 */
export const chapters = async (req, res) => {
  const { canto } = req.valid.query;

  const book = await prisma.book.findFirst({
    where: { slug: req.valid.params.slug, isPublished: true },
    select: { id: true, type: true },
  });
  if (!book) throw notFound('Book');

  const chapters = await prisma.chapter.findMany({
    where: { bookId: book.id, ...(canto !== undefined ? { cantoNumber: canto } : {}) },
    orderBy: [{ cantoNumber: 'asc' }, { number: 'asc' }],
  });

  return ok(res, present.sections(chapters, req.auth.user));
};

/**
 * GET /api/app/books/:slug/chapters/:number
 * The chapter and its verses in one call — this is the reading screen, and
 * splitting it would make every chapter open cost two round trips.
 */
export const chapter = async (req, res) => {
  const { slug, number } = req.valid.params;
  const { canto } = req.valid.query;

  const book = await prisma.book.findFirst({
    where: { slug, isPublished: true },
    select: { id: true, type: true, totalCantos: true },
  });
  if (!book) throw notFound('Book');

  if (book.totalCantos > 0 && canto === undefined) {
    throw badRequest('This book is organised by canto — pass ?canto=');
  }

  const chapter = await prisma.chapter.findFirst({
    where: { bookId: book.id, number, ...(canto !== undefined ? { cantoNumber: canto } : {}) },
  });
  if (!chapter) throw notFound('Chapter');

  const readingChain = language.readingChain(req.auth.user);

  const verses = await prisma.verse.findMany({
    where: { chapterId: chapter.id },
    orderBy: { verseNumber: 'asc' },
    include: present.includes.verse(readingChain),
  });

  return ok(res, {
    chapter: present.section(chapter, req.auth.user),
    verses: await present.verses(verses, req.auth.user),
  });
};
