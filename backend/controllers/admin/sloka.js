// Curating the daily sloka.
//
// The nightly job fills any date an editor has not set, so this screen is about
// overriding it — choosing the verse for a festival day, or replacing one that
// landed badly. A row is only sent once `isPublished` is true, so a draft can
// sit on a future date safely.

const { prisma } = require('../../config/database');
const audit = require('../../services/audit');
const s3 = require('../../services/s3');
const { redis } = require('../../config/redis');
const { ok, created, noContent } = require('../../utils/respond');
const { notFound, badRequest } = require('../../utils/errors');
const { toDateColumn, localDateString, shiftDays, isValidDateString } = require('../../utils/date');
const { CACHE, SLOKA_ELIGIBLE_BOOK_NUMBERS } = require('../../config/constants');

/** GET /api/admin/slokas — the calendar, defaulting to the coming fortnight. */
exports.calendar = async (req, res) => {
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

/** PUT /api/admin/slokas/:date — set or replace the sloka for one date. */
exports.set = async (req, res) => {
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
    after: { date, verseId },
  });

  return created(res, sloka);
};

/** DELETE /api/admin/slokas/:date */
exports.remove = async (req, res) => {
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
exports.pool = async (req, res) => {
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
exports.delivery = async (req, res) => {
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
