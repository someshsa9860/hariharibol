// Plans, their prices and the features they unlock.
//
// Three things are edited here and they are kept apart on purpose:
//
//   - the plan itself — a tier with a name (Free, Premium, …)
//   - its prices — one per store and billing period, so a plan can cost a
//     different amount on Google Play than on the App Store
//   - its features — a catalogue of things the product can do, with a value per
//     plan, so a benefit added next month is a row here and not a deploy
//
// Nothing here decides who is entitled to what; services/entitlement.js does,
// from the ledger. Changing a price never changes what an existing subscriber
// pays — the amount they were charged is on their Payment rows.

import { prisma } from '../../config/database.js';
import * as audit from '../../services/audit.js';
import * as payments from '../../services/payments/index.js';
import { ok, created } from '../../utils/respond.js';
import { notFound, badRequest } from '../../utils/errors.js';

// ── Providers ──────────────────────────────────────────────────────────────

/** The stores a price can be attached to — whatever services/payments knows about. */
export const providerKeys = Object.keys(payments.providers);

export const listProviders = async (req, res) => ok(res, providerKeys);

// ── Plans ──────────────────────────────────────────────────────────────────

export const listPlans = async (req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { tier: 'asc' },
    include: {
      prices: { orderBy: [{ provider: 'asc' }, { periodDays: 'asc' }] },
      features: true,
      _count: { select: { subscriptions: true } },
    },
  });
  return ok(res, plans);
};

export const createPlan = async (req, res) => {
  const plan = await prisma.subscriptionPlan.create({ data: req.valid.body });
  await audit.record(req, {
    action: 'plan.create',
    entityType: 'SubscriptionPlan',
    entityId: plan.id,
    after: req.valid.body,
  });
  return created(res, plan);
};

export const updatePlan = async (req, res) => {
  const before = await prisma.subscriptionPlan.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('Plan');

  // The free baseline is what everyone falls back to; switching it off would
  // leave a user with no plan at all.
  if (before.isFree && req.valid.body.isActive === false) throw badRequest('The free plan cannot be deactivated');
  if (before.isFree && req.valid.body.grantedToDonors) throw badRequest('A donation cannot earn the free plan');

  const plan = await prisma.subscriptionPlan.update({ where: { id: before.id }, data: req.valid.body });
  await audit.record(req, {
    action: 'plan.update',
    entityType: 'SubscriptionPlan',
    entityId: plan.id,
    before,
    after: plan,
  });
  return ok(res, plan);
};

// Sets a plan's value for several features at once — the plan × feature matrix
// is edited a plan at a time. Features not mentioned keep what they had.
export const setPlanFeatures = async (req, res) => {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: req.valid.params.id } });
  if (!plan) throw notFound('Plan');

  const { values } = req.valid.body;
  const known = await prisma.feature.findMany({
    where: { id: { in: values.map((v) => v.featureId) } },
    select: { id: true },
  });
  if (known.length !== new Set(values.map((v) => v.featureId)).size) throw badRequest('Unknown feature in the list');

  await prisma.$transaction(
    values.map((v) =>
      prisma.planFeature.upsert({
        where: { planId_featureId: { planId: plan.id, featureId: v.featureId } },
        update: { enabled: v.enabled, limit: v.limit ?? null },
        create: { planId: plan.id, featureId: v.featureId, enabled: v.enabled, limit: v.limit ?? null },
      })
    )
  );

  await audit.record(req, {
    action: 'plan.features',
    entityType: 'SubscriptionPlan',
    entityId: plan.id,
    after: values,
  });

  return ok(res, await prisma.planFeature.findMany({ where: { planId: plan.id } }));
};

// ── Prices ─────────────────────────────────────────────────────────────────

export const createPrice = async (req, res) => {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: req.valid.params.id } });
  if (!plan) throw notFound('Plan');
  if (plan.isFree) throw badRequest('The free plan is not sold, so it has no prices');

  const { provider, productId } = req.valid.body;
  const taken = await prisma.planPrice.findUnique({ where: { provider_productId: { provider, productId } } });
  if (taken) throw badRequest(`${provider} product ${productId} is already a price`);

  const price = await prisma.planPrice.create({ data: { ...req.valid.body, planId: plan.id } });
  await audit.record(req, {
    action: 'plan.price.create',
    entityType: 'PlanPrice',
    entityId: price.id,
    after: price,
  });
  return created(res, price);
};

export const updatePrice = async (req, res) => {
  const before = await prisma.planPrice.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('Price');

  const price = await prisma.planPrice.update({ where: { id: before.id }, data: req.valid.body });
  await audit.record(req, { action: 'plan.price.update', entityType: 'PlanPrice', entityId: price.id, before, after: price });
  return ok(res, price);
};

export const deletePrice = async (req, res) => {
  const price = await prisma.planPrice.findUnique({
    where: { id: req.valid.params.id },
    include: { _count: { select: { subscriptions: true } } },
  });
  if (!price) throw notFound('Price');
  // A price people have bought through is history; retire it instead.
  if (price._count.subscriptions > 0) throw badRequest('Subscribers bought through this price — deactivate it instead');

  await prisma.planPrice.delete({ where: { id: price.id } });
  await audit.record(req, { action: 'plan.price.delete', entityType: 'PlanPrice', entityId: price.id, before: price });
  return ok(res, { deleted: true });
};

// ── Features ───────────────────────────────────────────────────────────────

export const listFeatures = async (req, res) => {
  const features = await prisma.feature.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  return ok(res, features);
};

export const createFeature = async (req, res) => {
  const taken = await prisma.feature.findUnique({ where: { key: req.valid.body.key } });
  if (taken) throw badRequest(`A feature with key ${req.valid.body.key} already exists`);

  const feature = await prisma.feature.create({ data: req.valid.body });
  await audit.record(req, { action: 'feature.create', entityType: 'Feature', entityId: feature.id, after: feature });
  return created(res, feature);
};

// `key` is not editable: code asks about features by it.
export const updateFeature = async (req, res) => {
  const before = await prisma.feature.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('Feature');

  const feature = await prisma.feature.update({ where: { id: before.id }, data: req.valid.body });
  await audit.record(req, { action: 'feature.update', entityType: 'Feature', entityId: feature.id, before, after: feature });
  return ok(res, feature);
};

export const deleteFeature = async (req, res) => {
  const feature = await prisma.feature.findUnique({ where: { id: req.valid.params.id } });
  if (!feature) throw notFound('Feature');

  // Its values on every plan go with it (cascade). Code that still asks for the
  // key will find it missing and treat it as off — hence "deactivate" is the
  // kinder tool, and this is for a feature that was a mistake.
  await prisma.feature.delete({ where: { id: feature.id } });
  await audit.record(req, { action: 'feature.delete', entityType: 'Feature', entityId: feature.id, before: feature });
  return ok(res, { deleted: true });
};
