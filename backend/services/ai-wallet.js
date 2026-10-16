// The token wallet. Every AI operation that costs a person tokens — chat,
// summaries, and whatever AI feature comes next — debits the same wallet through
// `debit()`, so one balance and one ledger answer "what has this user spent".
//
// Nothing else writes AiWallet, AiWalletTransaction or AiDailyUsage. The
// arithmetic is in utils/ai-credits.js (pure, tested); this file reads rows,
// asks it what to do, and writes the result.
//
// Readers never see tokens: `status()` returns a percentage. Raw numbers are for
// the admin panel (`raw()`).
//
// The daily cap resets at each person's local midnight *without a job zeroing
// anything*: spend is recorded against the user's local date, and "today" is
// simply the row for today's date. A job that reset counters at one UTC moment
// could not respect 5.5-hour-offset timezones, and a missed run would leave
// everyone locked out. What the scheduled job does instead is renew wallets
// whose period has ended and prune old daily rows (jobs/processors/maintenance.js).

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import * as entitlement from './entitlement.js';
import {
  creditMeter, localDateKey, nextLocalMidnight, reconcileWallet, spendable, whyBlocked,
} from '../utils/ai-credits.js';

const DAILY_ROWS_KEPT_DAYS = 45;

// Allowances change rarely and are read on every message.
let allowanceCache = { at: 0, byPlan: new Map(), free: null };
const ALLOWANCE_TTL_MS = 30_000;

export function clearAllowanceCache() {
  allowanceCache = { at: 0, byPlan: new Map(), free: null };
}

async function loadAllowances() {
  if (Date.now() - allowanceCache.at < ALLOWANCE_TTL_MS) return allowanceCache;
  const rows = await prisma.aiPlanConfig.findMany({ include: { plan: { select: { isFree: true, tier: true } } } });
  allowanceCache = {
    at: Date.now(),
    byPlan: new Map(rows.map((r) => [r.planId, r])),
    free: rows.find((r) => r.plan.isFree) || null,
  };
  return allowanceCache;
}

/** What a plan allows in chat. A plan with no row of its own gets the free plan's. */
export async function allowanceFor(planId) {
  const { byPlan, free } = await loadAllowances();
  return byPlan.get(planId) || free || null;
}

async function userPlan(userId) {
  const { plan } = await entitlement.compute(userId);
  return plan;
}

function present(wallet, allowance, daily, timezone) {
  const now = new Date();
  const meter = creditMeter({
    balance: wallet.balance,
    allocation: wallet.allocation,
    dailyUsed: daily,
    dailyLimit: allowance.dailyTokens,
  });
  const resetsAt = nextLocalMidnight(now, timezone);
  return { meter, resetsAt };
}

async function dailyUsed(userId, timezone) {
  const row = await prisma.aiDailyUsage.findUnique({
    where: { userId_date: { userId, date: localDateKey(new Date(), timezone) } },
  });
  return row?.tokens || 0;
}

/**
 * The wallet, created or brought up to date with the user's plan first.
 * Returns everything a caller needs to decide whether a call can go ahead.
 */
export async function open(user) {
  const plan = await userPlan(user.id);
  const allowance = plan ? await allowanceFor(plan.id) : null;
  if (!plan || !allowance) return { plan, allowance: null, wallet: null, daily: 0 };

  let wallet = await prisma.aiWallet.findUnique({ where: { userId: user.id } });
  const decision = reconcileWallet({ wallet, allowance, planId: plan.id });

  if (decision.create) {
    try {
      wallet = await prisma.$transaction(async (tx) => {
        const created = await tx.aiWallet.create({ data: { userId: user.id, ...decision.create } });
        if (decision.credit) {
          await tx.aiWalletTransaction.create({
            data: { userId: user.id, type: 'CREDIT', tokens: decision.credit.tokens, source: 'PLAN_RENEWAL', note: decision.credit.note, balanceAfter: created.balance },
          });
        }
        return created;
      });
    } catch (error) {
      if (error.code !== 'P2002') throw error; // two requests raced to create it — use the winner's
      wallet = await prisma.aiWallet.findUnique({ where: { userId: user.id } });
    }
  } else if (decision.update || decision.credit) {
    wallet = await prisma.$transaction(async (tx) => {
      const next = await tx.aiWallet.update({
        where: { userId: user.id },
        data: { ...(decision.update || {}), ...(decision.credit ? { balance: { increment: decision.credit.tokens } } : {}) },
      });
      if (decision.credit) {
        await tx.aiWalletTransaction.create({
          data: { userId: user.id, type: 'CREDIT', tokens: decision.credit.tokens, source: 'PLAN_RENEWAL', note: decision.credit.note, balanceAfter: next.balance },
        });
      }
      return next;
    });
  }

  return { plan, allowance, wallet, daily: await dailyUsed(user.id, user.timezone) };
}

/**
 * What the app is told: levels and percentages, never token counts.
 */
