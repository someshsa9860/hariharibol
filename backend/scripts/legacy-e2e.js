// Walks the carry-over from the old server over real HTTP against a running API, with a stand-in for the Laravel
// API started here. Run the API with the same two settings the script uses, then:
//
//   LEGACY_API_URL=http://127.0.0.1:4199 LEGACY_MIGRATION_KEY=test-migration-key-0123456789 npm run dev
//   LEGACY_MIGRATION_KEY=test-migration-key-0123456789 npm run test:legacy
//
// What it checks: the key is presented and the token is judged by the old server, a new account is made with a
// session of this server's own, calling again finds the same account, an existing account is linked by its email
// or its provider id rather than duplicated, the most chanted mantra becomes the favourite and then gives way to
// real chanting here, and every way the old server can fail.

import http from 'node:http';

import { prisma } from '../config/database.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const KEY = process.env.LEGACY_MIGRATION_KEY || 'test-migration-key-0123456789';
const PORT = 4199;
const HEAD = { 'content-type': 'application/json', 'x-device-id': 'e2e-legacy', 'x-platform': 'android' };

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}

// ── the old server ─────────────────────────────────────────────────────────
const accounts = {
  'legacy-token-shiva': {
    id: 9001,
    email: 'legacy.shiva@e2e.test',
    name: 'Shiva Bhakta',
    provider: 'google',
    providerUserId: 'google-sub-e2e-9001',
    mantras: [
      { name: 'Hare Krishna', count: 1200 },
      { name: 'om namah shivay', count: 5400 },
      { name: 'A mantra only the old app had', count: 99999 },
    ],
  },
  'legacy-token-noemail': { id: 9002, name: 'No Email', mantras: [] },
  'legacy-token-existing': { id: 9003, email: 'legacy.existing@e2e.test', name: 'Already Here', mantras: [{ name: 'Gayatri', count: 1 }] },
  'legacy-token-byprovider': { id: 9004, email: 'other.address@e2e.test', providerUserId: 'google-sub-e2e-9004', mantras: [] },
  'legacy-token-banned': { id: 9005, email: 'legacy.banned@e2e.test', mantras: [] },
};
const seen = [];
let mode = 'normal';

const old = http.createServer((req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  seen.push({ url: req.url, method: req.method, key: req.headers['x-migration-key'], token });
  const send = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  if (mode === 'down') return req.destroy();
  if (mode === 'error') return send(500, { message: 'boom' });
  if (mode === 'garbage') return send(200, 'not json at all <html>');
  if (req.url !== '/api/migration/account' || req.method !== 'POST') return send(404, {});
  if (req.headers['x-migration-key'] !== KEY) return send(403, { message: 'bad key' });
  const account = accounts[token];
  if (!account) return send(401, { message: 'Unauthenticated.' });
  return send(200, { success: true, data: account });
});

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
    // no body
  }
  return { status: res.status, json };
}

