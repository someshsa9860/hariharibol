// Sadhana — the daily practice record.
//
// Everything hangs off SadhanaDay: one row per user per calendar date, in the
// *user's* timezone, not the server's. A user in Toronto starting their morning
// is on a different date from a server in Mumbai, and getting that wrong shows
// up as a missing day in someone's practice history.
//
// Rounds arrive two ways and both land in ChantSession: counted bead by bead in
// the app, or entered afterwards by someone who chanted on physical beads. They
// share a table so a total never has to be assembled from two places.
//
// The count columns on SadhanaDay are rollups of the child rows. They exist so
// a year of history can be charted without aggregating sessions and tasks every
// time, and `recountDay` is the only thing allowed to write them.

import { prisma } from '../../config/database.js';
import { ok, created } from '../../utils/respond.js';
import { notFound, badRequest, forbidden } from '../../utils/errors.js';
import { localDateString, toDateColumn, shiftDays, dateRange, isValidDateString } from '../../utils/date.js';
import { BEADS_PER_ROUND, DEFAULT_ROUND_TARGET } from '../../config/constants.js';
import * as websocket from '../../services/websocket.js';

/**
 * The day row for a user's local date, created on first touch.
 *
 * Exported because controllers/app/task.js needs exactly this and nothing else
 * — a shared helper between two controllers, not a service layer around them.
 */
async function ensureDay(user, dateString) {
  const date = dateString || localDateString(user.timezone);
  if (!isValidDateString(date)) throw badRequest('Expected a date as YYYY-MM-DD');

  const existing = await prisma.sadhanaDay.findUnique({
    where: { userId_date: { userId: user.id, date: toDateColumn(date) } },
  });
  if (existing) return existing;

  // A new day starts at the standing target, so the common case needs no input.
  const profile = await prisma.sadhanaProfile.findUnique({ where: { userId: user.id } });

  return prisma.sadhanaDay.create({
    data: {
      userId: user.id,
      date: toDateColumn(date),
      roundTarget: profile?.dailyRoundTarget ?? DEFAULT_ROUND_TARGET,
    },
  });
}

/** Recomputes a day's rollups from its children. The only writer of those columns. */
async function recountDay(sadhanaDayId) {
  const [rounds, tasksTotal, tasksDone] = await Promise.all([
    prisma.chantSession.aggregate({ where: { sadhanaDayId }, _sum: { rounds: true } }),
    // A task moved to another day was still planned here, so it stays in the
    // total; it simply was not finished.
    prisma.sadhanaTask.count({ where: { sadhanaDayId } }),
    prisma.sadhanaTask.count({ where: { sadhanaDayId, status: 'DONE' } }),
  ]);

  return prisma.sadhanaDay.update({
    where: { id: sadhanaDayId },
    data: { roundsCompleted: rounds._sum.rounds || 0, tasksTotal, tasksDone },
  });
}

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

/**
 * GET /api/app/sadhana/today
 * The whole practice screen in one call: the day, its tasks, its sessions, the
 * standing target and the current streak.
 */
