// Walks plans, prices, features and entitlement over real HTTP against a
// running API. Run it after `npm run dev`:
//
//   npm run test:subscriptions
//
// Store verification itself (Google / Apple) needs real credentials and is not
// exercised; subscriptions are written through the same services/payments
// upsert the verify endpoint and the webhooks use. What is being checked is the
// part that fails quietly: that prices differ per provider, that the highest
// tier wins when someone holds several entitlements, that a donation earns the
// donor plan, that a lapsed subscription falls back to Free, and that a feature
// nobody configured is on rather than silently locked.
//
// Everything it creates is deleted again.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import * as authService from '../services/auth.js';
import * as payments from '../services/payments/index.js';
import * as entitlement from '../services/entitlement.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'subscription-e2e-device';
const TAG = `e2e-${Date.now()}`;

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-device-id': DEVICE,
      'x-platform': 'android',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // no body
  }
  return { status: res.status, json };
}

const DAY = 86400000;

async function makeUser(roleSlug, label) {
  const role = await prisma.role.findUnique({ where: { slug: roleSlug } });
  const user = await prisma.user.create({
    data: { email: `${TAG}-${label}@example.test`, name: `${TAG} ${label}`, roleId: role.id, authProvider: 'GOOGLE', providerUserId: `${TAG}-${label}` },
  });
  await redis.del(`rl:write:${user.id}`, `rl:read:${user.id}`);
  const { accessToken } = await authService.issueSession(user, DEVICE);
  return { user, token: accessToken };
}

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`);
    process.exit(1);
  }

  const free = await prisma.subscriptionPlan.findFirst({ where: { isFree: true } });
  const premium = await prisma.subscriptionPlan.findFirst({ where: { grantedToDonors: true }, orderBy: { tier: 'desc' } });
  if (!free || !premium) {
    console.error('\nNeed the Free and Premium plans. Run `npm run seed` first.\n');
    process.exit(1);
  }

  const admin = await makeUser('super_admin', 'admin');
  const reader = await makeUser('user', 'reader');
  const other = await makeUser('user', 'other');
  const as = { token: admin.token };

  let goldId = null;
  let featureId = null;

  try {
    // ── 1 ──────────────────────────────────────────────────────────────────
    console.log('\n1. Catalogue');
    const pub = await call('GET', '/api/app/subscription/plans');
    check('plans are public', pub.status === 200, `HTTP ${pub.status}`);
    const plans = pub.json?.data?.plans ?? [];
    check('the free plan is listed, with no prices', plans.find((p) => p.isFree)?.prices.length === 0);
    check('plans come lowest tier first', plans.every((p, i) => i === 0 || plans[i - 1].tier <= p.tier));
    const narrowed = await call('GET', '/api/app/subscription/plans?provider=APPLE_APP_STORE');
    check(
      'provider narrows prices',
      narrowed.json.data.plans.every((p) => p.prices.every((x) => x.provider === 'APPLE_APP_STORE'))
    );

    // ── 2 ──────────────────────────────────────────────────────────────────
    console.log('\n2. Admin: who may edit');
    check('a reader cannot list plans', (await call('GET', '/api/admin/plans', { token: reader.token })).status === 403);
    check('a reader cannot create a feature', (await call('POST', '/api/admin/features', { token: reader.token, body: { key: 'x.y', name: 'x' } })).status === 403);
    const providers = await call('GET', '/api/admin/plans/providers', as);
    check('providers come from services/payments', JSON.stringify(providers.json?.data) === JSON.stringify(Object.keys(payments.providers)));

    // ── 3 ──────────────────────────────────────────────────────────────────
    console.log('\n3. Admin: plans, prices, features');
    const gold = await call('POST', '/api/admin/plans', { ...as, body: { slug: `${TAG}-gold`, name: 'Gold', tier: 2 } });
    check('create a plan', gold.status === 201, `HTTP ${gold.status} ${JSON.stringify(gold.json?.error ?? '')}`);
    goldId = gold.json?.data?.id;

    const g = await call('POST', `/api/admin/plans/${goldId}/prices`, {
      ...as,
      body: { provider: 'GOOGLE_PLAY', productId: `${TAG}.gold`, priceMinor: 19900, currency: 'inr', periodDays: 30, trialDays: 7 },
    });
    const a = await call('POST', `/api/admin/plans/${goldId}/prices`, {
      ...as,
      body: { provider: 'APPLE_APP_STORE', productId: `${TAG}.gold`, priceMinor: 24900, currency: 'INR', periodDays: 30 },
    });
    check('a price per provider', g.status === 201 && a.status === 201);
    check('the price differs by provider', g.json?.data?.priceMinor !== a.json?.data?.priceMinor);
    check('currency is normalised', g.json?.data?.currency === 'INR');
    check('trial days kept', g.json?.data?.trialDays === 7 && a.json?.data?.trialDays === 0);

    const dup = await call('POST', `/api/admin/plans/${goldId}/prices`, {
      ...as,
      body: { provider: 'GOOGLE_PLAY', productId: `${TAG}.gold`, priceMinor: 1, currency: 'INR', periodDays: 30 },
    });
    check('a product id cannot be reused', dup.status === 400, `HTTP ${dup.status}`);
    check('an unknown provider is refused', (await call('POST', `/api/admin/plans/${goldId}/prices`, {
      ...as, body: { provider: 'NOPE', productId: 'z', priceMinor: 1, currency: 'INR', periodDays: 30 },
    })).status === 400);
    check('the free plan has no prices', (await call('POST', `/api/admin/plans/${free.id}/prices`, {
      ...as, body: { provider: 'GOOGLE_PLAY', productId: `${TAG}.free`, priceMinor: 1, currency: 'INR', periodDays: 30 },
    })).status === 400);
    check('the free plan cannot be deactivated', (await call('PATCH', `/api/admin/plans/${free.id}`, { ...as, body: { isActive: false } })).status === 400);

    const feat = await call('POST', '/api/admin/features', {
      ...as,
      body: { key: `${TAG}.downloads`.replace(/-/g, '_'), name: 'Offline downloads', kind: 'LIMIT', unit: 'books' },
    });
    check('create a LIMIT feature', feat.status === 201, `HTTP ${feat.status}`);
    featureId = feat.json?.data?.id;
    const key = feat.json?.data?.key;
    check('a feature is on by default', feat.json?.data?.defaultEnabled === true);
    check('a duplicate key is refused', (await call('POST', '/api/admin/features', { ...as, body: { key, name: 'again' } })).status === 400);
    check('a malformed key is refused', (await call('POST', '/api/admin/features', { ...as, body: { key: 'Bad Key', name: 'x' } })).status === 400);

    // The feature has no per-plan values yet: everyone gets the default.
    const before = await call('GET', '/api/app/subscription/me', { token: reader.token });
    check('an unconfigured feature is on for free users', before.json?.data?.features?.[key]?.enabled === true);

    const set = await call('PUT', `/api/admin/plans/${free.id}/features`, { ...as, body: { values: [{ featureId, enabled: true, limit: 3 }] } });
    await call('PUT', `/api/admin/plans/${goldId}/features`, { ...as, body: { values: [{ featureId, enabled: true, limit: null }] } });
    check('set a plan’s feature values', set.status === 200);
    check('an unknown feature is refused', (await call('PUT', `/api/admin/plans/${goldId}/features`, { ...as, body: { values: [{ featureId: 'nope', enabled: true }] } })).status === 400);

    const adminPlans = await call('GET', '/api/admin/plans', as);
    const adminGold = adminPlans.json?.data?.find((p) => p.id === goldId);
    check('the admin list carries prices and values', adminGold?.prices.length === 2 && adminGold?.features.length === 1);

    // ── 4 ──────────────────────────────────────────────────────────────────
    console.log('\n4. Entitlement');
    const me = async (u) => (await call('GET', '/api/app/subscription/me', { token: u.token })).json?.data;

    let state = await me(reader);
    check('no subscription is the free plan', state.plan?.slug === 'free' && state.isPremium === false && state.reason === 'NONE');
    check('the free plan’s limit applies', state.features[key].limit === 3);

    const goldPrice = g.json.data;
    await payments.upsertSubscription({
      userId: reader.user.id, planId: goldId, priceId: goldPrice.id, provider: 'GOOGLE_PLAY',
      externalId: `${TAG}-tok-1`, currentPeriodEnd: new Date(Date.now() + 30 * DAY),
    });
    state = await me(reader);
    check('an active subscription puts the user on its plan', state.plan?.slug === `${TAG}-gold` && state.isPremium === true && state.reason === 'SUBSCRIPTION');
    check('the plan’s limit (unlimited) applies', state.features[key].limit === null && state.features[key].enabled);
    check('the subscription reports the price it was bought at', state.subscription?.price?.priceMinor === 19900);

    await payments.recordPayment({
      userId: reader.user.id, provider: 'GOOGLE_PLAY', purpose: 'DONATION', externalId: `${TAG}-don-1`, amountMinor: 100, currency: 'INR',
    });
    state = await me(reader);
    check('a donation does not outrank a higher-tier subscription', state.plan?.slug === `${TAG}-gold`);

    await prisma.subscription.updateMany({ where: { userId: reader.user.id }, data: { currentPeriodEnd: new Date(Date.now() - DAY) } });
    state = await me(reader);
    check('a lapsed subscription falls back to the donor plan', state.plan?.id === premium.id && state.reason === 'DONATION' && state.premiumUntil === null);

    await payments.recordPayment({
      userId: other.user.id, provider: 'GOOGLE_PLAY', purpose: 'DONATION', externalId: `${TAG}-don-2`, amountMinor: 100, currency: 'INR',
    });
    state = await me(other);
    check('a donation alone earns the donor plan, permanently', state.plan?.id === premium.id && state.premiumUntil === null);
    await payments.markRefunded({ provider: 'GOOGLE_PLAY', externalId: `${TAG}-don-2` });
    state = await me(other);
    check('a refunded donation falls back to Free', state.plan?.slug === 'free' && state.isPremium === false);

    check('can() reads the plan', (await entitlement.can(reader.user.id, 'ads.removed')) === true && (await entitlement.can(other.user.id, 'ads.removed')) === false);
    check('can() is false for an unknown feature', (await entitlement.can(reader.user.id, 'no.such.thing')) === false);

    check('an unknown store product is a 404', (await call('POST', '/api/app/subscription/verify', {
      token: reader.token, body: { provider: 'GOOGLE_PLAY', productId: 'not.a.product', purchaseToken: 't' },
    })).status === 404);

    // ── 5 ──────────────────────────────────────────────────────────────────
    console.log('\n5. Retiring things');
    const delBought = await call('DELETE', `/api/admin/prices/${goldPrice.id}`, as);
    check('a price people bought through cannot be deleted', delBought.status === 400, `HTTP ${delBought.status}`);
    const retire = await call('PATCH', `/api/admin/prices/${goldPrice.id}`, { ...as, body: { isActive: false } });
    check('it can be deactivated instead', retire.status === 200 && retire.json.data.isActive === false);
    const delFree = await call('DELETE', `/api/admin/prices/${a.json.data.id}`, as);
    check('an unused price can be deleted', delFree.status === 200);
    const hidden = (await call('GET', '/api/app/subscription/plans')).json.data.plans.find((p) => p.id === goldId);
    check('inactive prices are not offered', hidden.prices.length === 0);
  } finally {
    await prisma.payment.deleteMany({ where: { externalId: { startsWith: TAG } } });
    await prisma.subscription.deleteMany({ where: { externalId: { startsWith: TAG } } });
    if (featureId) await prisma.feature.deleteMany({ where: { id: featureId } });
    if (goldId) await prisma.subscriptionPlan.deleteMany({ where: { id: goldId } });
    for (const u of [admin, reader, other]) {
      await authService.invalidateUser(u.user.id);
      await prisma.user.delete({ where: { id: u.user.id } }).catch(() => {});
    }
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
