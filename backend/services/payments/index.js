// Writes to the money tables. Subscriptions and donations both land in
// `Payment`, separated by `purpose` — one ledger, because both arrive as
// provider webhooks and both reconcile the same way.
//
// Everything here is idempotent on `(provider, externalId)`. Every provider
// retries its webhooks, sometimes for days, and without that a retry credits a
// user twice. It is a unique index in the schema and an upsert here; neither
// alone is enough, because two retries can race.

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import * as entitlement from '../entitlement.js';
import * as notify from '../notify.js';
import * as google from './google.js';
import * as apple from './apple.js';
import * as razorpay from './razorpay.js';

const providers = { GOOGLE_PLAY: google, APPLE_APP_STORE: apple, RAZORPAY: razorpay };

// Records money moving, then recomputes what the user is entitled to. The
// second half is the point — a Payment row that does not refresh entitlement is
// a user who paid and did not get access.
async function recordPayment(input) {
  const {
    userId,
    provider,
    purpose,
    externalId,
    amountMinor,
    currency,
    status = 'SUCCEEDED',
    subscriptionId = null,
    message = null,
    isAnonymous = false,
    providerPayload = null,
    paidAt = new Date(),
  } = input;

  const data = {
    userId,
    subscriptionId,
    provider,
    purpose,
    externalId,
    amountMinor,
    currency,
    status,
    message,
    isAnonymous,
    providerPayload,
    paidAt: status === 'SUCCEEDED' ? paidAt : null,
  };

  const payment = await prisma.payment.upsert({
    where: { provider_externalId: { provider, externalId } },
    // A retry may carry a newer status — pending settling to succeeded, or a
    // refund. The user and the amount are not re-written: the first write is
    // authoritative about who paid what.
    update: { status: data.status, paidAt: data.paidAt, providerPayload, subscriptionId },
    create: data,
  });

  await entitlement.refresh(userId);
  logger.info({ userId, provider, purpose, amountMinor, currency, status }, 'payment recorded');

  return payment;
}

// Creates or moves a subscription forward. Called on first purchase and on
// every renewal notification — the same code path, because a renewal is only a
// new `currentPeriodEnd`.
async function upsertSubscription(input) {
  const {
    userId,
    planId,
    provider,
    externalId,
    status = 'ACTIVE',
    currentPeriodEnd,
    autoRenew = true,
    startedAt = new Date(),
  } = input;

  const subscription = await prisma.subscription.upsert({
    where: { provider_externalId: { provider, externalId } },
    update: { status, currentPeriodEnd, autoRenew, planId },
    create: { userId, planId, provider, externalId, status, currentPeriodEnd, autoRenew, startedAt },
  });

  await entitlement.refresh(userId);
  return subscription;
}

async function markRefunded({ provider, externalId }) {
  const payment = await prisma.payment.findUnique({
    where: { provider_externalId: { provider, externalId } },
  });
  if (!payment) return null;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'REFUNDED', refundedAt: new Date() },
  });

  // A refunded donation stops being a reason to keep permanent access. That is
  // decided by entitlement.compute, which only counts SUCCEEDED rows.
  await entitlement.refresh(payment.userId);
  logger.info({ paymentId: payment.id, userId: payment.userId }, 'payment refunded');

  return payment;
}

// Sent after a donation, once — the thank-you is part of the transaction as far
// as the donor is concerned.
async function thankDonor(userId, amountMinor, currency) {
  await notify.toUser(userId, {
    type: 'SYSTEM',
    title: 'Thank you',
    body: 'Your donation keeps HariHariBol running. Premium is yours, permanently.',
    data: { deeplink: 'hariharibol://premium', amountMinor: String(amountMinor), currency },
  });
}

export { providers, recordPayment, upsertSubscription, markRefunded, thankDonor };
