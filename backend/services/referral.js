// Refer and earn. A referral is a *claim*: a signed-in new reader says "I came from this code". It is never made
// by opening a link (that is utils/share.js's job, and it cannot touch this file). The referrer is rewarded
// one month of the Ārta plan once the new reader has been around a day and has done something devotional.
//
// The month is a Subscription row with provider REFERRAL — the same table entitlement.js reads — so access is
// the same in the app and on the website, and nothing here edits `User.isPremium`: entitlement.refresh owns
// that. A reward never overwrites or shortens anything: it starts when the access the person already holds ends
// (utils/referral.rewardWindow). Retries and races are harmless: the reward is claimed by flipping the
// referral PENDING → REWARDED in one atomic statement, and ReferralReward.referralId and
// Subscription (provider, externalId) are both unique.

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import * as entitlement from './entitlement.js';
import * as notify from './notify.js';
import { newCode, normaliseCode, REFERRAL_CODE_LENGTH } from '../utils/share.js';
import { canClaim, qualifies, rewardWindow, DEFAULT_RULES } from '../utils/referral.js';
import { badRequest, conflict } from '../utils/errors.js';

const YEAR_MS = 365 * 86_400_000;

/** A person's own code, made the first time it is asked for. */
export async function codeFor(userId) {
  const existing = await prisma.referralCode.findUnique({ where: { userId } });
  if (existing) return existing;
  for (let i = 0; i < 5; i += 1) {
    try {
      return await prisma.referralCode.create({ data: { userId, code: newCode(REFERRAL_CODE_LENGTH) } });
    } catch (error) {
      if (error.code !== 'P2002') throw error;
      const raced = await prisma.referralCode.findUnique({ where: { userId } });
      if (raced) return raced;
    }
  }
  throw new Error('could not make a referral code');
}

/** Public: whose invitation is this? Only a first name, nothing else about the person. */
export async function inviter(rawCode) {
  const code = normaliseCode(rawCode);
  if (!code) return null;
  const row = await prisma.referralCode.findUnique({ where: { code }, include: { user: { select: { name: true } } } });
  if (!row) return null;
  return { code, firstName: (row.user.name || '').trim().split(/\s+/)[0] || null };
}

/** The signed-in reader says which code brought them. First claim wins; a second code is refused, not replaced. */
export async function claim(user, rawCode) {
  const code = normaliseCode(rawCode);
  if (!code) throw badRequest('That code is not valid', { reason: 'CODE_UNKNOWN' });

  const [owner, existing] = await Promise.all([
    prisma.referralCode.findUnique({ where: { code } }),
    prisma.referral.findUnique({ where: { refereeId: user.id } }),
  ]);
  const verdict = canClaim({ referrerId: owner?.userId, referee: user, alreadyReferred: Boolean(existing) });
  if (!verdict.ok) {
    logger.info({ reason: verdict.reason, userId: user.id }, 'referral claim refused');
    // The same code claimed again is not an error worth shouting about — the answer is the same either way.
    if (verdict.reason === 'ALREADY_REFERRED' && existing.code === code) return existing;
    throw conflict('This code cannot be used', { reason: verdict.reason });
  }

  try {
    return await prisma.referral.create({ data: { referrerId: owner.userId, refereeId: user.id, code } });
  } catch (error) {
    // Two claims at once: the unique refereeId lets exactly one through.
    if (error.code === 'P2002') throw conflict('This code cannot be used', { reason: 'ALREADY_REFERRED' });
    throw error;
  }
}

async function activityOf(userId) {
  const [chants, reading, days] = await Promise.all([
    prisma.chantSession.count({ where: { userId } }),
    prisma.readingProgress.count({ where: { userId } }),
    prisma.sadhanaDay.count({ where: { userId } }),
  ]);
  return chants + reading + days;
}

async function planFor(rules) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: rules.rewardPlanSlug } });
  if (!plan || !plan.isActive) throw new Error(`reward plan "${rules.rewardPlanSlug}" is missing or inactive`);
  return plan;
}

/**
 * Grant the month if the referral has earned it. Safe to call as often as you like, from anywhere: it returns
 * `{ rewarded: false, reason }` until the rules are met and `{ rewarded: true }` exactly once.
 */
