// The admin landing screen, and "who am I" for the panel itself.

const { prisma } = require('../../config/database');
const { ok } = require('../../utils/respond');
const { PERMISSIONS } = require('../../config/constants');
const { localDateString, toDateColumn, shiftDays } = require('../../utils/date');

/**
 * GET /api/admin/me
 * The panel renders its navigation from this. It is the same account as the
 * app's /me — an admin is a user whose role carries permissions, not a separate
 * kind of record — so the panel must be told what this person may actually do
 * rather than assuming that reaching the admin API means full access.
 */
exports.me = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: { select: { slug: true, name: true } },
    },
  });

  const permissions = [...req.auth.permissions];

  return ok(res, {
    ...user,
    permissions,
    // Grouped the way the panel lays out its sections, so it does not need its
    // own copy of the permission catalogue.
    permissionGroups: permissions.reduce((groups, slug) => {
      const group = PERMISSIONS[slug]?.group || 'other';
      groups[group] = groups[group] || [];
      groups[group].push(slug);
      return groups;
    }, {}),
  });
};

/**
 * GET /api/admin/dashboard
 * Counts and a 30-day activity series. Deliberately a handful of indexed counts
 * rather than a reporting layer — this screen is opened constantly and should
 * never be the reason the database is busy.
 */
exports.stats = async (req, res) => {
  const today = localDateString('Asia/Kolkata');
  const monthAgo = toDateColumn(shiftDays(today, -30));
  const weekAgo = toDateColumn(shiftDays(today, -7));

  const [
    users,
    newUsers,
    premiumUsers,
    books,
    verses,
    mantras,
    slokaEligible,
    activeSubscriptions,
    donations,
    revenue,
    aiSpend,
    chantingThisWeek,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.user.count({ where: { isPremium: true } }),
    prisma.book.count({ where: { isPublished: true } }),
    prisma.verse.count(),
    prisma.mantra.count({ where: { isPublished: true } }),
    prisma.verse.count({ where: { isSlokaEligible: true } }),
    prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'IN_TRIAL', 'GRACE'] } } }),
    prisma.payment.count({ where: { purpose: 'DONATION', status: 'SUCCEEDED' } }),
    prisma.payment.aggregate({
      where: { status: 'SUCCEEDED', paidAt: { gte: monthAgo } },
      _sum: { amountMinor: true },
    }),
    prisma.aiUsageLog.aggregate({
      where: { createdAt: { gte: monthAgo } },
      _sum: { costMicros: true },
    }),
    prisma.sadhanaDay.count({ where: { date: { gte: weekAgo }, roundsCompleted: { gt: 0 } } }),
  ]);

  return ok(res, {
    users: { total: users, newThisMonth: newUsers, premium: premiumUsers },
    content: {
      books,
      verses,
      mantras,
      // The size of the pool the personalised sloka draws from. If this is
      // small, the feature is repeating itself, and no other number here says so.
      slokaEligibleVerses: slokaEligible,
    },
    money: {
      activeSubscriptions,
      donations,
      revenueThisMonthMinor: revenue._sum.amountMinor || 0,
      // Millionths of a dollar. Shown next to revenue on purpose — the paid
      // feature is the one with an AI cost behind it, and these two numbers
      // moving apart is the first sign that has stopped being true.
      aiSpendThisMonthMicros: aiSpend._sum.costMicros || 0,
    },
    engagement: { chantingDaysThisWeek: chantingThisWeek },
  });
};

/**
 * GET /api/admin/dashboard/signups
 * New accounts per day for the last 30 days.
 */
exports.signups = async (req, res) => {
  const days = req.valid.query.days || 30;
  const since = toDateColumn(shiftDays(localDateString('Asia/Kolkata'), -days));

  const rows = await prisma.$queryRaw`
    SELECT DATE("createdAt") AS date, COUNT(*)::int AS count
    FROM "User"
    WHERE "createdAt" >= ${since}
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `;

  return ok(res, rows);
};
