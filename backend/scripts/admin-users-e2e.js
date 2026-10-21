// Walks the admin panel's per-person detail, the daily-activity record, live presence and the activity analytics,
// against a running API and websocket container (npm run dev). Makes its own people and removes them again.
//
//   npm run test:admin-users

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import * as authService from '../services/auth.js';
import WebSocket from 'ws';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const WS = process.env.WS_URL || 'ws://localhost:4001/ws';
const TAG = `au${Date.now()}`;
let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1; else failed += 1;
};
const made = [];
async function call(path, token, platform = 'android') {
  const res = await fetch(BASE + path, { headers: { authorization: `Bearer ${token}`, 'x-platform': platform, 'x-device-id': `${TAG}-d` } });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
  const adminRole = await prisma.role.findFirst({ where: { slug: 'super_admin' } });
  const userRole = await prisma.role.findFirst({ where: { slug: 'user' } });
  const mk = async (label, roleId, extra = {}) => {
    const u = await prisma.user.create({ data: { email: `${TAG}-${label}@example.test`, name: `E2E ${label}`, authProvider: 'GOOGLE', providerUserId: `${TAG}-${label}`, roleId, ...extra } });
    made.push(u.id);
    return u;
  };
  const admin = await mk('admin', adminRole.id);
  const reader = await mk('reader', userRole.id, { createdAt: new Date(Date.now() - 5 * 86400000) });
  const adminToken = (await authService.issueSession(admin, `${TAG}-a`)).accessToken;
  const readerToken = (await authService.issueSession(reader, `${TAG}-r`)).accessToken;

  // Give the reader a practice.
  const mantra = await prisma.mantra.findFirst({ where: { isPublished: true } });
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today - 86400000);
  const dayRow = async (date, rounds) => prisma.sadhanaDay.create({ data: { userId: reader.id, date, roundTarget: 16, roundsCompleted: rounds } });
  const d1 = await dayRow(today, 16);
  const d0 = await dayRow(yesterday, 8);
  await prisma.chantSession.create({ data: { userId: reader.id, sadhanaDayId: d1.id, mantraId: mantra?.id, rounds: 16, durationSeconds: 3000 } });
  await prisma.chantSession.create({ data: { userId: reader.id, sadhanaDayId: d0.id, mantraId: mantra?.id, rounds: 8, durationSeconds: 1500 } });
  await prisma.auditLog.create({ data: { actorId: admin.id, action: 'user.ban', entityType: 'User', entityId: reader.id, before: { isBanned: false }, after: { isBanned: true } } });

  // ── Presence and the daily record, written by an ordinary signed-in request ──
  console.log('\nPresence');
  let events = [];
  const socket = new WebSocket(`${WS}?token=${adminToken}`);
  socket.on('message', (raw) => { try { events.push(JSON.parse(raw)); } catch { /* ignore */ } });
  await new Promise((r) => socket.once('open', r));
  await call('/api/app/me', readerToken, 'ios');
  await new Promise((r) => setTimeout(r, 400));
  const row = await prisma.userActiveDay.findFirst({ where: { userId: reader.id } });
  check('a signed-in request records the day', !!row);
  check('with the platform it came from', row?.platform === 'ios');
  const rows = await prisma.userActiveDay.count({ where: { userId: reader.id } });
  await call('/api/app/me', readerToken, 'ios');
  check('a second request the same day adds nothing', (await prisma.userActiveDay.count({ where: { userId: reader.id } })) === rows);

  const live = await call('/api/admin/system/live', adminToken);
  check('live shows the reader online', live.status === 200 && live.json.data.people.some((p) => p.id === reader.id) && live.json.data.online >= 1);
  check('live carries names, not tokens or secrets', !/token|password/i.test(JSON.stringify(live.json)));
  check('only people with system.read see it', (await call('/api/admin/system/live', readerToken)).status === 403);

  const push = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 9000);
    const check1 = () => {
      const e = events.find((x) => x.event === 'presence.update');
      if (e) { clearTimeout(t); resolve(e); } else setTimeout(check1, 250);
    };
    check1();
  });
  check('the websocket pushes presence.update to an admin', !!push, push ? '' : 'none within 9 s');
  check('with who just arrived', !!push?.payload.joined.some((p) => p.id === reader.id) || push?.payload.online >= 1);
  socket.close();

  // ── Analytics ──
  console.log('\nActivity analytics');
  await prisma.userActiveDay.createMany({ data: [{ userId: reader.id, date: yesterday }, { userId: admin.id, date: yesterday }], skipDuplicates: true });
  const act = await call('/api/admin/system/activity?days=14', adminToken);
  check('the series covers every day asked for', act.status === 200 && act.json.data.series.length === 14);
  const todayRow = act.json.data.series.at(-1);
  check('today has active users', todayRow.active >= 2, `active=${todayRow.active}`);
  const yRow = act.json.data.series.at(-2);
  check('yesterday counts both people added', yRow.active >= 2);
  check('stickiness is a percentage', todayRow.stickiness >= 0 && todayRow.stickiness <= 100);
  check('retention figures exist', 'd1' in act.json.data.retention);
  check('platform split is listed', act.json.data.today.byPlatform.some((p) => p.platform === 'ios'));
  const old = await call('/api/admin/system/analytics', adminToken);
  check('the older analytics endpoint still answers with DAU from the record', old.status === 200 && old.json.data.activeUsers.daily >= 2);

  // ── One person in full ──
  console.log('\nUser detail');
  const ov = await call(`/api/admin/users/${reader.id}/overview`, adminToken);
  check('overview answers', ov.status === 200);
  const o = ov.json.data;
  check('chanting totals add up', o.chanting.rounds === 24 && o.chanting.sittings === 2, JSON.stringify(o.chanting));
  check('streak counts today and yesterday', o.chanting.current >= 2 && o.chanting.daysChanted === 2);
  check('most chanted mantra is named', !mantra || o.chanting.favouriteMantra?.name === mantra.name);
  check('active days come from the record', o.activity.activeDays >= 2);
  check('the plan is reported', o.entitlement.reason !== undefined);
  check('no secrets in the overview', !/refreshToken|tokenHash|providerUserId/.test(JSON.stringify(ov.json)));
  const ch = await call(`/api/admin/users/${reader.id}/chanting`, adminToken);
  check('chanting by mantra', ch.status === 200 && ch.json.data.mantras[0].rounds === 24 && ch.json.data.total === 2);
  const dl = await call(`/api/admin/users/${reader.id}/daily?days=30`, adminToken);
  check('daily rows with target and activity', dl.status === 200 && dl.json.data.rows.length >= 2 && dl.json.data.rows.some((r) => r.roundsCompleted === 16 && r.roundTarget === 16 && r.active));
  check('daily totals count the target met', dl.json.data.totals.targetMetDays === 1);
  const en = await call(`/api/admin/users/${reader.id}/engagement`, adminToken);
  check('engagement answers', en.status === 200 && Array.isArray(en.json.data.reading));
  const bl = await call(`/api/admin/users/${reader.id}/billing`, adminToken);
  check('billing answers', bl.status === 200 && Array.isArray(bl.json.data.payments));
  check('a missing person is 404 on every tab', (await Promise.all(['overview', 'chanting', 'daily', 'engagement', 'billing'].map((t) => call(`/api/admin/users/nope/${t}`, adminToken)))).every((r) => r.status === 404));
  check('detail needs user.read', (await call(`/api/admin/users/${reader.id}/overview`, readerToken)).status === 403);

  console.log('\nAudit for a record');
  const au = await call(`/api/admin/audit?entityType=User&entityId=${reader.id}`, adminToken);
  check('the audit log answers per record', au.status === 200 && au.json.data.length === 1 && au.json.data[0].action === 'user.ban');
  const byActor = await call(`/api/admin/audit?actorId=${admin.id}`, adminToken);
  check('and per actor', byActor.status === 200 && byActor.json.data.length >= 1);
}

try {
  await main();
} catch (error) {
  console.error(error);
  failed += 1;
} finally {
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: made } }, { entityId: { in: made } }] } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: made } } }).catch((e) => console.error('cleanup', e.message));
  await redis.zrem('presence:users', ...made).catch(() => {});
  await prisma.$disconnect();
  await redis.quit().catch(() => {});
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
