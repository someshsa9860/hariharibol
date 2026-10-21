// The owner's books for one month, in INR.
//
// Three sources, each read where it already lives so no rupee is counted twice:
//   - revenue  — Payment rows, by the day they were paid (gross / commission / net, all in paise, written by
//                the store-payments code; a free trial is a row with zeros, so it adds nothing)
//   - AI cost  — AiUsageLog (billed in US dollars) converted at a stored rate
//   - the rest — FinanceEntry, the credit and debit lines the super admin types in
//
// Months are calendar months in India (IST), because that is the owner's books. A month named "2026-09" runs
// from 2026-09-01 00:00 IST to the same time on 2026-10-01.

import { prisma } from '../config/database.js';
import * as settings from './setting.js';
import { SETTING_KEYS } from '../config/constants.js';
import { localDateString } from '../utils/date.js';

const TIMEZONE = 'Asia/Kolkata';
const DEFAULT_USD_INR = 88;

// What a manual line can be filed under. `other` catches the rest.
const CATEGORIES = ['advertising', 'purchase', 'salary', 'tools', 'other'];

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const monthOf = (dateString) => dateString.slice(0, 7);

function nextMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

function previousMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** The instants a month starts and ends at, in IST. */
function bounds(month) {
  return {
    from: new Date(`${month}-01T00:00:00+05:30`),
    to: new Date(`${nextMonth(month)}-01T00:00:00+05:30`),
  };
}

/** The same month as the UTC-midnight dates `FinanceEntry.occurredOn` holds. */
function dayBounds(month) {
  return { from: new Date(`${month}-01T00:00:00Z`), to: new Date(`${nextMonth(month)}-01T00:00:00Z`) };
}

const currentMonth = (at = new Date()) => monthOf(localDateString(TIMEZONE, at));

