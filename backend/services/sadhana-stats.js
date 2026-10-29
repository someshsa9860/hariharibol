// What a reader's practice looks like, read from the sadhana rows: the streak and the mantra they keep coming back to.
// Shared by the Sadhana screens (controllers/app/sadhana.js, home.js) and by marketing, which writes to each reader
// from the same numbers (services/marketing-context.js).

import { prisma } from '../config/database.js';
import { localDateString, shiftDays } from '../utils/date.js';
import { visibleTo } from '../utils/mantra-visibility.js';

/**
 * Consecutive days ending today (or yesterday, if today has not been chanted
 * yet) with at least one round. Counted from the most recent day backwards and
 * stopping at the first gap, so it reads at most a couple of hundred rows even
 * for a user with years of history.
 */
async function currentStreak(userId, timezone) {
  const days = await prisma.sadhanaDay.findMany({
    where: { userId, roundsCompleted: { gt: 0 } },
    orderBy: { date: 'desc' },
    take: 400,
    select: { date: true },
  });
  if (!days.length) return 0;

  const chanted = new Set(days.map((d) => d.date.toISOString().slice(0, 10)));
  const today = localDateString(timezone);

  // Not having chanted *yet today* must not read as a broken streak — the day
  // is not over.
  let cursor = chanted.has(today) ? today : shiftDays(today, -1);
  let streak = 0;
  while (chanted.has(cursor)) {
    streak += 1;
    cursor = shiftDays(cursor, -1);
  }
  return streak;
}

// "Chant now" opens the mantra a person keeps coming back to. Looked at over the
// last stretch of days so it follows what they chant now, and rounds (not
// sessions) decide it so one long sitting outweighs a few taps.
const FAVOURITE_WINDOW_DAYS = 60;

async function favouriteMantra(user, mantraStub) {
  const since = new Date(Date.now() - FAVOURITE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const grouped = await prisma.chantSession.groupBy({
    by: ['mantraId'],
    where: { userId: user.id, mantraId: { not: null }, startedAt: { gte: since } },
    _sum: { rounds: true },
    _count: { _all: true },
  });
  const ranked = grouped
    .map((g) => ({ id: g.mantraId, rounds: g._sum.rounds || 0, sessions: g._count._all }))
    .sort((a, b) => b.rounds - a.rounds || b.sessions - a.sessions);

  // The top one may have been unpublished since (or be a private mantra the reader no longer holds); fall through to the next.
  for (const { id } of ranked.slice(0, 5)) {
    const mantra = await prisma.mantra.findFirst({ where: { id, AND: [visibleTo(user)] }, ...mantraStub });
    if (mantra) return mantra;
  }

  // Nothing chanted here lately. Someone carried over from the old app opens on the mantra they chanted most
  // there (POST /auth/legacy) until they have chanted one here, which then takes over.
  return prisma.mantra.findFirst({
    where: { isPublished: true, legacyFavoriteOf: { some: { userId: user.id } } },
    ...mantraStub,
  });
}

export { currentStreak, favouriteMantra, FAVOURITE_WINDOW_DAYS };
