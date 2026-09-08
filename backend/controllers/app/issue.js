// Issues — the vocabulary a user has for saying what is wrong.
//
// Two categories, seeded rather than free text:
//
//   VIKARA    the six inner enemies — kama, krodha, lobha, moha, mada, matsarya
//   PRACTICE  the sadhana difficulties — could not chant on time, could not
//             finish the round target
//
// A fixed list rather than a text box, because these are what VerseIssue maps
// slokas to. Free text would give the picker nothing to match against.

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import { ok, created } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';
import { toDateColumn, localDateString, shiftDays } from '../../utils/date.js';

/** GET /api/app/issues */
export const list = async (req, res) => {
  const { category } = req.valid.query;

  const issues = await prisma.issue.findMany({
    where: { isPublished: true, ...(category ? { category } : {}) },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  });

  const shaped = await present.references(issues, req.auth.user);

  return ok(
    res,
    shaped.map((issue, index) => ({ ...issue, category: issues[index].category }))
  );
};

/**
 * POST /api/app/issues/report
 * Records a struggle without asking for a sloka in return. Free, unlike the
 * mood-driven sloka — the honest record of what someone is going through is
 * what the weekly learning is built from, and putting a price on that would
 * make the data worse for everyone.
 */
export const report = async (req, res) => {
  const user = req.auth.user;
  const { issueSlug, intensity, note, date } = req.valid.body;

  const issue = await prisma.issue.findFirst({ where: { slug: issueSlug, isPublished: true } });
  if (!issue) throw notFound('Issue');

  // Attached to the day it is about, when there is one, so the report can line
  // a struggle up against what practice actually looked like that day.
  const localDate = date || localDateString(user.timezone);
  const day = await prisma.sadhanaDay.findUnique({
    where: { userId_date: { userId: user.id, date: toDateColumn(localDate) } },
    select: { id: true },
  });

  const report = await prisma.userIssue.create({
    data: {
      userId: user.id,
      issueId: issue.id,
      sadhanaDayId: day?.id || null,
      intensity: intensity || null,
      note: note || null,
    },
  });

  return created(res, report);
};

/** GET /api/app/issues/mine — this user's own reports, newest first. */
export const mine = async (req, res) => {
  const reports = await prisma.userIssue.findMany({
    where: { userId: req.auth.user.id },
    orderBy: { reportedAt: 'desc' },
    take: 50,
    include: { issue: { select: { slug: true, name: true, category: true } } },
  });

  return ok(res, reports);
};

/**
 * GET /api/app/issues/trends
 * How often each struggle has come up over a window, and whether it is easing.
 * The comparison against the previous window of the same length is the part
 * worth showing — a raw count says nothing about direction.
 */
export const trends = async (req, res) => {
  const user = req.auth.user;
  const days = req.valid.query.days || 30;

  const today = localDateString(user.timezone);
  const windowStart = toDateColumn(shiftDays(today, -days));
  const previousStart = toDateColumn(shiftDays(today, -days * 2));

  const [current, previous] = await Promise.all([
    prisma.userIssue.groupBy({
      by: ['issueId'],
      where: { userId: user.id, reportedAt: { gte: windowStart } },
      _count: { _all: true },
      _avg: { intensity: true },
    }),
    prisma.userIssue.groupBy({
      by: ['issueId'],
      where: { userId: user.id, reportedAt: { gte: previousStart, lt: windowStart } },
      _count: { _all: true },
    }),
  ]);

  const previousCounts = new Map(previous.map((row) => [row.issueId, row._count._all]));

  const issues = await prisma.issue.findMany({
    where: { id: { in: current.map((row) => row.issueId) } },
    select: { id: true, slug: true, name: true, category: true },
  });
  const byId = new Map(issues.map((row) => [row.id, row]));

  const trends = current
    .map((row) => {
      const before = previousCounts.get(row.issueId) || 0;
      return {
        issue: byId.get(row.issueId),
        count: row._count._all,
        previousCount: before,
        averageIntensity: row._avg.intensity ? Number(row._avg.intensity.toFixed(1)) : null,
        change: row._count._all - before,
      };
    })
    .sort((a, b) => b.count - a.count);

  return ok(res, { days, trends });
};
