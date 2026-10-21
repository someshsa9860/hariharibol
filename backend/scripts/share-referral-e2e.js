// Walks share links, referral rewards and AI backgrounds through the real services, database and Redis (no HTTP,
// no real image provider — `fetch` to OpenAI is faked, so no money is spent).
//
//   npm run test:share-referral
//
// Checks the parts that fail quietly: one reward per referral however many times and however concurrently it is
// settled; a reward that starts after paid access instead of shortening it; self / repeat / late claims refused;
// a draft or unpublished mantra gets no link; a background charged once per key, refunded on failure, never
// started without credit. Everything it creates is deleted again.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import env from '../config/env.js';
import * as share from '../services/share.js';
import * as referral from '../services/referral.js';
import * as background from '../services/share-background.js';
import * as aiWallet from '../services/ai-wallet.js';
import * as entitlement from '../services/entitlement.js';
import * as authService from '../services/auth.js';

const TAG = `e2e${Date.now()}`;
let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1; else failed += 1;
};
const rejects = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

const made = { users: [], mantras: [] };
let roleId;
const newUser = async (label, createdAt) => {
  const user = await prisma.user.create({
    data: { email: `${TAG}-${label}@example.test`, name: `Test ${label}`, authProvider: 'GOOGLE', providerUserId: `${TAG}-${label}`, roleId, ...(createdAt ? { createdAt } : {}) },
  });
  made.users.push(user.id);
  return user;
};
const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000);

