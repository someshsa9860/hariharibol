// Content for the public website.
//
// Separate from the app's endpoints even though some of it overlaps, because
// the two have different jobs. The website is indexed by search engines, so it
// wants full text, canonical URLs and a sitemap; the app wants small payloads
// resolved to a signed-in reader's languages. Serving both from one endpoint
// would mean each compromise for the other.
//
// Everything here is anonymous and English-first — there is no signed-in reader
// to resolve languages against.

const { prisma } = require('../../config/database');
const present = require('../../utils/present');
const s3 = require('../../services/s3');
const { ok } = require('../../utils/respond');
const { notFound } = require('../../utils/errors');
const { paginate } = require('../../utils/pagination');
const { localDateString, toDateColumn } = require('../../utils/date');
const env = require('../../config/env');

// The website has no session, so the language comes from the URL or the
// Accept-Language header. Shaped as a user object because that is what
// utils/present expects.
function visitor(req) {
  const code = req.valid?.query?.lang || req.acceptLanguage || 'en';
  return { appLanguage: code, readingLanguage: code, mantraLanguage: 'sa' };
}

/** GET /api/web/books */
exports.books = async (req, res) => {
  const reader = visitor(req);

  const { items, page } = await paginate(prisma.book, {
    where: { isPublished: true, ...(req.valid.query.type ? { type: req.valid.query.type } : {}) },
    orderBy: [{ displayOrder: 'asc' }, { bookNumber: 'asc' }],
    include: { deity: { select: { slug: true, name: true } } },
    query: req.valid.query,
  });

  return ok(res, { books: await present.books(items, reader), total: page.total });
};

/** GET /api/web/books/:slug — the book with its full chapter list, for the index page. */
exports.book = async (req, res) => {
  const reader = visitor(req);

  const book = await prisma.book.findFirst({
    where: { slug: req.valid.params.slug, isPublished: true },
    include: {
      deity: { select: { slug: true, name: true } },
      cantos: { orderBy: { number: 'asc' } },
      chapters: { orderBy: [{ cantoNumber: 'asc' }, { number: 'asc' }] },
      translators: { include: { translator: { select: { slug: true, name: true } } } },
    },
  });
  if (!book) throw notFound('Book');

  return ok(res, {
    ...(await present.book(book, reader)),
    cantos: present.sections(book.cantos, reader),
    chapters: present.sections(book.chapters, reader),
    translators: book.translators.map((link) => ({ ...link.translator, isDefault: link.isDefault })),
  });
};

/**
 * GET /api/web/verses/:verseId
 * A single verse with every published translation in full — the website page is
 * the canonical one for that verse, so it carries everything rather than the
 * one rendering the app would pick.
 */
exports.verse = async (req, res) => {
  const reader = visitor(req);

  const verse = await prisma.verse.findUnique({
    where: { verseId: req.valid.params.verseId },
    include: {
      book: { select: { slug: true, title: true, bookNumber: true, isPublished: true } },
      chapter: { select: { number: true, title: true } },
      translations: {
        where: { isPublished: true },
        include: { translator: { select: { slug: true, name: true } } },
        orderBy: { displayOrder: 'asc' },
      },
      explanations: { where: { isPublished: true } },
    },
  });
  if (!verse || !verse.book.isPublished) throw notFound('Verse');

  // Neighbours, so the page can offer previous and next without the site
  // holding a copy of the whole chapter.
  const [previous, next] = await Promise.all([
    prisma.verse.findFirst({
      where: { chapterId: verse.chapterId, verseNumber: { lt: verse.verseNumber } },
      orderBy: { verseNumber: 'desc' },
      select: { verseId: true },
    }),
    prisma.verse.findFirst({
      where: { chapterId: verse.chapterId, verseNumber: { gt: verse.verseNumber } },
      orderBy: { verseNumber: 'asc' },
      select: { verseId: true },
    }),
  ]);

  return ok(res, {
    ...(await present.verse(verse, reader)),
    translations: verse.translations.map((row) => ({
      languageCode: row.languageCode,
      type: row.type,
      meaning: row.meaning,
      purport: row.purport,
      sourceRef: row.sourceRef,
      translator: row.translator,
    })),
    previousVerseId: previous?.verseId || null,
    nextVerseId: next?.verseId || null,
    canonicalUrl: `${env.WEB_BASE_URL}/verse/${verse.verseId}`,
  });
};

/** GET /api/web/sloka/today — the shareable sloka of the day. */
exports.slokaOfTheDay = async (req, res) => {
  const reader = visitor(req);
  const date = req.valid.query.date || localDateString('Asia/Kolkata');

  const daily = await prisma.dailySloka.findFirst({
    where: { date: toDateColumn(date), isPublished: true },
    include: {
      verse: {
        include: {
          book: { select: { slug: true, title: true } },
          translations: {
            where: { isPublished: true, languageCode: 'en' },
            include: { translator: { select: { slug: true, name: true } } },
            take: 1,
          },
          explanations: { where: { isPublished: true, languageCode: 'en' } },
        },
      },
    },
  });
  if (!daily) throw notFound('Sloka for that date');

  return ok(res, {
    date,
    imageUrl: daily.imagePath ? await s3.presignGet(daily.imagePath) : null,
    verse: await present.verse(daily.verse, reader),
    shareUrl: `${env.WEB_BASE_URL}/sloka/${date}`,
  });
};

/**
 * GET /api/web/sitemap
 * Every canonical URL the site should expose. Ids only, no text — the site
 * builds the XML, and shipping the whole corpus through here would be a very
 * large response for something a crawler reads occasionally.
 */
exports.sitemap = async (req, res) => {
  const [books, verses, mantras] = await Promise.all([
    prisma.book.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.verse.findMany({
      where: { book: { isPublished: true } },
      select: { verseId: true, updatedAt: true },
    }),
    prisma.mantra.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  return ok(res, { books, verses, mantras, generatedAt: new Date().toISOString() });
};
