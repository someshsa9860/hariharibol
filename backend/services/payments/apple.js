// Apple App Store purchases, checked against the App Store Server API.
//
// Apple hands the client a transaction id. As with Google, that is only a
// string until Apple confirms it, so verification is always a server-to-server
// lookup — signed with an ES256 JWT built from the App Store Connect key.
//
// What comes back is JWS. The payload is decoded here rather than
// cryptographically verified, and that is safe *only* because it arrived over
// TLS directly from Apple's API in response to our authenticated request.
// A JWS that arrives any other way — from a client, or in a webhook — must have
// its signature chain verified before it is believed.

import { SignJWT, decodeJwt } from 'jose';
import crypto from 'node:crypto';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { AppError, badRequest } from '../../utils/errors.js';

const PRODUCTION = 'https://api.storekit.itunes.apple.com/inApps/v1';
const SANDBOX = 'https://api.storekit-sandbox.itunes.apple.com/inApps/v1';

async function signToken() {
  if (!env.APPLE_ISSUER_ID || !env.APPLE_KEY_ID || !env.applePrivateKey) {
    throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'Apple verification is not configured');
  }
  const key = crypto.createPrivateKey(env.applePrivateKey);
  const bundleId = env.appleBundleIds[0];

  return new SignJWT({ bid: bundleId })
    .setProtectedHeader({ alg: 'ES256', kid: env.APPLE_KEY_ID, typ: 'JWT' })
    .setIssuer(env.APPLE_ISSUER_ID)
    .setAudience('appstoreconnect-v1')
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(key);
}

// Sandbox receipts fail against production with a 404. Rather than configuring
// which environment we are in — which is wrong on TestFlight builds — try
// production and fall back, which is what Apple itself recommends.
async function call(path) {
  const token = await signToken();
  const headers = { Authorization: `Bearer ${token}` };

  for (const base of [PRODUCTION, SANDBOX]) {
    const response = await fetch(`${base}${path}`, { headers });
    if (response.ok) return response.json();
    if (response.status !== 404) {
      const body = await response.text();
      logger.error({ status: response.status, body: body.slice(0, 300) }, 'apple api error');
      throw new AppError(502, 'PAYMENT_LOOKUP_FAILED', 'Could not verify with Apple');
    }
  }

  throw badRequest('Apple does not recognise this transaction');
}

function decode(signedPayload) {
  if (!signedPayload) return null;
  return decodeJwt(signedPayload);
}

async function verifyTransaction(transactionId) {
  const result = await call(`/transactions/${transactionId}`);
  const info = decode(result.signedTransactionInfo);
  if (!info) throw badRequest('Apple returned no transaction info');

  return {
    provider: 'APPLE_APP_STORE',
    externalId: info.transactionId,
    originalTransactionId: info.originalTransactionId,
    productId: info.productId,
    isValid: !info.revocationDate,
    purchasedAt: info.purchaseDate ? new Date(info.purchaseDate) : null,
    expiresAt: info.expiresDate ? new Date(info.expiresDate) : null,
    priceMinor: info.price ? Math.round(info.price / 10) : null, // Apple sends milliunits
    currency: info.currency || null,
    raw: info,
  };
}

// Current entitlement for a subscription family. `originalTransactionId` is the
// stable key across renewals — the per-renewal transaction id changes every
// month and must never be used as the subscription identity.
async function verifySubscription(originalTransactionId) {
  const result = await call(`/subscriptions/${originalTransactionId}`);
  const item = result.data?.[0]?.lastTransactions?.[0];
  if (!item) throw badRequest('Apple returned no subscription state');

  const info = decode(item.signedTransactionInfo);
  const renewal = decode(item.signedRenewalInfo);
  const expiresAt = info?.expiresDate ? new Date(info.expiresDate) : null;

  return {
    provider: 'APPLE_APP_STORE',
    externalId: info?.originalTransactionId || originalTransactionId,
    productId: info?.productId,
    // 1 active, 2 expired, 3 in billing retry, 4 in grace, 5 revoked.
    status: item.status,
    isValid: [1, 4].includes(item.status),
    expiresAt,
    autoRenew: renewal?.autoRenewStatus === 1,
    raw: { transaction: info, renewal },
  };
}

// Apple Server Notifications V2. The body is a JWS; its signature chain is not
// verified here, so the notification is treated as a *hint* — the handler
// re-reads the authoritative state from the API above before writing anything.
function decodeNotification(signedPayload) {
  const payload = decodeJwt(signedPayload);
  return {
    type: payload.notificationType,
    subtype: payload.subtype,
    transaction: decode(payload.data?.signedTransactionInfo),
    renewal: decode(payload.data?.signedRenewalInfo),
  };
}

export const provider = 'APPLE_APP_STORE';
export { verifyTransaction, verifySubscription, decodeNotification };
