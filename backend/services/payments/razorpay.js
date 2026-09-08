// Razorpay — the web and Android donation path.
//
// Two separate signature checks, and they are not interchangeable:
//
//   verifyCheckoutSignature  the client hands back order_id + payment_id +
//                            signature after checkout. Proves *this* client
//                            completed *this* order.
//   verifyWebhookSignature   Razorpay calls us server-to-server. This is the
//                            authoritative one — a client can simply never call
//                            back, and the money still moved.
//
// Both are HMAC-SHA256 and both are compared in constant time. A `===` here
// leaks the expected signature one byte at a time.

const crypto = require('node:crypto');
const env = require('../../config/env');
const { AppError, badRequest } = require('../../utils/errors');

const BASE = 'https://api.razorpay.com/v1';

function authHeader() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'Razorpay is not configured');
  }
  const encoded = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  return `Basic ${encoded}`;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Amount is in the smallest currency unit — paise for INR. Razorpay expects it
// that way and so does our Payment ledger, so nothing is ever converted.
async function createOrder({ amountMinor, currency = 'INR', notes = {} }) {
  const response = await fetch(`${BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    body: JSON.stringify({ amount: amountMinor, currency, notes, payment_capture: 1 }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError(502, 'PAYMENT_FAILED', 'Could not create the order', body.slice(0, 300));
  }

  const order = await response.json();
  return { orderId: order.id, amountMinor: order.amount, currency: order.currency, keyId: env.RAZORPAY_KEY_ID };
}

function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  if (!env.RAZORPAY_KEY_SECRET) throw new AppError(503, 'PAYMENTS_UNAVAILABLE', 'Razorpay is not configured');
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  if (!safeEqual(expected, signature)) throw badRequest('Payment signature did not verify');
  return true;
}

// The raw request body is required — re-serialising the parsed JSON changes
// byte order and whitespace, and the signature then never matches.
function verifyWebhookSignature(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return safeEqual(expected, signature || '');
}

async function fetchPayment(paymentId) {
  const response = await fetch(`${BASE}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
  });
  if (!response.ok) throw new AppError(502, 'PAYMENT_LOOKUP_FAILED', 'Could not read the payment');
  return response.json();
}

module.exports = {
  provider: 'RAZORPAY',
  createOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  fetchPayment,
};
