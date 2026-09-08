// Sloka for You.
//
// Two things share this file because they are the same object seen twice:
//
//   the global sloka   one per date, the same for everyone, curated or picked
//                      by the nightly job. Free, and public — it is the thing
//                      someone sees before they have an account.
//   a personal sloka   chosen for one user from what they have said they are
//                      struggling with. This is the Premium feature.
//
// Slokas are drawn only from the Bhagavad Gita and the Srimad Bhagavatam, and
// only from verses an editor has opted in with `isSlokaEligible`. A short work
// is never used as a daily sloka.
//
// No AI runs here. The verse→issue mapping in VerseIssue was written by a batch
// job ahead of time, so answering "I am struggling with krodha" is a weighted
// indexed query, not a model call. That is what keeps the cost of this feature
// bounded by the size of the corpus rather than by the number of users.

const { prisma } = require('../../config/database');
const present = require('../../utils/present');
const language = require('../../utils/language');
const s3 = require('../../services/s3');
const settings = require('../../services/setting');
const { ok, created } = require('../../utils/respond');
const { notFound, paymentRequired } = require('../../utils/errors');
const { localDateString, toDateColumn, shiftDays } = require('../../utils/date');
const { SETTING_KEYS, SLOKA_ELIGIBLE_BOOK_NUMBERS, CACHE } = require('../../config/constants');
const { redis } = require('../../config/redis');

// How far back to look when avoiding repeats. Long enough that a sloka does not
// come round again while it is still familiar, short enough that a small
// curated pool does not run dry.
const REPEAT_WINDOW_DAYS = 45;

async function recentVerseIds(userId) {
  if (!userId) return [];
  const since = toDateColumn(shiftDays(localDateString('UTC'), -REPEAT_WINDOW_DAYS));
  const rows = await prisma.userDailySloka.findMany({
    where: { userId, date: { gte: since } },
    select: { verseId: true },
  });
  return rows.map((row) => row.verseId);
}

/**
 * Picks a verse for an issue.
 *
 * `VerseIssue.weight` says how directly a verse speaks to a struggle. Taking
 * the single highest-weighted verse every time would hand the same person the
 * same sloka whenever they report the same thing, so the top band is taken and
 * one is chosen from it at random — varied, but never off-topic.
 */
async function pickVerseForIssue(issueId, excludeVerseIds) {
  const candidates = await prisma.verseIssue.findMany({
    where: {
      issueId,
      verseId: { notIn: excludeVerseIds },
      verse: {
        isSlokaEligible: true,
        bookNumber: { in: SLOKA_ELIGIBLE_BOOK_NUMBERS },
        book: { isPublished: true },
      },
    },
    orderBy: { weight: 'desc' },
    take: 25,
    select: { verseId: true, weight: true },
  });

  if (!candidates.length) return null;

  // Only the top band competes: everything within 20% of the best weight.
  const best = candidates[0].weight;
  const band = candidates.filter((row) => row.weight >= best * 0.8);
  return band[Math.floor(Math.random() * band.length)].verseId;
}

/**
 * Any eligible verse — the fallback when an issue has no verses mapped to it.
 *
 * Called twice in the chain below: once respecting the repeat window, and once
 * ignoring it. Repeating a verse someone saw last month is a far better outcome
 * than an error page, and a young pool would otherwise run dry and start
 * failing exactly when the app has the fewest verses to offer.
 */
async function pickAnyEligibleVerse(excludeVerseIds) {
  const total = await prisma.verse.count({
    where: {
      isSlokaEligible: true,
      bookNumber: { in: SLOKA_ELIGIBLE_BOOK_NUMBERS },
      id: { notIn: excludeVerseIds },
    },
  });
  if (!total) return null;

  const verse = await prisma.verse.findFirst({
    where: {
      isSlokaEligible: true,
      bookNumber: { in: SLOKA_ELIGIBLE_BOOK_NUMBERS },
      id: { notIn: excludeVerseIds },
    },
    skip: Math.floor(Math.random() * total),
    select: { id: true },
  });
  return verse?.id || null;
}

/**
 * GET /api/app/sloka/today
 * The global sloka. Public and free — the same verse for everyone, cached
 * because every user asks for it within the same few hours.
 */
