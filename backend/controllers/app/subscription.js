// Subscriptions.
//
// Plans are tiers (Free, Premium, …). What a plan costs is a PlanPrice — one
// per store and billing period — and what it unlocks is a set of Features with
// a value per plan. The app itself is free; paid plans add benefits, they do
// not take things away from the free one.
//
// A purchase token from the client is never trusted. Every verification is a
// server-to-server call to Google or Apple, and what they say is what gets
// written. Entitlement itself is not decided here — services/entitlement.js
// owns that, and recomputes it from the ledger.

import { prisma } from '../../config/database.js';
import * as payments from '../../services/payments/index.js';
import * as entitlement from '../../services/entitlement.js';
import { ok, created } from '../../utils/respond.js';
import { notFound, badRequest } from '../../utils/errors.js';

const presentPrice = (price) => ({
  id: price.id,
  provider: price.provider,
  // The id the store knows the product by — differs per store, which is why
  // the app is told it rather than hardcoding it.
  productId: price.productId,
  // Minor units — paise for INR, cents for USD. The client formats; the
  // server never sends a float. The store's own localised price, when the
  // client can read it, is what the user is actually charged.
  priceMinor: price.priceMinor,
  currency: price.currency,
  periodDays: price.periodDays,
  trialDays: price.trialDays,
});

/**
 * GET /api/app/subscription/plans — public, so the paywall can be shown before sign-in.
 * `?provider=` narrows the prices to the store this device buys from.
 */
export const plans = async (req, res) => {
  const { provider } = req.valid.query;

  const [plans, features] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { tier: 'asc' },
      include: {
        prices: {
          where: { isActive: true, ...(provider ? { provider } : {}) },
          orderBy: { periodDays: 'asc' },
        },
        features: true,
      },
    }),
    prisma.feature.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
  ]);

  return ok(res, {
    // The catalogue, so the app can lay out a comparison table in one pass.
    features: features.map((f) => ({ key: f.key, name: f.name, description: f.description, kind: f.kind, unit: f.unit })),
    plans: plans.map((plan) => {
      const values = new Map(plan.features.map((v) => [v.featureId, v]));
      return {
        id: plan.id,
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        tier: plan.tier,
        isFree: plan.isFree,
        prices: plan.prices.map(presentPrice),
        features: Object.fromEntries(
          features.map((f) => {
            const v = values.get(f.id);
            return [
              f.key,
              { enabled: v ? v.enabled : f.defaultEnabled, limit: v && f.kind === 'LIMIT' ? v.limit : null },
            ];
          })
        ),
      };
    }),
  });
};

/**
 * GET /api/app/subscription/me
 * What this user is entitled to and why. `reason` matters — a donor and a
 * subscriber both have Premium, but only one of them has something to renew.
 */
export const mine = async (req, res) => {
  const userId = req.auth.user.id;

  const [subscription, computed] = await Promise.all([
    prisma.subscription.findFirst({
      where: { userId },
      orderBy: { currentPeriodEnd: 'desc' },
      include: {
        plan: { select: { slug: true, name: true, tier: true } },
        price: { select: { priceMinor: true, currency: true, periodDays: true } },
      },
    }),
    entitlement.compute(userId),
  ]);

  return ok(res, {
    isPremium: computed.isPremium,
    premiumSince: computed.premiumSince,
    premiumUntil: computed.premiumUntil,
    reason: computed.reason,
    plan: computed.plan,
    features: await entitlement.featuresForPlan(computed.plan?.id),
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          provider: subscription.provider,
          currentPeriodEnd: subscription.currentPeriodEnd,
          autoRenew: subscription.autoRenew,
          plan: subscription.plan,
          price: subscription.price,
        }
      : null,
  });
};

/**
 * POST /api/app/subscription/verify
 *
 * Called by the app straight after a store purchase. The webhook is the
 * authoritative path — it arrives whether or not the app is still open — but
 * waiting for it would leave someone staring at a paywall they have just paid
 * to remove. This gives them access now; the webhook reconciles later, and
 * because both write through the same idempotent upsert, neither double-counts.
 */
export const verify = async (req, res) => {
  const user = req.auth.user;
  const { provider, productId, purchaseToken, transactionId } = req.valid.body;

  // The product id names a price, and the price names the plan. Inactive prices
  // still resolve: someone who bought before it was retired has paid for it.
  const price = await prisma.planPrice.findUnique({
    where: { provider_productId: { provider, productId } },
    include: { plan: true },
  });
  if (!price || price.plan.isFree) throw notFound(`A plan for product ${productId}`);
  const plan = price.plan;

  let verified;
  if (provider === 'GOOGLE_PLAY') {
    if (!purchaseToken) throw badRequest('purchaseToken is required for Google Play');
    verified = await payments.providers.GOOGLE_PLAY.verifySubscription({ productId, purchaseToken });
  } else {
    if (!transactionId) throw badRequest('transactionId is required for the App Store');
    verified = await payments.providers.APPLE_APP_STORE.verifySubscription(transactionId);
  }

  if (!verified.isValid) throw badRequest('That subscription is not active');

  const subscription = await payments.upsertSubscription({
    userId: user.id,
    planId: plan.id,
    priceId: price.id,
    provider,
    externalId: verified.externalId,
    status: 'ACTIVE',
    currentPeriodEnd: verified.expiresAt,
    autoRenew: verified.autoRenew,
  });

  await payments.recordPayment({
    userId: user.id,
    subscriptionId: subscription.id,
    provider,
    purpose: 'SUBSCRIPTION',
    // The subscription is keyed by the token that survives renewals; a payment
    // is keyed by the order, which is different every month. Using the same key
    // for both would collapse a year of renewals into one ledger row.
    externalId: verified.orderId || verified.externalId,
    amountMinor: verified.priceMinor ?? price.priceMinor,
    currency: verified.currency ?? price.currency,
    status: 'SUCCEEDED',
    providerPayload: verified.raw,
  });

  return created(res, {
    subscription: {
      id: subscription.id,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
    isPremium: true,
    plan: { slug: plan.slug, name: plan.name, tier: plan.tier },
  });
};

/**
 * POST /api/app/subscription/restore
 * Re-reads the store and rebuilds entitlement. For a reinstall, or a device
 * where the webhook landed while the user was signed out.
 */
export const restore = async (req, res) => {
  const result = await entitlement.refresh(req.auth.user.id);
  return ok(res, result);
};
