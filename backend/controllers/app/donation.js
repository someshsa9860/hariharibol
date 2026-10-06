// Donations.
//
// Any amount, once, earns Premium permanently — `premiumUntil` stays null. That
// is a deliberate choice: someone who gives anything at all is supporting the
// project, and metering them afterwards would be a strange way to say thank
// you.
//
// Three ways in. Razorpay is a real order flow with a signature to check;
// Google and Apple are one-off in-app products verified the same way a
// subscription is.
//
// A note on the App Store: Apple requires in-app purchase for anything that
// unlocks digital content, and a donation that grants Premium is exactly that.
// Offering the Razorpay path inside the iOS build risks rejection — the app
// should show the store flow on iOS and keep Razorpay for Android and the web.

import { prisma } from '../../config/database.js';
import * as payments from '../../services/payments/index.js';
import { ok, created } from '../../utils/respond.js';
import { badRequest } from '../../utils/errors.js';

// A floor, so the ledger does not fill with 1-rupee rows that cost more in
// payment fees than they bring in.
const MIN_AMOUNT_MINOR = 1000; // ₹10

/**
 * POST /api/app/donations/razorpay/order
 * Opens an order. Nothing is credited here — the order is only an intent, and
 * the money has not moved yet.
 */
export const createOrder = async (req, res) => {
  const user = req.auth.user;
  const { amountMinor, currency, message, isAnonymous } = req.valid.body;

  if (amountMinor < MIN_AMOUNT_MINOR) {
    throw badRequest(`The smallest donation is ${MIN_AMOUNT_MINOR / 100} ${currency}`);
  }

  const order = await payments.providers.RAZORPAY.createOrder({
    amountMinor,
    currency,
    notes: { userId: user.id, purpose: 'DONATION' },
  });

  // Written as PENDING so an order that is paid but never confirmed by the
  // client is still visible, and the webhook has a row to settle against.
  await prisma.payment.create({
    data: {
      userId: user.id,
      provider: 'RAZORPAY',
      purpose: 'DONATION',
      externalId: order.orderId,
      amountMinor,
      currency,
      status: 'PENDING',
      message: message || null,
      isAnonymous: Boolean(isAnonymous),
    },
  });

  return created(res, order);
};

/**
 * POST /api/app/donations/razorpay/verify
 * Confirms a completed checkout. The signature proves this client finished this
 * order, which is enough to grant access immediately; the webhook confirms it
 * again server to server, and the upsert makes the second write harmless.
 */
export const verifyOrder = async (req, res) => {
  const user = req.auth.user;
  const { orderId, paymentId, signature } = req.valid.body;

  payments.providers.RAZORPAY.verifyCheckoutSignature({ orderId, paymentId, signature });

  const pending = await prisma.payment.findUnique({
    where: { provider_externalId: { provider: 'RAZORPAY', externalId: orderId } },
  });
  if (!pending) throw badRequest('That order was not created here');
  if (pending.userId !== user.id) throw badRequest('That order belongs to someone else');

  const payment = await payments.recordPayment({
    userId: user.id,
    provider: 'RAZORPAY',
    purpose: 'DONATION',
    externalId: orderId,
    amountMinor: pending.amountMinor,
    currency: pending.currency,
    status: 'SUCCEEDED',
    message: pending.message,
    isAnonymous: pending.isAnonymous,
    providerPayload: { paymentId },
  });

  await payments.thankDonor(user.id, payment.amountMinor, payment.currency);

  return ok(res, { paymentId: payment.id, isPremium: true });
};

/**
 * POST /api/app/donations/store
 * A one-off donation product bought through Google Play or the App Store.
 */
export const storeDonation = async (req, res) => {
  const user = req.auth.user;
  const { provider, productId, purchaseToken, transactionId, amountMinor, currency } =
    req.valid.body;

  let verified;
  if (provider === 'GOOGLE_PLAY') {
    if (!purchaseToken) throw badRequest('purchaseToken is required for Google Play');
    verified = await payments.providers.GOOGLE_PLAY.verifyProductPurchase({
      productId,
      purchaseToken,
    });
  } else {
    if (!transactionId) throw badRequest('transactionId is required for the App Store');
    verified = await payments.providers.APPLE_APP_STORE.verifyTransaction(transactionId);
  }

  if (!verified.isValid) throw badRequest('The store could not confirm that purchase');

  const payment = await payments.recordPayment({
    userId: user.id,
    provider,
    purpose: 'DONATION',
    externalId: verified.externalId,
    // Apple reports the price; Google does not for one-off products, so the
    // client's figure is the fallback. It only affects the receipt, never
    // entitlement — any successful donation grants the same access.
    amountMinor: verified.priceMinor ?? amountMinor,
    currency: verified.currency ?? currency,
    status: 'SUCCEEDED',
    paidAt: verified.purchasedAt || new Date(),
    providerPayload: verified.raw,
  });

  await payments.thankDonor(user.id, payment.amountMinor, payment.currency);

  return created(res, { paymentId: payment.id, isPremium: true });
};

/** GET /api/app/donations/mine — this user's own giving history. */
export const mine = async (req, res) => {
  const donations = await prisma.payment.findMany({
    where: { userId: req.auth.user.id, purpose: 'DONATION' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      provider: true,
      amountMinor: true,
      currency: true,
      status: true,
      message: true,
      isAnonymous: true,
      paidAt: true,
      createdAt: true,
    },
  });

  const total = donations
    .filter((row) => row.status === 'SUCCEEDED')
    .reduce((sum, row) => sum + row.amountMinor, 0);

  return ok(res, { donations, totalMinor: total });
};
