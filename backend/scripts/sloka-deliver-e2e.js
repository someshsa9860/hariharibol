// Runs the real `deliver()` of the sloka job against the local database, with the
// clock set to the moments it matters, and checks who is sent what.
//
//   AWS_ACCESS_KEY_ID= AWS_SECRET_ACCESS_KEY= node scripts/sloka-deliver-e2e.js
//
// The AWS keys are blanked on purpose: the push's picture is drawn and stored
// the first time a verse is sent, and a laptop's .env points at the real bucket.
// Blank, it is stored under backend/storage/ instead. The script refuses to run
// with them set.
//
// What it is here to catch: the reader's sloka is for *their* date, and in the
// first hours of the day a reader east of UTC is already on tomorrow's date. A job
// that only looked at rows up to UTC's today never saw their 04:30 sloka, and
// nothing in the pure tests (utils/sloka-delivery.js) could say so.
//
// Users, rows and notifications it makes are deleted again. It fakes `Date` only
// (node:test's mock timers), so the database and Redis are the real ones.

import { mock } from 'node:test';

import { prisma } from '../config/database.js';
import { redis, publisher } from '../config/redis.js';
import { deliver } from '../jobs/processors/sloka.js';
import * as settings from '../services/setting.js';
import { deliveryMinutes } from '../utils/sloka-delivery.js';
import { toDateColumn } from '../utils/date.js';
import { SETTING_KEYS } from '../config/constants.js';

const TAG = `e2e-sloka-${Date.now()}`;

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  console.log(
    `  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`
  );
  if (ok) passed += 1;
  else failed += 1;
}

const made = { users: [] };

async function makeUser(label, timezone) {
  const role = await prisma.role.findUnique({ where: { slug: 'user' } });
  const user = await prisma.user.create({
    data: {
      email: `${TAG}-${label}@example.test`,
      name: `${TAG} ${label}`,
      roleId: role.id,
      authProvider: 'GOOGLE',
      providerUserId: `${TAG}-${label}`,
      timezone,
    },
  });
  made.users.push(user.id);
  return user;
}

const sentTo = (user) => prisma.notification.count({ where: { userId: user.id, type: 'SLOKA' } });
const notified = async (user) =>
  (await prisma.userDailySloka.findMany({ where: { userId: user.id }, orderBy: { date: 'asc' } })).map(
    (row) => !!row.notifiedAt
  );

// Runs the job as if it were this instant (UTC).
async function runAt(iso) {
  mock.timers.setTime(new Date(iso).getTime());
  return deliver();
}

async function main() {
  if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('AWS keys are set, so the verse card would be stored in the real bucket. Blank them — see the top of this file.');
    process.exit(1);
  }

  // Every case below is 04:30 on the reader's clock.
  const target = deliveryMinutes(await settings.get(SETTING_KEYS.SLOKA_DELIVERY_TIME));
  if (target !== 270) {
    console.error('This walks the default delivery time, 04:30; the database has another. Set it back or edit the times below.');
    process.exit(1);
  }

  const verse = await prisma.verse.findFirst({
    where: { sanskrit: { not: '' }, book: { slug: 'bhagavad-gita' } },
    select: { id: true },
  });
  if (!verse) throw new Error('No Bhagavad-gita verse in this database — run `npm run db:seed` and the import first.');

  // 18 October is the reader's date in all of these; 17 October is yesterday's.
  const kolkata = await makeUser('kolkata', 'Asia/Kolkata'); //         +5:30 — 04:30 is 23:00 UTC the day before
  const kolkataStale = await makeUser('kolkata-stale', 'Asia/Kolkata'); // only has yesterday's row
  const kiritimati = await makeUser('kiritimati', 'Pacific/Kiritimati'); // +14, the furthest ahead there is
  const newYork = await makeUser('new-york', 'America/New_York'); //     −4 — 04:30 is 08:30 UTC the same day

  const row = (user, date) => prisma.userDailySloka.create({ data: { userId: user.id, date: toDateColumn(date), verseId: verse.id } });
  await row(kolkata, '2026-10-18');
  await row(kolkataStale, '2026-10-17');
  await row(kiritimati, '2026-10-18');
  await row(newYork, '2026-10-18');

  mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-17T00:00:00Z').getTime() });
  try {
    // Kiritimati wakes first: 04:30 on the 18th is 14:30 UTC on the 17th.
    await runAt('2026-10-17T14:30:00Z');
    check('Kiritimati, a day ahead of UTC, is sent at 04:30', (await sentTo(kiritimati)) === 1);
    check('no one else is sent in that run', (await sentTo(kolkata)) + (await sentTo(newYork)) === 0);

    await runAt('2026-10-17T22:30:00Z'); // 04:00 in Kolkata
    check('Kolkata is not sent at 04:00', (await sentTo(kolkata)) === 0);

    await runAt('2026-10-17T23:00:00Z'); // 04:30 in Kolkata, while UTC is still on the 17th
    check('Kolkata is sent at 04:30, while UTC is still a day behind', (await sentTo(kolkata)) === 1, `${await sentTo(kolkata)} sent`);
    check('a row from yesterday is not sent as today’s', (await sentTo(kolkataStale)) === 0);

    await runAt('2026-10-17T23:30:00Z'); // 05:00 in Kolkata
    await runAt('2026-10-18T00:00:00Z'); // 05:30 — UTC has caught up
    check('Kolkata is not sent a second time', (await sentTo(kolkata)) === 1);

    await runAt('2026-10-18T08:30:00Z'); // 04:30 in New York
    check('New York is sent at 04:30 its own time', (await sentTo(newYork)) === 1);
    check('and still no repeat for Kolkata or Kiritimati', (await sentTo(kolkata)) === 1 && (await sentTo(kiritimati)) === 1);

    await runAt('2026-10-18T09:00:00Z');
    check('the run after is quiet', (await sentTo(newYork)) === 1);
    check('only the stale row is left undelivered', (await notified(kolkataStale)).every((done) => !done));
  } finally {
    mock.timers.reset();
    await prisma.notification.deleteMany({ where: { userId: { in: made.users } } });
    await prisma.userDailySloka.deleteMany({ where: { userId: { in: made.users } } });
    await prisma.user.deleteMany({ where: { id: { in: made.users } } });
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  redis.disconnect();
  publisher.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  mock.timers.reset();
  await prisma.notification.deleteMany({ where: { userId: { in: made.users } } }).catch(() => {});
  await prisma.userDailySloka.deleteMany({ where: { userId: { in: made.users } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: made.users } } }).catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