exports.today = async (req, res) => {
  const user = req.auth.user;
  const date = req.valid.query.date || localDateString(user?.timezone || 'Asia/Kolkata');

  const cacheKey = CACHE.dailySloka(date);
  const readingChain = language.readingChain(user);

  // Only the verse id is cached, not the shaped response — the shaping depends
  // on the reader's language, so a cached body would serve one reader's
  // language to everyone.
  let verseId = await redis.get(cacheKey).catch(() => null);
  let daily = null;

  if (!verseId) {
    daily = await prisma.dailySloka.findUnique({
      where: { date: toDateColumn(date) },
      select: { id: true, verseId: true, imagePath: true, source: true, isPublished: true },
    });
    if (!daily || !daily.isPublished) throw notFound('Sloka for that date');
    verseId = daily.verseId;
    await redis.set(cacheKey, verseId, 'EX', CACHE.dailySlokaTtl).catch(() => null);
  }

  const [verse, meta] = await Promise.all([
    prisma.verse.findUnique({ where: { id: verseId }, include: present.includes.verse(readingChain) }),
    daily
      ? Promise.resolve(daily)
      : prisma.dailySloka.findUnique({
          where: { date: toDateColumn(date) },
          select: { id: true, imagePath: true, source: true },
        }),
  ]);

  return ok(res, {
    date,
    imageUrl: meta?.imagePath ? await s3.presignGet(meta.imagePath) : null,
    verse: await present.verse(verse, user),
  });
};

/**
 * GET /api/app/sloka/mine
 * The user's own sloka for today, written by the nightly job. Created on the
 * spot if the job has not reached them — a new account should not see an empty
 * screen until tomorrow.
 */
exports.mine = async (req, res) => {
  const user = req.auth.user;
  const date = req.valid.query.date || localDateString(user.timezone);
  const readingChain = language.readingChain(user);

  let row = await prisma.userDailySloka.findUnique({
    where: { userId_date: { userId: user.id, date: toDateColumn(date) } },
    include: {
      verse: { include: present.includes.verse(readingChain) },
      issue: { select: { id: true, slug: true, name: true, category: true } },
    },
  });

  if (!row) {
    const exclude = await recentVerseIds(user.id);

    // Choosing by what someone reported struggling with is the paid feature.
    // A free reader gets a verse from the eligible pool — a good verse, chosen
    // for nobody in particular. Without this line the paywall would have a door
    // straight through it: report a struggle to the free endpoint, then read
    // this one tomorrow.
    const lastIssue = user.isPremium
      ? await prisma.userIssue.findFirst({
          where: { userId: user.id },
          orderBy: { reportedAt: 'desc' },
          select: { issueId: true },
        })
      : null;

    const verseId =
      (lastIssue ? await pickVerseForIssue(lastIssue.issueId, exclude) : null) ||
      (await pickAnyEligibleVerse(exclude)) ||
      // Last resort: allow a repeat rather than showing nothing.
      (await pickAnyEligibleVerse([]));

    if (!verseId) throw notFound('An eligible sloka — none are marked eligible yet');

    row = await prisma.userDailySloka.create({
      data: {
        userId: user.id,
        date: toDateColumn(date),
        verseId,
        source: 'RULE',
        issueId: lastIssue?.issueId || null,
        seenAt: new Date(),
      },
      include: {
        verse: { include: present.includes.verse(readingChain) },
        issue: { select: { id: true, slug: true, name: true, category: true } },
      },
    });
  }

  return ok(res, {
    id: row.id,
    date,
    source: row.source,
    // "Because you mentioned krodha" — the app shows this, so the pick never
    // looks arbitrary.
    reason: row.reason,
    issue: row.issue,
    seenAt: row.seenAt,
    verse: await present.verse(row.verse, user),
  });
};

/**
 * POST /api/app/sloka/mood
 *
 * The Premium feature: report what is weighing on you and get a sloka chosen
 * for it. Everything else in the app is free — this is the one thing that is
 * not, because it is the one thing with a per-user cost behind it.
 *
 * A free monthly quota is allowed through first. Gating it completely would
 * mean most people never see the thing that makes the app worth paying for.
 */
