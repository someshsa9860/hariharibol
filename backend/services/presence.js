// Who is using the app right now, and who was on which day.
//
// Two cheap signals, both written from the auth middleware on a signed-in request:
//
//   presence   a Redis sorted set `presence:users` (userId → last seen, ms). A request refreshes it at most every
//              PRESENCE_GATE_S seconds per person, so a busy person costs one write every few seconds, not one per
//              request. "Online now" is the people seen in the last ONLINE_WINDOW_S seconds; the admin panel's live
//              numbers come from here (the websocket container publishes them, see websocket/index.js).
//   active day one `UserActiveDay` row per person per Indian calendar day — the history behind DAU / WAU / MAU and
//              retention. Written at most once a day per person (a Redis gate, then an upsert).
//
// Neither signal is a request log and neither stores anything about what was done.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import logger from '../config/logger.js';
import { localDateString, toDateColumn } from '../utils/date.js';

const KEY = 'presence:users';
const PRESENCE_GATE_S = 20;
export const ONLINE_WINDOW_S = 300; // five minutes without a request and a person is no longer "online"
const DAY_TZ = 'Asia/Kolkata';

/** Called for every signed-in request. Never throws and never waits for anything it does not have to. */
export function touch(userId, platform) {
  gate(userId, platform).catch((err) => logger.debug({ err: err.message }, 'presence touch failed'));
}

async function gate(userId, platform) {
  const now = Date.now();
  const fresh = await redis.set(`presence:g:${userId}`, '1', 'EX', PRESENCE_GATE_S, 'NX');
  if (fresh === 'OK') {
    await redis.zadd(KEY, now, userId);
    // Old entries leave on their own: trim anything older than a day whenever one is written.
    if (Math.random() < 0.02) await redis.zremrangebyscore(KEY, 0, now - 86_400_000);
  }

  const date = localDateString(DAY_TZ);
  const day = await redis.set(`presence:d:${userId}:${date}`, '1', 'EX', 90_000, 'NX');
  if (day !== 'OK') return;
  await prisma.userActiveDay.upsert({
    where: { userId_date: { userId, date: toDateColumn(date) } },
    update: {},
    create: { userId, date: toDateColumn(date), platform: ['ios', 'android', 'web'].includes(platform) ? platform : null },
  });
}

/** User ids seen within the last `seconds`, newest first, with when. */
export async function recent(seconds = ONLINE_WINDOW_S, limit = 500) {
  const min = Date.now() - seconds * 1000;
  const rows = await redis.zrevrangebyscore(KEY, '+inf', min, 'WITHSCORES', 'LIMIT', 0, limit);
  const out = [];
  for (let i = 0; i < rows.length; i += 2) out.push({ userId: rows[i], at: Number(rows[i + 1]) });
  return out;
}

/** How many were seen within each of the windows, in seconds. */
export async function counts(windows = [ONLINE_WINDOW_S, 900, 3600]) {
  const now = Date.now();
  const result = {};
  for (const w of windows) result[w] = await redis.zcount(KEY, now - w * 1000, '+inf');
  return result;
}

/** Names for a list of ids, for the live feed. Only what an admin already sees in the users list. */
export async function describe(userIds) {
  if (!userIds.length) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return userIds.map((id) => byId.get(id)).filter(Boolean);
}
