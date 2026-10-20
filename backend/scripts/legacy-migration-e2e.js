// Walks carrying people over from the old app's server end to end against the real database and the real app,
// with the old Laravel server faked:
//
//   npm run test:legacy-migration
//
// Needs Postgres and Redis (the usual .env) and a seeded database (`npm run seed`). It boots the API in this
// process on a free port and stands a small HTTP server in for the old one, so no key, no network and no real
// person is involved. What it checks:
//
//   1  what the old server is asked: the shared key in a header, the token in the body, nothing else
//   2  a first sign-in: a LEGACY account, a session that works, the old mantra carried across
//   3  the same person again (and from another token): the same account, never a second
//   4  everything that goes wrong — the app is told 403 UNAUTHENTICATED only when the token itself is no good,
//      and 503 for every other reason, none of which creates anything or tells the app why
//   5  people with no usable email: a stand-in address that is never shown to them
//   6  an account here that already has the email, a banned account, closed sign-ups, two requests at once
//   7  Google signing in with a carried-over email: it takes the account over, ends the sessions made from the
//      old token, and the old token stops working
//   8  the favourite mantra: the old one opens "Chant now" until a mantra is chanted here, then that one does
//   9  attestation (403 FORBIDDEN, not UNAUTHENTICATED), the feature switched off, deleting the account
//
// It removes every user it made and puts the sign-up setting back.

import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.AWS_ACCESS_KEY_ID = '';
process.env.AWS_SECRET_ACCESS_KEY = '';
process.env.APP_CHECK_ENABLED = 'false';
process.env.GOOGLE_CLIENT_IDS = 'legacy-e2e.apps.googleusercontent.com';

// ── The fake old server ────────────────────────────────────────────────────
const KEY = `legacy-e2e-${'k'.repeat(40)}`; // the shared secret: at least 32 characters
const RUN = Date.now();
const FIRST_ID = 910000; // old user ids this run uses; anything in 910000–910999 is swept up at the start and the end

/** Every request made to the "old server", in order. */
const hits = [];
/** Switches a test flips to make the old server misbehave. */
const mode = { notConfigured: false, rejectKey: false };
/** token → what the old server answers. `delayMs` holds the answer back; `raw` is sent as is instead of JSON. */
const answers = new Map();

function oldUser(id, extra = {}) {
  return { id, name: `Legacy ${id}`, email: `legacy-e2e-${id}-${RUN}@example.com`, image: null, provider: 'google', createdAt: '2024-01-01T00:00:00Z', ...extra };
}
const known = (id, mantras = [], user = {}) => ({ status: 200, body: { user: oldUser(id, user), mantras } });

const oldServer = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    let token = null;
    try { token = JSON.parse(raw).token; } catch { /* not JSON */ }
    hits.push({ method: req.method, url: req.url, key: req.headers['x-migration-key'], contentType: req.headers['content-type'], token, raw });

    const send = (status, body, text) => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(text ?? JSON.stringify(body));
    };

    // Laravel's own answers, in the order its middleware gives them.
    if (mode.notConfigured) return send(404, { code: 'not_configured' });
    if (mode.rejectKey || req.headers['x-migration-key'] !== KEY) return send(401, { code: 'invalid_key' });

    const answer = answers.get(token) ?? { status: 401, body: { code: 'invalid_token' } };
    setTimeout(() => send(answer.status, answer.body, answer.raw), answer.delayMs ?? 0);
  });
});
await new Promise((resolve) => oldServer.listen(0, '127.0.0.1', resolve));

process.env.LEGACY_MIGRATION_URL = `http://127.0.0.1:${oldServer.address().port}/api/migration/hariharibol`;
process.env.LEGACY_MIGRATION_KEY = KEY;
process.env.LEGACY_MIGRATION_TIMEOUT_MS = '1000'; // the least the config allows, so the slow case is quick

const { OAuth2Client } = await import('google-auth-library');
const { prisma } = await import('../config/database.js');
const { redis } = await import('../config/redis.js');
const { default: env } = await import('../config/env.js');
const authService = await import('../services/auth.js');
const { CACHE, SETTING_KEYS } = await import('../config/constants.js');
const { default: app } = await import('../app.js');

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}
const section = (title) => console.log(`\n${title}`);

