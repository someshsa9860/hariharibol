// Search across the library — verses, mantras and books — plus a direct jump
// to an exact verse when the query is a reference rather than a search: a
// dotted id ("1.2.47") or a book's own shorthand ("BG 2.47", "SB 1.3.28").
//
// It forgives what a person types. A query may start with a book's name, spelt however
// ("gita", "bhagvat gita", "sb"): that narrows the search to the book and the rest is
// what to look for. Each remaining word is matched against the library's own words by
// sound, so "krishna", "krsna" and "kṛṣṇa" are one word, a typo or a stray space still
// finds its verse, and the answer says what it read the query as (`corrected`). All of
// that lives in `utils/search-query.js`; this file turns it into queries.
//
// Verses are matched in the Sanskrit, the transliteration, the translation and the
// purport, and ranked: a hit in the verse itself beats one in the meaning, which beats
// one in the purport, and a query typed as a phrase beats the same words apart. A
// regular-expression match in Postgres, not a search cluster — about 18,700 verses is
// small enough, and nothing extra has to run, be backed up or paid for. When it stops
// being enough the next step is a trigram or full-text index on these columns.
//
// Without `type`, this returns a small preview of each kind — the "everything" view a
// query first lands on. With `type`, it returns the full, paginated list for just that
// one kind, so the app can page through it as the reader scrolls.

import { Prisma } from '@prisma/client';

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import * as language from '../../utils/language.js';
import { readPage } from '../../utils/pagination.js';
import { ok, paginated } from '../../utils/respond.js';
import { vocabulary } from '../../services/search-vocabulary.js';
import { visibleTo } from '../../utils/mantra-visibility.js';
import {
  alternation,
  escapeRegex,
  excerpt,
  interpret,
  isVerseNumber,
  parseBookTag,
  words,
} from '../../utils/search-query.js';

const PREVIEW_LIMIT = 6;
const BOOKS_TTL_MS = 60 * 1000;

// The verse scan reads every published verse in the reader's languages — a few hundred milliseconds of database time —
// and the same query comes back again and again: the overview, then each page of the list as the reader scrolls, then
// the next person to search "krishna". The best RANKED_CAP ids of a query and its total are kept in memory for
// RANKED_TTL_MS, so those pages cost nothing; a page beyond them is read from the database. A verse published in the
// meantime shows up when the entry runs out. Per process, so each API container keeps its own.
const RANKED_CAP = 120;
const RANKED_TTL_MS = 10 * 60 * 1000;
const RANKED_MAX_ENTRIES = 300;
const ranked = new Map();

let booksCache = { at: 0, rows: [] };

// The published books, for naming a book from the query. Cached for a minute: it is read
// on every keystroke and changes when someone publishes a book.
async function publishedBooks() {
  if (Date.now() - booksCache.at < BOOKS_TTL_MS) return booksCache.rows;
  const rows = await prisma.book.findMany({
    where: { isPublished: true },
    select: { id: true, bookNumber: true, slug: true, title: true },
    orderBy: { bookNumber: 'asc' },
  });
  booksCache = { at: Date.now(), rows };
  return rows;
}

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
function directVerseId(q, books) {
  if (/^\d+(\.\d+){1,3}$/.test(q)) return q;

  const match = q.match(REFERENCE_PATTERN);
  if (!match) return null;
  const [, prefix, numbers] = match;

  const book = books.find((candidate) => shortcutsFor(candidate).has(prefix.toLowerCase()));
  return book ? `${book.bookNumber}.${numbers}` : null;
}

// What the query asks for: which book (if any) it is narrowed to, and the words to find.
// An explicit `book` slug (the app's chip) wins; otherwise a book named at the start of
// the query is taken, and its name removed from what is searched for.
function readQuery(q, bookSlug, books) {
  const tagged = parseBookTag(q, books);
  const chosen = bookSlug ? books.find((b) => b.slug === bookSlug) : null;

  if (chosen) {
    const text = tagged.book?.id === chosen.id ? tagged.text : q.trim();
    return { book: chosen, text, tagged: false };
  }
  return { book: tagged.book, text: tagged.text, tagged: Boolean(tagged.book) };
}