export async function status(user) {
  const { plan, allowance, wallet, daily } = await open(user);
  if (!allowance || !allowance.isEnabled || !wallet) {
    return { enabled: false, levelName: allowance?.levelName || null, percent: 0, exhausted: true, limitedBy: null, resetsAt: null, renewsAt: null, canUpgrade: await canUpgrade(plan) };
  }

  const { meter, resetsAt } = present(wallet, allowance, daily, user.timezone);
  return {
    enabled: true,
    levelName: allowance.levelName,
    percent: meter.percent,
    exhausted: meter.exhausted,
    limitedBy: meter.limitedBy,
    // When the thing that is holding the reader back lifts.
    resetsAt: meter.limitedBy === 'wallet' ? wallet.periodEnd : resetsAt,
    renewsAt: wallet.periodEnd,
    canUpgrade: await canUpgrade(plan),
  };
}

async function canUpgrade(plan) {
  const higher = await prisma.subscriptionPlan.count({ where: { isActive: true, isFree: false, tier: { gt: plan?.tier ?? 0 } } });
  return higher > 0;
}

/**
 * The tokens this person can spend right now on one call, and, when it is
 * zero, which limit is in the way. `conversation` is `{ tokensUsed }`.
 */
export function room(opened, conversation) {
  const { allowance, wallet, daily } = opened;
  const args = {
    balance: wallet.balance,
    dailyUsed: daily,
    dailyLimit: allowance.dailyTokens,
    conversationUsed: conversation?.tokensUsed || 0,
    conversationLimit: conversation ? allowance.conversationTokens : 0,
  };
  return { available: spendable(args), blockedBy: (needed) => whyBlocked({ ...args, needed }) };
}

/**
 * Takes tokens from the wallet and records them against today's cap.
 * `tokens` is what the provider reported (or the local estimate for a reply cut
 * short — see services/ai/index.js). Always recorded, even when it takes the
 * balance a little below zero: the call has already been made.
 */
export async function debit({ userId, tokens, source, referenceId = null, note = null, timezone }) {
  if (!Number.isInteger(tokens) || tokens <= 0) return null;
  const date = localDateKey(new Date(), timezone);

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.aiWallet.update({ where: { userId }, data: { balance: { decrement: tokens } } });
    await tx.aiWalletTransaction.create({
      data: { userId, type: 'DEBIT', tokens, source, referenceId, note, balanceAfter: wallet.balance },
    });
    await tx.aiDailyUsage.upsert({
      where: { userId_date: { userId, date } },
      update: { tokens: { increment: tokens } },
      create: { userId, date, tokens },
    });
    return wallet.balance;
  });
}

/** Adds tokens: an admin grant, an adjustment, a renewal. */
export async function credit({ userId, tokens, source, referenceId = null, note = null, createdById = null }) {
  if (!Number.isInteger(tokens) || tokens <= 0) throw new Error('credit needs a positive whole number of tokens');
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.aiWallet.update({ where: { userId }, data: { balance: { increment: tokens } } });
    await tx.aiWalletTransaction.create({
      data: { userId, type: 'CREDIT', tokens, source, referenceId, note, balanceAfter: wallet.balance, createdById },
    });
    return wallet.balance;
  });
}

/** A signed correction by an admin: positive adds, negative removes. */
export async function adjust({ userId, tokens, note, createdById }) {
  if (!Number.isInteger(tokens) || tokens === 0) throw new Error('adjust needs a non-zero whole number');
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.aiWallet.update({ where: { userId }, data: { balance: { increment: tokens } } });
    await tx.aiWalletTransaction.create({
      data: {
        userId, type: tokens > 0 ? 'CREDIT' : 'DEBIT', tokens: Math.abs(tokens), source: 'ADMIN_ADJUST',
        note, balanceAfter: wallet.balance, createdById,
      },
    });
    return wallet.balance;
  });
}

/** Raw numbers, for the admin panel only. */
export async function raw(user) {
  const { plan, allowance, wallet, daily } = await open(user);
  if (!wallet) return null;
  const meter = allowance
    ? creditMeter({ balance: wallet.balance, allocation: wallet.allocation, dailyUsed: daily, dailyLimit: allowance.dailyTokens })
    : null;
  return {
    plan, allowance, balance: wallet.balance, allocation: wallet.allocation, dailyUsed: daily,
    periodStart: wallet.periodStart, periodEnd: wallet.periodEnd, percent: meter?.percent ?? null,
  };
}

/**
 * Renews every wallet whose period has ended. Called by the scheduled job so
 * that a wallet nobody opens still refills; opening one does the same check.
 */
export async function renewDue(batch = 500) {
  const due = await prisma.aiWallet.findMany({
    where: { periodEnd: { lte: new Date() } },
    take: batch,
    include: { user: { select: { id: true, timezone: true } } },
  });
  let renewed = 0;
  for (const wallet of due) {
    try {
      await open(wallet.user);
      renewed += 1;
    } catch (error) {
      logger.error({ err: error.message, userId: wallet.userId }, 'ai wallet renewal failed');
    }
  }
  return { due: due.length, renewed };
}

/** Drops daily rows past the retention window. */
export async function pruneDaily() {
  const cutoff = localDateKey(new Date(Date.now() - DAILY_ROWS_KEPT_DAYS * 86400000), 'UTC');
  const { count } = await prisma.aiDailyUsage.deleteMany({ where: { date: { lt: cutoff } } });
  return count;
}