// ── Helpers ────────────────────────────────────────────────────────────────
const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
const BASE = `http://127.0.0.1:${server.address().port}/api`;
const HEAD = { 'content-type': 'application/json', 'x-device-id': 'legacy-e2e-device', 'x-platform': 'ios' };

async function call(method, path, { token, body, headers } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...HEAD, ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

/** POST /app/auth/legacy the way the app sends it. */
const legacy = (legacyToken, extra = {}) =>
  call('POST', '/app/auth/legacy', { body: { legacyToken, deviceId: 'legacy-e2e-device', platform: 'ios', ...extra } });

const code = (r) => r.json?.error?.code;
const hitsFor = (token) => hits.filter((h) => h.token === token);
const rowOf = (legacyUserId) => prisma.user.findUnique({ where: { legacyUserId }, include: { sadhanaProfile: true, role: true } });
const people = () => prisma.user.count({ where: { legacyUserId: { gte: FIRST_ID, lte: FIRST_ID + 999 } } });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The Google sheet cannot be automated; what it hands the server can be. `claims` is what the id token would say.
const realVerifyIdToken = OAuth2Client.prototype.verifyIdToken;
let googleClaims = null;
OAuth2Client.prototype.verifyIdToken = async function verifyIdToken() {
  if (!googleClaims) throw new Error('no fake Google claims set');
  return { getPayload: () => googleClaims };
};
const google = (claims) => {
  googleClaims = { email_verified: true, picture: null, ...claims };
  return call('POST', '/app/auth/social', { body: { provider: 'GOOGLE', idToken: 'x'.repeat(40), deviceId: 'legacy-e2e-device' } });
};

const spare = []; // users made by hand, removed at the end
async function realUser(label, email) {
  const role = await prisma.role.findUnique({ where: { slug: 'user' } });
  const user = await prisma.user.create({
    data: { email, name: label, authProvider: 'GOOGLE', providerUserId: `legacy-e2e-${label}-${RUN}`, roleId: role.id },
  });
  spare.push(user.id);
  return user;
}

async function sweep() {
  const found = await prisma.user.findMany({
    where: { OR: [{ legacyUserId: { gte: FIRST_ID, lte: FIRST_ID + 999 } }, { email: { startsWith: 'legacy-e2e-' } }, { providerUserId: { startsWith: 'legacy-e2e-' } }] },
    select: { id: true },
  });
  const ids = [...found.map((u) => u.id), ...spare];
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.device.deleteMany({ where: { deviceId: { startsWith: 'legacy-e2e' } } });
  for (const id of ids) await redis.del(CACHE.userAuth(id)).catch(() => null);
}

// ── The run ────────────────────────────────────────────────────────────────
async function main() {
  const shiva = await prisma.mantra.findUnique({ where: { slug: 'om-namah-shivaya' } });
  const hare = await prisma.mantra.findUnique({ where: { slug: 'hare-krishna-mahamantra' } });
  if (!shiva?.isPublished || !hare?.isPublished) {
    console.error('\nThe seeded mantras are missing. Run `npm run seed` first.\n');
    process.exit(1);
  }

  const signupBefore = await prisma.appSetting.findUnique({ where: { key: SETTING_KEYS.SIGNUP_ENABLED } });
  const setSignup = async (value) => {
    if (signupBefore) await prisma.appSetting.update({ where: { key: SETTING_KEYS.SIGNUP_ENABLED }, data: { value } });
    else await prisma.appSetting.upsert({ where: { key: SETTING_KEYS.SIGNUP_ENABLED }, update: { value }, create: { key: SETTING_KEYS.SIGNUP_ENABLED, value, description: 'legacy e2e' } });
    await redis.del(CACHE.setting(SETTING_KEYS.SIGNUP_ENABLED));
  };

  await sweep();

  try {
    const ASHA = FIRST_ID + 1;
    const ashaEmail = `Legacy-E2E-Asha-${RUN}@Example.com`; // the old server keeps whatever case it was typed in
    answers.set('tok-asha', known(ASHA, [
      { id: 3, title: 'Om Namah Shivay', subtitle: 'Shiv mantra', mantra: 'ॐ नमः शिवाय', count: 12000 },
      { id: 1, title: 'Hare Krishna', subtitle: null, mantra: 'हरे कृष्ण हरे कृष्ण कृष्ण कृष्ण हरे हरे', count: 700 },
      { id: 9, title: 'Some chant nobody here has', subtitle: null, mantra: 'qzx qzx', count: 30 },
    ], { name: '  Asha   Kulkarni ', email: ashaEmail, image: 'https://example.com/asha.jpg' }));

    // ── 1–2 ────────────────────────────────────────────────────────────────
    section('1. A first sign-in with the old token');
    let r = await legacy('tok-asha', { appLanguage: 'hi', timezone: 'Asia/Kolkata' });
    check('answers 201 for an account it just made', r.status === 201 && r.json?.success === true, `${r.status}`);
    const asha = r.json?.data;
    check('sends the same shape /auth/social does: user and tokens', Boolean(asha?.user?.id && asha?.tokens?.accessToken && asha?.tokens?.refreshToken && asha?.tokens?.refreshExpiresAt));
    check('the user says LEGACY, keeps the tidied name and the old picture', asha?.user?.authProvider === 'LEGACY' && asha?.user?.name === 'Asha Kulkarni' && asha?.user?.avatarUrl === 'https://example.com/asha.jpg');
    check('the email is shown in lower case', asha?.user?.email === ashaEmail.toLowerCase(), asha?.user?.email);
    check('the language and timezone the app sent are used', asha?.user?.appLanguage === 'hi' && asha?.user?.readingLanguage === 'hi' && asha?.user?.timezone === 'Asia/Kolkata');

    const sent = hitsFor('tok-asha');
    check('the old server was asked exactly once', sent.length === 1, `${sent.length}`);
    check('…with the shared key in X-Migration-Key', sent[0]?.key === KEY);
    check('…the token in a JSON body and nothing else in it', sent[0]?.raw === JSON.stringify({ token: 'tok-asha' }) && /json/.test(sent[0]?.contentType || ''));
    check('…at the configured route', sent[0]?.method === 'POST' && sent[0]?.url === '/api/migration/hariharibol');
    check('neither the key nor the old token is in what the app is sent', !JSON.stringify(r.json).includes(KEY) && !JSON.stringify(r.json).includes('tok-asha'));

    let row = await rowOf(ASHA);
    check('the account is in the database under the old user id', Boolean(row) && row.authProvider === 'LEGACY' && row.providerUserId === `legacy:${ASHA}`);
    check('…with the plain user role, not banned, and its email lower-cased', row?.role.slug === 'user' && row?.isBanned === false && row?.email === ashaEmail.toLowerCase());
    check('…and a sadhana profile that remembers the mantra chanted most there', row?.sadhanaProfile?.legacyFavoriteMantraId === shiva.id, `${row?.sadhanaProfile?.legacyFavoriteMantraId}`);
    check('the old token is not stored anywhere on the account', !JSON.stringify(row).includes('tok-asha'));

    r = await call('GET', '/app/me', { token: asha.tokens.accessToken });
    check('the access token works', r.status === 200 && r.json?.data?.id === asha.user.id, `${r.status}`);
    check('/me shows the same email and name', r.json?.data?.email === ashaEmail.toLowerCase() && r.json?.data?.name === 'Asha Kulkarni');
    r = await call('POST', '/app/auth/refresh', { body: { refreshToken: asha.tokens.refreshToken } });
    check('the refresh token works and rotates', r.status === 200 && r.json?.data?.tokens?.refreshToken && r.json.data.tokens.refreshToken !== asha.tokens.refreshToken, `${r.status}`);
    const ashaTokens = r.json?.data?.tokens;
    check('the device the app named is linked to the account', (await prisma.device.findUnique({ where: { deviceId: 'legacy-e2e-device' } }))?.userId === asha.user.id);

    // ── 3 ──────────────────────────────────────────────────────────────────
    section('3. The same person again');
    r = await legacy('tok-asha');
    check('answers 200, not 201', r.status === 200, `${r.status}`);
    check('…the same account', r.json?.data?.user?.id === asha.user.id);
    check('…with a session of its own', r.json?.data?.tokens?.accessToken && r.json.data.tokens.accessToken !== asha.tokens.accessToken && r.json.data.tokens.refreshToken !== asha.tokens.refreshToken);
    check('…and the old server was asked again (nothing about the token is remembered here)', hitsFor('tok-asha').length === 2);
    answers.set('tok-asha-phone-2', known(ASHA, [], { name: 'Asha K.' }));
    r = await legacy('tok-asha-phone-2');
    check('another token of the same old person is the same account', r.status === 200 && r.json?.data?.user?.id === asha.user.id);
    check('…whose name is not rewritten by the old server\'s', r.json?.data?.user?.name === 'Asha Kulkarni');
    check('still one account for that old user id', (await prisma.user.count({ where: { legacyUserId: ASHA } })) === 1);
    check('the earlier session is still good (the new phone does not sign the other out)', (await call('GET', '/app/me', { token: asha.tokens.accessToken })).status === 200);

    // ── 4 ──────────────────────────────────────────────────────────────────
    section('4. Everything that goes wrong');
    const before = await people();
    const dead = FIRST_ID + 2;
    answers.set('tok-bad', { status: 401, body: { code: 'invalid_token' } });
    answers.set('tok-deleted', { status: 401, body: { code: 'account_deleted' } });
    answers.set('tok-500', { status: 500, body: { message: 'Server Error' } });
    answers.set('tok-html', { status: 502, raw: '<html>Bad gateway</html>', body: null });
    answers.set('tok-empty', { status: 200, body: {} });
    answers.set('tok-noid', { status: 200, body: { user: { name: 'No Id' }, mantras: [] } });
    answers.set('tok-slow', { ...known(dead), delayMs: 3000 });

    r = await legacy('tok-bad');
    check('a token the old server rejects → 403 UNAUTHENTICATED', r.status === 403 && code(r) === 'UNAUTHENTICATED', `${r.status} ${code(r)}`);
    r = await legacy('tok-deleted');
    check('an account the old server says was deleted → 403 UNAUTHENTICATED', r.status === 403 && code(r) === 'UNAUTHENTICATED', `${r.status} ${code(r)}`);

    r = await legacy('x'.repeat(9));
    check('a token too short to be one → 400 and the old server is not asked', r.status === 400 && hitsFor('x'.repeat(9)).length === 0, `${r.status}`);
    r = await legacy('x'.repeat(301));
    check('a token too long to be one → 400 and the old server is not asked', r.status === 400 && hitsFor('x'.repeat(301)).length === 0, `${r.status}`);
    r = await call('POST', '/app/auth/legacy', { body: {} });
    check('no token at all → 400', r.status === 400, `${r.status}`);

    for (const [label, token] of [['answers 500', 'tok-500'], ['answers with a page that is not JSON', 'tok-html'], ['answers 200 with no user', 'tok-empty'], ['answers a user with no id', 'tok-noid']]) {
      r = await legacy(token);
      check(`the old server ${label} → 503 LEGACY_UNAVAILABLE`, r.status === 503 && code(r) === 'LEGACY_UNAVAILABLE', `${r.status} ${code(r)}`);
    }

    mode.rejectKey = true;
    r = await legacy('tok-asha');
    check('the old server rejecting OUR key → 503, not 403 (that is not the token\'s fault)', r.status === 503 && code(r) === 'LEGACY_UNAVAILABLE', `${r.status} ${code(r)}`);
    mode.rejectKey = false;

    mode.notConfigured = true;
    r = await legacy('tok-asha');
    check('the old server\'s route not switched on yet (404) → 503', r.status === 503 && code(r) === 'LEGACY_UNAVAILABLE', `${r.status} ${code(r)}`);
    mode.notConfigured = false;

    const started = Date.now();
    r = await legacy('tok-slow');
    check('a slow old server → 503 once the timeout passes', r.status === 503 && code(r) === 'LEGACY_UNAVAILABLE' && Date.now() - started < 2500, `${r.status} after ${Date.now() - started} ms`);

    check('none of that made an account', (await people()) === before, `${before} → ${await people()}`);
    check('the 503 does not say why', !/timed out|status 500|invalid_key|not_configured|502|key/i.test(r.json?.error?.message || ''), r.json?.error?.message);
    r = await call('POST', '/app/auth/legacy', { body: { legacyToken: 'tok-500', deviceId: 'legacy-e2e-device' }, headers: { 'accept-language': 'hi' } });
    check('…and it is worded in the reader\'s language', r.status === 503 && /[ऀ-ॿ]/.test(r.json?.error?.message || ''), r.json?.error?.message);

    // ── 5 ──────────────────────────────────────────────────────────────────
    section('5. People with no usable email');
    const NOMAIL = FIRST_ID + 3;
    const FAKEMAIL = FIRST_ID + 4;
    const NOTMAIL = FIRST_ID + 5;
    answers.set('tok-nomail', known(NOMAIL, [], { email: null, name: 'Mobile Only' }));
    answers.set('tok-fakemail', known(FAKEMAIL, [], { email: 'someone@2024-05-01-12:30:00', name: 'Made Up' }));
    answers.set('tok-notmail', known(NOTMAIL, [], { email: 'not an email', name: '\u0007Ctrl  Name\n' }));
    for (const [token, id] of [['tok-nomail', NOMAIL], ['tok-fakemail', FAKEMAIL], ['tok-notmail', NOTMAIL]]) {
      r = await legacy(token);
      row = await rowOf(id);
      check(`${token}: 201 and an account`, r.status === 201 && Boolean(row), `${r.status}`);
      check(`${token}: a stand-in address nobody can have is stored`, row?.email === `legacy-${id}@legacy.invalid`, row?.email);
      check(`${token}: the app is sent no email at all`, r.json?.data?.user?.email === null);
      const me = await call('GET', '/app/me', { token: r.json?.data?.tokens?.accessToken });
      check(`${token}: /me shows none either`, me.status === 200 && me.json?.data?.email === null);
      const patched = await call('PATCH', '/app/me', { token: r.json?.data?.tokens?.accessToken, body: { name: 'New Name' } });
      check(`${token}: nor does saving their profile`, patched.status === 200 && patched.json?.data?.email === null && patched.json?.data?.name === 'New Name');
    }
    check('a name with control characters comes out as one clean line', (await rowOf(NOTMAIL)) && (await prisma.user.findFirst({ where: { legacyUserId: NOTMAIL } })).name === 'New Name');
    r = await legacy('tok-nomail');
    check('coming back is the same account', r.status === 200 && r.json?.data?.user?.id === (await rowOf(NOMAIL)).id);

    const TWIN = FIRST_ID + 6;
    answers.set('tok-twin', known(TWIN, [], { email: ashaEmail, name: 'Twin' }));
    r = await legacy('tok-twin');
    row = await rowOf(TWIN);
    check('a second old account with the same email gets a stand-in address, not the first one\'s', r.status === 201 && row?.email === `legacy-${TWIN}@legacy.invalid`, `${r.status} ${row?.email}`);

    // ── 6 ──────────────────────────────────────────────────────────────────
    section('6. Accounts that must not be taken, and requests that arrive together');
    const TAKEN = FIRST_ID + 7;
    const takenEmail = `legacy-e2e-taken-${RUN}@example.com`;
    await realUser('taken', takenEmail);
    answers.set('tok-taken', known(TAKEN, [], { email: takenEmail.toUpperCase().replace('@EXAMPLE.COM', '@example.com') }));
    r = await legacy('tok-taken');
    check('an account here already has that email (Google) → 409 CONFLICT', r.status === 409 && code(r) === 'CONFLICT', `${r.status} ${code(r)}`);
    check('…and no account was made for the old user', !(await rowOf(TAKEN)));
    check('…the message names the way to sign in', /google/i.test(r.json?.error?.message || ''), r.json?.error?.message);
    check('…and the real account is untouched', (await prisma.user.findUnique({ where: { email: takenEmail } }))?.authProvider === 'GOOGLE');

    const BANNED = FIRST_ID + 8;
    answers.set('tok-banned', known(BANNED, []));
    r = await legacy('tok-banned');
    await prisma.user.update({ where: { legacyUserId: BANNED }, data: { isBanned: true } });
    r = await legacy('tok-banned');
    check('a banned account is refused with 409', r.status === 409 && code(r) === 'CONFLICT', `${r.status} ${code(r)}`);

    const RACE = FIRST_ID + 9;
    answers.set('tok-race', { ...known(RACE, [{ id: 3, title: 'Om Namah Shivay', subtitle: null, mantra: 'ॐ नमः शिवाय', count: 10 }]), delayMs: 150 });
    const results = await Promise.all([1, 2, 3, 4].map(() => legacy('tok-race')));
    const statuses = results.map((x) => x.status).sort();
    check('four requests at once make exactly one account', (await prisma.user.count({ where: { legacyUserId: RACE } })) === 1, statuses.join(','));
    check('…every one is answered with a session for it', results.every((x) => (x.status === 200 || x.status === 201) && x.json?.data?.user?.id === results[0].json?.data?.user?.id), statuses.join(','));
    check('…and at most one says "new"', results.filter((x) => x.status === 201).length <= 1, statuses.join(','));

    const CLOSED = FIRST_ID + 10;
    answers.set('tok-closed', known(CLOSED, []));
    await setSignup('false');
    r = await legacy('tok-closed');
    check('with sign-ups closed a NEW old person gets 503 (the app keeps the token and asks again)', r.status === 503 && code(r) === 'LEGACY_UNAVAILABLE' && !(await rowOf(CLOSED)), `${r.status} ${code(r)}`);
    r = await legacy('tok-asha');
    check('…but someone already carried over still gets in', r.status === 200, `${r.status}`);
    await setSignup(signupBefore?.value ?? 'true');
    r = await legacy('tok-closed');
    check('…and when sign-ups open again the same person is carried over', r.status === 201 && Boolean(await rowOf(CLOSED)), `${r.status}`);

    // ── 7 ──────────────────────────────────────────────────────────────────
    section('7. Google signing in with a carried-over email');
    const cap = await legacy('tok-asha');
    const cappedRefresh = cap.json?.data?.tokens?.refreshToken;
    const cappedAccess = cap.json?.data?.tokens?.accessToken;
    check('(before: the old-token session works)', (await call('GET', '/app/me', { token: cappedAccess })).status === 200);

    r = await google({ sub: `g-asha-${RUN}`, email: ashaEmail.toUpperCase().replace('@EXAMPLE.COM', '@example.com'), name: 'Asha G' });
    check('Google with the same address (different case) signs in to the same account — 200, not 201', r.status === 200 && r.json?.data?.user?.id === asha.user.id, `${r.status} ${code(r)}`);
    check('…which now says GOOGLE', r.json?.data?.user?.authProvider === 'GOOGLE');
    row = await rowOf(ASHA);
    check('…the old user id and the sadhana profile are kept', row?.legacyUserId === ASHA && row?.sadhanaProfile?.legacyFavoriteMantraId === shiva.id);
    check('…and the provider id is now Google\'s', row?.providerUserId === `g-asha-${RUN}`);
    const googleTokens = r.json?.data?.tokens;
    check('…the new session works', (await call('GET', '/app/me', { token: googleTokens?.accessToken })).status === 200);
    r = await call('POST', '/app/auth/refresh', { body: { refreshToken: cappedRefresh } });
    check('a refresh token from before is refused (403 UNAUTHENTICATED)', r.status === 403 && code(r) === 'UNAUTHENTICATED', `${r.status} ${code(r)}`);
    r = await call('POST', '/app/auth/refresh', { body: { refreshToken: ashaTokens.refreshToken } });
    check('…every one of them, whichever phone it is on', r.status === 403 && code(r) === 'UNAUTHENTICATED', `${r.status} ${code(r)}`);
    check('…and the Google session is not caught up in that', (await call('POST', '/app/auth/refresh', { body: { refreshToken: googleTokens?.refreshToken } })).status === 200);

    r = await legacy('tok-asha');
    check('the old token no longer gets in: 409', r.status === 409 && code(r) === 'CONFLICT', `${r.status} ${code(r)}`);
    check('…and says to sign in with Google', /google/i.test(r.json?.error?.message || ''), r.json?.error?.message);
    check('…and made no second account', (await prisma.user.count({ where: { legacyUserId: ASHA } })) === 1);

    // A claimed account is never silently made again, but a stranger's Google account must not reach a LEGACY one
    // by a different route: an account that is not LEGACY is found by its provider id alone.
    r = await google({ sub: `g-other-${RUN}`, email: `legacy-e2e-other-${RUN}@example.com`, name: 'Other' });
    check('a Google sign-in with an unrelated address is unaffected (new account, 201)', r.status === 201 && r.json?.data?.user?.authProvider === 'GOOGLE', `${r.status} ${code(r)}`);

    // A banned carried-over account cannot be claimed either.
    r = await google({ sub: `g-banned-${RUN}`, email: (await prisma.user.findUnique({ where: { legacyUserId: BANNED } })).email, name: 'Banned' });
    check('a banned carried-over account is not given to Google either: 409', r.status === 409 && code(r) === 'CONFLICT', `${r.status} ${code(r)}`);

    // Sign-ups closed does not stop someone who already has an account here.
    const CLAIMME = FIRST_ID + 11;
    const claimEmail = `legacy-e2e-claimme-${RUN}@example.com`;
    answers.set('tok-claimme', known(CLAIMME, [], { email: claimEmail }));
    await legacy('tok-claimme');
    await setSignup('false');
    r = await google({ sub: `g-claimme-${RUN}`, email: claimEmail, name: 'Claim Me' });
    check('with sign-ups closed, claiming a carried-over account still works', r.status === 200 && r.json?.data?.user?.authProvider === 'GOOGLE', `${r.status} ${code(r)}`);
    await setSignup(signupBefore?.value ?? 'true');

    // An account with a stand-in address has nothing for Google to match: it keeps the old way in.
    r = await legacy('tok-nomail');
    check('an account with a stand-in address still signs in with the old token', r.status === 200, `${r.status}`);

    // ── 8 ──────────────────────────────────────────────────────────────────
    section('8. The favourite mantra');
    const ravi = FIRST_ID + 12;
    answers.set('tok-ravi', known(ravi, [
      { id: 7, title: 'Hare Krishna Mahamantra', subtitle: null, mantra: 'Hare Krishna Hare Krishna Krishna Krishna Hare Hare Hare Rama Hare Rama Rama Rama Hare Hare', count: 5400 },
      { id: 3, title: 'Om Namah Shivay', subtitle: null, mantra: 'ॐ नमः शिवाय', count: 200 },
    ]));
    r = await legacy('tok-ravi');
    const raviTokens = r.json?.data?.tokens;
    row = await rowOf(ravi);
    check('the most chanted old mantra is matched to ours by what it says', row?.sadhanaProfile?.legacyFavoriteMantraId === hare.id, `${row?.sadhanaProfile?.legacyFavoriteMantraId}`);

    const lena = FIRST_ID + 13;
    answers.set('tok-lena', known(lena, [{ id: 9, title: 'Some chant nobody here has', subtitle: null, mantra: 'qzx qzx', count: 99 }]));
    r = await legacy('tok-lena');
    row = await rowOf(lena);
    check('a mantra that is not ours is simply left unmatched', r.status === 201 && row?.sadhanaProfile?.legacyFavoriteMantraId === null);
    let today = await call('GET', '/app/sadhana/today', { token: r.json?.data?.tokens?.accessToken });
    check('…and "Chant now" has no favourite for them', today.status === 200 && today.json?.data?.favoriteMantra === null, `${today.status}`);

    const noMantras = FIRST_ID + 14;
    answers.set('tok-nomantras', known(noMantras, []));
    r = await legacy('tok-nomantras');
    check('someone who never chanted there has none either, and is carried over all the same', r.status === 201 && (await rowOf(noMantras)).sadhanaProfile.legacyFavoriteMantraId === null);

    today = await call('GET', '/app/sadhana/today', { token: raviTokens.accessToken });
    check('"Chant now" opens the mantra they chanted most there', today.status === 200 && today.json?.data?.favoriteMantra?.slug === 'hare-krishna-mahamantra', `${today.json?.data?.favoriteMantra?.slug}`);
    check('…and it is shown as a mantra, with its name', Boolean(today.json?.data?.favoriteMantra?.name));
    check('…while the preferred mantra they chose themselves (none) is untouched', today.json?.data?.profile?.preferredMantra === null);

    const raviUser = await prisma.user.findUnique({ where: { legacyUserId: ravi } });
    await prisma.chantSession.create({
      data: { userId: raviUser.id, sadhanaDayId: today.json.data.day.id, mantraId: shiva.id, rounds: 3, beads: 0, startedAt: new Date() },
    });
    today = await call('GET', '/app/sadhana/today', { token: raviTokens.accessToken });
    check('once they chant a mantra here, that one takes over', today.json?.data?.favoriteMantra?.slug === 'om-namah-shivaya', `${today.json?.data?.favoriteMantra?.slug}`);

    await prisma.mantra.update({ where: { id: hare.id }, data: { isPublished: false } });
    await prisma.chantSession.deleteMany({ where: { userId: raviUser.id } });
    today = await call('GET', '/app/sadhana/today', { token: raviTokens.accessToken });
    check('an old favourite that is not published is not offered', today.status === 200 && today.json?.data?.favoriteMantra === null, `${today.json?.data?.favoriteMantra?.slug}`);
    await prisma.mantra.update({ where: { id: hare.id }, data: { isPublished: true } });

    // ── 9 ──────────────────────────────────────────────────────────────────
    section('9. Attestation, the feature switched off, deleting the account');
    const callsBefore = hits.length;
    env.APP_CHECK_ENABLED = true;
    r = await legacy('tok-asha');
    env.APP_CHECK_ENABLED = false;
    check('an unattested client gets 403 FORBIDDEN — the app must NOT read that as a bad token', r.status === 403 && code(r) === 'FORBIDDEN', `${r.status} ${code(r)}`);
    check('…and the old server was not asked', hits.length === callsBefore);

    env.legacyMigrationEnabled = false;
    r = await legacy('tok-ravi');
    env.legacyMigrationEnabled = true;
    check('with the URL or key not set here → 503, without calling anyone', r.status === 503 && code(r) === 'LEGACY_UNAVAILABLE' && hits.length === callsBefore, `${r.status} ${code(r)}`);

    r = await call('POST', '/app/auth/legacy', { body: { legacyToken: 'tok-ravi' }, headers: { authorization: 'Bearer not-a-token' } });
    check('a bad bearer on this public route is refused like on every other (the app sends none)', r.status === 403 && code(r) === 'UNAUTHENTICATED', `${r.status} ${code(r)}`);

    r = await call('DELETE', '/app/auth/account', { token: raviTokens.accessToken });
    check('a carried-over person can delete their account', r.status === 200 && !(await rowOf(ravi)), `${r.status}`);
    r = await legacy('tok-ravi');
    check('…the old server still knows them, so the same token would make a fresh account', r.status === 201, `${r.status}`);
  } finally {
    OAuth2Client.prototype.verifyIdToken = realVerifyIdToken;
    env.APP_CHECK_ENABLED = false;
    await prisma.mantra.updateMany({ where: { slug: { in: ['om-namah-shivaya', 'hare-krishna-mahamantra'] } }, data: { isPublished: true } }).catch(() => null);
    await setSignup(signupBefore?.value ?? 'true').catch(() => null);
    if (!signupBefore) await prisma.appSetting.deleteMany({ where: { key: SETTING_KEYS.SIGNUP_ENABLED } }).catch(() => null);
    await sweep().catch((error) => console.error('could not remove the test users', error));
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  server.close();
  oldServer.closeAllConnections?.();
  oldServer.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  OAuth2Client.prototype.verifyIdToken = realVerifyIdToken;
  await sweep().catch(() => null);
  process.exit(1);
});
