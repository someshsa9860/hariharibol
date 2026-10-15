// Walks a mantra's opening prayer over real HTTP against a running API. Run it
// after `npm run dev`:
//
//   npm run test:mantra-prayer
//
// A mantra can name another mantra as the prayer chanted before it (the
// Panchatattva mantra before the mahamantra). The counter in the app shows the
// prayer first and again before every round, so the app is sent the prayer whole,
// with its own text and its own standard time. What is checked is the part that
// quietly goes wrong: that a mantra cannot be its own prayer or point at one that
// does not exist (a foreign key alone answers 500), that an unpublished prayer is
// never shown, that a prayer's own prayer is not followed, that the standard
// chanting time can be cleared again, and that deleting a prayer leaves the
// mantras that used it with none rather than failing.
//
// Publishing needs an uploaded recitation (`npm run test:mantra-mala` covers that), so
// here a mantra is switched to published straight in the database: what is under test
// is what a reader is sent once it is. Everything it creates is deleted again, and it
// uploads no files.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import * as authService from '../services/auth.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'mantra-prayer-e2e-device';

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  console.log(
    `  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`
  );
  if (ok) passed += 1;
  else failed += 1;
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-device-id': DEVICE,
      'x-platform': 'ios',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // 204 has no body.
  }
  return { status: res.status, json };
}

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`);
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({ where: { role: { slug: 'super_admin' } } });
  const reader = await prisma.user.findFirst({ where: { role: { slug: 'user' } } });
  if (!admin || !reader) {
    console.error('\nNeed a super_admin and a plain user. Run `npm run seed` first.\n');
    process.exit(1);
  }

  await authService.invalidateUser(admin.id);
  await redis.del(`rl:write:${admin.id}`, `rl:read:${admin.id}`);
  const { accessToken: token } = await authService.issueSession(admin, DEVICE);
  const { accessToken: readerToken } = await authService.issueSession(reader, DEVICE);
  const as = { token };

  const stamp = Date.now();
  const mainSlug = `prayer-e2e-main-${stamp}`;
  const prayerSlug = `prayer-e2e-prayer-${stamp}`;
  const ids = [];

  // Creates a mantra through the admin API.
  async function make(slug, extra = {}) {
    const made = await call('POST', '/api/admin/mantras', {
      ...as,
      body: { slug, name: slug, category: 'beej', sanskrit: 'ॐ', ...extra },
    });
    const id = made.json?.data?.id;
    if (id) ids.push(id);
    return { made, id };
  }
  const publish = (id, isPublished) => prisma.mantra.update({ where: { id }, data: { isPublished } });
  const seenByApp = async (slug) => (await call('GET', `/api/app/mantras/${slug}`, { token: readerToken })).json?.data;

  try {
    console.log(`\nAdmin ${admin.email}`);

    // ── 1 ────────────────────────────────────────────────────────────────────
    console.log('\n1. Setting a prayer');
    const prayer = await make(prayerSlug, { durationMs: 7000 });
    const main = await make(mainSlug, { durationMs: 4000 });
    check('both mantras are created', prayer.made.status === 201 && main.made.status === 201, `HTTP ${main.made.status}`);
    for (const { id } of [prayer, main]) {
      await call('PUT', `/api/admin/mantras/${id}/translations`, {
        ...as,
        body: { languageCode: 'sa', text: 'ॐ', isPublished: true },
      });
    }

    const own = await call('PATCH', `/api/admin/mantras/${main.id}`, { ...as, body: { prayerMantraId: main.id } });
    check('a mantra cannot be its own prayer', own.status === 400, `HTTP ${own.status}`);

    const nobody = await call('PATCH', `/api/admin/mantras/${main.id}`, { ...as, body: { prayerMantraId: 'nope' } });
    check('a prayer that does not exist is refused, not a 500', nobody.status === 400, `HTTP ${nobody.status}`);

    const onCreate = await call('POST', '/api/admin/mantras', {
      ...as,
      body: { slug: `${mainSlug}-x`, name: 'x', category: 'beej', sanskrit: 'ॐ', prayerMantraId: 'nope' },
    });
    check('and so is one named when creating', onCreate.status === 400, `HTTP ${onCreate.status}`);
    check('nothing was created by that', (await prisma.mantra.count({ where: { slug: `${mainSlug}-x` } })) === 0);

    const set = await call('PATCH', `/api/admin/mantras/${main.id}`, { ...as, body: { prayerMantraId: prayer.id } });
    check('a real mantra can be the prayer', set.status === 200, `HTTP ${set.status}`);

    const got = await call('GET', `/api/admin/mantras/${main.id}`, as);
    check(
      'the panel is sent its name to show',
      got.json?.data?.prayerMantraId === prayer.id && got.json?.data?.prayerMantra?.name === prayerSlug
    );

    // ── 2 ────────────────────────────────────────────────────────────────────
    console.log('\n2. What a reader receives');
    await publish(prayer.id, true);
    await publish(main.id, true);

    const seen = await seenByApp(mainSlug);
    check('the app is sent the prayer whole', seen?.prayer?.slug === prayerSlug && seen?.prayer?.text === 'ॐ');
    check('with its own standard time, not the mantra\'s', seen?.prayer?.durationMs === 7000 && seen?.durationMs === 4000);
    check('a prayer has no prayer of its own to follow', seen?.prayer && !seen.prayer.prayer);
    check('a mantra with none is sent null', (await seenByApp(prayerSlug))?.prayer === null);

    // A prayer can itself have a prayer on the row; it still stops at one level.
    await call('PATCH', `/api/admin/mantras/${prayer.id}`, { ...as, body: { prayerMantraId: main.id } });
    const loop = await seenByApp(mainSlug);
    check('a prayer pointing back is not followed', loop?.prayer?.slug === prayerSlug && !loop.prayer.prayer);
    await call('PATCH', `/api/admin/mantras/${prayer.id}`, { ...as, body: { prayerMantraId: null } });

    // ── 3 ────────────────────────────────────────────────────────────────────
    console.log('\n3. A prayer that is not ready');
    await publish(prayer.id, false);
    check('an unpublished prayer is not shown', (await seenByApp(mainSlug))?.prayer === null);
    await publish(prayer.id, true);
    check('and is again once published', (await seenByApp(mainSlug))?.prayer?.slug === prayerSlug);

    // ── 4 ────────────────────────────────────────────────────────────────────
    console.log('\n4. Taking it off, and the standard time');
    const off = await call('PATCH', `/api/admin/mantras/${main.id}`, { ...as, body: { prayerMantraId: null } });
    check('the prayer can be cleared', off.status === 200 && off.json?.data?.prayerMantraId === null, `HTTP ${off.status}`);
    check('the app is sent null again', (await seenByApp(mainSlug))?.prayer === null);

    const cleared = await call('PATCH', `/api/admin/mantras/${main.id}`, { ...as, body: { durationMs: null } });
    check('the standard time can be cleared', cleared.status === 200 && cleared.json?.data?.durationMs === null, `HTTP ${cleared.status}`);
    check('and reaches the app as nothing, which it reads as worked out from the text', (await seenByApp(mainSlug))?.durationMs == null);

    // ── 5 ────────────────────────────────────────────────────────────────────
    console.log('\n5. Deleting a prayer');
    await call('PATCH', `/api/admin/mantras/${main.id}`, { ...as, body: { prayerMantraId: prayer.id } });
    await publish(prayer.id, false);
    const removed = await call('DELETE', `/api/admin/mantras/${prayer.id}`, as);
    check('a prayer can be deleted while others use it', removed.status === 204, `HTTP ${removed.status}`);
    const after = await prisma.mantra.findUnique({ where: { id: main.id } });
    check('the mantra that used it is left with none', after?.prayerMantraId === null);
  } finally {
    await prisma.mantra.updateMany({ where: { id: { in: ids } }, data: { prayerMantraId: null } });
    await prisma.mantra.deleteMany({ where: { id: { in: ids } } });
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
