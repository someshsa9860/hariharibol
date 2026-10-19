// Turns what Sakha offered ("open the Gita 2.47") into something the app can open — or into nothing.
//
// utils/chat-actions.js reads the marker out of the reply; this checks it against the database. A model can name a
// verse that does not exist or a mantra we do not have, and a card for those would be a dead end, so an action that
// does not resolve is simply not sent. What does resolve is still only an offer: the app asks the reader first.
//
// The result is plain data for the `action` event: the app words every label itself, from the `type` and `page`; only
// the names of things (a mantra, a book and verse) come from here, in the reader's reading language.

import { prisma } from '../config/database.js';
import * as language from '../utils/language.js';

const GITA = new Set(['bhagavad-gita', 'bhagavat-gita', 'bhagavad-gita-as-it-is', 'gita', 'bg']);
const BHAGAVATAM = new Set(['srimad-bhagavatam', 'srimad-bhagavata', 'bhagavatam', 'bhagavata', 'sb']);

const slugify = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function findBook(name) {
  const wanted = slugify(name);
  const exact = await prisma.book.findFirst({
    where: { isPublished: true, slug: wanted },
    select: { id: true, slug: true, title: true, titleI18n: true, bookNumber: true },
  });
  if (exact) return exact;
  // The model may use a short or older spelling; BG and SB are the two books with numbers 1 and 2.
  const number = GITA.has(wanted) ? 1 : BHAGAVATAM.has(wanted) ? 2 : null;
  if (!number) return null;
  return prisma.book.findFirst({
    where: { isPublished: true, bookNumber: number },
    select: { id: true, slug: true, title: true, titleI18n: true, bookNumber: true },
  });
}

const titleIn = (book, chain) => {
  const map = book.titleI18n && typeof book.titleI18n === 'object' ? book.titleI18n : {};
  for (const code of chain) {
    if (typeof map[code] === 'string' && map[code].trim()) return map[code].trim();
    if (code === 'en') break;
  }
  return map.en?.trim() || book.title;
};

async function resolveVerse(parsed, user) {
  const book = await findBook(parsed.book);
  if (!book) return null;
  // The Gita has chapter.verse; the Bhagavatam canto.chapter.verse. Anything else is a guess we do not follow.
  const hasCantos = book.bookNumber === 2;
  const expected = hasCantos ? 3 : 2;
  if (parsed.numbers.length !== expected) return null;
  const [canto, chapter, verse] = hasCantos ? parsed.numbers : [null, ...parsed.numbers];

  const row = await prisma.verse.findFirst({
    where: {
      bookId: book.id,
      chapterNumber: chapter,
      ...(canto ? { cantoNumber: canto } : {}),
      // A compound verse (13–14) is reached by either number.
      OR: [{ verseNumber: verse }, { verseNumber: { lt: verse }, verseNumberEnd: { gte: verse } }],
    },
    select: { verseNumber: true, cantoNumber: true, chapterNumber: true },
    orderBy: { verseNumber: 'asc' },
  });
  if (!row) return null;

  const title = titleIn(book, language.readingChain(user));
  const reference = [row.cantoNumber, row.chapterNumber, row.verseNumber].filter((n) => n != null).join('.');
  return {
    type: 'verse',
    bookSlug: book.slug,
    canto: row.cantoNumber ?? null,
    chapter: row.chapterNumber,
    verse: row.verseNumber,
    title: `${title} ${reference}`,
  };
}

async function resolveMantra(parsed, user) {
  const q = parsed.query.trim();
  if (!q) return null;
  const chain = language.readingChain(user);
  const select = {
    slug: true, name: true, translations: { where: { isPublished: true, languageCode: { in: chain } }, select: { languageCode: true, name: true } },
  };
  const where = { isPublished: true };
  const exact = await prisma.mantra.findFirst({
    where: { ...where, OR: [{ slug: slugify(q) }, { name: { equals: q, mode: 'insensitive' } }] }, select,
  });
  const found = exact || (await prisma.mantra.findFirst({
    where: { ...where, OR: language.mantraNameClauses(q, chain) }, orderBy: { displayOrder: 'asc' }, select,
  }));
  if (!found) return null;
  return { type: 'mantra', slug: found.slug, title: language.pickName(found.translations, chain, found.name) };
}

/** The parsed marker as an action for the app, or null when it names nothing that exists. */
export async function resolve(parsed, user) {
  if (!parsed) return null;
  if (parsed.kind === 'page') return { type: 'page', page: parsed.page };
  if (parsed.kind === 'mantra') return resolveMantra(parsed, user);
  if (parsed.kind === 'verse') return resolveVerse(parsed, user);
  return null;
}
