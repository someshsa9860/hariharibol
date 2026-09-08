// Payment webhooks — the authoritative path for money.
//
// The client-side verify endpoints exist so a user is not left staring at a
// paywall they have just paid to remove. These are what actually decide the
// ledger: they arrive whether or not the app is still open, whether or not the
// phone lost signal, and they keep arriving on renewals, refunds and
// cancellations long after the purchase.
//
// Three rules hold for every handler here:
//
//   1. Verify before believing. A webhook body is an unauthenticated HTTP
//      request until its signature is checked or its claim is confirmed against
//      the provider's own API.
//   2. Be idempotent. Every provider retries, sometimes for days. Writes go
//      through services/payments, which upserts on (provider, externalId).
//   3. Answer 200 quickly. A provider that gets a slow or failing response
//      retries harder, and a handler that does its work after responding is
//      easier to reason about than one holding the connection open.

const { prisma } = require('../../config/database');
const logger = require('../../config/logger');
const env = require('../../config/env');
const payments = require('../../services/payments');
const entitlement = require('../../services/entitlement');
const { ok } = require('../../utils/respond');
const { forbidden } = require('../../utils/errors');

/**
 * POST /api/webhooks/razorpay
 *
 * The signature is computed over the raw body. app.js keeps `req.rawBody` for
 * exactly this — re-serialising the parsed JSON changes whitespace and key
 * order, and the signature then never matches.
 */
exports.razorpay = async (req, res) => {
  const signature = req.get('X-Razorpay-Signature');
  const valid = payments.providers.RAZORPAY.verifyWebhookSignature(req.rawBody, signature);

  if (!valid) {
    logger.warn({ ip: req.ip }, 'razorpay webhook signature rejected');
    throw forbidden('Signature did not verify');
  }

  const event = req.body?.event;
  const entity = req.body?.payload?.payment?.entity || req.body?.payload?.refund?.entity;

  logger.info({ event, id: entity?.id }, 'razorpay webhook');

  switch (event) {
    case 'payment.captured': {
      // The order id is the key we already hold from the create call; the
      // payment id is new. Matching on the order is what makes this the same
      // row the client-side verify wrote.
      const orderId = entity?.order_id;
      const existing = await prisma.payment.findUnique({
        where: { provider_externalId: { provider: 'RAZORPAY', externalId: orderId } },
      });

      if (!existing) {
        logger.warn({ orderId }, 'razorpay captured an order we have no record of');
        break;
      }

      await payments.recordPayment({
        userId: existing.userId,
        provider: 'RAZORPAY',
        purpose: existing.purpose,
        externalId: orderId,
        amountMinor: entity.amount,
        currency: entity.currency,
        status: 'SUCCEEDED',
        message: existing.message,
        isAnonymous: existing.isAnonymous,
        providerPayload: entity,
      });
      break;
    }

    case 'payment.failed': {
      const orderId = entity?.order_id;
      if (orderId) {
        await prisma.payment.updateMany({
          where: { provider: 'RAZORPAY', externalId: orderId },
          data: { status: 'FAILED', providerPayload: entity },
        });
      }
      break;
    }

    case 'refund.processed': {
      const paymentEntity = req.body?.payload?.payment?.entity;
      if (paymentEntity?.order_id) {
        await payments.markRefunded({ provider: 'RAZORPAY', externalId: paymentEntity.order_id });
      }
      break;
    }

    default:
      // Razorpay sends far more events than we subscribe to meaning. Ignoring
      // the rest quietly with a 200 is correct — a 4xx would make it retry.
      logger.debug({ event }, 'razorpay event ignored');
  }

  return ok(res, { received: true });
};

/**
 * POST /api/webhooks/google
 *
 * Real-time developer notifications, delivered through Pub/Sub push. The body
 * carries only an identifier — never an entitlement claim — so the state is
 * always re-read from the Play API before anything is written.
 */