exports.mood = async (req, res) => {
  const user = req.auth.user;
  const { issueSlug, intensity, note } = req.valid.body;
  const date = localDateString(user.timezone);

  const issue = await prisma.issue.findFirst({ where: { slug: issueSlug, isPublished: true } });
  if (!issue) throw notFound('Issue');

  if (!user.isPremium) {
    // The quota counts *days*, not requests: there is one personal sloka per
    // person per date, so reporting a second struggle on the same day replaces
    // the pick rather than spending another day of the allowance. Someone
    // working out what is really bothering them should not be charged for
    // changing their mind.
    const quota = await settings.getNumber(SETTING_KEYS.FREE_MOOD_SLOKA_QUOTA, 3);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const usedToday = await prisma.userDailySloka.findUnique({
      where: { userId_date: { userId: user.id, date: toDateColumn(date) } },
      select: { issueId: true },
    });

    if (!usedToday?.issueId) {
      const daysUsed = await prisma.userDailySloka.count({
        where: { userId: user.id, issueId: { not: null }, createdAt: { gte: monthStart } },
      });

      if (daysUsed >= quota) {
        throw paymentRequired(
          `You have used your ${quota} free mood slokas this month. Premium removes the limit.`
        );
      }
    }
  }

  // Append-only: the report needs to show which struggle recurs and whether it
  // eases, and a current-mood column could not answer that.
  const report = await prisma.userIssue.create({
    data: { userId: user.id, issueId: issue.id, intensity: intensity || null, note: note || null },
  });

  const exclude = await recentVerseIds(user.id);
  const verseId =
    (await pickVerseForIssue(issue.id, exclude)) ||
    (await pickAnyEligibleVerse(exclude)) ||
    // A repeat beats an error. Someone who has just told the app they are
    // struggling should never be answered with "nothing found".
    (await pickVerseForIssue(issue.id, [])) ||
    (await pickAnyEligibleVerse([]));
  if (!verseId) throw notFound('A sloka for that — none are mapped to it yet');

  const readingChain = language.readingChain(user);

  // One personal sloka per user per date is a database constraint, so a second
  // report on the same day replaces the pick rather than failing.
  const row = await prisma.userDailySloka.upsert({
    where: { userId_date: { userId: user.id, date: toDateColumn(date) } },
    update: { verseId, issueId: issue.id, source: 'RULE', reason: `Because you mentioned ${issue.name.toLowerCase()}`, seenAt: new Date() },
    create: {
      userId: user.id,
      date: toDateColumn(date),
      verseId,
      issueId: issue.id,
      source: 'RULE',
      reason: `Because you mentioned ${issue.name.toLowerCase()}`,
      seenAt: new Date(),
    },
    include: { verse: { include: present.includes.verse(readingChain) } },
  });

  return created(res, {
    id: row.id,
    date,
    reason: row.reason,
    issue: { id: issue.id, slug: issue.slug, name: issue.name, category: issue.category },
    reportId: report.id,
    verse: await present.verse(row.verse, user),
  });
};

/** POST /api/app/sloka/:id/seen — marks a personal sloka as read. */
exports.markSeen = async (req, res) => {
  const updated = await prisma.userDailySloka.updateMany({
    where: { id: req.valid.params.id, userId: req.auth.user.id, seenAt: null },
    data: { seenAt: new Date() },
  });
  return ok(res, { updated: updated.count > 0 });
};

/** GET /api/app/sloka/history — the slokas this user has been given. */
exports.history = async (req, res) => {
  const user = req.auth.user;
  const readingChain = language.readingChain(user);

  const rows = await prisma.userDailySloka.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
    take: 60,
    include: {
      verse: { include: present.includes.verse(readingChain) },
      issue: { select: { slug: true, name: true } },
    },
  });

  return ok(
    res,
    await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        date: row.date.toISOString().slice(0, 10),
        reason: row.reason,
        issue: row.issue,
        seenAt: row.seenAt,
        verse: await present.verse(row.verse, user),
      }))
    )
  );
};

module.exports.pickVerseForIssue = pickVerseForIssue;
module.exports.pickAnyEligibleVerse = pickAnyEligibleVerse;
module.exports.recentVerseIds = recentVerseIds;
