// A store subscription's life, from both stores, in one place.
//
// Google's Pub/Sub notifications and Apple's server notifications, the app's own
// verify call and the reconcile job all end up here with the same thing: the store's
// current state of one subscription, already normalised by google.js / apple.js
// (`verified`). This file turns that into rows:
//
//   Subscription   status, period end, auto-renew, plan (follows the product bought)
//   Payment        one per charge, a free trial a row of 0, with INR figures (money.js)
//   push           told to the reader when something they care about changed
//
// Everything is idempotent. The same state applied twice changes nothing and sends
// nothing, because notifications are decided by comparing before and after.
//
// What the store tells us, and what we do with it:
//   bought / trial started      subscription created, payment (0 for a trial)
//   renewed / trial -> paid     period moves forward, a new payment
//   auto-renew switched off     status CANCELLED, still entitled until the period ends
//   payment failed (grace)      status GRACE, still entitled; on hold: not entitled
//   expired                     status EXPIRED
//   refunded / revoked          payment REFUNDED, subscription REFUNDED, access ends now
//   plan changed                Google: new token that `replaces` the old; Apple: same
//                               subscription, new product. Plan follows the product.

import { prisma } from '../../config/database.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import * as entitlement from '../entitlement.js';
import * as notify from '../notify.js';
import * as payments from './index.js';

const PAYING = ['ACTIVE', 'IN_TRIAL', 'CANCELLED']; // states in which a charge has really gone through
const ENTITLED = ['IN_TRIAL', 'ACTIVE', 'GRACE', 'CANCELLED'];

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

const storeName = (provider) => (provider === 'APPLE_APP_STORE' ? 'App Store' : 'Google Play');

// The push for a change. Deep link is the app's own plans screen.
function messageFor({ kind, plan, until, provider }) {
  const link = { deeplink: 'hariharibol://premium' };
  const date = until ? fmtDate(until) : '';
  switch (kind) {
    case 'TRIAL_STARTED':
      return { title: `Your ${plan} free trial has begun`, body: `Enjoy ${plan} free until ${date}. Cancel any time in ${storeName(provider)}.`, data: link };
    case 'SUBSCRIBED':
      return { title: `Plan upgraded to ${plan}`, body: `Thank you! ${plan} is active until ${date}. Ask Sakha is ready for more.`, data: link };
    case 'UPGRADED':
      return { title: `Plan upgraded to ${plan}`, body: `${plan} is yours now, active until ${date}.`, data: link };
    case 'CHANGED':
      return { title: `Your plan is now ${plan}`, body: `${plan} is active until ${date}.`, data: link };
    case 'DOWNGRADE_SCHEDULED':
      return { title: `Your plan will change to ${plan}`, body: `You keep your current plan until ${date}, then move to ${plan}.`, data: link };
    case 'RENEWED':
      return { title: 'Subscription renewed', body: `${plan} renewed. Active until ${date}. Thank you for your support!`, data: link };
    case 'CANCELLED':
      return { title: 'Subscription cancelled', body: `${plan} will not renew. You keep it until ${date}.`, data: link };
    case 'RESUMED':
      return { title: 'Auto-renew is back on', body: `${plan} will renew on ${date}.`, data: link };
    case 'GRACE':
      return { title: 'We could not renew your plan', body: `${storeName(provider)} could not take the payment. Please update your payment method to keep ${plan}.`, data: link };
    case 'EXPIRED':
      return { title: 'Your subscription has ended', body: `${plan} has ended. You can come back any time from Plans.`, data: link };
    case 'REFUNDED':
      return { title: 'Your payment was refunded', body: `${plan} has ended with the refund.`, data: link };
    default:
      return null;
  }
}

async function push(userId, args) {
  const msg = messageFor(args);
  if (!msg) return;
  try {
    await notify.toUser(userId, { type: 'SYSTEM', source: 'subscription', campaign: `subscription-${args.kind.toLowerCase()}`, ...msg });
  } catch (err) {
    logger.error({ err: err.message, userId, kind: args.kind }, 'subscription push failed');
  }
}

// Who a store subscription belongs to: the row we already have, the subscription it
// replaces (a plan change), or the account id the app attached at purchase.
async function findOwner({ provider, verified, userId }) {
  if (userId) return userId;
  if (verified.replaces) {
    const old = await prisma.subscription.findUnique({
      where: { provider_externalId: { provider, externalId: verified.replaces } },
      select: { userId: true },
    });
    if (old) return old.userId;
  }
  if (verified.accountId) {
    const user = await prisma.user.findUnique({ where: { id: verified.accountId }, select: { id: true } });
    if (user) return user.id;
  }
  return null;
}