exports.google = async (req, res) => {
  // Pub/Sub push subscriptions authenticate with a shared token on the URL. It
  // is the mechanism Google offers for this; keep the URL out of logs.
  if (env.NODE_ENV === 'production' && req.query.token !== env.PUBSUB_VERIFICATION_TOKEN) {
    logger.warn({ ip: req.ip }, 'google webhook token rejected');
    throw forbidden('Not authorised');
  }

  const encoded = req.body?.message?.data;
  if (!encoded) return ok(res, { received: true });

  const payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  const notification = payload.subscriptionNotification || payload.oneTimeProductNotification;

  logger.info({ type: notification?.notificationType }, 'google play webhook');

  if (!notification) return ok(res, { received: true });

  const { purchaseToken, subscriptionId, sku } = notification;

  // The notification says nothing about which user this is. The purchase token
  // does — it is what we stored as `externalId` when the client verified, and
  // it stays the same across every renewal. A notification for a purchase we
  // never saw is logged and dropped rather than guessed at.
  const existing = await prisma.subscription.findUnique({
    where: { provider_externalId: { provider: 'GOOGLE_PLAY', externalId: purchaseToken } },
    select: { userId: true, planId: true },
  });

  if (!existing) {
    logger.warn({ sku: subscriptionId || sku }, 'google notification for an unknown purchase');
    return ok(res, { received: true });
  }

  try {
    const verified = await payments.providers.GOOGLE_PLAY.verifySubscription({
      productId: subscriptionId || sku,
      purchaseToken,
    });

    await payments.upsertSubscription({
      userId: existing.userId,
      planId: existing.planId,
      provider: 'GOOGLE_PLAY',
      externalId: verified.externalId,
      status: verified.isValid ? 'ACTIVE' : 'EXPIRED',
      currentPeriodEnd: verified.expiresAt,
      autoRenew: verified.autoRenew,
    });
  } catch (err) {
    logger.error({ err: err.message }, 'google notification could not be verified');
  }

  return ok(res, { received: true });
};

/**
 * POST /api/webhooks/apple
 *
 * App Store Server Notifications V2. The body is a JWS; its payload is decoded
 * for routing, then the authoritative state is re-read from Apple's API before
 * anything is written — a decoded JWS whose chain has not been verified is a
 * hint about what happened, not proof of it.
 */
exports.apple = async (req, res) => {
  const signedPayload = req.body?.signedPayload;
  if (!signedPayload) return ok(res, { received: true });

  let notification;
  try {
    notification = payments.providers.APPLE_APP_STORE.decodeNotification(signedPayload);
  } catch (err) {
    logger.warn({ err: err.message }, 'apple notification could not be decoded');
    return ok(res, { received: true });
  }

  const originalTransactionId = notification.transaction?.originalTransactionId;
  logger.info({ type: notification.type, subtype: notification.subtype }, 'apple webhook');

  if (!originalTransactionId) return ok(res, { received: true });

  const subscription = await prisma.subscription.findFirst({
    where: { provider: 'APPLE_APP_STORE', externalId: originalTransactionId },
    select: { userId: true, planId: true },
  });

  if (!subscription) {
    logger.warn({ originalTransactionId }, 'apple notification for an unknown subscription');
    return ok(res, { received: true });
  }

  try {
    if (notification.type === 'REFUND') {
      await payments.markRefunded({
        provider: 'APPLE_APP_STORE',
        externalId: notification.transaction.transactionId,
      });
      return ok(res, { received: true });
    }

    const verified =
      await payments.providers.APPLE_APP_STORE.verifySubscription(originalTransactionId);

    await payments.upsertSubscription({
      userId: subscription.userId,
      planId: subscription.planId,
      provider: 'APPLE_APP_STORE',
      externalId: verified.externalId,
      status: verified.isValid ? 'ACTIVE' : 'EXPIRED',
      currentPeriodEnd: verified.expiresAt,
      autoRenew: verified.autoRenew,
    });
  } catch (err) {
    logger.error({ err: err.message }, 'apple notification could not be verified');
  }

  return ok(res, { received: true });
};

/**
 * POST /api/webhooks/entitlement/refresh/:userId
 * An operator escape hatch for when a webhook was missed and someone is locked
 * out of something they paid for. Recomputes from the ledger; grants nothing on
 * its own.
 */
exports.refreshEntitlement = async (req, res) => {
  const result = await entitlement.refresh(req.valid.params.userId);
  return ok(res, result);
};
