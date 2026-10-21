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

import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import env from '../../config/env.js';
import * as payments from '../../services/payments/index.js';
import * as entitlement from '../../services/entitlement.js';
import { ok } from '../../utils/respond.js';
import { forbidden, AppError } from '../../utils/errors.js';
import * as lifecycle from '../../services/payments/lifecycle.js';
import * as google_ from '../../services/payments/google.js';
import * as apple_ from '../../services/payments/apple.js';

/**
 * POST /api/webhooks/razorpay
 *
 * The signature is computed over the raw body. app.js keeps `req.rawBody` for
 * exactly this — re-serialising the parsed JSON changes whitespace and key
 * order, and the signature then never matches.
 */
export const razorpay = async (req, res) => {
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

// A store lookup that failed for a reason that may pass (the store is down, our
// credentials expired) must answer with an error so the sender retries: Pub/Sub
// redelivers for days, Apple a handful of times. A purchase the store does not know,
// or one we cannot attach to anybody, is final — that is answered 200.
const isTransient = (err) => err instanceof AppError && err.status >= 500;

const sameSecret = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

let oidc = null;

// Pub/Sub push proves itself one of two ways: a Google-signed token in the
// Authorization header (the subscription's "authentication" setting; audience and
// service account in the env), or a shared secret on the URL. Either is enough.
// Neither configured is refused in production — an open endpoint would let anyone
// make us re-read a purchase.
async function pubsubAuthorised(req) {
  const bearer = req.get('Authorization')?.replace(/^Bearer /i, '');
  if (env.PUBSUB_AUDIENCE && bearer) {
    try {
      oidc ??= new OAuth2Client();
      const ticket = await oidc.verifyIdToken({ idToken: bearer, audience: env.PUBSUB_AUDIENCE });
      const claims = ticket.getPayload();
      if (!env.PUBSUB_SERVICE_ACCOUNT_EMAIL || claims.email === env.PUBSUB_SERVICE_ACCOUNT_EMAIL) return true;
    } catch (err) {
      logger.warn({ err: err.message }, 'pubsub token did not verify');
    }
  }
  if (env.PUBSUB_VERIFICATION_TOKEN) return sameSecret(req.query.token, env.PUBSUB_VERIFICATION_TOKEN);
  return !env.isProduction && !env.PUBSUB_AUDIENCE;
}

/**
 * POST /api/webhooks/google
 *
 * Real-time developer notifications, delivered through Pub/Sub push. The body
 * carries only an identifier — never an entitlement claim — so the state is
 * always re-read from the Play API before anything is written.
 */
export const google = async (req, res) => {
  if (!(await pubsubAuthorised(req))) {
    logger.warn({ ip: req.ip }, 'google webhook not authorised');
    throw forbidden('Not authorised');
  }

  const encoded = req.body?.message?.data;
  if (!encoded) return ok(res, { received: true });

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch {
    return ok(res, { received: true });
  }

  if (payload.packageName && env.GOOGLE_PLAY_PACKAGE_NAME && payload.packageName !== env.GOOGLE_PLAY_PACKAGE_NAME) {
    logger.warn({ packageName: payload.packageName }, 'google notification for another app');
    return ok(res, { received: true });
  }
  if (payload.testNotification) {
    logger.info('google play test notification received');
    return ok(res, { received: true });
  }

  try {
    // Refunds and chargebacks.
    const voided = payload.voidedPurchaseNotification;
    if (voided) {
      logger.info({ productType: voided.productType, refundType: voided.refundType }, 'google voided purchase');
      if (voided.productType === 2) {
        await payments.markRefunded({ provider: 'GOOGLE_PLAY', externalId: voided.orderId });
      } else {
        await lifecycle.applyRefund({
          provider: 'GOOGLE_PLAY',
          orderId: voided.orderId,
          subscriptionExternalId: voided.purchaseToken,
        });
      }
      return ok(res, { received: true });
    }

    const notification = payload.subscriptionNotification;
    if (!notification) {
      logger.debug('google notification ignored (not a subscription)');
      return ok(res, { received: true });
    }

    const type = google_.NOTIFICATION_TYPES[notification.notificationType] || String(notification.notificationType);
    logger.info({ type }, 'google play subscription notification');

    if (type === 'REVOKED') {
      await lifecycle.applyRefund({ provider: 'GOOGLE_PLAY', subscriptionExternalId: notification.purchaseToken });
      return ok(res, { received: true });
    }

    const verified = await google_.verifySubscription({ purchaseToken: notification.purchaseToken });
    await lifecycle.applyStoreState({ provider: 'GOOGLE_PLAY', verified, event: type });

    // Google refunds a purchase nobody acknowledges within three days.
    if (['PURCHASED', 'RESTARTED', 'RECOVERED'].includes(type) && verified.productId) {
      await google_.acknowledge({ productId: verified.productId, purchaseToken: notification.purchaseToken });
    }
  } catch (err) {
    if (isTransient(err)) throw err;
    logger.error({ err: err.message }, 'google notification could not be applied');
  }

  return ok(res, { received: true });
};

// Apple notification types that mean "look at this subscription again".
const APPLE_RESYNC = new Set([
  'SUBSCRIBED',
  'DID_RENEW',
  'DID_CHANGE_RENEWAL_STATUS',
  'DID_CHANGE_RENEWAL_PREF',
  'DID_FAIL_TO_RENEW',
  'EXPIRED',
  'GRACE_PERIOD_EXPIRED',
  'OFFER_REDEEMED',
  'RENEWAL_EXTENDED',
  'RENEWAL_EXTENSION',
  'PRICE_INCREASE',
]);

/**
 * POST /api/webhooks/apple
 *
 * App Store Server Notifications V2. The body is a JWS; its payload is decoded
 * for routing, then the authoritative state is re-read from Apple's API before
 * anything is written — a decoded JWS whose chain has not been verified is a
 * hint about what happened, not proof of it.
 */
export const apple = async (req, res) => {
  const signedPayload = req.body?.signedPayload;
  if (!signedPayload) return ok(res, { received: true });

  let notification;
  try {
    notification = apple_.decodeNotification(signedPayload);
  } catch (err) {
    logger.warn({ err: err.message }, 'apple notification could not be decoded');
    return ok(res, { received: true });
  }

  const { type, subtype } = notification;
  logger.info({ type, subtype }, 'apple webhook');

  if (env.appleBundleIds.length && notification.bundleId && !env.appleBundleIds.includes(notification.bundleId)) {
    logger.warn({ bundleId: notification.bundleId }, 'apple notification for another app');
    return ok(res, { received: true });
  }

  const originalTransactionId = notification.transaction?.originalTransactionId;
  if (!originalTransactionId) return ok(res, { received: true });

  try {
    if (type === 'REFUND' || type === 'REVOKE') {
      await lifecycle.applyRefund({
        provider: 'APPLE_APP_STORE',
        orderId: notification.transaction.transactionId,
        subscriptionExternalId: originalTransactionId,
      });
      return ok(res, { received: true });
    }

    if (!APPLE_RESYNC.has(type)) return ok(res, { received: true });

    const verified = await apple_.verifySubscription(originalTransactionId);
    await lifecycle.applyStoreState({ provider: 'APPLE_APP_STORE', verified, event: subtype ? `${type}/${subtype}` : type, subtype });
  } catch (err) {
    if (isTransient(err)) throw err;
    logger.error({ err: err.message }, 'apple notification could not be applied');
  }

  return ok(res, { received: true });
};

/**
 * POST /api/webhooks/entitlement/refresh/:userId
 * An operator escape hatch for when a webhook was missed and someone is locked
 * out of something they paid for. Recomputes from the ledger; grants nothing on
 * its own.
 */
export const refreshEntitlement = async (req, res) => {
  const result = await entitlement.refresh(req.valid.params.userId);
  return ok(res, result);
};
