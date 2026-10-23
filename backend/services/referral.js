// Refer and earn.
//
// The shape of it, so the rules below read as one story:
//
//   1. Everyone has a code (`codeFor`). A link with it is /satsang/<code>.
//   2. A new person presents a code once they have an account (`attribute`). The
//      first valid code wins; later ones are ignored. Opening a link on its own
//      attributes nothing and rewards nothing.
//   3. When the new person has done the first real thing — finished a round of
//      chanting (`evaluate`) — the referral qualifies and the referrer is given
//      REWARD_DAYS days of the reward plan, as an EntitlementGrant.
//
// Every number is in config/referral.js. Nothing here trusts the client: the
// referrer, the dates and the progress are all read from the database.

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import config from '../config/referral.js';
import * as entitlement from './entitlement.js';
import * as notify from './notify.js';
import { ENTITLING_STATUSES } from './entitlement.js';
import { inbox, newReferralCode, normaliseReferralCode, referralUrl } from '../utils/share.js';
import { longDate } from '../utils/date.js';
import { greeted, notice } from '../utils/messages.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Why an attribution was not made. The app words each in the reader's language;
// none of them is an error to show in red.
export const REFUSED = {
  INVALID_CODE: 'invalid_code',
  OWN_CODE: 'own_code',
  ALREADY_REFERRED: 'already_referred',
  NOT_NEW: 'not_new',
  WINDOW_PASSED: 'window_passed',
  SAME_PERSON: 'same_person',
  REFERRER_UNAVAILABLE: 'referrer_unavailable',
  REFERRER_BUSY: 'referrer_busy',
};

/** The user's own code, made on first use. */
export async function codeFor(userId) {
  const found = await prisma.referralCode.findUnique({ where: { userId }, select: { code: true } });
  if (found) return found.code;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return (await prisma.referralCode.create({ data: { userId, code: newReferralCode() }, select: { code: true } })).code;
    } catch (err) {
      if (err.code !== 'P2002') throw err;
      // Either the code collided (draw again) or a parallel request made this
      // user's row first (take theirs).
      const again = await prisma.referralCode.findUnique({ where: { userId }, select: { code: true } });
      if (again) return again.code;
    }
  }
  throw new Error('could not find a free referral code');
}

const firstName = (name) => (String(name || '').trim().split(/\s+/)[0] || null);

/** Public: is this code real, and whose is it (first name only). */
export async function inspect(raw) {
  const code = normaliseReferralCode(raw);
  if (!code) return { valid: false };
  const row = await prisma.referralCode.findUnique({
    where: { code },
    select: { code: true, user: { select: { name: true, isBanned: true } } },
  });
  if (!row || row.user.isBanned) return { valid: false };
  return { valid: true, code: row.code, referrerName: firstName(row.user.name) };
}

/** Presents a code for a signed-in user. Returns `{ attributed }` or `{ attributed: false, reason }`. */
export async function attribute({ userId, code: raw, source = 'LINK' }) {
  const code = normaliseReferralCode(raw);
  if (!code) return refuse(REFUSED.INVALID_CODE);

  const [owner, user, existing] = await Promise.all([
    prisma.referralCode.findUnique({
      where: { code },
      select: { userId: true, user: { select: { email: true, isBanned: true } } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, email: true, isBanned: true } }),
    prisma.referral.findUnique({ where: { refereeId: userId }, select: { id: true } }),
  ]);
  if (!owner || !user) return refuse(REFUSED.INVALID_CODE);
  if (owner.userId === userId) return suspect(userId, REFUSED.OWN_CODE, code);
  if (existing) return refuse(REFUSED.ALREADY_REFERRED);
  if (owner.user.isBanned || user.isBanned) return refuse(REFUSED.REFERRER_UNAVAILABLE);
  if (inbox(owner.user.email) === inbox(user.email)) return suspect(userId, REFUSED.SAME_PERSON, code);

  // Someone who already pays, or has paid, is not a new user.
  const [paid, subscribed] = await Promise.all([
    prisma.payment.count({ where: { userId, status: 'SUCCEEDED' } }),
    prisma.subscription.count({ where: { userId } }),
  ]);
  if (paid || subscribed) return refuse(REFUSED.NOT_NEW);
  if (Date.now() - user.createdAt.getTime() > config.ATTRIBUTION_WINDOW_DAYS * DAY_MS) {
    return refuse(REFUSED.WINDOW_PASSED);
  }

  const pending = await prisma.referral.count({ where: { referrerId: owner.userId, status: 'PENDING' } });
  if (pending >= config.MAX_PENDING_PER_REFERRER) return suspect(userId, REFUSED.REFERRER_BUSY, code);

  try {
    await prisma.referral.create({
      data: { referrerId: owner.userId, refereeId: userId, code, source: source === 'CODE' ? 'CODE' : 'LINK' },
    });
  } catch (err) {
    if (err.code === 'P2002') return refuse(REFUSED.ALREADY_REFERRED); // a parallel request got there first
    throw err;
  }
  logger.info({ referrerId: owner.userId, refereeId: userId, source }, 'referral attributed');
  // They may already have chanted before presenting the code.
  await evaluate(userId);
  return { attributed: true };
}

