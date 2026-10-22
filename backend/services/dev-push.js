// When the developer's phone gets a push, and when it does not.
//
// The websocket carries everything while the companion app is open; a push is only for the times it is
// not. The rules, in order, per recipient:
//
//   1. App in the foreground (it says so every 30 s, key `dev:fg:<user>`) → no push, the socket has it.
//   2. The type is muted in the recipient's preferences → no push.
//   3. Critical events push at once, from their own allowance (PUSH_CRITICAL_MAX_PER_HOUR).
//   4. A reader's chat message pushes at once, but only one per conversation per PUSH_CHAT_GAP_S.
//   5. Everything else — and whatever rules 3 and 4 held back — waits in a list and leaves as ONE digest
//      push ("2 sign-ups, 1 new ticket") by the digest job, never sooner than PUSH_DIGEST_MIN_GAP_S after the
//      last push.
//   6. Whatever the kind, no more than PUSH_MAX_PER_HOUR pushes an hour per recipient; past that, events
//      keep collecting for the digest.
//
// Only the worker calls this. Everything is Redis counters and lists, so several workers agree.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import logger from '../config/logger.js';
import { devops } from '../config/devops.js';
import * as fcm from './fcm.js';

const DIGEST_LABELS = {
  'user.signup': ['new sign-up', 'new sign-ups'],
  'ticket.new': ['new ticket', 'new tickets'],
  'feedback.new': ['new feedback', 'new feedback'],
  'chat.message': ['message', 'messages'],
  'error.new': ['new error', 'new errors'],
  'error.spike': ['error spike', 'error spikes'],
  'health.alert': ['server alert', 'server alerts'],
};

// ── Who gets them ──────────────────────────────────────────────────────────

let cached = { at: 0, ids: [] };

export async function recipients() {
  if (Date.now() - cached.at < 60_000) return cached.ids;
  const users = await prisma.user.findMany({
    where: { isBanned: false, role: { permissions: { some: { permission: { slug: 'dev.access' } } } } },
    select: { id: true },
  });
  cached = { at: Date.now(), ids: users.map((u) => u.id) };
  return cached.ids;
}

// ── Preferences ────────────────────────────────────────────────────────────

const prefsKey = (userId) => `dev:prefs:${userId}`;

export async function getPrefs(userId) {
  try {
    const raw = await redis.get(prefsKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return { pushEnabled: parsed.pushEnabled !== false, mutedTypes: Array.isArray(parsed.mutedTypes) ? parsed.mutedTypes : [] };
  } catch {
    return { pushEnabled: true, mutedTypes: [] };
  }
}

export async function setPrefs(userId, { pushEnabled, mutedTypes }) {
  const prefs = { pushEnabled: pushEnabled !== false, mutedTypes: (mutedTypes || []).slice(0, 30) };
  await redis.set(prefsKey(userId), JSON.stringify(prefs), 'EX', devops.PUSH_PREFS_TTL_S);
  return prefs;
}

// ── Counters ───────────────────────────────────────────────────────────────

// True while under `max` uses inside the window that started at the first use.
async function take(key, max, ttlS) {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, ttlS);
  return n <= max;
}

async function isForeground(userId) {
  return (await redis.exists(`dev:fg:${userId}`)) === 1;
}

// ── Sending ────────────────────────────────────────────────────────────────

async function push(userId, { title, body, data }, { critical = false } = {}) {
  const allowance = critical ? `dev:push:crit:${userId}` : `dev:push:hour:${userId}`;
  const max = critical ? devops.PUSH_CRITICAL_MAX_PER_HOUR : devops.PUSH_MAX_PER_HOUR;
  if (!(await take(allowance, max, 3600))) return false;
  try {
    const result = await fcm.sendToUser(userId, { title, body, data, importance: critical ? 'urgent' : 'quiet' }, 'dev');
    await redis.set(`dev:lastpush:${userId}`, String(Date.now()), 'EX', 86_400);
    return result.sent > 0;
  } catch (err) {
    logger.warn({ err: err.message, userId }, 'dev push failed');
    return false;
  }
}

async function addToDigest(userId, event) {
  const key = `dev:digest:${userId}`;
  await redis.rpush(key, JSON.stringify({ type: event.type, title: event.title, at: Date.now() }));
  await redis.ltrim(key, -devops.PUSH_DIGEST_MAX_ITEMS, -1);
  await redis.expire(key, 3 * 86_400);
}

/** Apply the rules to one new event for every recipient. `conversationId` marks a chat message. */
export async function consider(event, { conversationId } = {}) {
  const ids = await recipients();
  for (const userId of ids) {
    try {
      const prefs = await getPrefs(userId);
      if (!prefs.pushEnabled || prefs.mutedTypes.includes(event.type)) continue;
      if (await isForeground(userId)) continue;

      const data = { type: event.type, eventId: event.id || '', deeplink: conversationId ? `chat/${conversationId}` : 'feed' };
      if (event.severity === 'critical') {
        if (await push(userId, { title: event.title, body: event.body || '', data }, { critical: true })) continue;
      } else if (conversationId) {
        const free = await redis.set(`dev:chatgap:${userId}:${conversationId}`, '1', 'EX', devops.PUSH_CHAT_GAP_S, 'NX');
        if (free === 'OK' && (await push(userId, { title: event.title, body: event.body || '', data }))) continue;
      }
      await addToDigest(userId, event);
    } catch (err) {
      logger.debug({ err: err.message, userId }, 'dev push consideration failed');
    }
  }
}

function summary(items) {
  const counts = new Map();
  for (const item of items) counts.set(item.type, (counts.get(item.type) || 0) + 1);
  return [...counts.entries()]
    .map(([type, n]) => {
      const [one, many] = DIGEST_LABELS[type] || ['event', 'events'];
      return `${n} ${n === 1 ? one : many}`;
    })
    .join(', ');
}

/** The digest job: one push per recipient who has waiting items and has not been pushed to lately. */
export async function flushDigests() {
  const ids = await recipients();
  let sent = 0;
  for (const userId of ids) {
    try {
      const key = `dev:digest:${userId}`;
      if (await isForeground(userId)) {
        await redis.del(key); // they are looking at the feed
        continue;
      }
      const last = Number(await redis.get(`dev:lastpush:${userId}`)) || 0;
      if (Date.now() - last < devops.PUSH_DIGEST_MIN_GAP_S * 1000) continue;
      const raw = await redis.lrange(key, 0, -1);
      if (raw.length === 0) continue;
      const items = raw.map((r) => JSON.parse(r));
      const ok = await push(userId, { title: 'While you were away', body: summary(items), data: { type: 'digest', deeplink: 'feed' } });
      if (ok) {
        await redis.del(key);
        sent += 1;
      }
    } catch (err) {
      logger.debug({ err: err.message, userId }, 'dev digest failed');
    }
  }
  return { sent };
}

export { summary };