// ─── verses ──────────────────────────────────────────────────────────────────

// One regular expression per word, matching any spelling of it. Each word must be found
// somewhere in the verse, in any of its four texts. Built with bound parameters; the
// column and alias names are fixed strings.
function verseMatch(terms, phrase, chain, bookNumber) {
  const regexes = terms.map((t) => alternation(t.variants));

  const flags = regexes.map(
    (re, i) => Prisma.sql`
      (v."sanskrit" ~* ${re} OR v."transliteration" ~* ${re}) AS ${Prisma.raw(`a${i}`)},
      (tr."meaning" ~* ${re}) AS ${Prisma.raw(`m${i}`)},
      (tr."purport" ~* ${re}) AS ${Prisma.raw(`p${i}`)}`
  );

  const hit = terms.map((_, i) => Prisma.sql`(h.${Prisma.raw(`a${i}`)} OR h.${Prisma.raw(`m${i}`)} OR h.${Prisma.raw(`p${i}`)})`);
  const score = terms.map(
    (_, i) => Prisma.sql`(CASE WHEN h.${Prisma.raw(`a${i}`)} THEN 3 ELSE 0 END
      + CASE WHEN h.${Prisma.raw(`m${i}`)} THEN 2 ELSE 0 END
      + CASE WHEN h.${Prisma.raw(`p${i}`)} THEN 1 ELSE 0 END)`
  );

  // The words together, as typed, are a better answer than the same words apart.
  const together =
    terms.length > 1
      ? Prisma.sql`+ (CASE WHEN v."transliteration" ~* ${phrase} OR tr."meaning" ~* ${phrase} THEN 6 ELSE 0 END)`
      : Prisma.empty;

  const bookFilter = bookNumber != null ? Prisma.sql`AND v."bookNumber" = ${bookNumber}` : Prisma.empty;

  return {
    from: Prisma.sql`
      FROM "Verse" v
      JOIN "Book" b ON b."id" = v."bookId" AND b."isPublished"
      LEFT JOIN LATERAL (
        SELECT string_agg(t."meaning", ' ') AS "meaning", string_agg(t."purport", ' ') AS "purport"
        FROM "VerseTranslation" t
        WHERE t."verseId" = v."id" AND t."isPublished" AND t."languageCode" = ANY(${chain}::text[])
      ) tr ON true
      CROSS JOIN LATERAL (SELECT ${Prisma.join(flags, ', ')}) h
      WHERE ${Prisma.join(hit, ' AND ')} ${bookFilter}`,
    score: Prisma.sql`(${Prisma.join(score, ' + ')} ${together})`,
  };
}

async function scanVerseIds(terms, phrase, chain, bookNumber, { skip, take }) {
  const { from, score } = verseMatch(terms, phrase, chain, bookNumber);

  const rows = await prisma.$queryRaw`
    SELECT v."id" AS id, ${score} AS score, count(*) OVER() AS total
    ${from}
    ORDER BY score DESC, v."bookNumber", v."cantoNumber" NULLS FIRST, v."chapterNumber" NULLS FIRST, v."verseNumber"
    LIMIT ${take} OFFSET ${skip}`;

  return { ids: rows.map((r) => r.id), total: rows.length ? Number(rows[0].total) : 0 };
}

