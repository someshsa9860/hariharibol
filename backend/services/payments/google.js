// Google Play purchases, checked against the Play Developer API.
//
// The client sends a purchase token. It is never trusted on its own — a token is just
// a string, and the only thing that makes it mean "this person paid" is Google
// confirming it. So every verification is a server-to-server lookup, and a real-time
// notification (Pub/Sub) is only a prompt to look again.
//
// Authentication is a service account JSON file (GOOGLE_PLAY_SERVICE_ACCOUNT_PATH),
// invited in Play Console → Users and permissions with the financial-data and
// manage-orders permissions. docs/store-subscriptions.md walks through it.
//
// Subscriptions use `purchases.subscriptionsv2`, which describes a subscription in
// terms of its state (active, cancelled, grace period, on hold, expired) rather than
// the old numeric payment states.

import { existsSync, readFileSync } from 'node:fs';
import { JWT } from 'google-auth-library';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { AppError, badRequest } from '../../utils/errors.js';
import { unitsToMinor } from './money.js';
import { STORE_TIMEOUT_MS } from '../../config/constants.js';

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

let client = null;
// Every call is given STORE_TIMEOUT_MS; one that runs out is a failed lookup, like any other error from Play.
let fetcher = (url, options = {}) =>
  fetch(url, { ...options, signal: AbortSignal.timeout(STORE_TIMEOUT_MS) }).catch((error) => {
    if (error.name !== 'TimeoutError') throw error;
    throw new AppError(502, 'PAYMENT_LOOKUP_FAILED', 'Google Play did not answer in time');
  });
const setFetch = (fn) => {
  fetcher = fn;
};

function credentials() {
  const path = env.googlePlayServiceAccountPath;
  if (path) {
    if (!existsSync(path)) {
      logger.warn({ path }, 'Google Play service account file does not exist');
    } else {
      try {
        const parsed = JSON.parse(readFileSync(path, 'utf8'));
        if (parsed.client_email && parsed.private_key) {
          return { email: parsed.client_email, key: parsed.private_key };
        }
        logger.warn({ path }, 'Google Play service account json is missing client_email / private_key');
      } catch (err) {
        logger.warn({ path, err: err.message }, 'Google Play service account json could not be read');
      }
    }
  }
  if (env.FIREBASE_CLIENT_EMAIL && env.firebasePrivateKey) {
    return { email: env.FIREBASE_CLIENT_EMAIL, key: env.firebasePrivateKey };
  }
  return null;
}

function getClient() {
  if (client) return client;
  const creds = credentials();
  if (!creds) throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'Google Play verification is not configured');
  client = new JWT({ email: creds.email, key: creds.key, scopes: [SCOPE] });
  return client;
}

const isConfigured = () => Boolean(credentials() && env.GOOGLE_PLAY_PACKAGE_NAME);

