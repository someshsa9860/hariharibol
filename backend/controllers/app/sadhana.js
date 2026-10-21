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

import * as referral from '../../services/referral.js';
import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { readPage } from '../../utils/pagination.js';
import * as present from '../../utils/present.js';
import * as language from '../../utils/language.js';
import { notFound, badRequest, forbidden } from '../../utils/errors.js';
import { localDateString, toDateColumn, shiftDays, dateRange, isValidDateString } from '../../utils/date.js';
import { BEADS_PER_ROUND, DEFAULT_ROUND_TARGET, CHANT_TRANSCRIPT_TTL_DAYS } from '../../config/constants.js';
import * as websocket from '../../services/websocket.js';
import * as sampradaya from '../../services/sampradaya.js';

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
 * Chanting a mantra on a new day can change which tradition someone is counted
 * in (services/sampradaya.js). It must never fail the request that saved the
 * chanting — the rounds are what the person came to keep — so a failure here is
 * logged and the old value stands until the next day's chanting.
 */
async function learnSampradaya(userId) {
  try {
    await sampradaya.refresh(userId);
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'sampradaya refresh failed');
  }
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

  // The top one may have been unpublished since; fall through to the next.
  for (const { id } of ranked.slice(0, 5)) {
    const mantra = await prisma.mantra.findFirst({ where: { id, isPublished: true }, ...mantraStub });
    if (mantra) return mantra;
  }

  // Nothing chanted here lately. Someone carried over from the old app opens on the mantra they chanted most
  // there (POST /auth/legacy) until they have chanted one here, which then takes over.
  return prisma.mantra.findFirst({
    where: { isPublished: true, legacyFavoriteOf: { some: { userId: user.id } } },
    ...mantraStub,
  });
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
  const mantraStub = present.includes.mantraStub(language.readingChain(user));

  const [tasks, sessions, profile, streak, favourite] = await Promise.all([
    prisma.sadhanaTask.findMany({
      where: { sadhanaDayId: day.id },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.chantSession.findMany({
      where: { sadhanaDayId: day.id },
      orderBy: { startedAt: 'desc' },
      include: { mantra: mantraStub },
    }),
    prisma.sadhanaProfile.findUnique({
      where: { userId: user.id },
      include: { preferredMantra: mantraStub },
    }),
    currentStreak(user.id, user.timezone),
    favouriteMantra(user, mantraStub),
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
    sessions: sessions.map((session) => ({ ...session, mantra: present.mantraStub(session.mantra, user) })),
    profile: profile && { ...profile, preferredMantra: present.mantraStub(profile.preferredMantra, user) },
    streak,
    favoriteMantra: present.mantraStub(favourite, user),
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

  // Rounds are at least 1 here, so this is always the day's chanting on it.
  if (session.mantraId) await learnSampradaya(user.id);

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

  // Only the first bead or round of a session can add a day to a tradition;
  // every PATCH after it is more of the same day, and this runs on each one.
  const firstProgress =
    session.rounds === 0 && session.beads === 0 && ((data.rounds ?? 0) > 0 || (data.beads ?? 0) > 0);
  if (session.mantraId && firstProgress) await learnSampradaya(user.id);

  return ok(res, { session: updated, day });
};

/** The caller's own session, or the right error. */
async function ownSession(id, user) {
  const session = await prisma.chantSession.findUnique({ where: { id } });
  if (!session) throw notFound('Session');
  if (session.userId !== user.id) throw forbidden('That is not your session');
  return session;
}

/**
 * PUT /api/app/sadhana/chant/session/:id/detail
 * The rounds of a sitting, one row each. The row is a summary — beads, span,
 * mean gap — and not the taps behind it: a tap each was most of what this table
 * held. A client that still sends taps (an older build) gets them stored and its
 * figures worked out from them, so a bug there cannot store a duration that
 * disagrees with the taps beside it; one that sends only the summary is trusted
 * for it, within the bounds the route checks.
 */
export const saveChantDetail = async (req, res) => {
  const user = req.auth.user;
  const { id } = req.valid.params;
  const { malas } = req.valid.body;
  const session = await ownSession(id, user);

  const rows = malas.map((mala) => {
    const taps = [...(mala.taps ?? [])].sort((a, b) => a.seq - b.seq);
    if (taps.length) return { index: mala.index, data: roundFromTaps(mala, taps) };

    const beads = mala.beads ?? 0;
    const data = {
      beads,
      startedAt: mala.startedAt != null ? new Date(mala.startedAt) : session.startedAt,
      endedAt: mala.endedAt != null ? new Date(mala.endedAt) : null,
      durationMs: mala.durationMs ?? 0,
      avgGapMs: mala.avgGapMs ?? 0,
      complete: Boolean(mala.complete) && beads >= BEADS_PER_ROUND,
      taps: [],
    };
    return { index: mala.index, data };
  });

  const saved = await prisma.$transaction(
    rows.map(({ index, data }) =>
      prisma.chantMala.upsert({
        where: { sessionId_index: { sessionId: id, index } },
        create: { sessionId: id, userId: user.id, index, ...data },
        update: data,
      })
    )
  );

  // A finished round may be the first thing a referred person does. Never lets
  // the referral's outcome change the answer to the phone.
  if (saved.some((m) => m.complete)) referral.evaluate(user.id).catch(() => {});

  return ok(res, { malas: saved });
};

/** A round's row worked out from its taps — what older builds send. */
function roundFromTaps(mala, taps) {
  const first = taps[0];
  const last = taps[taps.length - 1];
  // The first tap of a round has no span of its own; the gaps after it are
  // what a round's duration is made of.
  const gaps = taps.slice(1).map((tap) => tap.gapMs);
  return {
    beads: taps.length,
    startedAt: new Date(first.at),
    endedAt: new Date(last.at),
    durationMs: Math.max(0, last.at - first.at),
    avgGapMs: gaps.length ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : 0,
    complete: Boolean(mala.complete) && taps.length >= BEADS_PER_ROUND,
    taps,
  };
}

/**
 * POST /api/app/sadhana/chant/session/:id/transcripts
 * Short-lived — see ChantTapTranscript. `expiresAt` is stamped here so the
 * sweep is a single indexed delete.
 */
export const saveChantTranscripts = async (req, res) => {
  const user = req.auth.user;
  const { id } = req.valid.params;
  const { items } = req.valid.body;
  await ownSession(id, user);

  const expiresAt = new Date(Date.now() + CHANT_TRANSCRIPT_TTL_DAYS * 86400000);

  await prisma.$transaction(
    items.map((item) => {
      const data = {
        malaIndex: item.malaIndex,
        text: item.text.trim(),
        confidence: item.confidence ?? null,
        locale: item.locale ?? null,
        heardAt: item.heardAt,
        expiresAt,
      };
      return prisma.chantTapTranscript.upsert({
        where: { sessionId_seq: { sessionId: id, seq: item.seq } },
        create: { sessionId: id, userId: user.id, seq: item.seq, ...data },
        update: data,
      });
    })
  );

  return ok(res, { stored: items.length, expiresAt });
};

/** GET /api/app/sadhana/chant/sessions — past sittings, newest first, with their round summary. */
export const listChantSessions = async (req, res) => {
  const user = req.auth.user;
  const { page, pageSize, skip, take } = readPage(req.valid.query);
  const { mantraId } = req.valid.query;
  const where = {
    userId: user.id,
    source: 'IN_APP',
    // Sittings that opened and closed without finishing a round have nothing to
    // show round by round, and were most of the rows in the list.
    rounds: { gt: 0 },
    ...(mantraId ? { mantraId: mantraId === 'none' ? null : mantraId } : {}),
  };

  const [sessions, total] = await Promise.all([
    prisma.chantSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip,
      take,
      include: {
        mantra: present.includes.mantraStub(language.readingChain(user)),
        malas: { select: { index: true, durationMs: true, complete: true } },
      },
    }),
    prisma.chantSession.count({ where }),
  ]);

  const items = sessions.map(({ malas, ...session }) => {
    const finished = malas.filter((mala) => mala.complete);
    return {
      ...session,
      mantra: present.mantraStub(session.mantra, user),
      malaCount: malas.length,
      avgMalaMs: finished.length
        ? Math.round(finished.reduce((sum, mala) => sum + mala.durationMs, 0) / finished.length)
        : 0,
    };
  });

  return paginated(res, items, { page, pageSize, total });
};

/** GET /api/app/sadhana/chant/session/:id — one session, its rounds and what was heard. */
export const getChantSession = async (req, res) => {
  const user = req.auth.user;
  const { id } = req.valid.params;
  await ownSession(id, user);

  const [session, malas, transcripts] = await Promise.all([
    prisma.chantSession.findUnique({
      where: { id },
      include: { mantra: present.includes.mantraStub(language.readingChain(user)) },
    }),
    prisma.chantMala.findMany({ where: { sessionId: id }, orderBy: { index: 'asc' } }),
    // Expired rows may still be on disk until the nightly sweep; they are gone
    // to the reader the moment they expire.
    prisma.chantTapTranscript.findMany({
      where: { sessionId: id, expiresAt: { gt: new Date() } },
      orderBy: { seq: 'asc' },
      select: { seq: true, malaIndex: true, text: true, confidence: true, heardAt: true, expiresAt: true },
    }),
  ]);

  return ok(res, {
    session: session && { ...session, mantra: present.mantraStub(session.mantra, user) },
    malas,
    transcripts,
  });
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
