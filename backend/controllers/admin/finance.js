// The super admin's finance section: a month's revenue, AI cost, typed credits and debits, and profit.
//
// Everything is INR. Revenue and AI cost are read where they already live (see services/finance.js); only the
// lines typed in here are stored here. Month-end: the reminder job nudges until the month's costs are confirmed.

import { prisma } from '../../config/database.js';
import * as audit from '../../services/audit.js';
import * as finance from '../../services/finance.js';
import * as settings from '../../services/setting.js';
import { SETTING_KEYS } from '../../config/constants.js';
import { ok, created, noContent, paginated } from '../../utils/respond.js';
import { paginate, readSort } from '../../utils/pagination.js';
import { notFound, badRequest } from '../../utils/errors.js';

export const ENTRY_SORT_COLUMNS = { occurredOn: 'occurredOn', amount: 'amountInr', category: 'category', createdAt: 'createdAt' };

const toPaise = (rupees) => Math.round(rupees * 100);
const present = (entry) => ({ ...entry, occurredOn: entry.occurredOn.toISOString().slice(0, 10) });

/** GET /api/admin/finance/overview — the last twelve months side by side, and what still needs entering. */
export const overview = async (req, res) => {
  const months = [];
  let month = finance.currentMonth();
  for (let i = 0; i < 12; i += 1) {
    months.push(month);
    month = finance.previousMonth(month);
  }

  const rows = await Promise.all(months.map((m) => finance.summary(m)));
  const trend = rows.map((row) => ({
    month: row.month,
    confirmed: row.confirmed,
    grossInr: row.revenue.grossInr,
    netRevenueInr: row.revenue.netInr,
    aiCostInr: row.ai.costInr,
    otherExpensesInr: row.manual.debitInr,
    creditsInr: row.manual.creditInr,
    profitInr: row.profitInr,
  }));

  return ok(res, {
    currentMonth: months[0],
    pendingMonths: await finance.pendingMonths(),
    usdInrRate: await finance.currentRate(),
    categories: finance.CATEGORIES,
    trend: trend.reverse(),
  });
};

/** GET /api/admin/finance/pending — cheap enough for the banner every page asks. */
export const pending = async (req, res) => ok(res, { months: await finance.pendingMonths() });

/** GET /api/admin/finance/months/:month */
export const month = async (req, res) => ok(res, await finance.summary(req.valid.params.month));

export const listEntries = async (req, res) => {
  const { month: m, direction, category } = req.valid.query;
  const range = m ? finance.dayBounds(m) : null;

  const { items, page } = await paginate(prisma.financeEntry, {
    where: {
      ...(range ? { occurredOn: { gte: range.from, lt: range.to } } : {}),
      ...(direction ? { direction } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: readSort(req.valid.query, ENTRY_SORT_COLUMNS, [{ occurredOn: 'desc' }, { createdAt: 'desc' }]),
    query: req.valid.query,
  });

  return paginated(res, items.map(present), page);
};

export const createEntry = async (req, res) => {
  const { amount, date, ...rest } = req.valid.body;
  const entry = await prisma.financeEntry.create({
    data: { ...rest, amountInr: toPaise(amount), occurredOn: new Date(`${date}T00:00:00Z`), createdById: req.auth.user.id },
  });
  await audit.record(req, { action: 'finance.entry.create', entityType: 'FinanceEntry', entityId: entry.id, after: present(entry) });
  return created(res, present(entry));
};

export const updateEntry = async (req, res) => {
  const before = await prisma.financeEntry.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('No such entry');

  const { amount, date, ...rest } = req.valid.body;
  const entry = await prisma.financeEntry.update({
    where: { id: before.id },
    data: {
      ...rest,
      ...(amount !== undefined ? { amountInr: toPaise(amount) } : {}),
      ...(date ? { occurredOn: new Date(`${date}T00:00:00Z`) } : {}),
    },
  });
  await audit.record(req, {
    action: 'finance.entry.update',
    entityType: 'FinanceEntry',
    entityId: entry.id,
    before: present(before),
    after: present(entry),
  });
  return ok(res, present(entry));
};

export const deleteEntry = async (req, res) => {
  const before = await prisma.financeEntry.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('No such entry');
  await prisma.financeEntry.delete({ where: { id: before.id } });
  await audit.record(req, { action: 'finance.entry.delete', entityType: 'FinanceEntry', entityId: before.id, before: present(before) });
  return noContent(res);
};

/** POST /api/admin/finance/months/:month/confirm — "this month's costs are all in". Fixes the dollar rate. */
export const confirm = async (req, res) => {
  const { month: m } = req.valid.params;
  if (m >= finance.currentMonth() && finance.daysLeftInMonth() > 2) {
    throw badRequest('A month can be confirmed in its last two days or after it ends');
  }
  await finance.confirmMonth(m, req.auth.user.id);
  await audit.record(req, { action: 'finance.month.confirm', entityType: 'FinanceMonth', entityId: m });
  return ok(res, await finance.summary(m));
};

/** DELETE /api/admin/finance/months/:month/confirm — reopen a month to add a late cost. */
export const reopen = async (req, res) => {
  const { month: m } = req.valid.params;
  await finance.reopenMonth(m);
  await audit.record(req, { action: 'finance.month.reopen', entityType: 'FinanceMonth', entityId: m });
  return ok(res, await finance.summary(m));
};

/** PUT /api/admin/finance/rate — the rupees per US dollar open months convert AI spend at. */
export const setRate = async (req, res) => {
  const before = await finance.currentRate();
  await settings.set(SETTING_KEYS.FINANCE_USD_INR_RATE, String(req.valid.body.rate), {
    description: 'Rupees per US dollar, for putting AI spend into the books in INR',
    updatedById: req.auth.user.id,
  });
  await audit.record(req, {
    action: 'finance.rate.update',
    entityType: 'AppSetting',
    entityId: SETTING_KEYS.FINANCE_USD_INR_RATE,
    before: { rate: before },
    after: { rate: req.valid.body.rate },
  });
  return ok(res, { usdInrRate: req.valid.body.rate });
};
