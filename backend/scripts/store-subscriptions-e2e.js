// Walks a store subscription through its life against a real database, with the stores
// and the exchange-rate service faked. No API server is needed:
//
//   npm run test:store-subscriptions
//
// It checks what fails quietly in money code: a free trial is a row of 0, a renewal
// is counted once however many times the store tells us, cancel keeps access to the
// end of the period, grace keeps access and never counts as a payment, a refund keeps
// the figures but ends access, a plan change moves the plan, a payment in dollars is
// worth the right rupees, and the reader hears about each of it exactly once.
//
// Everything it creates is deleted again.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import * as lifecycle from '../services/payments/lifecycle.js';
import * as money from '../services/payments/money.js';
import * as fx from '../services/payments/fx.js';
import * as google from '../services/payments/google.js';
import * as apple from '../services/payments/apple.js';

const TAG = `e2e-${Date.now()}`;
const DAY = 86400000;
let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}

const titles = async (userId) =>
  (await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })).map((n) => n.title);

// A state as google.js / apple.js would hand it over.
const state = (over) => ({
  provider: 'GOOGLE_PLAY',
  externalId: `${TAG}-token`,
  productId: `${TAG}_arta_monthly`,
  orderId: `${TAG}-order-1`,
  status: 'ACTIVE',
  isValid: true,
  billingIssue: false,
  expiresAt: new Date(Date.now() + 30 * DAY),
  autoRenew: true,
  startedAt: new Date(),
  isTrial: false,
  priceMinor: 4900,
  currency: 'INR',
  replaces: null,
  accountId: null,
  isTest: false,
  raw: {},
  ...over,
});

