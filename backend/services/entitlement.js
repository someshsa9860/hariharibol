// Who is Premium, and why.
//
// `User.isPremium` is a cache. It is read on ordinary requests, so it lives on
// the user row rather than behind a join — but it is never the source of truth.
// This module owns it, and it can be rebuilt from Subscription and Payment at
// any time. Nothing else may write those three columns.
//
// Premium is earned two ways, and they are worth the same access (a donation
// earns the plan flagged `grantedToDonors`; a subscription earns the plan
// bought):
//
//   - an active subscription — entitled until `currentPeriodEnd`
//   - any donation, of any amount — entitled permanently. `premiumUntil` stays
//     null, which is how a donor is held: they gave once and they keep access.
//
// Donation therefore always wins over a lapsed subscription. Someone who
// subscribed for a month and later donated is a donor, not an ex-subscriber.

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import * as authService from './auth.js';
import * as websocket from './websocket.js';

// Statuses that still entitle. CANCELLED is included on purpose — a cancelled
// subscription has been paid for to the end of its period, and cutting access
// the moment someone cancels is taking money for nothing.
const ENTITLING_STATUSES = ['IN_TRIAL', 'ACTIVE', 'GRACE', 'CANCELLED'];

const PLAN_SELECT = { id: true, slug: true, name: true, tier: true, isFree: true };

// The baseline plan — what anyone with no subscription and no donation is on.
async function freePlan() {
  return prisma.subscriptionPlan.findFirst({ where: { isFree: true }, select: PLAN_SELECT });
}

// The plan a donation earns: the highest tier flagged `grantedToDonors`.
async function donorPlan() {
  return prisma.subscriptionPlan.findFirst({
    where: { grantedToDonors: true, isActive: true },
    orderBy: { tier: 'desc' },
    select: PLAN_SELECT,
  });
}

// Works out what a user's entitlement *should* be, without writing anything.
// `plan` is the tier they are on; when several things entitle someone, the
// highest tier wins.
async function compute(userId) {
  const now = new Date();

  const [donation, subscription] = await Promise.all([
    prisma.payment.findFirst({
      where: { userId, purpose: 'DONATION', status: 'SUCCEEDED' },
      orderBy: { paidAt: 'asc' },
      select: { paidAt: true, createdAt: true },
    }),
    // Highest tier first, then whichever runs longest.
    prisma.subscription.findFirst({
      where: { userId, status: { in: ENTITLING_STATUSES }, currentPeriodEnd: { gt: now } },
      orderBy: [{ plan: { tier: 'desc' } }, { currentPeriodEnd: 'desc' }],
      select: { startedAt: true, currentPeriodEnd: true, plan: { select: PLAN_SELECT } },
    }),
  ]);

  const donated = donation ? await donorPlan() : null;

  // A donation wins over a subscription of the same or lower tier: someone who
  // subscribed for a month and later donated is a donor, not an ex-subscriber.
  if (donated && (!subscription || donated.tier >= subscription.plan.tier)) {
    return {
      isPremium: !donated.isFree,
      premiumSince: donation.paidAt || donation.createdAt,
      premiumUntil: null, // permanent
      reason: 'DONATION',
      plan: donated,
    };
  }

  if (subscription) {
    return {
      isPremium: !subscription.plan.isFree,
      premiumSince: subscription.startedAt,
      premiumUntil: subscription.currentPeriodEnd,
      reason: 'SUBSCRIPTION',
      plan: subscription.plan,
    };
  }

  return { isPremium: false, premiumSince: null, premiumUntil: null, reason: 'NONE', plan: await freePlan() };
}

// What a plan unlocks, as { [key]: { enabled, limit, ... } } for every active
// feature. A feature the plan has no row for gets the feature's own default —
// so a feature added tomorrow is on for everyone until someone says otherwise,
// which is the app's rule: new things are free unless a decision is made.
async function featuresForPlan(planId) {
  const [features, values] = await Promise.all([
    prisma.feature.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    planId ? prisma.planFeature.findMany({ where: { planId } }) : [],
  ]);
  const byFeature = new Map(values.map((v) => [v.featureId, v]));

  const result = {};
  for (const feature of features) {
    const value = byFeature.get(feature.id);
    result[feature.key] = {
      name: feature.name,
      kind: feature.kind,
      unit: feature.unit,
      enabled: value ? value.enabled : feature.defaultEnabled,
      // null = unlimited. Only meaningful for LIMIT features.
      limit: value && feature.kind === 'LIMIT' ? value.limit : null,
    };
  }
  return result;
}

// The one question the rest of the codebase asks: may this user use this?
async function can(userId, key) {
  const { plan } = await compute(userId);
  if (!plan) return false;
  const features = await featuresForPlan(plan.id);
  return features[key]?.enabled ?? false;
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
      plan: next.plan?.slug ?? null,
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

export { compute, refresh, sweep, featuresForPlan, can, ENTITLING_STATUSES };
