// Walks the calendar over real HTTP against a running API, then the push job:
//
//   npm run dev    (another terminal)
//   npm run test:panchang
//
// Checks the public calendar, who may use the admin pages, a correction that survives
// generating the year again, a festival added for tomorrow, the push going out once, and a
// festival today: pushed on its own day, and queued for 05:00 by the 04:45 planning job.
// Makes a throw-away admin and reader (deleted at the end) and two festivals (deleted too).

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import * as authService from '../services/auth.js';
import festivalNotify from '../jobs/processors/festival-notify.js';
import festivalPlan, { pushTime } from '../jobs/processors/festival-plan.js';
import { queues } from '../jobs/index.js';
import { LOCATIONS } from '../services/panchang.js';
import { currentLocationKey, asDate } from '../services/panchang-store.js';
import { localDateString, shiftDays } from '../utils/date.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'panchang-e2e-device';
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
    headers: { 'content-type': 'application/json', 'x-device-id': DEVICE, 'x-platform': 'ios', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // 204
  }
  return { status: res.status, json };
}

async function makeUser(slug, tag) {
  const role = await prisma.role.findUnique({ where: { slug } });
  const email = `panchang-e2e-${tag}@example.com`;
  await prisma.user.deleteMany({ where: { email } });
  return prisma.user.create({ data: { email, name: `Panchang ${tag}`, roleId: role.id, authProvider: 'GOOGLE', providerUserId: `panchang-e2e-${tag}` } });
}

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`);
    process.exit(1);
  }
  const admin = await makeUser('super_admin', 'admin');
  const reader = await makeUser('user', 'reader');
  const key = await currentLocationKey();
  const today = localDateString(LOCATIONS[key].timezone);
  const tomorrow = shiftDays(today, 1);
  let festivalId = null;
  let todayId = null;
  const planJobId = `festival-notify-${today}`;

  try {
    await redis.del(`rl:write:${admin.id}`, `rl:read:${admin.id}`);
    const { accessToken: token } = await authService.issueSession(admin, DEVICE);
    const { accessToken: readerToken } = await authService.issueSession(reader, DEVICE);

    console.log('\n1. The public calendar');
    const month = await call('GET', '/api/app/calendar?from=2026-01-01&to=2026-01-31');
    check('answers without signing in', month.status === 200, `HTTP ${month.status}`);
    const d14 = month.json?.data?.days?.find((d) => d.date === '2026-01-14');
    check('14 Jan 2026 is Krishna Ekadashi', d14?.tithi.name === 'Ekadashi' && d14.tithi.paksha === 'KRISHNA', JSON.stringify(d14?.tithi));
    check('with Shattila Ekadashi and Makar Sankranti',
      ['Shattila Ekadashi', 'Makar Sankranti'].every((n) => month.json.data.festivals.some((f) => f.date === '2026-01-14' && f.name === n)));
    const long = await call('GET', '/api/app/calendar?from=2026-01-01&to=2026-12-31');
    check('a year at once is refused', long.status === 400, `HTTP ${long.status}`);
    const next = await call('GET', '/api/app/calendar/upcoming?days=90');
    check('upcoming answers', next.status === 200 && Array.isArray(next.json?.data?.festivals));

    console.log('\n2. Who may use the admin pages');
    const anon = await call('GET', '/api/admin/panchang?month=2026-01');
    check('signed out is 403', anon.status === 403, `HTTP ${anon.status}`);
    const plain = await call('GET', '/api/admin/panchang?month=2026-01', { token: readerToken });
    check('a plain reader is 403', plain.status === 403, `HTTP ${plain.status}`);
    const adm = await call('GET', '/api/admin/panchang?month=2026-01', { token });
    check('an admin sees 31 days', adm.status === 200 && adm.json.data.days.length === 31, `HTTP ${adm.status}`);

    console.log('\n3. A correction survives generating again');
    const patched = await call('PATCH', '/api/admin/panchang/days/2026-01-20', { token, body: { notes: 'e2e note', nakshatra: 'Rohini' } });
    check('the day is changed and marked edited', patched.status === 200 && patched.json.data.isEdited && patched.json.data.nakshatra.name === 'Rohini', `HTTP ${patched.status}`);
    const regen = await call('POST', '/api/admin/panchang/generate', { token, body: { year: 2026 } });
    check('generating again keeps it', regen.status === 200 && regen.json.data.adminEditedKept >= 1, JSON.stringify(regen.json?.data));
    const kept = await prisma.panchangDay.findUnique({ where: { date_locationKey: { date: asDate('2026-01-20'), locationKey: key } } });
    check('the note is still there', kept.notes === 'e2e note' && kept.nakshatra === 'Rohini');

    console.log('\n4. A festival added for tomorrow is pushed once');
    const device = await prisma.device.upsert({
      where: { deviceId: DEVICE }, update: { userId: reader.id, fcmToken: 'e2e-token' },
      create: { deviceId: DEVICE, platform: 'ios', userId: reader.id, fcmToken: 'e2e-token' },
    });
    const made = await call('POST', '/api/admin/panchang/festivals', { token, body: { date: tomorrow, slug: 'e2e-festival', kind: 'FESTIVAL', name: 'E2E Utsav', notifyDaysBefore: [1] } });
    festivalId = made.json?.data?.id;
    check('created', made.status === 201, `HTTP ${made.status}`);
    const first = await festivalNotify();
    check('the job sends it', first.sent >= 1, JSON.stringify(first));
    // Any real festival that falls tomorrow is pushed by the same run, so look for ours by title.
    const rows = await prisma.notification.findMany({ where: { userId: reader.id, type: 'FESTIVAL' } });
    check('the reader has it in the app', rows.some((r) => r.title === 'E2E Utsav tomorrow'), rows.map((r) => r.title).join(', '));
    const second = await festivalNotify();
    check('a second run sends nothing', second.sent === 0 && (await prisma.notification.count({ where: { userId: reader.id, type: 'FESTIVAL' } })) === rows.length, JSON.stringify(second));
    const off = await call('PATCH', `/api/admin/panchang/festivals/${festivalId}`, { token, body: { isActive: false } });
    check('it can be switched off', off.status === 200 && off.json.data.isActive === false);
    void device;

    console.log('\n5. A festival today is pushed on its day, and queued for 05:00');
    const madeToday = await call('POST', '/api/admin/panchang/festivals', { token, body: { date: today, slug: 'e2e-today', kind: 'FESTIVAL', name: 'E2E Today', notifyDaysBefore: [] } });
    todayId = madeToday.json?.data?.id;
    check('created, with no earlier heads-up asked for', madeToday.status === 201, `HTTP ${madeToday.status}`);
    check('05:00 IST on 22 Oct is 23:30 UTC the evening before',
      pushTime('2026-10-22', 'Asia/Kolkata').toISOString() === '2026-10-21T23:30:00.000Z', pushTime('2026-10-22', 'Asia/Kolkata').toISOString());
    await queues.notification.remove(planJobId);
    const plan = await festivalPlan();
    check('the 04:45 job finds it and queues the push', plan.planned && plan.due >= 1, JSON.stringify(plan));
    const queued = await queues.notification.getJob(planJobId);
    const at = pushTime(today, LOCATIONS[key].timezone).getTime();
    const wanted = Math.max(at, queued?.timestamp ?? 0); // already past 05:00 → goes at once
    check('as a festival.notify job for 05:00', queued?.name === 'festival.notify' && Math.abs(queued.timestamp + queued.opts.delay - wanted) < 5000,
      queued ? `delay ${queued.opts.delay} ms` : 'not on the queue');
    await festivalPlan();
    check('planning again does not queue a second', (await queues.notification.getJobs(['waiting', 'delayed'])).filter((j) => j.id === planJobId).length === 1);
    // The first push went to a made-up token, which the push service drops as invalid; give the phone one again.
    await prisma.device.update({ where: { deviceId: DEVICE }, data: { fcmToken: 'e2e-token' } });
    const todayRun = await festivalNotify();
    check('the push goes out', todayRun.sent >= 1, JSON.stringify(todayRun));
    const todayRows = await prisma.notification.findMany({ where: { userId: reader.id, type: 'FESTIVAL' } });
    check('the reader has "E2E Today today"', todayRows.some((r) => r.title === 'E2E Today today'), todayRows.map((r) => r.title).join(', '));
    const after = await festivalPlan();
    check('with nothing left to send, planning finds less', after.due < plan.due, JSON.stringify(after));

    console.log('\n6. The place');
    const bad = await call('PUT', '/api/admin/panchang/location', { token, body: { key: 'atlantis' } });
    check('an unknown place is refused', bad.status === 400, `HTTP ${bad.status}`);
  } finally {
    if (festivalId || todayId) await prisma.festival.deleteMany({ where: { id: { in: [festivalId, todayId].filter(Boolean) } } });
    await queues.notification.remove(planJobId).catch(() => {});
    // The runs above announced whatever real festival is today or tomorrow; let the real job do it again.
    await prisma.festival.updateMany({ where: { locationKey: key, date: { in: [asDate(today), asDate(tomorrow)] } }, data: { notifiedDays: [] } });
    await prisma.panchangDay.updateMany({ where: { date: asDate('2026-01-20'), locationKey: key }, data: { isEdited: false, notes: null } });
    await prisma.notification.deleteMany({ where: { userId: { in: [admin.id, reader.id] } } });
    await prisma.device.deleteMany({ where: { deviceId: DEVICE } });
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, reader.id] } } });
    await prisma.$disconnect();
    redis.disconnect();
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main();
