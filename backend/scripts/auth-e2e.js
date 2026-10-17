// Walks the whole session lifecycle the mobile app depends on, over real HTTP
// against a running API. Run it after `npm run dev`:
//
//   npm run test:auth
//
// The provider sheet is the one part that cannot be automated — Google will not
// mint an ID token for a script — so the session is issued exactly the way
// controllers/app/auth.js issues it once a token has been verified. Everything
// after that point is the real endpoint, over the real transport.

import jwt from 'jsonwebtoken';

import env from '../config/env.js';
import { prisma } from '../config/database.js';
import * as authService from '../services/auth.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const HEAD = {
  'content-type': 'application/json',
  'x-device-id': 'e2e-device',
  'x-platform': 'ios',
};

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
    headers: { ...HEAD, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // 204 and friends have no body.
  }
  return { status: res.status, json };
}

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`);
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: 'user@smoke.test' },
    include: { role: true },
  });
  if (!user) {
    console.error('\nThe seed user is missing. Run `npm run seed` first.\n');
    process.exit(1);
  }

  console.log('\n1. The session /auth/social hands back once a provider token checks out');
  let session = await authService.issueSession(user, 'e2e-device');
  check('access token issued', typeof session.accessToken === 'string' && session.accessToken.length > 40);
  check('refresh token issued', typeof session.refreshToken === 'string' && session.refreshToken.length > 20);
  const days = (new Date(session.refreshExpiresAt) - Date.now()) / 86_400_000;
  check('refresh token lasts about a year', days > 360 && days < 370, `${Math.round(days)} days`);

  console.log('\n2. The dashboard call the app makes the moment it lands');
  const home = await call('GET', '/api/app/home', { token: session.accessToken });
  check('GET /api/app/home is 200', home.status === 200, `HTTP ${home.status}`);
  check('it returns a data envelope', home.json?.success === true && home.json?.data != null);
  if (home.json?.data) {
    console.log(`        sections: ${Object.keys(home.json.data).join(', ')}`);
  }

  console.log('\n3. That same call without a token');
  // /home is deliberately public: a signed-out visitor gets the shared sections
  // and none of the personal ones, rather than an error. /user/me is not.
  const anonymous = await call('GET', '/api/app/home');
  check('the public sections still load', anonymous.status === 200, `HTTP ${anonymous.status}`);
  const personal = ['sadhana', 'mySloka', 'continueReading', 'unreadNotifications', 'isPremium'];
  const leaked = personal.filter((key) => key in (anonymous.json?.data ?? {}));
  check('no personal section is exposed', leaked.length === 0, leaked.join(', ') || 'none');
  check('the signed-in response does carry them', personal.every((key) => key in home.json.data));

  const guarded = await call('GET', '/api/app/me');
  check('a guarded route without a token is 403', guarded.status === 403, `HTTP ${guarded.status}`);
  check('and says why: UNAUTHENTICATED', guarded.json?.error?.code === 'UNAUTHENTICATED', guarded.json?.error?.code);
  const garbled = await call('GET', '/api/app/me', { token: 'not.a.token' });
  check('a garbage token is 403 as well', garbled.status === 403, `HTTP ${garbled.status}`);
  const stale = jwt.sign({ sub: user.id, role: 'user', typ: 'access' }, env.JWT_SECRET, {
    expiresIn: -60,
    issuer: 'hariharibol',
  });
  const expired = await call('GET', '/api/app/me', { token: stale });
  check('an expired access token is 403 UNAUTHENTICATED', expired.status === 403 && expired.json?.error?.code === 'UNAUTHENTICATED', `HTTP ${expired.status}`);
  const guardedOk = await call('GET', '/api/app/me', { token: session.accessToken });
  check('and 200 with one', guardedOk.status === 200, `HTTP ${guardedOk.status}`);

  console.log('\n4. Silent rotation — what the Dio interceptor does on a 403 UNAUTHENTICATED');
  const spentRefresh = session.refreshToken;
  const rotated = await call('POST', '/api/app/auth/refresh', {
    body: { refreshToken: spentRefresh, deviceId: 'e2e-device' },
  });
  check('POST /auth/refresh is 200', rotated.status === 200, `HTTP ${rotated.status}`);
  const pair = rotated.json?.data?.tokens;
  check('a fresh pair came back', Boolean(pair?.accessToken && pair?.refreshToken));
  check('the refresh token actually changed', pair?.refreshToken !== spentRefresh);
  check('the user comes back with it', Boolean(rotated.json?.data?.user?.id));

  console.log('\n5. The rotated access token still opens the dashboard');
  const home2 = await call('GET', '/api/app/home', { token: pair?.accessToken });
  check('GET /api/app/home is 200', home2.status === 200, `HTTP ${home2.status}`);

  console.log('\n6. A spent refresh token presented again straight away (a lost response)');
  // The phone sent the refresh, the server rotated, the reply never arrived —
  // so the phone asks again with the only token it has. That must work.
  const retried = await call('POST', '/api/app/auth/refresh', {
    body: { refreshToken: spentRefresh, deviceId: 'e2e-device' },
  });
  check('inside the grace window it is answered, not refused', retried.status === 200, `HTTP ${retried.status}`);
  const retriedPair = retried.json?.data?.tokens;
  check('with a pair of its own', Boolean(retriedPair?.accessToken && retriedPair?.refreshToken));
  const stillOpen = await call('POST', '/api/app/auth/refresh', {
    body: { refreshToken: pair?.refreshToken, deviceId: 'e2e-device' },
  });
  check('and nothing was revoked: the first pair still rotates', stillOpen.status === 200, `HTTP ${stillOpen.status}`);
  pair.refreshToken = stillOpen.json?.data?.tokens?.refreshToken;

  console.log('\n7. Replaying a spent refresh token after the window is treated as theft');
  // Age the spent row past the window instead of sleeping through it.
  const graceMs = env.REFRESH_REUSE_GRACE_SECONDS * 1000;
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, rotatedAt: { not: null } },
    data: { rotatedAt: new Date(Date.now() - graceMs - 60_000) },
  });
  const replay = await call('POST', '/api/app/auth/refresh', {
    body: { refreshToken: spentRefresh, deviceId: 'e2e-device' },
  });
  check('the replay is refused with 403', replay.status === 403, `HTTP ${replay.status}`);
  check('and the code says unauthenticated', replay.json?.error?.code === 'UNAUTHENTICATED', replay.json?.error?.code);
  const afterReplay = await call('POST', '/api/app/auth/refresh', {
    body: { refreshToken: pair?.refreshToken, deviceId: 'e2e-device' },
  });
  check('and it revoked every other session too', afterReplay.status === 403, `HTTP ${afterReplay.status}`);

  console.log('\n8. A refresh that is not 403 leaves the session alone');
  const fresh = await authService.issueSession(user, 'e2e-device');
  const malformed = await call('POST', '/api/app/auth/refresh', { body: { refreshToken: 'short' } });
  check('a malformed request is 4xx but not 403', malformed.status >= 400 && malformed.status < 500 && malformed.status !== 403, `HTTP ${malformed.status}`);
  const stillGood = await call('POST', '/api/app/auth/refresh', {
    body: { refreshToken: fresh.refreshToken, deviceId: 'e2e-device' },
  });
  check('the token it was sent for still works', stillGood.status === 200, `HTTP ${stillGood.status}`);

  console.log('\n9. Signing out ends this device and no other');
  session = await authService.issueSession(user, 'e2e-device');
  const otherDevice = await authService.issueSession(user, 'e2e-device-2');
  const signedOut = await call('POST', '/api/app/auth/logout', {
    token: session.accessToken,
    body: { refreshToken: session.refreshToken },
  });
  check('POST /auth/logout is 200', signedOut.status === 200, `HTTP ${signedOut.status}`);
  const dead = await call('POST', '/api/app/auth/refresh', {
    body: { refreshToken: session.refreshToken },
  });
  check('the signed-out token is dead', dead.status === 403, `HTTP ${dead.status}`);
  const stillAlive = await call('POST', '/api/app/auth/refresh', {
    body: { refreshToken: otherDevice.refreshToken, deviceId: 'e2e-device-2' },
  });
  check('the other device is untouched', stillAlive.status === 200, `HTTP ${stillAlive.status}`);

  console.log('\n10. Sign-in without a verifiable provider token');
  const forgedGoogle = await call('POST', '/api/app/auth/social', {
    body: { provider: 'GOOGLE', idToken: 'x'.repeat(40) },
  });
  check('a forged Google token is refused', forgedGoogle.status === 403, `HTTP ${forgedGoogle.status}`);
  const forgedApple = await call('POST', '/api/app/auth/social', {
    body: { provider: 'APPLE', idToken: 'x'.repeat(40) },
  });
  check('a forged Apple token is refused', forgedApple.status === 403, `HTTP ${forgedApple.status}`);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
