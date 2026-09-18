// Search across the library — verses, mantras and books — plus a direct jump
// to an exact verse when the query is a reference rather than a search: a
// dotted id ("1.2.47") or a book's own shorthand ("BG 2.47", "SB 1.3.28").
//
// Without `type`, this returns a small preview of each kind — the
// "everything" view a query first lands on. With `type`, it returns the full,
// paginated list for just that one kind, so a "see all" screen can lazy-load
// through it page by page instead of the app holding one long local index.
//
// Postgres `contains` with a case-insensitive match, deliberately: at this
// corpus size — around 18,700 verses — it is fast enough with the right
// indexes, and it needs no extra service to run, back up or pay for.
//
// When it stops being enough, the next step is a Postgres full-text index on
// the translation text, not a separate search cluster. Nothing here would have
// to move.

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import * as language from '../../utils/language.js';
import { paginate } from '../../utils/pagination.js';
import { ok, paginated } from '../../utils/respond.js';

const PREVIEW_LIMIT = 6;

// The shorthand people already write a verse reference with — "BG 2.47",
// "SB 1.3.28" — built from each book's own slug so a new book gets one for
// free instead of a table to keep in sync by hand.
function shortcutsFor(book) {
  const words = book.slug.split('-');
  return new Set([words.join(''), words.map((word) => word[0]).join(''), ...words]);
}

const REFERENCE_PATTERN = /^([a-z]+)[\s.]*(\d+(?:\.\d+){0,2})$/i;

// "1.2.47" is already a verseId. "BG 2.47" needs its word swapped for the
// book number it is shorthand for. Returns null when `q` is neither — an
// ordinary search term, not a reference.
async function directVerseId(q) {
  if (/^\d+(\.\d+){1,3}$/.test(q)) return q;

  const match = q.match(REFERENCE_PATTERN);
  if (!match) return null;
  const [, prefix, numbers] = match;

  const books = await prisma.book.findMany({
    where: { isPublished: true },
    select: { bookNumber: true, slug: true },
  });
  const book = books.find((candidate) => shortcutsFor(candidate).has(prefix.toLowerCase()));
  return book ? `${book.bookNumber}.${numbers}` : null;
}

function verseWhere(q, readingChain) {
  return {
    book: { isPublished: true },
    OR: [
      { sanskrit: { contains: q, mode: 'insensitive' } },
      { transliteration: { contains: q, mode: 'insensitive' } },
      {
        translations: {
          some: {
            isPublished: true,
            languageCode: { in: readingChain },
            meaning: { contains: q, mode: 'insensitive' },
          },
        },
      },
    ],
  };
}

function mantraWhere(q) {
  return {
    isPublished: true,
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { sanskrit: { contains: q, mode: 'insensitive' } },
      { transliteration: { contains: q, mode: 'insensitive' } },
      { tags: { has: q.toLowerCase() } },
    ],
  };
}

function bookWhere(q) {
  return {
    isPublished: true,
    OR: [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { tags: { has: q.toLowerCase() } },
    ],
  };
}

export const search = async (req, res) => {
  const user = req.auth.user;
  const { q, type } = req.valid.query;
  const readingChain = language.readingChain(user);

  const reference = await directVerseId(q);
  if (reference) {
    const verses = await prisma.verse.findMany({
      where: { verseId: reference, book: { isPublished: true } },
      include: present.includes.verse(readingChain),
    });
    return ok(res, {
      query: q,
      verses: await present.verses(verses, user),
      mantras: [],
      books: [],
      total: verses.length,
    });
  }

  // A page of just one kind — ordered deterministically, since that is what
  // makes paging through it actually lazy-load rather than reshuffle.
  if (type === 'verse') {
    const { items, page } = await paginate(prisma.verse, {
      where: verseWhere(q, readingChain),
      orderBy: [
        { bookNumber: 'asc' },
        { cantoNumber: 'asc' },
        { chapterNumber: 'asc' },
        { verseNumber: 'asc' },
      ],
      include: present.includes.verse(readingChain),
      query: req.valid.query,
    });
    return paginated(res, await present.verses(items, user), page);
  }

  if (type === 'mantra') {
    const { items, page } = await paginate(prisma.mantra, {
      where: mantraWhere(q),
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: present.includes.mantra(language.mantraChain(user), readingChain),
      query: req.valid.query,
    });
    return paginated(res, await present.mantras(items, user), page);
  }

  if (type === 'book') {
    const { items, page } = await paginate(prisma.book, {
      where: bookWhere(q),
      orderBy: [{ displayOrder: 'asc' }, { bookNumber: 'asc' }],
      query: req.valid.query,
    });
    return paginated(res, await present.books(items, user), page);
  }

  // No type: a small preview of everything, capped well under a page. Each
  // kind's `HasMore` is a page's worth cheaper than a count query — it only
  // has to know whether it filled the preview, not how many rows are left.
  const [verses, mantras, books] = await Promise.all([
    prisma.verse.findMany({
      where: verseWhere(q, readingChain),
      take: PREVIEW_LIMIT,
      include: present.includes.verse(readingChain),
    }),
    prisma.mantra.findMany({
      where: mantraWhere(q),
      take: PREVIEW_LIMIT,
      include: present.includes.mantra(language.mantraChain(user), readingChain),
    }),
    prisma.book.findMany({ where: bookWhere(q), take: PREVIEW_LIMIT }),
  ]);

  return ok(res, {
    query: q,
    verses: await present.verses(verses, user),
    verseHasMore: verses.length === PREVIEW_LIMIT,
    mantras: await present.mantras(mantras, user),
    mantraHasMore: mantras.length === PREVIEW_LIMIT,
    books: await present.books(books, user),
    bookHasMore: books.length === PREVIEW_LIMIT,
    total: verses.length + mantras.length + books.length,
  });
};
