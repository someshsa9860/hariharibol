// Subscriptions.
//
// One plan: Premium, monthly. The app itself is free — the only thing behind
// the paywall is the mood-driven sloka, which is also the only feature with a
// per-user cost behind it. Spend follows revenue rather than running ahead of
// it.
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

/** GET /api/app/subscription/plans — public, so the paywall can be shown before sign-in. */
export const plans = async (req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { priceMinor: 'asc' },
  });

  return ok(
    res,
    plans.map((plan) => ({
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      // Minor units — paise for INR, cents for USD. The client formats; the
      // server never sends a float.
      priceMinor: plan.priceMinor,
      currency: plan.currency,
      periodDays: plan.periodDays,
      // Each store issues its own product id, which is why these live on the
      // plan rather than being constants in the app.
      googleProductId: plan.googleProductId,
      appleProductId: plan.appleProductId,
      razorpayPlanId: plan.razorpayPlanId,
    }))
  );
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
      include: { plan: { select: { slug: true, name: true, priceMinor: true, currency: true } } },
    }),
    entitlement.compute(userId),
  ]);

  return ok(res, {
    isPremium: computed.isPremium,
    premiumSince: computed.premiumSince,
    premiumUntil: computed.premiumUntil,
    reason: computed.reason,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          provider: subscription.provider,
          currentPeriodEnd: subscription.currentPeriodEnd,
          autoRenew: subscription.autoRenew,
          plan: subscription.plan,
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

  const plan = await prisma.subscriptionPlan.findFirst({
    where: {
      isActive: true,
      ...(provider === 'GOOGLE_PLAY' ? { googleProductId: productId } : {}),
      ...(provider === 'APPLE_APP_STORE' ? { appleProductId: productId } : {}),
    },
  });
  if (!plan) throw notFound(`A plan for product ${productId}`);

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
    amountMinor: verified.priceMinor ?? plan.priceMinor,
    currency: verified.currency ?? plan.currency,
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
