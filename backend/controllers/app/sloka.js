// Sloka for You.
//
// Two things share this file because they are the same object seen twice:
//
//   the global sloka   one per date, the same for everyone, curated or picked
//                      by the nightly job. Public — it is the thing someone
//                      sees before they have an account.
//   a personal sloka   chosen for one user from what they have said they are
//                      struggling with.
//
// Slokas are drawn only from the Bhagavad Gita and the Srimad Bhagavatam, and
// only from verses an editor has opted in with `isSlokaEligible`. A short work
// is never used as a daily sloka.
//
// No AI runs here. The verse→issue mapping in VerseIssue was written by a batch
// job ahead of time, so answering "I am struggling with krodha" is a weighted
// indexed query, not a model call. That is what keeps the cost of this feature
// bounded by the size of the corpus rather than by the number of users.

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import * as language from '../../utils/language.js';
import * as s3 from '../../services/s3.js';
import { ok, created } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';
import { localDateString, toDateColumn, shiftDays } from '../../utils/date.js';
import { SLOKA_ELIGIBLE_BOOK_NUMBERS, CACHE } from '../../config/constants.js';
import { redis } from '../../config/redis.js';

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
export const today = async (req, res) => {
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
export const mine = async (req, res) => {
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

    const lastIssue = await prisma.userIssue.findFirst({
      where: { userId: user.id },
      orderBy: { reportedAt: 'desc' },
      select: { issueId: true },
    });

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

/** "Because you mentioned krodha" — the app shows this, so the pick never looks arbitrary. */
function moodReason(issue) {
  return `Because you mentioned ${issue.name.toLowerCase()}`;
}

/**
 * POST /api/app/sloka/mood
 *
 * Report what is weighing on you and get a sloka chosen for it.
 */
export const mood = async (req, res) => {
  const user = req.auth.user;
  const { issueSlug, intensity, note } = req.valid.body;
  const date = localDateString(user.timezone);

  const issue = await prisma.issue.findFirst({ where: { slug: issueSlug, isPublished: true } });
  if (!issue) throw notFound('Issue');

  const exclude = await recentVerseIds(user.id);
  const verseId =
    (await pickVerseForIssue(issue.id, exclude)) ||
    (await pickAnyEligibleVerse(exclude)) ||
    // A repeat beats an error. Someone who has just told the app they are
    // struggling should never be answered with "nothing found".
    (await pickVerseForIssue(issue.id, [])) ||
    (await pickAnyEligibleVerse([]));
  if (!verseId) throw notFound('A sloka for that — none are mapped to it yet');

  const reason = moodReason(issue);

  // Append-only: the report needs to show which struggle recurs and whether it
  // eases, and a current-mood column could not answer that. `date` is what
  // lets the dashboard later ask "has this been answered today" without
  // redoing this same timezone math. `verseId` is stored here too — see GET
  // /sloka/mood/today — so a vikara answered earlier today can still be
  // reopened and read again after a later one replaces it below.
  const report = await prisma.userIssue.create({
    data: {
      userId: user.id,
      issueId: issue.id,
      intensity: intensity || null,
      note: note || null,
      date: toDateColumn(date),
      verseId,
    },
  });

  const readingChain = language.readingChain(user);

  // One personal sloka per user per date is a database constraint, so a second
  // report on the same day replaces the pick rather than failing.
  const row = await prisma.userDailySloka.upsert({
    where: { userId_date: { userId: user.id, date: toDateColumn(date) } },
    update: { verseId, issueId: issue.id, source: 'RULE', reason, seenAt: new Date() },
    create: {
      userId: user.id,
      date: toDateColumn(date),
      verseId,
      issueId: issue.id,
      source: 'RULE',
      reason,
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

/**
 * GET /api/app/sloka/mood/today
 *
 * Every struggle reported today, each with the verse it was answered with.
 * `UserDailySloka` keeps only one row per day, so the dashboard's "for you"
 * card only ever shows the last of these — this is what lets an earlier one
 * be reopened and read again, as many times as wanted.
 */
export const moodToday = async (req, res) => {
  const user = req.auth.user;
  const date = req.valid.query.date || localDateString(user.timezone);
  const readingChain = language.readingChain(user);

  const rows = await prisma.userIssue.findMany({
    where: { userId: user.id, date: toDateColumn(date), verseId: { not: null } },
    orderBy: { reportedAt: 'desc' },
    include: {
      issue: { select: { id: true, slug: true, name: true, category: true } },
      verse: { include: present.includes.verse(readingChain) },
    },
  });

  return ok(
    res,
    await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        reason: moodReason(row.issue),
        issue: row.issue,
        verse: await present.verse(row.verse, user),
      }))
    )
  );
};

/** POST /api/app/sloka/:id/seen — marks a personal sloka as read. */
export const markSeen = async (req, res) => {
  const updated = await prisma.userDailySloka.updateMany({
    where: { id: req.valid.params.id, userId: req.auth.user.id, seenAt: null },
    data: { seenAt: new Date() },
  });
  return ok(res, { updated: updated.count > 0 });
};

/** GET /api/app/sloka/history — the slokas this user has been given. */
export const history = async (req, res) => {
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

// Shared with the nightly sloka job, which picks the same way this does.
export { pickVerseForIssue, pickAnyEligibleVerse, recentVerseIds };