const refuse = (reason) => ({ attributed: false, reason });
function suspect(userId, reason, code) {
  logger.warn({ userId, reason, code }, 'referral refused');
  return refuse(reason);
}

/**
 * Has this referee done enough? Safe to call as often as you like, from anywhere,
 * at the same time: the PENDING → QUALIFIED claim is one conditional update, so
 * exactly one caller goes on to give the reward.
 */
export async function evaluate(refereeId) {
  const referral = await prisma.referral.findUnique({ where: { refereeId } });
  if (!referral || referral.status !== 'PENDING') return { changed: false };

  if (Date.now() - referral.attributedAt.getTime() > config.QUALIFY_WITHIN_DAYS * DAY_MS) {
    await prisma.referral.updateMany({ where: { id: referral.id, status: 'PENDING' }, data: { status: 'REJECTED', rejectReason: 'expired' } });
    return { changed: true, status: 'REJECTED' };
  }

  const rounds = await prisma.chantMala.count({
    where: { userId: refereeId, complete: true, startedAt: { gte: referral.attributedAt } },
  });
  if (rounds < config.QUALIFY_ROUNDS) return { changed: false };

  const plan = await prisma.subscriptionPlan.findFirst({ where: { slug: config.REWARD_PLAN_SLUG, isActive: true } });
  if (!plan) {
    logger.error({ slug: config.REWARD_PLAN_SLUG }, 'referral reward plan is missing; nothing was given');
    return { changed: false };
  }

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.referral.updateMany({
      where: { id: referral.id, status: 'PENDING' },
      data: { status: 'QUALIFIED', qualifiedAt: new Date() },
    });
    if (claimed.count !== 1) return null; // someone else qualified it

    const yearAgo = new Date(Date.now() - 365 * DAY_MS);
    const earned = await tx.entitlementGrant.count({
      where: { userId: referral.referrerId, source: 'REFERRAL', createdAt: { gte: yearAgo } },
    });
    if (earned >= config.REWARD_LIMIT_PER_YEAR) {
      await tx.referral.update({ where: { id: referral.id }, data: { status: 'REJECTED', rejectReason: 'referrer_limit_reached' } });
      return { limited: true };
    }

    const now = new Date();
    const startsAt = await grantStart(tx, referral.referrerId, plan, now);
    const grant = await tx.entitlementGrant.create({
      data: {
        userId: referral.referrerId,
        planId: plan.id,
        source: 'REFERRAL',
        referralId: referral.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + config.REWARD_DAYS * DAY_MS),
        note: 'Referral reward',
      },
    });
    return { grant };
  });

  if (!result) return { changed: false };
  if (result.limited) {
    logger.warn({ referrerId: referral.referrerId }, 'referral reward limit reached');
    return { changed: true, status: 'REJECTED' };
  }

  // Outside the transaction: the reward is already safe, and a failed refresh or
  // push must not undo it. The nightly sweep catches up a refresh that failed.
  await entitlement.refresh(referral.referrerId).catch((err) => logger.error({ err }, 'entitlement refresh after referral failed'));
  notify
    .recipient(referral.referrerId)
    .then(({ name, chain }) =>
      notify.toUser(referral.referrerId, {
        type: 'REFERRAL',
        title: notice('referralTitle', chain, [plan.name]),
        body: greeted(name, chain, notice('referralBody', chain, [plan.name, longDate(result.grant.endsAt, chain)])),
        data: { route: 'refer' },
      })
    )
    .catch((err) => logger.warn({ err }, 'referral notification failed'));
  logger.info({ referralId: referral.id, referrerId: referral.referrerId, endsAt: result.grant.endsAt }, 'referral rewarded');
  return { changed: true, status: 'QUALIFIED' };
}