/**
 * Applies the store's current state of one subscription.
 *
 * @param {object} args
 * @param {string} args.provider  GOOGLE_PLAY | APPLE_APP_STORE
 * @param {object} args.verified  normalised state from google.js / apple.js
 * @param {string} [args.userId]  when the caller already knows who it is (the app's verify call)
 * @param {string} [args.event]   the store event that prompted this, for the record
 * @param {string} [args.subtype] Apple's subtype (UPGRADE, DOWNGRADE…)
 * @returns {Promise<{result: string, subscription?: object, plan?: object}>}
 */
async function applyStoreState({ provider, verified, userId = null, event = null, subtype = null }) {
  if (verified.status === 'PENDING') return { result: 'pending' };

  const existing = await prisma.subscription.findUnique({
    where: { provider_externalId: { provider, externalId: verified.externalId } },
    include: { plan: { select: { id: true, name: true, tier: true } } },
  });

  const ownerId = existing?.userId ?? (await findOwner({ provider, verified, userId }));
  if (!ownerId) {
    logger.warn({ provider, event, productId: verified.productId }, 'store subscription with no known owner');
    return { result: 'unknown_owner' };
  }

  // The plan follows the product that was bought; a stale product keeps the old plan.
  const price = verified.productId
    ? await prisma.planPrice.findUnique({
        where: { provider_productId: { provider, productId: verified.productId } },
        include: { plan: { select: { id: true, name: true, tier: true, isFree: true } } },
      })
    : null;
  const plan = price?.plan ?? existing?.plan;
  if (!plan) {
    logger.warn({ provider, productId: verified.productId }, 'store subscription for a product with no plan');
    return { result: 'unknown_product' };
  }

  const status = verified.status;
  const now = new Date();
  const periodEnd = verified.expiresAt ?? existing?.currentPeriodEnd ?? now;
  const autoRenewChanged = existing && existing.autoRenew !== verified.autoRenew;

  const subscription = await prisma.subscription.upsert({
    where: { provider_externalId: { provider, externalId: verified.externalId } },
    create: {
      userId: ownerId,
      planId: plan.id,
      priceId: price?.id ?? null,
      provider,
      externalId: verified.externalId,
      status,
      startedAt: verified.startedAt ?? now,
      currentPeriodEnd: periodEnd,
      autoRenew: verified.autoRenew,
      cancelledAt: status === 'CANCELLED' ? now : null,
      billingIssueAt: verified.billingIssue ? now : null,
      lastEvent: event,
      lastEventAt: now,
    },
    update: {
      planId: plan.id,
      ...(price ? { priceId: price.id } : {}),
      status,
      currentPeriodEnd: periodEnd,
      autoRenew: verified.autoRenew,
      cancelledAt: status === 'CANCELLED' ? (existing?.cancelledAt ?? now) : null,
      billingIssueAt: verified.billingIssue ? (existing?.billingIssueAt ?? now) : null,
      lastEvent: event,
      lastEventAt: now,
    },
  });

  // A plan change on Google is a new token; the old subscription ends with it.
  if (verified.replaces) {
    await prisma.subscription.updateMany({
      where: { provider, externalId: verified.replaces, userId: ownerId, status: { not: 'EXPIRED' } },
      data: { status: 'EXPIRED', currentPeriodEnd: now, lastEvent: 'REPLACED', lastEventAt: now },
    });
  }

  // The charge. One Payment per order / transaction, trial included (as 0).
  let charged = null;
  if (verified.orderId && PAYING.includes(status) && !verified.billingIssue) {
    const known = await prisma.payment.findUnique({
      where: { provider_externalId: { provider, externalId: verified.orderId } },
      select: { id: true },
    });
    if (!known) {
      const earlier = await prisma.payment.count({ where: { subscriptionId: subscription.id } });
      const isTrial = verified.isTrial ?? (earlier === 0 && (price?.trialDays ?? 0) > 0);
      // Store test purchases (licence testers, sandbox) are never revenue.
      if (verified.isTest && env.isProduction) {
        logger.info({ provider, orderId: verified.orderId }, 'test purchase: subscription granted, no payment row');
      } else {
        charged = await payments.recordPayment({
          userId: ownerId,
          subscriptionId: subscription.id,
          provider,
          purpose: 'SUBSCRIPTION',
          externalId: verified.orderId,
          amountMinor: verified.priceMinor ?? price?.priceMinor ?? 0,
          currency: verified.currency ?? price?.currency ?? 'INR',
          status: 'SUCCEEDED',
          isTrial,
          paidAt: now,
          providerPayload: verified.raw,
        });
      }
    }
  }

  await entitlement.refresh(ownerId);

  // What to tell the reader — decided by what changed, so a retry says nothing twice.
  const args = { plan: plan.name, until: periodEnd, provider };
  if (!existing) {
    if (ENTITLED.includes(status)) await push(ownerId, { ...args, kind: charged?.isTrial || status === 'IN_TRIAL' ? 'TRIAL_STARTED' : 'SUBSCRIBED' });
  } else if (existing.planId !== plan.id && ENTITLED.includes(status)) {
    await push(ownerId, { ...args, kind: plan.tier > existing.plan.tier ? 'UPGRADED' : 'CHANGED' });
  } else if (subtype === 'DOWNGRADE' && verified.nextProductId) {
    const next = await prisma.planPrice.findUnique({
      where: { provider_productId: { provider, productId: verified.nextProductId } },
      include: { plan: { select: { name: true } } },
    });
    if (next) await push(ownerId, { ...args, plan: next.plan.name, kind: 'DOWNGRADE_SCHEDULED' });
  } else if (charged && !charged.isTrial && existing.currentPeriodEnd < periodEnd) {
    await push(ownerId, { ...args, kind: 'RENEWED' });
  } else if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
    await push(ownerId, { ...args, kind: 'CANCELLED' });
  } else if (status === 'GRACE' && existing.status !== 'GRACE') {
    await push(ownerId, { ...args, kind: 'GRACE' });
  } else if (status === 'EXPIRED' && ENTITLED.includes(existing.status) && !verified.replaces) {
    await push(ownerId, { ...args, kind: 'EXPIRED' });
  } else if (status === 'REFUNDED' && existing.status !== 'REFUNDED') {
    await push(ownerId, { ...args, kind: 'REFUNDED' });
  } else if (autoRenewChanged && verified.autoRenew && ['ACTIVE', 'IN_TRIAL'].includes(status)) {
    await push(ownerId, { ...args, kind: 'RESUMED' });
  }

  return { result: existing ? 'updated' : 'created', subscription, plan, charged };
}

