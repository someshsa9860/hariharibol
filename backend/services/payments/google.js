// Google Play purchases, checked against the Play Developer API.
//
// The client sends a purchase token. It is never trusted on its own — a token
// is just a string, and the only thing that makes it mean "this person paid" is
// Google confirming it. So every verification is a server-to-server lookup.
//
// Authentication reuses the Firebase service account already in the
// environment. It needs the androidpublisher scope, and the service account has
// to be linked in the Play Console — that is a one-time console step, not
// something code can do.

import { JWT } from 'google-auth-library';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { AppError, badRequest } from '../../utils/errors.js';

const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';

let client = null;

function getClient() {
  if (client) return client;
  if (!env.FIREBASE_CLIENT_EMAIL || !env.firebasePrivateKey) {
    throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'Google Play verification is not configured');
  }
  client = new JWT({
    email: env.FIREBASE_CLIENT_EMAIL,
    key: env.firebasePrivateKey,
    scopes: [SCOPE],
  });
  return client;
}

async function call(path) {
  const auth = getClient();
  const { token } = await auth.getAccessToken();
  const packageName = env.GOOGLE_PLAY_PACKAGE_NAME;
  if (!packageName) throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'GOOGLE_PLAY_PACKAGE_NAME is not set');

  const response = await fetch(`${BASE}/${packageName}/purchases/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 404) throw badRequest('Google Play does not recognise this purchase');
  if (!response.ok) {
    const body = await response.text();
    logger.error({ status: response.status, body: body.slice(0, 300) }, 'play api error');
    throw new AppError(502, 'PAYMENT_LOOKUP_FAILED', 'Could not verify with Google Play');
  }

  return response.json();
}

// One-off purchase — a donation. purchaseState 0 means purchased; 1 cancelled,
// 2 pending. Only 0 is money we have.
async function verifyProductPurchase({ productId, purchaseToken }) {
  const purchase = await call(`products/${productId}/tokens/${purchaseToken}`);

  return {
    provider: 'GOOGLE_PLAY',
    externalId: purchase.orderId || purchaseToken,
    isValid: purchase.purchaseState === 0,
    isAcknowledged: purchase.acknowledgementState === 1,
    purchasedAt: purchase.purchaseTimeMillis ? new Date(Number(purchase.purchaseTimeMillis)) : null,
    raw: purchase,
  };
}

// A subscription. `expiryTimeMillis` is what entitlement is anchored to — it
// moves forward on every renewal, so it is read fresh rather than assumed.
async function verifySubscription({ productId, purchaseToken }) {
  const subscription = await call(`subscriptions/${productId}/tokens/${purchaseToken}`);
  const expiresAt = subscription.expiryTimeMillis
    ? new Date(Number(subscription.expiryTimeMillis))
    : null;

  return {
    provider: 'GOOGLE_PLAY',
    // The purchase token, not the order id: it stays the same across every
    // renewal, and it is the only thing a real-time notification gives us to
    // find the subscription by. The order id changes monthly.
    externalId: purchaseToken,
    orderId: subscription.orderId || null,
    isValid: Boolean(expiresAt && expiresAt > new Date()),
    expiresAt,
    autoRenew: Boolean(subscription.autoRenewing),
    // 0 = still in the paid period the user was charged for.
    isInGrace: subscription.paymentState === 0,
    startedAt: subscription.startTimeMillis ? new Date(Number(subscription.startTimeMillis)) : null,
    priceMinor: subscription.priceAmountMicros
      ? Math.round(Number(subscription.priceAmountMicros) / 10000)
      : null,
    currency: subscription.priceCurrencyCode || null,
    raw: subscription,
  };
}

export const provider = 'GOOGLE_PLAY';
export { verifyProductPurchase, verifySubscription };