// The ranked ids of a query (see RANKED_CAP). The entry holds the promise, so the same query asked twice at once — the
// overview and the first page, or two readers — waits on one scan.
async function findVerseIds(terms, text, chain, bookNumber, { skip, take }) {
  const phrase = words(text).map(escapeRegex).join('[^[:alnum:]]+');
  if (skip + take > RANKED_CAP) return scanVerseIds(terms, phrase, chain, bookNumber, { skip, take });

  const key = JSON.stringify([terms.map((t) => t.variants), phrase, chain, bookNumber]);
  let entry = ranked.get(key);
  if (!entry || Date.now() - entry.at > RANKED_TTL_MS) {
    entry = { at: Date.now(), result: scanVerseIds(terms, phrase, chain, bookNumber, { skip: 0, take: RANKED_CAP }) };
    ranked.delete(key);
    ranked.set(key, entry);
    if (ranked.size > RANKED_MAX_ENTRIES) ranked.delete(ranked.keys().next().value);
    entry.result.catch(() => ranked.get(key) === entry && ranked.delete(key));
  }

  const { ids, total } = await entry.result;
  return { ids: ids.slice(skip, skip + take), total };
}

// Which text of the verse the words were found in, with the passage around them. The
// verse's own lines first — someone typing Sanskrit wants to see Sanskrit — then the
// translation, then the purport.
function matchOf(verse, row, terms) {
  const sources = [
    ['transliteration', verse.transliteration],
    ['sanskrit', verse.sanskrit],
    ['meaning', verse.translation?.meaning],
    ['purport', row.translations.map((t) => t.purport).filter(Boolean).join(' ')],
  ];
  for (const [field, value] of sources) {
    const snippet = excerpt(value, terms);
    if (snippet) return { field, snippet };
  }
  return null;
}

