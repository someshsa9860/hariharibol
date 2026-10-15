// Curating the daily sloka.
//
// The nightly job fills any date an editor has not set, so this screen is about
// overriding it — choosing the verse for a festival day, or replacing one that
// landed badly. A row is only sent once `isPublished` is true, so a draft can
// sit on a future date safely.

import { prisma } from '../../config/database.js';
import * as audit from '../../services/audit.js';
import * as s3 from '../../services/s3.js';
import { redis } from '../../config/redis.js';
import { ok, created, noContent } from '../../utils/respond.js';
import { notFound, badRequest } from '../../utils/errors.js';
import { toDateColumn, localDateString, shiftDays, isValidDateString } from '../../utils/date.js';
import { CACHE, SLOKA_ELIGIBLE_BOOK_NUMBERS } from '../../config/constants.js';

/** GET /api/admin/slokas — the calendar, defaulting to the coming fortnight. */
export const calendar = async (req, res) => {
  const from = req.valid.query.from || shiftDays(localDateString('Asia/Kolkata'), -7);
  const to = req.valid.query.to || shiftDays(from, 21);

  const slokas = await prisma.dailySloka.findMany({
    where: { date: { gte: toDateColumn(from), lte: toDateColumn(to) } },
    orderBy: { date: 'asc' },
    include: {
      verse: {
        select: {
          verseId: true,
          sanskrit: true,
          book: { select: { slug: true, title: true } },
        },
      },
    },
  });

  return ok(res, {
    from,
    to,
    slokas: await s3.presignList(slokas, ['imagePath']),
    // Dates with nothing set. The nightly job will fill them, but an editor
    // planning around a festival wants to see the gaps before it does.
    unset: gaps(from, to, slokas),
  });
};

function gaps(from, to, slokas) {
  const taken = new Set(slokas.map((row) => row.date.toISOString().slice(0, 10)));
  const out = [];
  let cursor = from;
  while (cursor <= to) {
    if (!taken.has(cursor)) out.push(cursor);
    cursor = shiftDays(cursor, 1);
  }
  return out;
}

// The Gita's plain chapter titles are the Sanskrit names; Prabhupāda's English
// heading is `titleI18n.en` (see "Translated titles" in backend/CLAUDE.md).
const englishTitle = (row) => (typeof row?.titleI18n?.en === 'string' && row.titleI18n.en.trim()) || row?.title || '';

/**
 * GET /api/admin/slokas/picker
 * The verses an editor can choose from, laid out to be chosen by — book, then
 * canto (the Bhagavatam only), then chapter, then verse. Only the eligible pool
 * is listed, because `set` refuses anything else; picking from a list of what
 * will be accepted beats typing a verse id and being told it was not.
 *
 * Served from here rather than the books and verses endpoints so choosing a
 * sloka needs `sloka.manage` and nothing more. The pool is curated by hand, so
 * it is sent whole, Sanskrit included, for the preview under the verse.
 */
export const picker = async (req, res) => {
  const verses = await prisma.verse.findMany({
    where: { isSlokaEligible: true, bookNumber: { in: SLOKA_ELIGIBLE_BOOK_NUMBERS } },
    orderBy: [{ bookNumber: 'asc' }, { cantoNumber: 'asc' }, { chapterNumber: 'asc' }, { verseNumber: 'asc' }],
    select: {
      verseId: true,
      bookNumber: true,
      cantoNumber: true,
      chapterNumber: true,
      verseNumber: true,
      verseNumberEnd: true,
      sanskrit: true,
      book: { select: { title: true } },
      chapter: { select: { title: true, titleI18n: true } },
    },
  });

  const cantos = await prisma.canto.findMany({
    where: { book: { bookNumber: { in: SLOKA_ELIGIBLE_BOOK_NUMBERS } } },
    select: { number: true, title: true, titleI18n: true, book: { select: { bookNumber: true } } },
  });
  const cantoTitle = new Map(cantos.map((c) => [`${c.book.bookNumber}.${c.number}`, englishTitle(c)]));

  // Rows arrive in reading order, so each level is appended to as it is met.
  const books = [];
  for (const v of verses) {
    let book = books.find((b) => b.bookNumber === v.bookNumber);
    if (!book) {
      book = { bookNumber: v.bookNumber, title: v.book.title, cantos: [], chapters: [] };
      books.push(book);
    }

    if (v.cantoNumber != null && !book.cantos.some((c) => c.number === v.cantoNumber)) {
      book.cantos.push({ number: v.cantoNumber, title: cantoTitle.get(`${v.bookNumber}.${v.cantoNumber}`) ?? '' });
    }

    let chapter = book.chapters.find((c) => c.cantoNumber === v.cantoNumber && c.number === v.chapterNumber);
    if (!chapter) {
      chapter = { number: v.chapterNumber, cantoNumber: v.cantoNumber, title: englishTitle(v.chapter), verses: [] };
      book.chapters.push(chapter);
    }

    chapter.verses.push({
      verseId: v.verseId,
      verseNumber: v.verseNumber,
      verseNumberEnd: v.verseNumberEnd,
      sanskrit: v.sanskrit,
    });
  }

  return ok(res, { books });
};