const legacy = (legacyToken) => call('POST', '/api/app/auth/legacy', { body: { legacyToken, timezone: 'Asia/Kolkata' } });

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it first (see the top of this file).\n`);
    process.exit(1);
  }
  await new Promise((resolve) => old.listen(PORT, '127.0.0.1', resolve));

  const emails = Object.values(accounts).map((a) => a.email).filter(Boolean);
  const wipe = async () => {
    await prisma.user.deleteMany({
      where: { OR: [{ email: { in: emails } }, { email: { startsWith: 'legacy-90' } }, { legacyUserId: { in: ['9001', '9002', '9003', '9004', '9005'] } }] },
    });
  };
  await wipe();

  try {
    console.log('\n1. A new account is made from the old one');
    const first = await legacy('legacy-token-shiva');
    check('201', first.status === 201, String(first.status));
    check('a session of this server comes back', !!first.json?.data?.tokens?.accessToken && !!first.json?.data?.tokens?.refreshToken);
    check('the old token is not handed back as ours', first.json?.data?.tokens?.accessToken !== 'legacy-token-shiva');
    check('email and name carried over', first.json?.data?.user?.email === 'legacy.shiva@e2e.test' && first.json?.data?.user?.name === 'Shiva Bhakta');
    const call1 = seen.at(-1);
    check('the old server was shown the migration key', call1.key === KEY);
    check('and the token, as a bearer', call1.token === 'legacy-token-shiva');

    const row = await prisma.user.findUnique({ where: { email: 'legacy.shiva@e2e.test' } });
    check('linked to the old id', row?.legacyUserId === '9001');
    check("the provider's own id kept, so a later Google sign-in is the same account", row?.providerUserId === 'google-sub-e2e-9001');

    const mine = await call('GET', '/api/app/me', { token: first.json.data.tokens.accessToken });
    check('the new access token works', mine.status === 200, String(mine.status));

    console.log('\n2. The favourite mantra comes with them');
    const today = await call('GET', '/api/app/sadhana/today', { token: first.json.data.tokens.accessToken });
    check('Om Namah Shivaya is the favourite (most chanted that the catalogue has)', today.json?.data?.favoriteMantra?.slug === 'om-namah-shivaya', today.json?.data?.favoriteMantra?.slug);

    console.log('\n3. Calling again finds the same account');
    const again = await legacy('legacy-token-shiva');
    check('200 and the same user', again.status === 200 && again.json?.data?.user?.id === first.json.data.user.id, String(again.status));
    check('still one row', (await prisma.user.count({ where: { legacyUserId: '9001' } })) === 1);

    console.log('\n4. What they chant here takes over, but a taste of something else does not');
    const token = again.json.data.tokens.accessToken;
    const gita = await prisma.mantra.findUnique({ where: { slug: 'hare-krishna-mahamantra' } });
    await call('POST', '/api/app/sadhana/chant/manual', { token, body: { rounds: 2, mantraId: gita.id } });
    const taste = await call('GET', '/api/app/sadhana/today', { token });
    check('two rounds of another mantra leave the favourite alone', taste.json?.data?.favoriteMantra?.slug === 'om-namah-shivaya', taste.json?.data?.favoriteMantra?.slug);
    await call('POST', '/api/app/sadhana/chant/manual', { token, body: { rounds: 16, mantraId: gita.id } });
    const habit = await call('GET', '/api/app/sadhana/today', { token });
    check('a habit here becomes the favourite', habit.json?.data?.favoriteMantra?.slug === 'hare-krishna-mahamantra', habit.json?.data?.favoriteMantra?.slug);

    console.log('\n5. Account with no email');
    const none = await legacy('legacy-token-noemail');
    check('still created', none.status === 201, String(none.status));
    const noneRow = await prisma.user.findUnique({ where: { legacyUserId: '9002' } });
    check('with an address that cannot collide', noneRow?.email === 'legacy-9002@legacy.hariharibol.invalid');
    check('and a placeholder provider id', noneRow?.providerUserId === 'legacy:9002');

    console.log('\n6. Someone already here is linked, not duplicated');
    const role = await prisma.role.findUnique({ where: { slug: 'user' } });
    const existing = await prisma.user.create({
      data: { email: 'legacy.existing@e2e.test', name: null, authProvider: 'GOOGLE', providerUserId: 'google-sub-e2e-9003', roleId: role.id },
    });
    const linked = await legacy('legacy-token-existing');
    check('by email', linked.status === 200 && linked.json?.data?.user?.id === existing.id, String(linked.status));
    check('the old id is now on it', (await prisma.user.findUnique({ where: { id: existing.id } })).legacyUserId === '9003');

    const byProvider = await prisma.user.create({
      data: { email: 'someone.else@e2e.test', authProvider: 'GOOGLE', providerUserId: 'google-sub-e2e-9004', roleId: role.id },
    });
    const linked2 = await legacy('legacy-token-byprovider');
    check("by the provider's id even when the email differs", linked2.status === 200 && linked2.json?.data?.user?.id === byProvider.id, String(linked2.status));
    await prisma.user.delete({ where: { id: byProvider.id } });

    console.log('\n7. Refusals');
    const stranger = await legacy('legacy-token-unknown');
    check('a token the old server does not know is 403 UNAUTHENTICATED', stranger.status === 403 && stranger.json?.error?.code === 'UNAUTHENTICATED', `${stranger.status} ${stranger.json?.error?.code}`);
    const short = await legacy('x');
    check('a malformed body is 400', short.status === 400, String(short.status));

    await prisma.user.create({
      data: { email: 'legacy.banned@e2e.test', authProvider: 'GOOGLE', providerUserId: 'g-banned-9005', roleId: role.id, isBanned: true },
    });
    const banned = await legacy('legacy-token-banned');
    check('a banned account is 409', banned.status === 409, String(banned.status));

    console.log('\n8. The old server failing is never "signed out"');
    for (const m of ['down', 'error', 'garbage']) {
      mode = m;
      const r = await legacy('legacy-token-shiva');
      check(`${m} → 502 LEGACY_UNAVAILABLE`, r.status === 502 && r.json?.error?.code === 'LEGACY_UNAVAILABLE', `${r.status} ${r.json?.error?.code}`);
    }
    mode = 'normal';
  } finally {
    await wipe();
    old.close();
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
