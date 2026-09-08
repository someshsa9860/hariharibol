// The money screens: plans, subscriptions, the payment ledger and refunds.
//
// Nothing here decides entitlement. services/entitlement.js does, by
// recomputing it from the ledger — so an admin marking a payment refunded
// removes access as a consequence of the ledger changing, not because this file
// reached over and flipped a flag.

const { prisma } = require('../../config/database');
const audit = require('../../services/audit');
const payments = require('../../services/payments');
const entitlement = require('../../services/entitlement');
const { ok, created, paginated } = require('../../utils/respond');
const { paginate } = require('../../utils/pagination');
const { notFound, badRequest } = require('../../utils/errors');

// ── Plans ──────────────────────────────────────────────────────────────────

exports.listPlans = async (req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { subscriptions: true } } },
  });
  return ok(res, plans);
};

exports.createPlan = async (req, res) => {
  const plan = await prisma.subscriptionPlan.create({ data: req.valid.body });
  await audit.record(req, {
    action: 'plan.create',
    entityType: 'SubscriptionPlan',
    entityId: plan.id,
    after: req.valid.body,
  });
  return created(res, plan);
};

/**
 * PATCH /api/admin/plans/:id
 *
 * Changing a price does not change what an existing subscriber pays — their
 * Subscription keeps pointing at this plan, and the amount they were actually
 * charged is on their Payment rows. That is why the ledger stores the amount
 * rather than reading it back off the plan.
 */
exports.updatePlan = async (req, res) => {
  const before = await prisma.subscriptionPlan.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('Plan');

  const plan = await prisma.subscriptionPlan.update({
    where: { id: before.id },
    data: req.valid.body,
  });

  await audit.record(req, {
    action: 'plan.update',
    entityType: 'SubscriptionPlan',
    entityId: plan.id,
    before,
    after: plan,
  });

  return ok(res, plan);
};

// ── Subscriptions ──────────────────────────────────────────────────────────

exports.listSubscriptions = async (req, res) => {
  const { status, provider } = req.valid.query;

  const { items, page } = await paginate(prisma.subscription, {
    where: { ...(status ? { status } : {}), ...(provider ? { provider } : {}) },
    orderBy: { currentPeriodEnd: 'desc' },
    include: {
      user: { select: { id: true, email: true, name: true } },
      plan: { select: { slug: true, name: true } },
    },
    query: req.valid.query,
  });

  return paginated(res, items, page);
};

// ── Payments ───────────────────────────────────────────────────────────────

exports.listPayments = async (req, res) => {
  const { purpose, status, provider, from, to } = req.valid.query;

  const { items, page } = await paginate(prisma.payment, {
    where: {
      ...(purpose ? { purpose } : {}),
      ...(status ? { status } : {}),
      ...(provider ? { provider } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, email: true, name: true } } },
    query: req.valid.query,
  });

  return paginated(res, items, page);
};

/**
 * GET /api/admin/payments/summary
 * Totals by purpose and currency. Grouped by currency deliberately — summing
 * paise and cents into one number would be meaningless, and a single "revenue"
 * figure across currencies is exactly the kind of thing that goes unnoticed.
 */
exports.summary = async (req, res) => {
  const from = req.valid.query.from ? new Date(req.valid.query.from) : new Date(Date.now() - 30 * 86400000);

  const rows = await prisma.payment.groupBy({
    by: ['purpose', 'currency'],
    where: { status: 'SUCCEEDED', paidAt: { gte: from } },
    _sum: { amountMinor: true },
    _count: { _all: true },
  });

  return ok(res, {
    from,
    totals: rows.map((row) => ({
      purpose: row.purpose,
      currency: row.currency,
      amountMinor: row._sum.amountMinor || 0,
      count: row._count._all,
    })),
  });
};

/**
 * POST /api/admin/payments/:id/refund
 *
 * Records that a refund happened; it does not issue one. The money is returned
 * through the provider's own console, and this brings our ledger back in line —
 * which then recomputes entitlement, so a refunded donation stops granting
 * permanent Premium.
 */
exports.refund = async (req, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: req.valid.params.id } });
  if (!payment) throw notFound('Payment');
  if (payment.status === 'REFUNDED') throw badRequest('That payment is already marked refunded');
  if (payment.status !== 'SUCCEEDED') throw badRequest('Only a successful payment can be refunded');

  await payments.markRefunded({ provider: payment.provider, externalId: payment.externalId });

  await audit.record(req, {
    action: 'payment.refund',
    entityType: 'Payment',
    entityId: payment.id,
    before: { status: payment.status },
    after: { status: 'REFUNDED', reason: req.valid.body.reason },
  });

  return ok(res, { refunded: true });
};

/** POST /api/admin/payments/entitlement/:userId — recompute one account. */
exports.refreshEntitlement = async (req, res) => {
  const result = await entitlement.refresh(req.valid.params.userId);
  return ok(res, result);
};

/**
 * GET /api/admin/payments/donors
 * Donors, most recent first. Anonymous donors are included as totals but not
 * named — they asked not to be, and an admin list is still a list.
 */
exports.donors = async (req, res) => {
  const donations = await prisma.payment.findMany({
    where: { purpose: 'DONATION', status: 'SUCCEEDED' },
    orderBy: { paidAt: 'desc' },
    take: 200,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return ok(
    res,
    donations.map((row) => ({
      id: row.id,
      amountMinor: row.amountMinor,
      currency: row.currency,
      message: row.message,
      paidAt: row.paidAt,
      provider: row.provider,
      donor: row.isAnonymous ? null : row.user,
      isAnonymous: row.isAnonymous,
    }))
  );
};