// A background image is only trusted if this server issued its key for a sloka
// image, and it is only saved if the file really arrived — otherwise the app is
// sent a link to nothing. A key the row already holds passes untouched.
async function assertImage(key, current) {
  if (!key || key === current) return;
  if (!s3.isGeneratedKey(key) || !s3.keyHasPrefix(key, s3.PREFIXES.slokaImage)) {
    throw badRequest('Not a sloka image upload key');
  }
  if (!(await s3.objectExists(key))) throw badRequest('That image is missing from storage — upload it again');
}

/** PUT /api/admin/slokas/:date — set or replace the sloka for one date. */
export const set = async (req, res) => {
  const { date } = req.valid.params;
  const { verseId, imagePath, isPublished } = req.valid.body;

  if (!isValidDateString(date)) throw badRequest('Expected a date as YYYY-MM-DD');

  const verse = await prisma.verse.findUnique({ where: { verseId } });
  if (!verse) throw notFound('Verse');

  if (!SLOKA_ELIGIBLE_BOOK_NUMBERS.includes(verse.bookNumber)) {
    throw badRequest('Only Bhagavad Gita and Srimad Bhagavatam verses can be the daily sloka');
  }
  if (!verse.isSlokaEligible) {
    throw badRequest('That verse is not marked sloka-eligible');
  }

  const existing = await prisma.dailySloka.findUnique({
    where: { date: toDateColumn(date) },
    select: { imagePath: true },
  });
  await assertImage(imagePath, existing?.imagePath);

  const sloka = await prisma.dailySloka.upsert({
    where: { date: toDateColumn(date) },
    update: { verseId: verse.id, imagePath, isPublished, source: 'MANUAL' },
    create: { date: toDateColumn(date), verseId: verse.id, imagePath, isPublished, source: 'MANUAL' },
  });

  // The public endpoint caches the verse id for an hour; without this, an
  // editor's correction would not appear until it expired.
  await redis.del(CACHE.dailySloka(date)).catch(() => null);

  await audit.record(req, {
    action: 'sloka.set',
    entityType: 'DailySloka',
    entityId: sloka.id,
    after: { date, verseId, imagePath },
  });

  return created(res, sloka);
};

/** DELETE /api/admin/slokas/:date */
export const remove = async (req, res) => {
  const { date } = req.valid.params;

  const sloka = await prisma.dailySloka.findUnique({ where: { date: toDateColumn(date) } });
  if (!sloka) throw notFound('Sloka');
  if (sloka.sentAt) throw badRequest('That sloka has already been sent out');

  await prisma.dailySloka.delete({ where: { id: sloka.id } });
  await redis.del(CACHE.dailySloka(date)).catch(() => null);

  return noContent(res);
};

/**
 * GET /api/admin/slokas/pool
 * How healthy the eligible pool is, per book. The personalised sloka avoids
 * repeating within 45 days, so a pool smaller than that is guaranteed to
 * repeat — this is the number that says so before users notice.
 */
export const pool = async (req, res) => {
  const [byBook, mapped, unmapped] = await Promise.all([
    prisma.verse.groupBy({
      by: ['bookNumber'],
      where: { isSlokaEligible: true },
      _count: { _all: true },
    }),
    prisma.verse.count({ where: { isSlokaEligible: true, issueLinks: { some: {} } } }),
    prisma.verse.count({ where: { isSlokaEligible: true, issueLinks: { none: {} } } }),
  ]);

  const total = byBook.reduce((sum, row) => sum + row._count._all, 0);

  return ok(res, {
    total,
    byBook: byBook.map((row) => ({ bookNumber: row.bookNumber, count: row._count._all })),
    mappedToIssues: mapped,
    // Eligible but connected to no struggle: usable as the global sloka of the
    // day, invisible to the personalised picker.
    notMappedToIssues: unmapped,
    repeatWindowDays: 45,
    isTooSmall: total < 45,
  });
};

/**
 * GET /api/admin/slokas/delivery
 * What went out and what was actually opened. `seenAt` against `notifiedAt` is
 * the honest measure of whether the personalisation is landing.
 */
export const delivery = async (req, res) => {
  const date = req.valid.query.date || localDateString('Asia/Kolkata');
  const dateColumn = toDateColumn(date);

  const [picked, notified, seen, byIssue] = await Promise.all([
    prisma.userDailySloka.count({ where: { date: dateColumn } }),
    prisma.userDailySloka.count({ where: { date: dateColumn, notifiedAt: { not: null } } }),
    prisma.userDailySloka.count({ where: { date: dateColumn, seenAt: { not: null } } }),
    prisma.userDailySloka.groupBy({
      by: ['issueId'],
      where: { date: dateColumn, issueId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  return ok(res, {
    date,
    picked,
    notified,
    seen,
    openRate: notified ? Number((seen / notified).toFixed(2)) : 0,
    byIssue,
  });
};