async function main() {
  const role = await prisma.role.findUnique({ where: { slug: 'user' } });
  const user = await prisma.user.create({
    data: { email: `${TAG}@example.test`, name: TAG, roleId: role.id, authProvider: 'GOOGLE', providerUserId: TAG },
  });
  const arta = await prisma.subscriptionPlan.create({
    data: { slug: `${TAG}-arta`, name: 'Ārta', tier: 91, prices: { create: { provider: 'GOOGLE_PLAY', productId: `${TAG}_arta_monthly`, priceMinor: 4900, currency: 'INR', trialDays: 7 } } },
  });
  const jnani = await prisma.subscriptionPlan.create({
    data: { slug: `${TAG}-jnani`, name: 'Jñānī', tier: 92, prices: { create: [
      { provider: 'GOOGLE_PLAY', productId: `${TAG}_jnani_monthly`, priceMinor: 39900, currency: 'INR' },
      { provider: 'APPLE_APP_STORE', productId: `${TAG}_jnani_apple`, priceMinor: 499, currency: 'USD' },
    ] } },
  });
  const premium = async () => (await prisma.user.findUnique({ where: { id: user.id } })).isPremium;
  const payments = () => prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });

  try {
    console.log('\n1. Exchange rate and commission');
    let calls = 0;
    fx.setFetch(async (url) => {
      calls += 1;
      if (String(url).includes('frankfurter') || String(url).includes('/v1/')) return { ok: true, json: async () => ({ rates: { INR: 83.5 } }) };
      return { ok: false, status: 500 };
    });
    const usd = await money.revenueFields({ provider: 'APPLE_APP_STORE', amountMinor: 999, currency: 'USD', paidAt: new Date('2026-09-15T10:00:00Z') });
    check('$9.99 at 83.5 is 83,417 paise gross', usd.grossInrMinor === 83417, String(usd.grossInrMinor));
    check('Apple keeps 15% (configured rate), saved with the payment', usd.commissionRate === 0.15 && usd.commissionSource === 'RATE');
    check('gross - commission = net, to the paisa', usd.grossInrMinor - usd.commissionInrMinor === usd.netInrMinor);
    check('the rate and its source are kept', usd.fxRate === 83.5 && usd.fxSource === 'FRANKFURTER');
    await money.revenueFields({ provider: 'APPLE_APP_STORE', amountMinor: 100, currency: 'USD', paidAt: new Date('2026-09-15T12:00:00Z') });
    check('a second payment that day reuses the stored rate', calls === 1, `${calls} fetch(es)`);
    fx.setFetch(async () => { throw new Error('offline'); });
    const dark = await money.revenueFields({ provider: 'GOOGLE_PLAY', amountMinor: 500, currency: 'AED', paidAt: new Date('2026-09-16T00:00:00Z') });
    check('with no rate available the INR figures stay empty (filled later)', dark.grossInrMinor === null && dark.netMinor === 425);
    const trial = await money.revenueFields({ provider: 'GOOGLE_PLAY', amountMinor: 4900, currency: 'INR', isTrial: true });
    check('a free trial is worth 0 in every column', [trial.commissionMinor, trial.netMinor, trial.grossInrMinor, trial.commissionInrMinor, trial.netInrMinor].every((v) => v === 0));
    check('0-decimal and 3-decimal currencies scale correctly', money.unitsToMinor(1000, 'JPY') === 1000 && money.unitsToMinor(1.5, 'KWD') === 1500);

    console.log('\n2. Free trial, renewal, replays');
    await lifecycle.applyStoreState({ provider: 'GOOGLE_PLAY', userId: user.id, event: 'PURCHASED', verified: state({ status: 'IN_TRIAL', isTrial: true, expiresAt: new Date(Date.now() + 7 * DAY) }) });
    let rows = await payments();
    check('the trial is a payment row of 0 marked as a trial', rows.length === 1 && rows[0].amountMinor === 0 && rows[0].isTrial && rows[0].grossInrMinor === 0);
    check('the reader has the plan during the trial', await premium());
    check('and is told the trial began', (await titles(user.id)).some((t) => t.includes('free trial')));

    const renewed = state({ orderId: `${TAG}-order-2`, expiresAt: new Date(Date.now() + 37 * DAY) });
    await lifecycle.applyStoreState({ provider: 'GOOGLE_PLAY', event: 'RENEWED', verified: renewed });
    await lifecycle.applyStoreState({ provider: 'GOOGLE_PLAY', event: 'RENEWED', verified: renewed });
    rows = await payments();
    check('the first paid month is one row, however often the store repeats it', rows.length === 2 && rows[1].amountMinor === 4900);
    check('₹49: commission ₹7.35, net ₹41.65', rows[1].commissionInrMinor === 735 && rows[1].netInrMinor === 4165 && rows[1].grossInrMinor === 4900);
    check('the renewal push went out once', (await titles(user.id)).filter((t) => t === 'Subscription renewed').length === 1);

    console.log('\n3. Cancel, grace, expiry');
    await lifecycle.applyStoreState({ provider: 'GOOGLE_PLAY', event: 'CANCELED', verified: state({ orderId: `${TAG}-order-2`, status: 'CANCELLED', autoRenew: false, expiresAt: renewed.expiresAt }) });
    check('cancelled keeps access to the end of the period', (await premium()) && (await prisma.subscription.findFirst({ where: { userId: user.id } })).status === 'CANCELLED');
    check('the reader is told it will not renew', (await titles(user.id)).includes('Subscription cancelled'));
    await lifecycle.applyStoreState({ provider: 'GOOGLE_PLAY', event: 'IN_GRACE_PERIOD', verified: state({ orderId: `${TAG}-order-3`, status: 'GRACE', billingIssue: true, expiresAt: new Date(Date.now() + 3 * DAY) }) });
    check('grace keeps access and is not counted as a payment', (await premium()) && (await payments()).length === 2);
    check('the reader is told the payment failed', (await titles(user.id)).includes('We could not renew your plan'));
    await lifecycle.applyStoreState({ provider: 'GOOGLE_PLAY', event: 'EXPIRED', verified: state({ orderId: `${TAG}-order-3`, status: 'EXPIRED', isValid: false, autoRenew: false, expiresAt: new Date(Date.now() - 1000) }) });
    check('expired ends access', !(await premium()));
    check('and the reader is told', (await titles(user.id)).includes('Your subscription has ended'));

    console.log('\n4. Plan change and a payment in dollars');
    const old = state({ externalId: `${TAG}-token-a`, orderId: `${TAG}-a-1` });
    await lifecycle.applyStoreState({ provider: 'GOOGLE_PLAY', userId: user.id, event: 'PURCHASED', verified: old });
    const upgraded = state({ externalId: `${TAG}-token-b`, orderId: `${TAG}-b-1`, productId: `${TAG}_jnani_monthly`, priceMinor: 39900, replaces: `${TAG}-token-a` });
    await lifecycle.applyStoreState({ provider: 'GOOGLE_PLAY', event: 'PURCHASED', verified: upgraded });
    const oldRow = await prisma.subscription.findFirst({ where: { externalId: `${TAG}-token-a` } });
    const newRow = await prisma.subscription.findFirst({ where: { externalId: `${TAG}-token-b` }, include: { plan: true } });
    check('the new token belongs to the same reader on the higher plan', newRow?.userId === user.id && newRow.plan.id === jnani.id);
    check('the replaced subscription is ended', oldRow.status === 'EXPIRED');
    check('the reader is told the plan was upgraded', (await titles(user.id)).includes('Plan upgraded to Jñānī'));

    fx.setFetch(async () => ({ ok: true, json: async () => ({ rates: { INR: 84 } }) }));
    const iosPurchase = state({ provider: 'APPLE_APP_STORE', externalId: `${TAG}-orig`, orderId: `${TAG}-tx-1`, productId: `${TAG}_jnani_apple`, priceMinor: 499, currency: 'USD' });
    await lifecycle.applyStoreState({ provider: 'APPLE_APP_STORE', userId: user.id, event: 'SUBSCRIBED', verified: iosPurchase });
    const dollars = await prisma.payment.findFirst({ where: { externalId: `${TAG}-tx-1` } });
    check('a $4.99 App Store payment is kept in dollars and in rupees', dollars.amountMinor === 499 && dollars.currency === 'USD' && dollars.grossInrMinor === 41916 && Number(dollars.fxRate) === 84);

    console.log('\n5. Refund');
    await lifecycle.applyRefund({ provider: 'APPLE_APP_STORE', orderId: `${TAG}-tx-1`, subscriptionExternalId: `${TAG}-orig` });
    const refunded = await prisma.payment.findFirst({ where: { externalId: `${TAG}-tx-1` } });
    check('the payment is REFUNDED with its figures kept', refunded.status === 'REFUNDED' && refunded.grossInrMinor === 41916 && refunded.refundedAt);
    check('the subscription is ended', (await prisma.subscription.findFirst({ where: { externalId: `${TAG}-orig` } })).status === 'REFUNDED');
    check('the reader is told', (await titles(user.id)).includes('Your payment was refunded'));

    console.log('\n6. Unknown buyers and store payloads');
    const stranger = await lifecycle.applyStoreState({ provider: 'GOOGLE_PLAY', event: 'PURCHASED', verified: state({ externalId: `${TAG}-nobody` }) });
    check('a purchase nobody owns is dropped, not guessed at', stranger.result === 'unknown_owner');
    const byAccount = await lifecycle.applyStoreState({ provider: 'GOOGLE_PLAY', event: 'PURCHASED', verified: state({ externalId: `${TAG}-acct`, orderId: `${TAG}-acct-1`, accountId: user.id }) });
    check('the account id the app attached links a notification that came first', byAccount.result === 'created');

    const g = google.normalise({
      subscriptionState: 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', latestOrderId: 'GPA.1', startTime: '2026-10-01T00:00:00Z', linkedPurchaseToken: 'old',
      externalAccountIdentifiers: { obfuscatedExternalAccountId: 'u1' },
      lineItems: [{ productId: 'p', expiryTime: '2099-01-01T00:00:00Z', autoRenewingPlan: { autoRenewEnabled: true, recurringPrice: { currencyCode: 'INR', units: '99', nanos: 0 } } }],
    }, 'tok');
    check('Google v2 state maps to grace with price in paise and the owner link', g.status === 'GRACE' && g.priceMinor === 9900 && g.replaces === 'old' && g.accountId === 'u1' && g.billingIssue);
    const jws = (o) => `x.${Buffer.from(JSON.stringify(o)).toString('base64url')}.y`;
    const a = apple.normalise({ status: 1, signedTransactionInfo: jws({ originalTransactionId: 'o', transactionId: 't', productId: 'p', price: 499000, currency: 'USD', expiresDate: Date.now() + DAY, offerDiscountType: 'FREE_TRIAL' }), signedRenewalInfo: jws({ autoRenewStatus: 1 }) }, 'o');
    check('Apple free trial maps to IN_TRIAL with price 0', a.status === 'IN_TRIAL' && a.priceMinor === 0 && a.isValid);
    const a2 = apple.normalise({ status: 1, signedTransactionInfo: jws({ originalTransactionId: 'o', transactionId: 't', productId: 'p', price: 4990, currency: 'USD', expiresDate: Date.now() + DAY }), signedRenewalInfo: jws({ autoRenewStatus: 0 }) }, 'o');
    check('Apple auto-renew off maps to CANCELLED, still valid, $4.99 = 499', a2.status === 'CANCELLED' && a2.isValid && a2.priceMinor === 499);
  } finally {
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.payment.deleteMany({ where: { userId: user.id } });
    await prisma.subscription.deleteMany({ where: { userId: user.id } });
    await prisma.subscriptionPlan.deleteMany({ where: { id: { in: [arta.id, jnani.id] } } });
    await prisma.fxRate.deleteMany({ where: { currency: { in: ['USD', 'AED'] }, date: { in: [new Date('2026-09-15'), new Date('2026-09-16')] } } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