async function main() {
  await prisma.$connect();
  roleId = (await prisma.role.findFirst({ where: { slug: 'user' } }))?.id ?? (await prisma.role.findFirst()).id;
  const arta = await prisma.subscriptionPlan.findUnique({ where: { slug: 'arta' } });
  if (!arta) throw new Error('run `npm run seed` first');

  // ── Share links ──
  console.log('\nShare links');
  const mantra = await prisma.mantra.create({ data: { slug: `${TAG}-m`, name: 'Test Mantra', sanskrit: 'ॐ', category: 'name', isPublished: true } });
  const draft = await prisma.mantra.create({ data: { slug: `${TAG}-d`, name: 'Draft', sanskrit: 'ॐ', category: 'name', isPublished: false } });
  made.mantras.push(mantra.id, draft.id);

  const a = await share.linkFor('MANTRA', mantra.slug);
  const b = await share.linkFor('MANTRA', mantra.slug);
  check('the same target always gets the same code', a.code === b.code);
  check('the code names nothing', !a.code.toLowerCase().includes(mantra.slug.slice(-6).toLowerCase()) && a.code.length === 10);
  const e1 = await rejects(() => share.linkFor('MANTRA', draft.slug));
  check('a draft gets no link', e1?.status === 404);
  const e2 = await rejects(() => share.linkFor('NONSENSE', 'x'));
  check('an unknown kind is refused', e2?.status === 400);

  const opened = await share.resolve(a.code.toLowerCase(), 'MANTRA');
  check('a code opens its mantra (any case)', opened.state === 'ok' && opened.content.title === 'Test Mantra');
  check('the wrong kind is "missing", not a leak', (await share.resolve(a.code, 'SHLOKA')).state === 'missing');
  check('rubbish is "missing"', (await share.resolve('../x')).state === 'missing');
  await prisma.mantra.update({ where: { id: mantra.id }, data: { isPublished: false } });
  check('an unpublished mantra becomes "gone"', (await share.resolve(a.code)).state === 'gone');
  await prisma.mantra.update({ where: { id: mantra.id }, data: { isPublished: true } });
  await prisma.shareLink.update({ where: { code: a.code }, data: { revokedAt: new Date() } });
  check('a revoked link is "gone"', (await share.resolve(a.code)).state === 'gone');
  const racers = await Promise.all(Array.from({ length: 8 }, () => share.linkFor('MANTRA', mantra.slug)));
  check('eight at once still make one code', new Set(racers.map((r) => r.code)).size === 1);

  // ── Referrals ──
  console.log('\nReferrals');
  const referrer = await newUser('referrer');
  const code = await referral.codeFor(referrer.id);
  check('a code is made once', (await referral.codeFor(referrer.id)).code === code.code && code.code.length === 8);
  check('the inviter shows a first name only', (await referral.inviter(code.code)).firstName === 'Test');

  const fresh = await newUser('fresh', hoursAgo(30));
  check('self-claim is refused', (await rejects(() => referral.claim(referrer, code.code)))?.details?.reason === 'SELF_REFERRAL');
  check('an unknown code is refused', (await rejects(() => referral.claim(fresh, 'ZZZZZZZZ')))?.details?.reason === 'CODE_UNKNOWN');
  const old = await newUser('old', hoursAgo(24 * 40));
  check('an old account cannot claim', (await rejects(() => referral.claim(old, code.code)))?.details?.reason === 'NOT_NEW');

  const claimed = await referral.claim(fresh, code.code);
  check('a new reader can claim', claimed.status === 'PENDING');
  check('claiming the same code again is harmless', (await referral.claim(fresh, code.code)).id === claimed.id);
  const other = await referral.codeFor((await newUser('other')).id);
  check('a second, different code is refused', (await rejects(() => referral.claim(fresh, other.code)))?.details?.reason === 'ALREADY_REFERRED');

  const before = await referral.qualifyIfDue(claimed.id);
  check('no reward before the reader has done anything', before.rewarded === false && before.reason === 'NOT_ACTIVE_YET');
  check('opening a share link never creates a referral', (await prisma.referral.count({ where: { referrerId: referrer.id } })) === 1);

  await prisma.sadhanaDay.create({ data: { userId: fresh.id, date: new Date() } });
  const results = await Promise.all(Array.from({ length: 6 }, () => referral.qualifyIfDue(claimed.id)));
  check('six concurrent settles reward exactly once', results.filter((r) => r.rewarded).length === 1);
  check('one reward row, one subscription row', (await prisma.referralReward.count({ where: { referralId: claimed.id } })) === 1
    && (await prisma.subscription.count({ where: { userId: referrer.id, provider: 'REFERRAL' } })) === 1);
  const again = await referral.qualifyIfDue(claimed.id);
  check('settling again does nothing', again.rewarded === false && again.reason === 'NOT_PENDING');

  const ent = await entitlement.compute(referrer.id);
  const sub = await prisma.subscription.findFirst({ where: { userId: referrer.id } });
  check('the referrer is on Ārta', ent.isPremium && ent.plan.slug === 'arta');
  check('for about 30 days', Math.abs((sub.currentPeriodEnd - Date.now()) / 86_400_000 - 30) < 0.1);
  const cached = await prisma.user.findUnique({ where: { id: referrer.id } });
  check('the cached premium flag follows', cached.isPremium === true);

  // A second referral extends, never overwrites or shortens.
  const second = await newUser('second', hoursAgo(30));
  const r2 = await referral.claim(second, code.code);
  await prisma.sadhanaDay.create({ data: { userId: second.id, date: new Date() } });
  await referral.qualifyIfDue(r2.id);
  const subs = await prisma.subscription.findMany({ where: { userId: referrer.id, provider: 'REFERRAL' } });
  check('a second reward extends the same month, not a second row', subs.length === 1 && Math.abs((subs[0].currentPeriodEnd - Date.now()) / 86_400_000 - 60) < 0.1);

  // Paid access first: the month starts after it.
  const payer = await newUser('payer');
  const paidEnd = new Date(Date.now() + 10 * 86_400_000);
  await prisma.subscription.create({ data: { userId: payer.id, planId: arta.id, provider: 'GOOGLE_PLAY', externalId: `${TAG}-paid`, status: 'ACTIVE', currentPeriodEnd: paidEnd } });
  const payerCode = await referral.codeFor(payer.id);
  const third = await newUser('third', hoursAgo(30));
  const r3 = await referral.claim(third, payerCode.code);
  await prisma.sadhanaDay.create({ data: { userId: third.id, date: new Date() } });
  await referral.qualifyIfDue(r3.id);
  const reward = await prisma.referralReward.findUnique({ where: { referralId: r3.id } });
  check('the month starts when paid access ends', Math.abs(reward.startsAt - paidEnd) < 1000);
  const paid = await prisma.subscription.findFirst({ where: { userId: payer.id, provider: 'GOOGLE_PLAY' } });
  check('the paid subscription is untouched', paid.currentPeriodEnd.getTime() === paidEnd.getTime());

  // Too soon.
  const quick = await newUser('quick', hoursAgo(2));
  const rq = await referral.claim(quick, code.code);
  await prisma.sadhanaDay.create({ data: { userId: quick.id, date: new Date() } });
  check('a brand-new account does not qualify in the same breath', (await referral.qualifyIfDue(rq.id)).reason === 'TOO_SOON');

  const summary = await referral.summary(referrer, {});
  check('the dashboard counts and lists rewards', summary.totals.rewarded === 2 && summary.rewards.length === 2 && summary.totals.pending === 1 && summary.history.length === 3);
  check('history shows first names only', summary.history.length > 0 && summary.history.every((h) => h.name === 'Test'));

  // ── AI backgrounds (provider faked) ──
  console.log('\nAI backgrounds');
  const painter = await newUser('painter');
  env.OPENAI_API_KEY = 'test-key';
  const realFetch = globalThis.fetch;
  let calls = 0;
  let mode = 'ok';
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes('images/generations')) return realFetch(url, init);
    calls += 1;
    if (mode === 'fail') return new Response('{"error":"boom secret"}', { status: 500 });
    return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('png-bytes').toString('base64') }] }), { status: 200 });
  };
  const balance = async () => (await prisma.aiWallet.findUnique({ where: { userId: painter.id } })).balance;
  try {
    await aiWallet.open(painter);
    const poor = await background.quote(painter);
    check('a free wallet cannot afford one, and is told so', poor.canAfford === false && poor.backgroundsLeft === 0);
    await aiWallet.credit({ userId: painter.id, tokens: 400_000, source: 'ADMIN_GRANT', note: 'e2e' });
    const start = await balance();
    const cost = env.SHARE_BACKGROUND_TOKENS;
    const q = await background.quote(painter);
    check('the quote says a background is affordable', q.available && q.canAfford);

    const first = await background.generate(painter, { requestId: `${TAG}-req-1`, prompt: 'golden sunrise over a temple' });
    check('a background is made', first.status === 'DONE' && !!first.imageKey);
    check('and charged once', (await balance()) === start - cost);
    const replay = await background.generate(painter, { requestId: `${TAG}-req-1`, prompt: 'golden sunrise over a temple' });
    check('the same key again costs nothing and calls nothing', replay.id === first.id && (await balance()) === start - cost && calls === 1);

    const concurrent = await Promise.allSettled([1, 2, 3].map(() => background.generate(painter, { requestId: `${TAG}-req-2`, prompt: 'blue lake at dawn' })));
    check('three at once with one key charge once', (await balance()) === start - 2 * cost && calls === 2, `calls=${calls}`);
    check('…and the others are told it is in progress or replayed', concurrent.every((r) => r.status === 'fulfilled' || r.reason?.code === 'CONFLICT'));

    mode = 'fail';
    const failure = await rejects(() => background.generate(painter, { requestId: `${TAG}-req-3`, prompt: 'peaceful forest' }));
    check('a failed generation is refunded', failure?.code === 'IMAGE_FAILED' && (await balance()) === start - 2 * cost);
    check('and the error does not leak the provider', !JSON.stringify(failure).includes('secret'));
    mode = 'ok';
    const retry = await background.generate(painter, { requestId: `${TAG}-req-3`, prompt: 'peaceful forest' });
    check('retrying the failed key succeeds and charges once', retry.status === 'DONE' && (await balance()) === start - 3 * cost);

    await prisma.aiWallet.update({ where: { userId: painter.id }, data: { balance: cost - 1 } });
    const callsBefore = calls;
    const broke = await rejects(() => background.generate(painter, { requestId: `${TAG}-req-4`, prompt: 'no credit here' }));
    check('without credit nothing starts', broke?.status === 402 && broke.code === 'CREDITS_EXHAUSTED' && calls === callsBefore);
    check('and nothing is charged or recorded', (await balance()) === cost - 1 && (await prisma.shareBackground.count({ where: { userId: painter.id, requestId: `${TAG}-req-4` } })) === 0);

    check('an empty prompt is refused', (await rejects(() => background.generate(painter, { requestId: `${TAG}-req-5`, prompt: '  ' })))?.status === 400);
  } finally {
    globalThis.fetch = realFetch;
  }

  await httpSection(painter);
}

