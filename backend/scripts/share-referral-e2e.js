// Walks share links, refer-and-earn and share backgrounds against a running API
// and the real database. Run it after `npm run dev`:
//
//   npm run test:share-referral
//
// (The npm script sets a dummy OPENAI_API_KEY.) The image provider is faked (no real picture is bought and no key is needed);
// everything else — links, attribution, qualification, the Ārta grant, the
// entitlement, the wallet — is real. Everything it creates is deleted again.


import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import * as authService from '../services/auth.js';
import * as referral from '../services/referral.js';
import * as shareImage from '../services/share-image.js';
import * as aiWallet from '../services/ai-wallet.js';
import * as entitlement from '../services/entitlement.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'share-referral-e2e-device';
const TAG = `e2e${Date.now()}`;
const DAY = 86400000;

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (ok) passed += 1;
  else failed += 1;
};

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-device-id': DEVICE, 'x-platform': 'android', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const made = [];
async function makeUser(label, { email, ageDays = 0, name } = {}) {
  const role = await prisma.role.findUnique({ where: { slug: 'user' } });
  const user = await prisma.user.create({
    data: {
      email: email || `${TAG}-${label}@example.test`, name: name || `${label} Tester`, roleId: role.id,
      authProvider: 'GOOGLE', providerUserId: `${TAG}-${label}`, createdAt: new Date(Date.now() - ageDays * DAY),
    },
  });
  made.push(user.id);
  await redis.del(`rl:write:${user.id}`, `rl:read:${user.id}`);
  const { accessToken } = await authService.issueSession(user, DEVICE);
  return { user, token: accessToken };
}

async function chantRound(userId) {
  const day = await prisma.sadhanaDay.create({ data: { userId, date: new Date(new Date().toISOString().slice(0, 10)) } });
  const session = await prisma.chantSession.create({ data: { userId, sadhanaDayId: day.id } });
  await prisma.chantMala.create({ data: { sessionId: session.id, userId, index: 1, beads: 108, startedAt: new Date(), complete: true } });
}