/** Days left in the IST month containing `at`, counting today as 0 on its last day. */
function daysLeftInMonth(at = new Date()) {
  const today = localDateString(TIMEZONE, at);
  const { to } = bounds(monthOf(today));
  const end = new Date(to.getTime() - 86400000);
  return Math.round((new Date(`${localDateString(TIMEZONE, end)}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000);
}

async function currentRate() {
  const rate = await settings.getNumber(SETTING_KEYS.FINANCE_USD_INR_RATE, DEFAULT_USD_INR);
  return rate > 0 ? rate : DEFAULT_USD_INR;
}

// How AI calls are grouped for the owner. The log's `operation` names what a call was for.
function aiGroup(operation = '') {
  if (operation.startsWith('chat')) return 'Ask Sakha';
  if (operation.startsWith('translation')) return 'Translations';
  if (operation.startsWith('scenes')) return 'Scenes (Gemini)';
  if (/image|picture|background/.test(operation)) return 'Image generation';
  return 'Verses and other AI';
}

const microsToPaise = (micros, rate) => Math.round((micros * rate) / 10000);

async function revenueOfMonth(month) {
  const { from, to } = bounds(month);
  const paid = { paidAt: { gte: from, lt: to } };
  const sum = { grossInrMinor: true, commissionInrMinor: true, netInrMinor: true };

  const [byPurpose, refunds, trials, unconverted] = await Promise.all([
    // Paid in the month and not since refunded...
    prisma.payment.groupBy({
      by: ['purpose', 'provider'],
      where: { ...paid, status: { in: ['SUCCEEDED', 'REFUNDED'] }, isTrial: false },
      _sum: sum,
      _count: { _all: true },
    }),
    // ...less what was refunded in the month, whenever it was paid.
    prisma.payment.aggregate({
      where: { status: 'REFUNDED', refundedAt: { gte: from, lt: to }, isTrial: false },
      _sum: sum,
      _count: { _all: true },
    }),
    prisma.payment.count({ where: { ...paid, isTrial: true } }),
    // A foreign-currency payment whose rupee value is not known yet (the nightly job fills it in).
    prisma.payment.count({ where: { ...paid, status: 'SUCCEEDED', isTrial: false, grossInrMinor: null } }),
  ]);

  const total = { grossInr: 0, commissionInr: 0, netInr: 0, count: 0 };
  const lines = byPurpose.map((row) => {
    const line = {
      purpose: row.purpose,
      provider: row.provider,
      count: row._count._all,
      grossInr: row._sum.grossInrMinor || 0,
      commissionInr: row._sum.commissionInrMinor || 0,
      netInr: row._sum.netInrMinor || 0,
    };
    total.grossInr += line.grossInr;
    total.commissionInr += line.commissionInr;
    total.netInr += line.netInr;
    total.count += line.count;
    return line;
  });

  const refunded = {
    count: refunds._count._all,
    grossInr: refunds._sum.grossInrMinor || 0,
    commissionInr: refunds._sum.commissionInrMinor || 0,
    netInr: refunds._sum.netInrMinor || 0,
  };

  return {
    lines,
    refunded,
    freeTrials: trials,
    unconvertedPayments: unconverted,
    grossInr: total.grossInr - refunded.grossInr,
    commissionInr: total.commissionInr - refunded.commissionInr,
    netInr: total.netInr - refunded.netInr,
    paymentCount: total.count,
  };
}

async function aiCostOfMonth(month, rate) {
  const { from, to } = bounds(month);
  const rows = await prisma.aiUsageLog.groupBy({
    by: ['operation'],
    where: { createdAt: { gte: from, lt: to }, costMicros: { gt: 0 } },
    _sum: { costMicros: true },
    _count: { _all: true },
  });

  const groups = new Map();
  let micros = 0;
  for (const row of rows) {
    const key = aiGroup(row.operation);
    const group = groups.get(key) || { name: key, costMicros: 0, calls: 0 };
    group.costMicros += row._sum.costMicros || 0;
    group.calls += row._count._all;
    groups.set(key, group);
    micros += row._sum.costMicros || 0;
  }

  return {
    usdInrRate: rate,
    costMicros: micros,
    costInr: microsToPaise(micros, rate),
    groups: [...groups.values()]
      .sort((a, b) => b.costMicros - a.costMicros)
      .map((g) => ({ ...g, costInr: microsToPaise(g.costMicros, rate) })),
  };
}

async function entriesOfMonth(month) {
  const { from, to } = dayBounds(month);
  const rows = await prisma.financeEntry.groupBy({
    by: ['direction', 'category'],
    where: { occurredOn: { gte: from, lt: to } },
    _sum: { amountInr: true },
    _count: { _all: true },
  });

  const out = { creditInr: 0, debitInr: 0, byCategory: [], count: 0 };
  for (const row of rows) {
    const amount = row._sum.amountInr || 0;
    if (row.direction === 'CREDIT') out.creditInr += amount;
    else out.debitInr += amount;
    out.count += row._count._all;
    out.byCategory.push({ direction: row.direction, category: row.category, amountInr: amount, count: row._count._all });
  }
  return out;
}

/** Everything the Finance page shows for one month. All money is paise of INR. */
async function summary(month) {
  const row = await prisma.financeMonth.findUnique({ where: { month } });
  // A confirmed month keeps the rate it was closed at; an open one follows the setting.
  const rate = row?.usdInrRate ? Number(row.usdInrRate) : await currentRate();

  const [revenue, ai, manual] = await Promise.all([revenueOfMonth(month), aiCostOfMonth(month, rate), entriesOfMonth(month)]);

  const expensesInr = ai.costInr + manual.debitInr;
  return {
    month,
    timezone: TIMEZONE,
    confirmed: Boolean(row?.costsConfirmedAt),
    confirmedAt: row?.costsConfirmedAt || null,
    revenue,
    ai,
    manual,
    // What came in less what went out: store earnings plus typed credits, less AI and typed debits.
    incomeInr: revenue.netInr + manual.creditInr,
    expensesInr,
    profitInr: revenue.netInr + manual.creditInr - expensesInr,
  };
}

/**
 * Months that still need the super admin's costs: last month until confirmed, and this month in its
 * final days (so it can be done on the day).
 */
async function pendingMonths(at = new Date()) {
  const now = currentMonth(at);
  const candidates = [previousMonth(now)];
  if (daysLeftInMonth(at) <= 2) candidates.push(now);

  const confirmed = await prisma.financeMonth.findMany({
    where: { month: { in: candidates }, costsConfirmedAt: { not: null } },
    select: { month: true },
  });
  const done = new Set(confirmed.map((r) => r.month));
  return candidates.filter((m) => !done.has(m));
}

async function confirmMonth(month, userId) {
  const rate = await currentRate();
  const now = new Date();
  const existing = await prisma.financeMonth.findUnique({ where: { month } });
  return prisma.financeMonth.upsert({
    where: { month },
    create: { month, usdInrRate: rate, costsConfirmedAt: now, costsConfirmedById: userId },
    // The month is fixed at the rate it was first closed at; reopening clears it, so closing again re-fixes it.
    update: { costsConfirmedAt: now, costsConfirmedById: userId, usdInrRate: existing?.usdInrRate ?? rate },
  });
}

async function reopenMonth(month) {
  return prisma.financeMonth.updateMany({
    where: { month },
    data: { costsConfirmedAt: null, costsConfirmedById: null, usdInrRate: null },
  });
}

export {
  CATEGORIES,
  MONTH_RE,
  TIMEZONE,
  currentMonth,
  previousMonth,
  nextMonth,
  bounds,
  dayBounds,
  daysLeftInMonth,
  currentRate,
  aiGroup,
  microsToPaise,
  summary,
  pendingMonths,
  confirmMonth,
  reopenMonth,
};