export async function qualifyIfDue(referralId, rules = DEFAULT_RULES) {
  const referral = await prisma.referral.findUnique({ where: { id: referralId }, include: { referee: { select: { createdAt: true } } } });
  if (!referral) return { rewarded: false, reason: 'NOT_FOUND' };

  const now = new Date();
  const [actions, rewardsThisYear] = await Promise.all([
    activityOf(referral.refereeId),
    prisma.referralReward.count({ where: { userId: referral.referrerId, createdAt: { gt: new Date(now - YEAR_MS) } } }),
  ]);
  const verdict = qualifies({ referral: { ...referral, refereeCreatedAt: referral.referee.createdAt }, actions, rewardsThisYear, now, rules });
  if (!verdict.ok) return { rewarded: false, reason: verdict.reason };

  const plan = await planFor(rules);

  const result = await prisma.$transaction(async (tx) => {
    // The one atomic step: only one caller can move PENDING → REWARDED.
    const won = await tx.referral.updateMany({ where: { id: referralId, status: 'PENDING' }, data: { status: 'REWARDED', qualifiedAt: now } });
    if (won.count !== 1) return null;

    // Where the month starts: after any Ārta-or-better access they already hold, so nothing is shortened.
    const held = await tx.subscription.findMany({
      where: {
        userId: referral.referrerId, status: { in: ['IN_TRIAL', 'ACTIVE', 'GRACE', 'CANCELLED'] },
        currentPeriodEnd: { gt: now }, plan: { tier: { gte: plan.tier } },
      },
      select: { currentPeriodEnd: true, provider: true, id: true },
      orderBy: { currentPeriodEnd: 'desc' },
    });
    const { startsAt, endsAt } = rewardWindow({ coveredUntil: held[0]?.currentPeriodEnd ?? null, now, rules });

    const mine = held.find((s) => s.provider === 'REFERRAL');
    if (mine) {
      await tx.subscription.update({ where: { id: mine.id }, data: { currentPeriodEnd: endsAt } });
    } else {
      await tx.subscription.create({
        data: {
          userId: referral.referrerId, planId: plan.id, provider: 'REFERRAL', externalId: `referral:${referralId}`,
          status: 'ACTIVE', startedAt: now, currentPeriodEnd: endsAt, autoRenew: false,
        },
      });
    }
    return tx.referralReward.create({ data: { referralId, userId: referral.referrerId, planId: plan.id, startsAt, endsAt } });
  });

  if (!result) return { rewarded: false, reason: 'ALREADY_HANDLED' };

  await entitlement.refresh(referral.referrerId);
  notify.toUser(referral.referrerId, {
    type: 'SYSTEM', title: 'A month of Ārta, with thanks',
    body: 'Someone you invited has joined. A month of the Ārta plan is now yours.', data: { link: 'hariharibol://premium' },
  }).catch((error) => logger.warn({ err: error }, 'referral reward notification failed'));

  return { rewarded: true, reward: result };
}

/** Everything the Refer and Earn screen shows. Also tries to settle any referral of theirs that is due. */
export async function summary(user, { page = 1, pageSize = 20 } = {}) {
  const code = await codeFor(user.id);

  // Opening the screen is a natural moment to settle what is due; the sweep catches the rest.
  const pending = await prisma.referral.findMany({ where: { referrerId: user.id, status: 'PENDING' }, select: { id: true } });
  for (const { id } of pending) await qualifyIfDue(id).catch((error) => logger.warn({ err: error }, 'referral settle failed'));

  const [counts, rewards, history, total, mine] = await Promise.all([
    prisma.referral.groupBy({ by: ['status'], where: { referrerId: user.id }, _count: { _all: true } }),
    prisma.referralReward.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.referral.findMany({
      where: { referrerId: user.id }, orderBy: { claimedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      include: { referee: { select: { name: true } }, reward: true },
    }),
    prisma.referral.count({ where: { referrerId: user.id } }),
    prisma.referral.findUnique({ where: { refereeId: user.id }, select: { status: true, claimedAt: true } }),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  return {
    code: code.code,
    rules: { rewardDays: DEFAULT_RULES.rewardDays, plan: DEFAULT_RULES.rewardPlanSlug, maxPerYear: DEFAULT_RULES.maxRewardsPerYear },
    totals: { pending: by.PENDING || 0, rewarded: by.REWARDED || 0, rejected: by.REJECTED || 0 },
    rewards: rewards.map((r) => ({ id: r.id, startsAt: r.startsAt, endsAt: r.endsAt, grantedAt: r.createdAt })),
    // First name only: a referrer sees who joined, not their account.
    history: history.map((h) => ({
      id: h.id, name: (h.referee.name || '').trim().split(/\s+/)[0] || null, status: h.status, claimedAt: h.claimedAt, qualifiedAt: h.qualifiedAt,
    })),
    historyTotal: total,
    // Did this reader themselves come through someone's code?
    referredBy: mine,
  };
}

/** The nightly sweep: settle every pending referral old enough to qualify. Returns how many were rewarded. */
export async function sweep(limit = 200) {
  const due = await prisma.referral.findMany({
    where: { status: 'PENDING', referee: { createdAt: { lt: new Date(Date.now() - DEFAULT_RULES.qualifyAfterHours * 3_600_000) } } },
    select: { id: true }, take: limit, orderBy: { claimedAt: 'asc' },
  });
  let rewarded = 0;
  for (const { id } of due) {
    const r = await qualifyIfDue(id).catch((error) => { logger.warn({ err: error }, 'referral sweep failed'); return null; });
    if (r?.rewarded) rewarded += 1;
  }
  return rewarded;
}

