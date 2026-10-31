// What the support desk and the store-rating prompt both need to know.

import { prisma } from '../config/database.js';
import { localDateString, shiftDays, toDateColumn } from '../utils/date.js';

// `suggestion` is what quick feedback is filed under; `feature` and `translation` are asked for in a ticket
// (`translation` carries a book and a language in `SupportTicket.details`).
export const CATEGORIES = ['bug', 'payment', 'account', 'content', 'feature', 'translation', 'suggestion', 'other'];

// A reader is asked for a store rating at most this often, and not at all for a while after they wrote in.
export const PROMPT_GAP_DAYS = 90;
export const AFTER_WRITING_IN_DAYS = 60;
// Consecutive days with at least one round chanted before the streak counts as a happy moment.
export const STREAK_DAYS = 7;
// An unhappy rating (or ticket) this recent or lower keeps the prompt away.
export const UNHAPPY_RATING = 3;

/** Consecutive days, ending today or yesterday, on which the reader completed a round. */
export async function chantStreak(user) {
  const today = localDateString(user.timezone || 'Asia/Kolkata');
  const from = toDateColumn(shiftDays(today, -60));
  const days = await prisma.sadhanaDay.findMany({
    where: { userId: user.id, date: { gte: from }, roundsCompleted: { gt: 0 } },
    select: { date: true },
  });
  const done = new Set(days.map((d) => d.date.toISOString().slice(0, 10)));
  // Today may not be chanted yet; the streak still stands from yesterday.
  let cursor = done.has(today) ? today : shiftDays(today, -1);
  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = shiftDays(cursor, -1);
  }
  return streak;
}

/**
 * Whether to ask this reader for a store rating now.
 * `{ ask, reason }` — the reason is for logs and tests, never shown.
 */
export async function reviewCheck(user, trigger, now = new Date()) {
  const day = 24 * 60 * 60 * 1000;
  const [lastPrompt, recentWriting, recentUnhappy] = await Promise.all([
    prisma.reviewPrompt.findFirst({
      where: { userId: user.id, outcome: { in: ['SHOWN', 'LIKED', 'UNHAPPY'] } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.supportTicket.findFirst({
      where: { userId: user.id, createdAt: { gte: new Date(now.getTime() - AFTER_WRITING_IN_DAYS * day) } },
      select: { id: true },
    }),
    prisma.supportTicket.findFirst({
      where: { userId: user.id, rating: { lte: UNHAPPY_RATING, not: null } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  if (lastPrompt && now - lastPrompt.createdAt < PROMPT_GAP_DAYS * day) return { ask: false, reason: 'recently_asked' };
  if (recentWriting) return { ask: false, reason: 'recently_wrote_in' };
  if (recentUnhappy && now - recentUnhappy.createdAt < 180 * day) return { ask: false, reason: 'unhappy_feedback' };

  if (trigger === 'streak') {
    const streak = await chantStreak(user);
    if (streak < STREAK_DAYS) return { ask: false, reason: 'streak_too_short', streak };
    return { ask: true, reason: 'streak', streak };
  }
  // 'session' — the reader just finished a chanting session; only ask once they have shown some staying power.
  const rounds = await prisma.sadhanaDay.count({ where: { userId: user.id, roundsCompleted: { gt: 0 } } });
  if (rounds < 5) return { ask: false, reason: 'too_new' };
  return { ask: true, reason: 'session' };
}