/**
 * When a new grant should begin so that it never overlaps, replaces or shortens
 * anything: after the last grant that is running, and after a subscription of the
 * same or a higher tier that is paid up (that already gives the same access).
 */
async function grantStart(tx, userId, plan, now) {
  const [lastGrant, subscription] = await Promise.all([
    tx.entitlementGrant.findFirst({
      where: { userId, revokedAt: null, endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
      select: { endsAt: true },
    }),
    tx.subscription.findFirst({
      where: {
        userId,
        status: { in: ENTITLING_STATUSES },
        currentPeriodEnd: { gt: now },
        plan: { tier: { gte: plan.tier } },
      },
      orderBy: { currentPeriodEnd: 'desc' },
      select: { currentPeriodEnd: true },
    }),
  ]);
  return new Date(Math.max(now.getTime(), lastGrant?.endsAt.getTime() || 0, subscription?.currentPeriodEnd.getTime() || 0));
}

/** Takes a reward back (a refund, abuse). The referral is kept, marked REVERSED. */
export async function reverse(referralId, reason = 'reversed') {
  const referral = await prisma.referral.findUnique({ where: { id: referralId }, include: { reward: true } });
  if (!referral || referral.status !== 'QUALIFIED') return false;
  await prisma.$transaction([
    prisma.entitlementGrant.updateMany({ where: { referralId, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.referral.update({ where: { id: referralId }, data: { status: 'REVERSED', rejectReason: reason.slice(0, 120) } }),
  ]);
  await entitlement.refresh(referral.referrerId);
  logger.warn({ referralId, referrerId: referral.referrerId, reason }, 'referral reversed');
  return true;
}

const mask = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'A new devotee';
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

/** Everything the Refer and earn screen shows. */
export async function summary(userId, { page = 1, pageSize = 20 } = {}) {
  const code = await codeFor(userId);
  const [counts, total, rows, active] = await Promise.all([
    prisma.referral.groupBy({ by: ['status'], where: { referrerId: userId }, _count: true }),
    prisma.referral.count({ where: { referrerId: userId } }),
    prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { attributedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, status: true, source: true, attributedAt: true, qualifiedAt: true, rejectReason: true,
        referee: { select: { name: true } },
        reward: { select: { startsAt: true, endsAt: true, revokedAt: true } },
      },
    }),
    prisma.entitlementGrant.findFirst({
      where: { userId, source: 'REFERRAL', revokedAt: null, endsAt: { gt: new Date() } },
      orderBy: { endsAt: 'desc' },
      select: { endsAt: true },
    }),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const year = new Date(Date.now() - 365 * DAY_MS);
  const earnedThisYear = await prisma.entitlementGrant.count({ where: { userId, source: 'REFERRAL', createdAt: { gte: year } } });

  return {
    code,
    url: referralUrl(env.WEB_BASE_URL, code),
    totals: {
      invited: total,
      pending: by.PENDING || 0,
      successful: by.QUALIFIED || 0,
      rewardsEarned: by.QUALIFIED || 0,
    },
    rewardActiveUntil: active?.endsAt || null,
    rules: {
      rewardDays: config.REWARD_DAYS,
      rewardPlan: config.REWARD_PLAN_SLUG,
      qualifyRounds: config.QUALIFY_ROUNDS,
      qualifyWithinDays: config.QUALIFY_WITHIN_DAYS,
      attributionWindowDays: config.ATTRIBUTION_WINDOW_DAYS,
      limitPerYear: config.REWARD_LIMIT_PER_YEAR,
      remainingThisYear: Math.max(0, config.REWARD_LIMIT_PER_YEAR - earnedThisYear),
    },
    history: rows.map((r) => ({
      id: r.id,
      name: mask(r.referee.name),
      status: r.status,
      source: r.source,
      invitedAt: r.attributedAt,
      qualifiedAt: r.qualifiedAt,
      reason: r.status === 'REJECTED' || r.status === 'REVERSED' ? r.rejectReason : null,
      reward: r.reward ? { startsAt: r.reward.startsAt, endsAt: r.reward.endsAt, revoked: Boolean(r.reward.revokedAt) } : null,
    })),
    page: { page, pageSize, total, hasMore: page * pageSize < total },
  };
}

/** What the person who was invited sees: their own referral, if any. */
export async function mine(userId) {
  const row = await prisma.referral.findUnique({
    where: { refereeId: userId },
    select: { status: true, attributedAt: true, referrer: { select: { name: true } } },
  });
  return row ? { status: row.status, referrerName: firstName(row.referrer.name), attributedAt: row.attributedAt } : null;
}
