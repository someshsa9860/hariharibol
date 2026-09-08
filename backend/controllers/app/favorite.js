// Bookmarks.
//
// A favourite points at exactly one of a verse, a mantra or a book. Three real
// foreign keys rather than a generic targetType/targetId pair, so deleting a
// verse takes its bookmarks with it instead of leaving rows pointing at
// nothing. Which one is set is enforced here.

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import * as language from '../../utils/language.js';
import { ok, created, noContent } from '../../utils/respond.js';
import { badRequest, notFound } from '../../utils/errors.js';

const TARGETS = ['verseId', 'mantraId', 'bookId'];

/** GET /api/app/favorites */
export const list = async (req, res) => {
  const user = req.auth.user;
  const { type } = req.valid.query;

  const where = {
    userId: user.id,
    ...(type === 'verse' ? { verseId: { not: null } } : {}),
    ...(type === 'mantra' ? { mantraId: { not: null } } : {}),
    ...(type === 'book' ? { bookId: { not: null } } : {}),
  };

  const favorites = await prisma.favorite.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      verse: { include: present.includes.verse(language.readingChain(user)) },
      mantra: {
        include: present.includes.mantra(language.mantraChain(user), language.readingChain(user)),
      },
      book: true,
    },
  });

  return ok(
    res,
    await Promise.all(
      favorites.map(async (row) => ({
        id: row.id,
        createdAt: row.createdAt,
        type: row.verseId ? 'verse' : row.mantraId ? 'mantra' : 'book',
        verse: row.verse ? await present.verse(row.verse, user) : null,
        mantra: row.mantra ? await present.mantra(row.mantra, user) : null,
        book: row.book ? await present.book(row.book, user) : null,
      }))
    )
  );
};

/**
 * POST /api/app/favorites
 * Idempotent: bookmarking something already bookmarked returns the existing
 * row rather than failing, because a double tap should not produce an error.
 */
export const add = async (req, res) => {
  const user = req.auth.user;
  const body = req.valid.body;

  const set = TARGETS.filter((field) => body[field]);
  if (set.length !== 1) throw badRequest('Set exactly one of verseId, mantraId or bookId');

  const field = set[0];
  const value = body[field];

  // Confirmed before writing, so a typo becomes a 404 rather than a foreign key
  // error surfacing as a 500.
  const exists = await {
    verseId: () => prisma.verse.findUnique({ where: { id: value }, select: { id: true } }),
    mantraId: () => prisma.mantra.findUnique({ where: { id: value }, select: { id: true } }),
    bookId: () => prisma.book.findUnique({ where: { id: value }, select: { id: true } }),
  }[field]();
  if (!exists) throw notFound(field.replace('Id', ''));

  const favorite = await prisma.favorite.upsert({
    where: { [`userId_${field}`]: { userId: user.id, [field]: value } },
    update: {},
    create: { userId: user.id, [field]: value },
  });

  return created(res, favorite);
};

/** DELETE /api/app/favorites/:id */
export const remove = async (req, res) => {
  const deleted = await prisma.favorite.deleteMany({
    where: { id: req.valid.params.id, userId: req.auth.user.id },
  });
  if (!deleted.count) throw notFound('Favourite');
  return noContent(res);
};