// ── Over HTTP: only when an API is listening (npm run dev), so `npm run test:share-referral` also works without one.
async function httpSection(painter) {
  const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
  const up = await fetch(`${BASE}/health`).then((r) => r.ok).catch(() => false);
  if (!up) { console.log('\nHTTP: skipped (no API at ' + BASE + ')'); return; }
  console.log('\nHTTP');

  const call = async (method, path, { token, body } = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', 'x-device-id': `${TAG}-dev`, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const raw = await res.arrayBuffer();
    let json = null;
    try { json = JSON.parse(Buffer.from(raw).toString()); } catch { /* binary */ }
    return { status: res.status, json, bytes: raw.byteLength };
  };

  const mantra = await prisma.mantra.create({ data: { slug: `${TAG}-http`, name: 'Http Mantra', sanskrit: 'ॐ', category: 'name', isPublished: true } });
  made.mantras.push(mantra.id);
  const reader = await newUser('reader');
  const { accessToken: token } = await authService.issueSession(reader, `${TAG}-dev`);

  check('creating a link needs sign-in', (await call('POST', '/api/app/share/links', { body: { kind: 'MANTRA', targetId: mantra.slug } })).status === 403);
  const made1 = await call('POST', '/api/app/share/links', { token, body: { kind: 'MANTRA', targetId: mantra.slug } });
  check('a signed-in reader gets a link', made1.status === 201 && /\/mantra\/[A-Z0-9]{10}$/.test(made1.json.data.url) && made1.json.data.appUri.startsWith('hariharibol://mantra/'));
  check('a draft cannot be linked', (await call('POST', '/api/app/share/links', { token, body: { kind: 'MANTRA', targetId: `${TAG}-nope` } })).status === 404);
  check('a bad kind is a 400', (await call('POST', '/api/app/share/links', { token, body: { kind: 'ADMIN', targetId: 'x' } })).status === 400);

  const code = made1.json.data.code;
  const open = await call('GET', `/api/app/share/links/${code}?kind=MANTRA&utm_source=wa&redirect=http://evil.test`);
  check('anyone can open it, signed out', open.status === 200 && open.json.data.content.title === 'Http Mantra');
  check('only attribution survives, never a destination', open.json.data.query === 'utm_source=wa' && !JSON.stringify(open.json).includes('evil'));
  check('the public view leaks no ids or people', !/userId|email|createdById/.test(JSON.stringify(open.json)));
  check('another kind\'s path does not open it', (await call('GET', `/api/app/share/links/${code}?kind=REEL`)).status === 404);
  await prisma.shareLink.updateMany({ where: { code }, data: { revokedAt: new Date() } });
  check('a revoked link is 410', (await call('GET', `/api/app/share/links/${code}`)).status === 410);

  const me = await call('GET', '/api/app/referral/me', { token });
  check('referral/me gives a code and a satsang link', me.status === 200 && /\/satsang\/[A-Z0-9]{8}$/.test(me.json.data.url));
  check('referral/me needs sign-in', (await call('GET', '/api/app/referral/me')).status === 403);
  const inviterRes = await call('GET', `/api/app/referral/inviter/${me.json.data.code}`);
  check('the inviter endpoint is public and shows a first name only', inviterRes.status === 200 && inviterRes.json.data.firstName === 'Test' && !/email/.test(JSON.stringify(inviterRes.json)));
  check('claiming your own code is refused over HTTP', (await call('POST', '/api/app/referral/claim', { token, body: { code: me.json.data.code } })).status === 409);
  check('an invitation page for a content code is a 404', (await call('GET', `/api/app/referral/inviter/${code}`)).status === 404);

  const quote = await call('GET', '/api/app/share/background/quote', { token });
  check('the quote never shows tokens', quote.status === 200 && !/token/i.test(JSON.stringify(quote.json)));
  const row = await prisma.shareBackground.findFirst({ where: { userId: painter.id, status: 'DONE' } });
  const { accessToken: painterToken } = await authService.issueSession(painter, `${TAG}-dev`);
  const mine = await call('GET', `/api/app/share/background/${row.id}/image`, { token: painterToken });
  check('a maker can download their picture', mine.status === 200 && mine.bytes > 0);
  const theirs = await call('GET', `/api/app/share/background/${row.id}/image`, { token });
  check('nobody else can', theirs.status === 404);
}

try {
  await main();
} catch (error) {
  console.error(error);
  failed += 1;
} finally {
  await prisma.shareBackground.deleteMany({ where: { userId: { in: made.users } } }).catch(() => {});
  await prisma.aiWalletTransaction.deleteMany({ where: { userId: { in: made.users } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: made.users } } }).catch((e) => console.error('cleanup', e.message));
  await prisma.shareLink.deleteMany({ where: { kind: 'MANTRA', targetId: { startsWith: TAG } } }).catch(() => {});
  await prisma.mantra.deleteMany({ where: { id: { in: made.mantras } } }).catch(() => {});
  await prisma.$disconnect();
  await redis.quit().catch(() => {});
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
