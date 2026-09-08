// The weekly learning pass.
//
// Rebuilds UserPreferenceProfile from what each user actually did: what they
// reported struggling with, which slokas they opened, when they opened them,
// how consistently they chanted.
//
// Everything it writes is derived. Nothing here is a source of truth, so the
// table can be wiped and regenerated whenever the scoring changes — which is
// the point of keeping it separate rather than folding these numbers onto User.
//
// No AI. This is arithmetic over rows we already have.

const { prisma } = require('../../config/database');
const logger = require('../../config/logger');
const { localDateString, toDateColumn, shiftDays, localHour } = require('../../utils/date');

// Eight weeks: long enough that one bad week does not redefine someone, short
// enough that it still reflects where they are now.
const WINDOW_DAYS = 56;
const BATCH_SIZE = 200;

// More recent reports count for more. A struggle from seven weeks ago is real
// history but a poor guide to what someone needs this morning.
function recencyWeight(reportedAt, windowStart) {
  const age = Date.now() - reportedAt.getTime();
  const span = Date.now() - windowStart.getTime();
  return Math.max(0.2, 1 - age / span);
}

function normalise(scores) {
  const max = Math.max(...Object.values(scores), 0);
  if (!max) return {};
  return Object.fromEntries(
    Object.entries(scores).map(([key, value]) => [key, Number((value / max).toFixed(3))])
  );
}

async function rebuildFor(user, windowStart, windowEnd) {
  const since = toDateColumn(windowStart);

  const [issues, days, seenSlokas, favourites] = await Promise.all([
    prisma.userIssue.findMany({
      where: { userId: user.id, reportedAt: { gte: since } },
      include: { issue: { select: { slug: true } } },
    }),
    prisma.sadhanaDay.findMany({
      where: { userId: user.id, date: { gte: since } },
      select: { roundTarget: true, roundsCompleted: true },
    }),
    prisma.userDailySloka.findMany({
      where: { userId: user.id, seenAt: { not: null }, date: { gte: since } },
      select: { seenAt: true, verse: { select: { bookNumber: true, tags: true } } },
    }),
    prisma.favorite.findMany({
      where: { userId: user.id, verseId: { not: null } },
      select: { verse: { select: { tags: true, bookNumber: true } } },
      take: 100,
    }),
  ]);

  // What they say troubles them, weighted by how strongly and how recently.
  const issueScores = {};
  for (const report of issues) {
    const weight = recencyWeight(report.reportedAt, new Date(windowStart));
    const intensity = (report.intensity || 3) / 3;
    issueScores[report.issue.slug] = (issueScores[report.issue.slug] || 0) + weight * intensity;
  }

  // What they actually read and keep — a better signal than what they say,
  // which is why both are kept rather than one standing in for the other.
  const topicScores = {};
  for (const row of [...seenSlokas, ...favourites]) {
    for (const tag of row.verse?.tags || []) {
      topicScores[tag] = (topicScores[tag] || 0) + 1;
    }
  }

  const bookCounts = {};
  for (const row of [...seenSlokas, ...favourites]) {
    const book = row.verse?.bookNumber;
    if (book) bookCounts[book] = (bookCounts[book] || 0) + 1;
  }
  const preferredBookNumber =
    Object.keys(bookCounts).length > 0
      ? Number(Object.entries(bookCounts).sort((a, b) => b[1] - a[1])[0][0])
      : null;

  // When they actually open a sloka, in their own timezone. This is what the
  // delivery job uses instead of sending everyone theirs at the same hour.
  const hourCounts = {};
  for (const row of seenSlokas) {
    const hour = localHour(user.timezone, row.seenAt);
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }
  const bestDeliveryHour =
    Object.keys(hourCounts).length >= 3
      ? Number(Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0][0])
      : null;

  const chantedDays = days.filter((day) => day.roundsCompleted > 0).length;
  const metTarget = days.filter(
    (day) => day.roundTarget > 0 && day.roundsCompleted >= day.roundTarget
  ).length;
  const totalRounds = days.reduce((sum, day) => sum + day.roundsCompleted, 0);

  return prisma.userPreferenceProfile.upsert({
    where: { userId: user.id },
    update: {
      issueScores: normalise(issueScores),
      topicScores: normalise(topicScores),
      preferredBookNumber,
      bestDeliveryHour,
      avgRoundsPerDay: chantedDays ? Number((totalRounds / WINDOW_DAYS).toFixed(2)) : 0,
      chantConsistency: Number((metTarget / WINDOW_DAYS).toFixed(3)),
      windowStart: toDateColumn(windowStart),
      windowEnd: toDateColumn(windowEnd),
      computedAt: new Date(),
    },
    create: {
      userId: user.id,
      issueScores: normalise(issueScores),
      topicScores: normalise(topicScores),
      preferredBookNumber,
      bestDeliveryHour,
      avgRoundsPerDay: chantedDays ? Number((totalRounds / WINDOW_DAYS).toFixed(2)) : 0,
      chantConsistency: Number((metTarget / WINDOW_DAYS).toFixed(3)),
      windowStart: toDateColumn(windowStart),
      windowEnd: toDateColumn(windowEnd),
    },
  });
}

module.exports = async function preferencesProcessor(job) {
  const windowEnd = localDateString('UTC');
  const windowStart = shiftDays(windowEnd, -WINDOW_DAYS);

  let cursor = null;
  let rebuilt = 0;

  for (;;) {
    const users = await prisma.user.findMany({
      // Only people with something to learn from. Rebuilding an empty profile
      // for a dormant account is work that changes nothing.
      where: {
        isBanned: false,
        lastActiveAt: { gte: new Date(Date.now() - WINDOW_DAYS * 86400000) },
      },
      select: { id: true, timezone: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!users.length) break;
    cursor = users[users.length - 1].id;

    for (const user of users) {
      try {
        await rebuildFor(user, windowStart, windowEnd);
        rebuilt += 1;
      } catch (err) {
        // One bad profile must not stop the pass for everyone else.
        logger.error({ err: err.message, userId: user.id }, 'preference rebuild failed');
      }
    }

    await job.updateProgress({ rebuilt });
  }

  logger.info({ rebuilt, windowStart, windowEnd }, 'preference profiles rebuilt');
  return { rebuilt };
};

module.exports.rebuildFor = rebuildFor;