async function call(path) {
  const packageName = env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!packageName) throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'GOOGLE_PLAY_PACKAGE_NAME is not set');
  const { token } = await getClient().getAccessToken();

  const response = await fetcher(`${BASE}/${packageName}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 404 || response.status === 410) throw badRequest('Google Play does not recognise this purchase');
  if (!response.ok) {
    const body = await response.text();
    logger.error({ status: response.status, body: body.slice(0, 300) }, 'play api error');
    throw new AppError(502, 'PAYMENT_LOOKUP_FAILED', 'Could not verify with Google Play');
  }
  return response.json();
}

// One-off purchase — a donation. purchaseState 0 means purchased; 1 cancelled, 2 pending.
async function verifyProductPurchase({ productId, purchaseToken }) {
  const purchase = await call(`purchases/products/${productId}/tokens/${purchaseToken}`);

  return {
    provider: 'GOOGLE_PLAY',
    externalId: purchase.orderId || purchaseToken,
    isValid: purchase.purchaseState === 0,
    isAcknowledged: purchase.acknowledgementState === 1,
    purchasedAt: purchase.purchaseTimeMillis ? new Date(Number(purchase.purchaseTimeMillis)) : null,
    raw: purchase,
  };
}

// subscriptionState -> our SubscriptionStatus. ON_HOLD and PAUSED are not entitled and
// have no status of their own here; they are EXPIRED with `billingIssue` set.
const STATES = {
  SUBSCRIPTION_STATE_ACTIVE: { status: 'ACTIVE' },
  SUBSCRIPTION_STATE_CANCELED: { status: 'CANCELLED' },
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: { status: 'GRACE', billingIssue: true },
  SUBSCRIPTION_STATE_ON_HOLD: { status: 'EXPIRED', billingIssue: true },
  SUBSCRIPTION_STATE_PAUSED: { status: 'EXPIRED' },
  SUBSCRIPTION_STATE_EXPIRED: { status: 'EXPIRED' },
  SUBSCRIPTION_STATE_PENDING: { status: 'PENDING' },
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: { status: 'EXPIRED' },
};

const money = (m) =>
  m?.currencyCode ? { currency: m.currencyCode, priceMinor: unitsToMinor(Number(m.units || 0) + (m.nanos || 0) / 1e9, m.currencyCode) } : {};

// Turns a SubscriptionPurchaseV2 into the shape lifecycle.js understands (shared with Apple).
function normalise(sub, purchaseToken) {
  const line = sub.lineItems?.[0] || {};
  const mapped = STATES[sub.subscriptionState] || { status: 'EXPIRED' };
  const expiresAt = line.expiryTime ? new Date(line.expiryTime) : null;
  const phase = line.offerPhase || null;
  const autoRenew = Boolean(line.autoRenewingPlan?.autoRenewEnabled);

  let status = mapped.status;
  const isTrial = phase ? Boolean(phase.freeTrialPhase) : null;
  if (status === 'ACTIVE' && isTrial) status = 'IN_TRIAL';

  return {
    provider: 'GOOGLE_PLAY',
    // The purchase token, not the order id: it stays the same across every renewal and
    // is the only thing a notification gives us. An upgrade or downgrade makes a new one.
    externalId: purchaseToken,
    productId: line.productId || null,
    orderId: sub.latestOrderId || null,
    status,
    isValid: ['ACTIVE', 'IN_TRIAL', 'GRACE', 'CANCELLED'].includes(status) && Boolean(expiresAt && expiresAt > new Date()),
    billingIssue: Boolean(mapped.billingIssue),
    expiresAt,
    autoRenew,
    startedAt: sub.startTime ? new Date(sub.startTime) : null,
    isTrial,
    ...money(line.autoRenewingPlan?.recurringPrice),
    // Set on a plan change: the token of the subscription this one replaces.
    replaces: sub.linkedPurchaseToken || null,
    // The id the app attached at purchase (our user id), when it did.
    accountId: sub.externalAccountIdentifiers?.obfuscatedExternalAccountId || null,
    isTest: Boolean(sub.testPurchase),
    raw: sub,
  };
}

async function verifySubscription({ purchaseToken }) {
  const sub = await call(`purchases/subscriptionsv2/tokens/${purchaseToken}`);
  return normalise(sub, purchaseToken);
}

// Tell Google we have granted the entitlement; an unacknowledged purchase is refunded after 3 days.
async function acknowledge({ productId, purchaseToken }) {
  const { token } = await getClient().getAccessToken();
  const response = await fetcher(
    `${BASE}/${env.GOOGLE_PLAY_PACKAGE_NAME}/purchases/subscriptions/${productId}/tokens/${purchaseToken}:acknowledge`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' }
  );
  if (!response.ok && response.status !== 400) logger.warn({ status: response.status }, 'play acknowledge failed');
}

// Pub/Sub subscriptionNotification.notificationType.
const NOTIFICATION_TYPES = {
  1: 'RECOVERED',
  2: 'RENEWED',
  3: 'CANCELED',
  4: 'PURCHASED',
  5: 'ON_HOLD',
  6: 'IN_GRACE_PERIOD',
  7: 'RESTARTED',
  8: 'PRICE_CHANGE_CONFIRMED',
  9: 'DEFERRED',
  10: 'PAUSED',
  11: 'PAUSE_SCHEDULE_CHANGED',
  12: 'REVOKED',
  13: 'EXPIRED',
  20: 'PENDING_PURCHASE_CANCELED',
};

export const provider = 'GOOGLE_PLAY';
export { verifyProductPurchase, verifySubscription, acknowledge, normalise, isConfigured, setFetch, NOTIFICATION_TYPES };