export const today = async (req, res) => {
  const user = req.auth.user;
  const date = req.valid.query.date || localDateString(user.timezone);
  const day = await ensureDay(user, date);

  const [tasks, sessions, profile, streak] = await Promise.all([
    prisma.sadhanaTask.findMany({
      where: { sadhanaDayId: day.id },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.chantSession.findMany({
      where: { sadhanaDayId: day.id },
      orderBy: { startedAt: 'desc' },
      include: { mantra: { select: { id: true, slug: true, name: true } } },
    }),
    prisma.sadhanaProfile.findUnique({ where: { userId: user.id } }),
    currentStreak(user.id, user.timezone),
  ]);

  return ok(res, {
    date,
    day: {
      id: day.id,
      roundTarget: day.roundTarget,
      roundsCompleted: day.roundsCompleted,
      tasksTotal: day.tasksTotal,
      tasksDone: day.tasksDone,
      note: day.note,
    },
    tasks,
    sessions,
    profile,
    streak,
    beadsPerRound: BEADS_PER_ROUND,
  });
};

/** PATCH /api/app/sadhana/today — today's target and note, without touching the standing one. */
export const updateDay = async (req, res) => {
  const user = req.auth.user;
  const { date, roundTarget, note } = req.valid.body;
  const day = await ensureDay(user, date);

  const updated = await prisma.sadhanaDay.update({
    where: { id: day.id },
    data: { roundTarget, note },
  });

  return ok(res, updated);
};

/**
 * POST /api/app/sadhana/chant/manual
 * Rounds chanted on physical beads, entered afterwards. The common case for
 * anyone who does not want a phone in their hand while chanting.
 */
export const logManualRounds = async (req, res) => {
  const user = req.auth.user;
  const { date, rounds, mantraId, durationSeconds } = req.valid.body;
  const day = await ensureDay(user, date);

  const session = await prisma.chantSession.create({
    data: {
      userId: user.id,
      sadhanaDayId: day.id,
      mantraId: mantraId || null,
      source: 'MANUAL',
      rounds,
      durationSeconds: durationSeconds || null,
      endedAt: new Date(),
    },
  });

  const updated = await recountDay(day.id);
  websocket.toUser(user.id, websocket.EVENTS.CHANT_PROGRESS, {
    date: updated.date,
    roundsCompleted: updated.roundsCompleted,
    roundTarget: updated.roundTarget,
  });

  return created(res, { session, day: updated });
};

/**
 * POST /api/app/sadhana/chant/session
 * Opens a live in-app session. Progress is written as it goes rather than only
 * at the end, so closing the app mid-round does not lose the count.
 */
export const startSession = async (req, res) => {
  const user = req.auth.user;
  const { mantraId } = req.valid.body;
  const day = await ensureDay(user);

  const session = await prisma.chantSession.create({
    data: {
      userId: user.id,
      sadhanaDayId: day.id,
      mantraId: mantraId || null,
      source: 'IN_APP',
      startedAt: new Date(),
    },
  });

  return created(res, session);
};

/**
 * PATCH /api/app/sadhana/chant/session/:id
 * Bead and round progress, and the close. Counts only ever move forward — a
 * dropped request that arrives late must not roll the total backwards.
 */
export const updateSession = async (req, res) => {
  const user = req.auth.user;
  const { id } = req.valid.params;
  const { rounds, beads, finish } = req.valid.body;

  const session = await prisma.chantSession.findUnique({ where: { id } });
  if (!session) throw notFound('Session');
  if (session.userId !== user.id) throw forbidden('That is not your session');
  if (session.endedAt) throw badRequest('That session is already finished');

  const data = {};
  if (rounds !== undefined) data.rounds = Math.max(session.rounds, rounds);
  if (beads !== undefined) data.beads = Math.max(session.beads, beads);

  if (finish) {
    data.endedAt = new Date();
    data.durationSeconds = Math.round((Date.now() - session.startedAt.getTime()) / 1000);
  }

  const updated = await prisma.chantSession.update({ where: { id }, data });
  const day = await recountDay(session.sadhanaDayId);

  websocket.toUser(user.id, websocket.EVENTS.CHANT_PROGRESS, {
    date: day.date,
    roundsCompleted: day.roundsCompleted,
    roundTarget: day.roundTarget,
  });

  return ok(res, { session: updated, day });
};

/** GET /api/app/sadhana/days — history for a date range, for the calendar view. */
export const days = async (req, res) => {
  const user = req.auth.user;
  const to = req.valid.query.to || localDateString(user.timezone);
  const from = req.valid.query.from || shiftDays(to, -30);

  const days = await prisma.sadhanaDay.findMany({
    where: { userId: user.id, date: { gte: toDateColumn(from), lte: toDateColumn(to) } },
    orderBy: { date: 'asc' },
  });

  return ok(res, { from, to, days });
};

/**
 * GET /api/app/sadhana/report
 * The productivity report. Every day in the window is returned, including the
 * empty ones — a chart with gaps silently closed over is a chart that lies
 * about consistency.
 */
export const report = async (req, res) => {
  const user = req.auth.user;
  const to = req.valid.query.to || localDateString(user.timezone);
  const from = req.valid.query.from || shiftDays(to, -29);

  const range = { gte: toDateColumn(from), lte: toDateColumn(to) };

  const [days, issues, streak, sessionSplit] = await Promise.all([
    prisma.sadhanaDay.findMany({ where: { userId: user.id, date: range }, orderBy: { date: 'asc' } }),
    prisma.userIssue.groupBy({
      by: ['issueId'],
      where: { userId: user.id, reportedAt: { gte: toDateColumn(from) } },
      _count: { _all: true },
      orderBy: { _count: { issueId: 'desc' } },
      take: 6,
    }),
    currentStreak(user.id, user.timezone),
    prisma.chantSession.groupBy({
      by: ['source'],
      where: { userId: user.id, day: { date: range } },
      _sum: { rounds: true },
    }),
  ]);

  const byDate = new Map(days.map((d) => [d.date.toISOString().slice(0, 10), d]));

  const series = dateRange(from, to).map((date) => {
    const day = byDate.get(date);
    return {
      date,
      roundTarget: day?.roundTarget ?? 0,
      roundsCompleted: day?.roundsCompleted ?? 0,
      tasksTotal: day?.tasksTotal ?? 0,
      tasksDone: day?.tasksDone ?? 0,
      metTarget: Boolean(day && day.roundTarget > 0 && day.roundsCompleted >= day.roundTarget),
    };
  });

  const totals = series.reduce(
    (acc, day) => ({
      rounds: acc.rounds + day.roundsCompleted,
      target: acc.target + day.roundTarget,
      tasks: acc.tasks + day.tasksTotal,
      tasksDone: acc.tasksDone + day.tasksDone,
      daysChanted: acc.daysChanted + (day.roundsCompleted > 0 ? 1 : 0),
      daysMetTarget: acc.daysMetTarget + (day.metTarget ? 1 : 0),
    }),
    { rounds: 0, target: 0, tasks: 0, tasksDone: 0, daysChanted: 0, daysMetTarget: 0 }
  );

  const issueDetails = await prisma.issue.findMany({
    where: { id: { in: issues.map((i) => i.issueId) } },
    select: { id: true, slug: true, name: true, category: true },
  });
  const issuesById = new Map(issueDetails.map((i) => [i.id, i]));

  return ok(res, {
    from,
    to,
    streak,
    series,
    totals: {
      ...totals,
      // Consistency, not volume — the fraction of days the target was actually
      // met, which is the number that tracks whether a practice is holding.
      consistency: series.length ? Number((totals.daysMetTarget / series.length).toFixed(2)) : 0,
      avgRoundsPerDay: series.length ? Number((totals.rounds / series.length).toFixed(1)) : 0,
    },
    roundsBySource: sessionSplit.map((row) => ({ source: row.source, rounds: row._sum.rounds || 0 })),
    // What the user has been reporting, most frequent first. This is also what
    // feeds the personalised sloka.
    topIssues: issues.map((row) => ({
      ...issuesById.get(row.issueId),
      count: row._count._all,
    })),
  });
};

// Shared with the task controller and the home screen — a helper between
// two controllers, not a service layer around them.
export { ensureDay, recountDay, currentStreak };