const grants = (userId) => prisma.entitlementGrant.findMany({ where: { userId }, orderBy: { startsAt: 'asc' } });

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) { console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`); process.exit(1); }

  // Its own book, so this runs on an empty database and never touches real content.
  const bookNumber = 9000 + Math.floor(Math.random() * 900);
  const book = await prisma.book.create({
    data: { bookNumber, slug: `${TAG}-book`, type: 'SCRIPTURE', title: 'Test Book', isPublished: true },
  });
  const verse = await prisma.verse.create({
    data: { verseId: `${bookNumber}.1.1`, bookId: book.id, bookNumber, verseNumber: 1, sanskrit: 'ॐ नमो भगवते वासुदेवाय' },
    select: { verseId: true },
  });
  const mantra = await prisma.mantra.findFirst({ where: { isPublished: true }, select: { slug: true } });
  const hidden = await prisma.mantra.findFirst({ where: { isPublished: false }, select: { slug: true } });

  const A = await makeUser('a', { name: 'Anna Referrer' });
  const B = await makeUser('b', { name: 'Bhanu Newcomer' });
  const C = await makeUser('c');
  const D = await makeUser('d');

  try {
    console.log('\n1. Share links');
    const l1 = await call('POST', '/api/app/share/link', { token: A.token, body: { type: 'VERSE', targetId: verse.verseId } });
    check('a verse link is made', l1.status === 200 && /^[1-9A-HJ-NP-Za-km-z]{10}$/.test(l1.json?.data?.code), JSON.stringify(l1.json));
    check('it is on the spiritual path', /\/shloka\/[A-Za-z0-9]{10}$/.test(l1.json?.data?.url || ''));
    check('the code does not contain the verse id', !l1.json.data.code.includes(verse.verseId));
    const l2 = await call('POST', '/api/app/share/link', { token: A.token, body: { type: 'VERSE', targetId: verse.verseId } });
    check('the same share gives the same link', l2.json?.data?.code === l1.json.data.code);
    const l3 = await call('POST', '/api/app/share/link', { token: B.token, body: { type: 'VERSE', targetId: verse.verseId } });
    check('another person gets their own code', l3.json?.data?.code && l3.json.data.code !== l1.json.data.code);
    if (mantra) {
      const m = await call('POST', '/api/app/share/link', { token: A.token, body: { type: 'MANTRA', targetId: mantra.slug } });
      check('a mantra link is on /naam', /\/naam\//.test(m.json?.data?.url || ''));
    }
    check('an unknown verse is 404', (await call('POST', '/api/app/share/link', { token: A.token, body: { type: 'VERSE', targetId: '9.9.9' } })).status === 404);
    check('a malformed target is 400', (await call('POST', '/api/app/share/link', { token: A.token, body: { type: 'VERSE', targetId: '../etc' } })).status === 400);
    if (hidden) check('an unpublished mantra cannot be shared', (await call('POST', '/api/app/share/link', { token: A.token, body: { type: 'MANTRA', targetId: hidden.slug } })).status === 404);
    check('signing in is required', (await call('POST', '/api/app/share/link', { body: { type: 'VERSE', targetId: verse.verseId } })).status === 403);

    console.log('\n2. The public page');
    const code = l1.json.data.code;
    const pub = await call('GET', `/api/web/share/shloka/${code}`);
    check('a verse link resolves without signing in', pub.status === 200 && pub.json?.data?.verseId === verse.verseId);
    const text = JSON.stringify(pub.json);
    check('no database id or sharer leaks', !text.includes(A.user.id) && !text.includes(A.user.email) && !/"id":/.test(text));
    check('the wrong route is 404', (await call('GET', `/api/web/share/naam/${code}`)).status === 404);
    check('an unknown code is 404', (await call('GET', '/api/web/share/shloka/zzzzzzzzzz')).status === 404);
    check('a malformed code is rejected', (await call('GET', '/api/web/share/shloka/..%2Fx')).status >= 400);
    await prisma.shareLink.update({ where: { code }, data: { revokedAt: new Date() } });
    check('a revoked link is 410', (await call('GET', `/api/web/share/shloka/${code}`)).status === 410);
    const clicks = (await prisma.shareLink.findUnique({ where: { code: l3.json.data.code } })).clicks;
    await call('GET', `/api/web/share/shloka/${l3.json.data.code}`);
    await new Promise((r) => setTimeout(r, 300));
    check('visits are counted', (await prisma.shareLink.findUnique({ where: { code: l3.json.data.code } })).clicks === clicks + 1);

    console.log('\n3. Referral codes');
    const me1 = await call('GET', '/api/app/referral/me', { token: A.token });
    const aCode = me1.json?.data?.code;
    check('everyone has a code and a /satsang link', /^[A-Z2-9]{8}$/.test(aCode || '') && me1.json.data.url.endsWith(`/satsang/${aCode}`));
    check('the code is stable', (await call('GET', '/api/app/referral/me', { token: A.token })).json.data.code === aCode);
    const ins = await call('GET', `/api/web/referral/${aCode.toLowerCase()}`);
    check('an invitation can be checked, naming only a first name', ins.status === 200 && ins.json.data.referrerName === 'Anna' && !JSON.stringify(ins.json).includes('Referrer'));
    check('an unknown invitation is 404', (await call('GET', '/api/web/referral/AAAAAAAA')).status === 404);

    console.log('\n4. Attribution');
    check('your own code is refused', (await call('POST', '/api/app/referral/attribute', { token: A.token, body: { code: aCode } })).json.data.reason === 'own_code');
    check('a made-up code is refused', (await call('POST', '/api/app/referral/attribute', { token: B.token, body: { code: 'AAAAAAAA' } })).json.data.reason === 'invalid_code');
    const dotted = await makeUser('dot', { email: `Anna.Ref+x@gmail.com` });
    const plain = await makeUser('plain', { email: `annaref@gmail.com` });
    const plainCode = (await call('GET', '/api/app/referral/me', { token: plain.token })).json.data.code;
    check('the same inbox under another spelling is refused', (await call('POST', '/api/app/referral/attribute', { token: dotted.token, body: { code: plainCode } })).json.data.reason === 'same_person');
    const old = await makeUser('old', { ageDays: 30 });
    check('an old account is not a new user', (await call('POST', '/api/app/referral/attribute', { token: old.token, body: { code: aCode } })).json.data.reason === 'window_passed');
    const payer = await makeUser('payer');
    const arta = await prisma.subscriptionPlan.findUnique({ where: { slug: 'arta' } });
    await prisma.subscription.create({ data: { userId: payer.user.id, planId: arta.id, provider: 'GOOGLE_PLAY', externalId: `${TAG}-p`, currentPeriodEnd: new Date(Date.now() - DAY), status: 'EXPIRED' } });
    check('someone who has paid is not new', (await call('POST', '/api/app/referral/attribute', { token: payer.token, body: { code: aCode } })).json.data.reason === 'not_new');

    const ok1 = await call('POST', '/api/app/referral/attribute', { token: B.token, body: { code: aCode.toLowerCase(), source: 'CODE' } });
    check('a new person is attributed (code typed in lower case)', ok1.json?.data?.attributed === true);
    check('only the first code counts', (await call('POST', '/api/app/referral/attribute', { token: B.token, body: { code: plainCode } })).json.data.reason === 'already_referred');
    check('they can see who invited them', (await call('GET', '/api/app/referral/mine', { token: B.token })).json.data.referrerName === 'Anna');
    check('opening the public page rewarded nothing', (await grants(A.user.id)).length === 0);
    const me2 = await call('GET', '/api/app/referral/me', { token: A.token });
    check('the inviter sees one pending referral and no reward', me2.json.data.totals.pending === 1 && me2.json.data.totals.successful === 0 && me2.json.data.history[0].name === 'Bhanu N.');

    console.log('\n5. Qualifying and the reward');
    check('nothing is given before the first round', (await referral.evaluate(B.user.id)).changed === false && (await grants(A.user.id)).length === 0);
    await chantRound(B.user.id);
    const results = await Promise.all(Array.from({ length: 6 }, () => referral.evaluate(B.user.id)));
    check('six parallel checks make one reward', results.filter((r) => r.status === 'QUALIFIED').length === 1 && (await grants(A.user.id)).length === 1);
    await referral.evaluate(B.user.id);
    check('checking again later changes nothing', (await grants(A.user.id)).length === 1);
    const g1 = (await grants(A.user.id))[0];
    check('the grant is 30 days of Ārta', g1.planId === arta.id && Math.abs((g1.endsAt - g1.startsAt) / DAY - 30) < 0.01);
    const sub = await call('GET', '/api/app/subscription/me', { token: A.token });
    check('the inviter is now on Ārta, because of a grant', sub.json?.data?.plan?.slug === 'arta' && sub.json.data.reason === 'GRANT', JSON.stringify(sub.json?.data));
    check('it is not shown as a store subscription', await prisma.subscription.count({ where: { userId: A.user.id } }) === 0);
    const me3 = await call('GET', '/api/app/referral/me', { token: A.token });
    check('the dashboard shows the reward and its dates', me3.json.data.totals.successful === 1 && me3.json.data.history[0].reward.endsAt && me3.json.data.rewardActiveUntil);
    check('the inviter was told', await prisma.notification.count({ where: { userId: A.user.id, type: 'REFERRAL' } }) === 1);

    await call('POST', '/api/app/referral/attribute', { token: C.token, body: { code: aCode } });
    await chantRound(C.user.id);
    await referral.evaluate(C.user.id);
    const gs = await grants(A.user.id);
    check('a second reward starts when the first ends', gs.length === 2 && Math.abs(gs[1].startsAt - gs[0].endsAt) < 1000);

    console.log('\n6. A paid subscription is never replaced or shortened');
    const paid = await makeUser('paid');
    const paidEnd = new Date(Date.now() + 10 * DAY);
    await prisma.subscription.create({ data: { userId: paid.user.id, planId: arta.id, provider: 'GOOGLE_PLAY', externalId: `${TAG}-s`, currentPeriodEnd: paidEnd, status: 'ACTIVE' } });
    const paidCode = (await call('GET', '/api/app/referral/me', { token: paid.token })).json.data.code;
    await call('POST', '/api/app/referral/attribute', { token: D.token, body: { code: paidCode } });
    await chantRound(D.user.id);
    await referral.evaluate(D.user.id);
    const [pg] = await grants(paid.user.id);
    check('the reward waits until the paid period ends', pg && Math.abs(pg.startsAt - paidEnd) < 1000);
    const now = await entitlement.compute(paid.user.id);
    check('meanwhile they stay on their subscription', now.reason === 'SUBSCRIPTION' && now.premiumUntil.getTime() === paidEnd.getTime());

    console.log('\n7. Expiry, limits and reversal');
    const late = await makeUser('late');
    await call('POST', '/api/app/referral/attribute', { token: late.token, body: { code: aCode } });
    await prisma.referral.update({ where: { refereeId: late.user.id }, data: { attributedAt: new Date(Date.now() - 40 * DAY) } });
    await chantRound(late.user.id);
    check('a referral that took too long expires without a reward', (await referral.evaluate(late.user.id)).status === 'REJECTED' && (await grants(A.user.id)).length === 2);
    check('a reversal takes the reward back', (await referral.reverse((await prisma.referral.findUnique({ where: { refereeId: C.user.id } })).id, 'refund')) === true);
    check('…and the inviter keeps the first reward only', (await entitlement.compute(A.user.id)).premiumUntil.getTime() === (await grants(A.user.id))[0].endsAt.getTime());
    check('reversing twice does nothing', (await referral.reverse((await prisma.referral.findUnique({ where: { refereeId: C.user.id } })).id)) === false);

    console.log('\n8. Backgrounds');
    const user = { id: A.user.id, timezone: 'Asia/Kolkata' };
    const calls = [];
    const realFetch = globalThis.fetch;
    let mode = 'ok';
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2000, 1)]);
    globalThis.fetch = async (url, init) => {
      if (!String(url).includes('api.openai.com/v1/images')) return realFetch(url, init);
      calls.push(JSON.parse(init.body));
      if (mode === 'fail') return new Response('{}', { status: 500 });
      return new Response(JSON.stringify({ data: [{ b64_json: png.toString('base64') }] }), { status: 200 });
    };
    const balance = async () => (await prisma.aiWallet.findUnique({ where: { userId: A.user.id } }))?.balance;
    await aiWallet.open(user);
    const start = await balance();
    const quote = await shareImage.quote(user);
    check('the quote is a percentage, not tokens', quote.enabled && Number.isInteger(quote.costPercent) && !JSON.stringify(quote).includes('tokens'));

    const key = `${TAG}-k1`;
    const first = await shareImage.generate({ user, requestKey: key, prompt: 'A golden sunrise behind a temple' });
    check('a background is made and charged once', first.status === 'DONE' && first.imageUrl && (await balance()) === start - shareImage.COST_TOKENS);
    check('the guard against letters and watermarks is always sent', /no letters/i.test(calls[0].prompt));
    const again = await shareImage.generate({ user, requestKey: key, prompt: 'A golden sunrise behind a temple' });
    check('the same request again is not charged or sent twice', again.id === first.id && (await balance()) === start - shareImage.COST_TOKENS && calls.length === 1);
    const burst = await Promise.all(Array.from({ length: 5 }, () => shareImage.generate({ user, requestKey: `${TAG}-k2`, prompt: 'Soft lotus pond at dawn' })));
    check('five parallel identical requests charge once', new Set(burst.map((j) => j.id)).size === 1 && (await balance()) === start - 2 * shareImage.COST_TOKENS && calls.length === 2);
    const used = async () => (await prisma.aiDailyUsage.findMany({ where: { userId: A.user.id } })).reduce((n, r) => n + r.tokens, 0);
    check('the day’s cap counts both', (await used()) === 2 * shareImage.COST_TOKENS);
    await prisma.aiDailyUsage.deleteMany({ where: { userId: A.user.id } });

    mode = 'fail';
    const bad = await shareImage.generate({ user, requestKey: `${TAG}-k3`, prompt: 'A river with floating lamps' });
    check('a provider failure is refunded', bad.status === 'FAILED' && (await balance()) === start - 2 * shareImage.COST_TOKENS);
    check('…with one credit entry back', await prisma.aiWalletTransaction.count({ where: { userId: A.user.id, source: 'SHARE_IMAGE', type: 'CREDIT', referenceId: bad.id } }) === 1);
    check('…and the day’s cap is given back too', (await used()) === 0);
    mode = 'ok';
    const retry = await shareImage.generate({ user, requestKey: `${TAG}-k3`, prompt: 'A river with floating lamps' });
    check('a failed request can be retried with the same key', retry.status === 'DONE' && retry.id === bad.id && (await balance()) === start - 3 * shareImage.COST_TOKENS);

    await prisma.aiWallet.update({ where: { userId: A.user.id }, data: { balance: 10 } });
    const before = calls.length;
    let blocked = null;
    try { await shareImage.generate({ user, requestKey: `${TAG}-k4`, prompt: 'A quiet forest clearing' }); } catch (e) { blocked = e; }
    check('without credit it is refused first (402), nothing sent or charged', blocked?.status === 402 && blocked.code === 'CREDIT_REQUIRED' && calls.length === before && (await balance()) === 10);
    check('a short prompt is refused', await shareImage.generate({ user, requestKey: `${TAG}-k5`, prompt: 'x' }).then(() => false, (e) => e.status === 400));
    globalThis.fetch = realFetch;
  } finally {
    await prisma.shareImageJob.deleteMany({ where: { userId: { in: made } } });
    await prisma.notification.deleteMany({ where: { userId: { in: made } } });
    await prisma.shareLink.deleteMany({ where: { createdById: { in: made } } });
    await prisma.user.deleteMany({ where: { id: { in: made } } });
    await prisma.book.deleteMany({ where: { slug: `${TAG}-book` } });
    await prisma.$disconnect();
    redis.disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