/**
 * The store gave the money back (Google voided purchase / REVOKED, Apple REFUND / REVOKE).
 * The payment becomes REFUNDED (the figures stay, with `refundedAt`) and access ends now.
 */
async function applyRefund({ provider, orderId, subscriptionExternalId }) {
  let payment = orderId
    ? await prisma.payment.findUnique({ where: { provider_externalId: { provider, externalId: orderId } } })
    : null;

  let subscription = null;
  if (!payment && subscriptionExternalId) {
    subscription = await prisma.subscription.findUnique({
      where: { provider_externalId: { provider, externalId: subscriptionExternalId } },
    });
    if (subscription) {
      payment = await prisma.payment.findFirst({
        where: { subscriptionId: subscription.id, status: 'SUCCEEDED' },
        orderBy: { paidAt: 'desc' },
      });
    }
  }
  if (!payment && !subscription) return { result: 'unknown' };

  if (payment && payment.status === 'SUCCEEDED') {
    await payments.markRefunded({ provider, externalId: payment.externalId });
  }

  const subscriptionId = payment?.subscriptionId ?? subscription?.id;
  if (!subscriptionId) return { result: 'refunded' };

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: { select: { name: true } } },
  });
  if (!sub || sub.status === 'REFUNDED') return { result: 'refunded' };

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: 'REFUNDED', currentPeriodEnd: new Date(), lastEvent: 'REFUND', lastEventAt: new Date() },
  });
  await entitlement.refresh(sub.userId);
  await push(sub.userId, { kind: 'REFUNDED', plan: sub.plan.name, provider });
  return { result: 'refunded' };
}

/**
 * Catches what a missed notification would have: every store subscription whose paid
 * period has run out (or is about to) is read from the store again. A renewal that
 * arrived unnoticed extends it; one that did not expires it, with the reader told.
 */
async function reconcile({ limit = 200 } = {}) {
  const due = await prisma.subscription.findMany({
    where: {
      provider: { in: ['GOOGLE_PLAY', 'APPLE_APP_STORE'] },
      status: { in: ENTITLED },
      currentPeriodEnd: { lt: new Date(Date.now() + 6 * 3600 * 1000) },
    },
    orderBy: { currentPeriodEnd: 'asc' },
    take: limit,
  });

  let changed = 0;
  let failed = 0;
  for (const sub of due) {
    try {
      const module = payments.providers[sub.provider];
      if (!module.isConfigured()) continue;
      const verified =
        sub.provider === 'GOOGLE_PLAY'
          ? await module.verifySubscription({ purchaseToken: sub.externalId })
          : await module.verifySubscription(sub.externalId);
      await applyStoreState({ provider: sub.provider, verified, userId: sub.userId, event: 'RECONCILE' });
      changed += 1;
    } catch (err) {
      failed += 1;
      logger.warn({ subscriptionId: sub.id, err: err.message }, 'subscription reconcile failed');
    }
  }
  logger.info({ checked: due.length, changed, failed }, 'subscription reconcile finished');
  return { checked: due.length, changed, failed };
}

export { applyStoreState, applyRefund, reconcile, messageFor };