async function presentVerses(ids, terms, user, chain) {
  if (!ids.length) return [];
  const rows = await prisma.verse.findMany({
    where: { id: { in: ids } },
    include: present.includes.verse(chain, user?.id),
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  const shaped = await present.verses(ordered, user);
  return shaped.map((verse, i) => ({ ...verse, searchMatch: matchOf(verse, ordered[i], terms) }));
}

// ─── mantras and books ───────────────────────────────────────────────────────

// Every word must be found, each in any of its spellings.
const everyWord = (terms, clausesFor) =>
  terms.map((t) => ({ OR: t.variants.flatMap((variant) => clausesFor(variant)) }));

function mantraWhere(terms, readingChain, user) {
  return {
    AND: [
      visibleTo(user),
      ...everyWord(terms, (v) => [
        ...language.mantraNameClauses(v, readingChain),
        { sanskrit: { contains: v, mode: 'insensitive' } },
        { transliteration: { contains: v, mode: 'insensitive' } },
        { tags: { has: v.toLowerCase() } },
      ]),
    ],
  };
}

function bookWhere(terms) {
  return {
    isPublished: true,
    AND: everyWord(terms, (v) => [
      { title: { contains: v, mode: 'insensitive' } },
      { description: { contains: v, mode: 'insensitive' } },
      { tags: { has: v.toLowerCase() } },
    ]),
  };
}

// ─── the endpoint ────────────────────────────────────────────────────────────

const scopeOf = (read) =>
  read.book
    ? { slug: read.book.slug, title: read.book.title, fromQuery: read.tagged, text: read.text }
    : null;

export const search = async (req, res) => {
  const user = req.auth.user;
  const { q, type, book: bookSlug } = req.valid.query;
  const readingChain = language.readingChain(user);

  const books = await publishedBooks();
  const read = readQuery(q, bookSlug, books);

  // A reference rather than a search: "1.2.47", "BG 2.47", "gita 2.47", or a number
  // typed with the Gita chip on.
  const number = read.text.trim().replace(/\s+/g, '.');
  const reference = read.book && isVerseNumber(number)
    ? `${read.book.bookNumber}.${number}`
    : directVerseId(q, books);
  if (reference) {
    const verses = await prisma.verse.findMany({
      where: { verseId: reference, book: { isPublished: true } },
      include: present.includes.verse(readingChain),
    });
    return ok(res, {
      query: q,
      scope: scopeOf(read),
      corrected: null,
      verses: await present.verses(verses, user),
      verseHasMore: false,
      verseTotal: verses.length,
      mantras: [],
      mantraHasMore: false,
      mantraTotal: 0,
      books: [],
      bookHasMore: false,
      bookTotal: 0,
      total: verses.length,
    });
  }

  // A book's name on its own is a search for the book, not an empty scope.
  const scoped = read.book && read.text.length >= 2 ? read : { ...read, book: null, tagged: false, text: q };
  const text = scoped.text;
  const bookNumber = scoped.book?.bookNumber ?? null;

  const vocab = await vocabulary();
  const { terms, corrected } = interpret(text, vocab);
  const scope = scopeOf(scoped);

  if (!terms.length) {
    return ok(res, emptyOverview(q, scope));
  }

  const { page, pageSize, skip } = readPage(req.valid.query);
  const noMantrasOrBooks = bookNumber != null;

  // A page of just one kind — ordered best first, then in book order, which is what
  // makes paging through it lazy-load rather than reshuffle.
  if (type === 'verse') {
    const { ids, total } = await findVerseIds(terms, text, readingChain, bookNumber, { skip, take: pageSize });
    const items = await presentVerses(ids, terms, user, readingChain);
    return paginated(res, items, { page, pageSize, total }, { scope, corrected });
  }

  if (type === 'mantra') {
    const where = noMantrasOrBooks ? { id: '' } : mantraWhere(terms, readingChain, user);
    const [items, total] = await Promise.all([
      prisma.mantra.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: present.includes.mantra(language.mantraTextChain(user), readingChain),
        skip,
        take: pageSize,
      }),
      prisma.mantra.count({ where }),
    ]);
    return paginated(res, await present.mantras(items, user), { page, pageSize, total }, { scope, corrected });
  }

  if (type === 'book') {
    const where = noMantrasOrBooks ? { id: '' } : bookWhere(terms);
    const [items, total] = await Promise.all([
      prisma.book.findMany({
        where,
        orderBy: [{ displayOrder: 'asc' }, { bookNumber: 'asc' }],
        skip,
        take: pageSize,
      }),
      prisma.book.count({ where }),
    ]);
    return paginated(res, await present.books(items, user), { page, pageSize, total }, { scope, corrected });
  }

  // No type: a small preview of everything, with how many there are of each so the
  // app can label its tabs. Capped well under a page.
  const mantraFilter = noMantrasOrBooks ? { id: '' } : mantraWhere(terms, readingChain, user);
  const bookFilter = noMantrasOrBooks ? { id: '' } : bookWhere(terms);

  const [verseResult, mantras, mantraTotal, bookRows, bookTotal] = await Promise.all([
    findVerseIds(terms, text, readingChain, bookNumber, { skip: 0, take: PREVIEW_LIMIT }),
    prisma.mantra.findMany({
      where: mantraFilter,
      take: PREVIEW_LIMIT,
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: present.includes.mantra(language.mantraTextChain(user), readingChain),
    }),
    prisma.mantra.count({ where: mantraFilter }),
    prisma.book.findMany({ where: bookFilter, take: PREVIEW_LIMIT, orderBy: [{ displayOrder: 'asc' }] }),
    prisma.book.count({ where: bookFilter }),
  ]);
  const verses = await presentVerses(verseResult.ids, terms, user, readingChain);

  return ok(res, {
    query: q,
    scope,
    corrected,
    verses,
    verseHasMore: verseResult.total > verses.length,
    verseTotal: verseResult.total,
    mantras: await present.mantras(mantras, user),
    mantraHasMore: mantraTotal > mantras.length,
    mantraTotal,
    books: await present.books(bookRows, user),
    bookHasMore: bookTotal > bookRows.length,
    bookTotal,
    total: verseResult.total + mantraTotal + bookTotal,
  });
};

function emptyOverview(q, scope) {
  return {
    query: q,
    scope,
    corrected: null,
    verses: [],
    verseHasMore: false,
    verseTotal: 0,
    mantras: [],
    mantraHasMore: false,
    mantraTotal: 0,
    books: [],
    bookHasMore: false,
    bookTotal: 0,
    total: 0,
  };
}
