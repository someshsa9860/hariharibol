// Who is Premium, and why.
//
// `User.isPremium` is a cache. It is read on ordinary requests, so it lives on
// the user row rather than behind a join — but it is never the source of truth.
// This module owns it, and it can be rebuilt from Subscription and Payment at
// any time. Nothing else may write those three columns.
//
// Premium is earned two ways, and they are worth the same access:
//
//   - an active subscription — entitled until `currentPeriodEnd`
//   - any donation, of any amount — entitled permanently. `premiumUntil` stays
//     null, which is how a donor is held: they gave once and they keep access.
//
// Donation therefore always wins over a lapsed subscription. Someone who
// subscribed for a month and later donated is a donor, not an ex-subscriber.

const { prisma } = require('../config/database');
const logger = require('../config/logger');
const authService = require('./auth');
const websocket = require('./websocket');

// Statuses that still entitle. CANCELLED is included on purpose — a cancelled
// subscription has been paid for to the end of its period, and cutting access
// the moment someone cancels is taking money for nothing.
const ENTITLING_STATUSES = ['IN_TRIAL', 'ACTIVE', 'GRACE', 'CANCELLED'];

// Works out what a user's entitlement *should* be, without writing anything.
async function compute(userId) {
  const now = new Date();

  const donation = await prisma.payment.findFirst({
    where: { userId, purpose: 'DONATION', status: 'SUCCEEDED' },
    orderBy: { paidAt: 'asc' },
    select: { paidAt: true, createdAt: true },
  });

  if (donation) {
    return {
      isPremium: true,
      premiumSince: donation.paidAt || donation.createdAt,
      premiumUntil: null, // permanent
      reason: 'DONATION',
    };
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: { in: ENTITLING_STATUSES }, currentPeriodEnd: { gt: now } },
    orderBy: { currentPeriodEnd: 'desc' },
    select: { startedAt: true, currentPeriodEnd: true },
  });

  if (subscription) {
    return {
      isPremium: true,
      premiumSince: subscription.startedAt,
      premiumUntil: subscription.currentPeriodEnd,
      reason: 'SUBSCRIPTION',
    };
  }

  return { isPremium: false, premiumSince: null, premiumUntil: null, reason: 'NONE' };
}

// Recompute and persist. Called by every payment webhook and by the nightly
// sweep — those are the only two things that can change the answer.
async function refresh(userId) {
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true, premiumUntil: true },
  });
  if (!before) return null;

  const next = await compute(userId);

  await prisma.user.update({
    where: { id: userId },
    data: {
      isPremium: next.isPremium,
      premiumSince: next.premiumSince,
      premiumUntil: next.premiumUntil,
    },
  });

  // The cached auth payload carries isPremium, so a stale cache would keep a
  // new subscriber locked out for its full TTL.
  await authService.invalidateUser(userId);

  if (before.isPremium !== next.isPremium) {
    logger.info({ userId, isPremium: next.isPremium, reason: next.reason }, 'entitlement changed');
    websocket.toUser(userId, websocket.EVENTS.ENTITLEMENT_CHANGED, {
      isPremium: next.isPremium,
      premiumUntil: next.premiumUntil,
      reason: next.reason,
    });
  }

  return next;
}

// The nightly sweep: expire subscriptions whose period has run out, then
// recompute everyone the change could have affected.
//
// Only users who might have flipped are touched — a full table scan every night
// would grow into the slowest thing the system does.
async function sweep() {
  const now = new Date();

  const expired = await prisma.subscription.updateMany({
    where: {
      status: { in: ['ACTIVE', 'GRACE', 'CANCELLED', 'IN_TRIAL'] },
      currentPeriodEnd: { lt: now },
    },
    data: { status: 'EXPIRED' },
  });

  const stale = await prisma.user.findMany({
    where: { isPremium: true, premiumUntil: { not: null, lt: now } },
    select: { id: true },
  });

  for (const user of stale) {
    await refresh(user.id);
  }

  logger.info({ expired: expired.count, refreshed: stale.length }, 'entitlement sweep complete');
  return { expired: expired.count, refreshed: stale.length };
}

module.exports = { compute, refresh, sweep, ENTITLING_STATUSES };
