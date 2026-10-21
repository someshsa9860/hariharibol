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
import { existsSync, readFileSync } from 'node:fs';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { AppError, badRequest } from '../../utils/errors.js';
import { unitsToMinor } from './money.js';

let fetcher = (...args) => fetch(...args);
const setFetch = (fn) => {
  fetcher = fn;
};

// The App Store Connect .p8 key: from APPLE_PRIVATE_KEY_PATH when set, else the pasted APPLE_PRIVATE_KEY.
function privateKey() {
  const path = env.applePrivateKeyPath;
  if (path) {
    if (existsSync(path)) return readFileSync(path, 'utf8');
    logger.warn({ path }, 'APPLE_PRIVATE_KEY_PATH points at nothing');
  }
  return env.applePrivateKey || null;
}

const isConfigured = () => Boolean(env.APPLE_ISSUER_ID && env.APPLE_KEY_ID && privateKey() && env.appleBundleIds[0]);

const PRODUCTION = 'https://api.storekit.itunes.apple.com/inApps/v1';
const SANDBOX = 'https://api.storekit-sandbox.itunes.apple.com/inApps/v1';

async function signToken() {
  if (!isConfigured()) {
    throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'Apple verification is not configured');
  }
  const key = crypto.createPrivateKey(privateKey());
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
    const response = await fetcher(`${base}${path}`, { headers });
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

// A one-off transaction (a donation).
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
    ...price(info),
    raw: info,
  };
}

// Apple sends the price in milliunits of the storefront currency.
function price(info) {
  if (!info?.currency) return {};
  const free = info.offerDiscountType === 'FREE_TRIAL';
  if (info.price == null && !free) return { currency: info.currency };
  return { currency: info.currency, priceMinor: free ? 0 : unitsToMinor(info.price / 1000, info.currency) };
}

// subscription status from the API -> our SubscriptionStatus.
// 1 active, 2 expired, 3 billing retry (no access), 4 grace period (access), 5 revoked.
function normalise(item, fallbackId) {
  const info = decode(item.signedTransactionInfo);
  const renewal = decode(item.signedRenewalInfo);
  const expiresAt = info?.expiresDate ? new Date(info.expiresDate) : null;
  const isTrial = info?.offerDiscountType === 'FREE_TRIAL';
  const autoRenew = renewal?.autoRenewStatus === 1;

  let status;
  switch (item.status) {
    case 1:
      status = isTrial ? 'IN_TRIAL' : autoRenew ? 'ACTIVE' : 'CANCELLED';
      break;
    case 4:
      status = 'GRACE';
      break;
    case 5:
      status = 'REFUNDED';
      break;
    default:
      status = 'EXPIRED';
  }

  return {
    provider: 'APPLE_APP_STORE',
    // The original transaction id is stable across renewals; the per-renewal one is not.
    externalId: info?.originalTransactionId || fallbackId,
    // The renewal's own transaction id: one per charge, so it keys the Payment row.
    orderId: info?.transactionId || null,
    productId: info?.productId || null,
    // What the subscriber will renew into, if they changed plan.
    nextProductId: renewal?.autoRenewProductId || null,
    status,
    isValid: ['IN_TRIAL', 'ACTIVE', 'GRACE', 'CANCELLED'].includes(status) && Boolean(expiresAt && expiresAt > new Date()),
    billingIssue: item.status === 3 || item.status === 4,
    expiresAt,
    autoRenew,
    startedAt: info?.originalPurchaseDate ? new Date(info.originalPurchaseDate) : null,
    isTrial,
    ...price(info),
    revokedAt: info?.revocationDate ? new Date(info.revocationDate) : null,
    replaces: null,
    accountId: info?.appAccountToken || null,
    isTest: info?.environment === 'Sandbox',
    raw: { transaction: info, renewal },
  };
}

// Current state for a subscription family, keyed by the original transaction id.
async function verifySubscription(originalTransactionId) {
  const result = await call(`/subscriptions/${originalTransactionId}`);
  const items = (result.data || []).flatMap((group) => group.lastTransactions || []);
  const item = items.find((i) => i.originalTransactionId === originalTransactionId) || items[0];
  if (!item) throw badRequest('Apple returned no subscription state');
  return normalise(item, originalTransactionId);
}

// Apple Server Notifications V2. The body is a JWS whose signature chain is not
// verified here, so a notification is only a *hint*: the handler re-reads the
// authoritative state from the API above before writing anything.
function decodeNotification(signedPayload) {
  const payload = decodeJwt(signedPayload);
  return {
    type: payload.notificationType,
    subtype: payload.subtype,
    bundleId: payload.data?.bundleId,
    transaction: decode(payload.data?.signedTransactionInfo),
    renewal: decode(payload.data?.signedRenewalInfo),
  };
}

export const provider = 'APPLE_APP_STORE';
export { verifyTransaction, verifySubscription, decodeNotification, normalise, isConfigured, setFetch };
