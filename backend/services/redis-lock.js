// A small distributed lock on Redis: `SET key token NX PX ttl`, released only by
// whoever holds the token. Used so two worker containers (or a worker and a
// manual trigger) never run the same export at once.
//
// The lock expires by itself if its holder dies, and a live holder renews it, so
// a long run keeps it and a crashed one does not wedge the job for good.

import crypto from 'node:crypto';

// Deletes the key only if it still holds our token — never someone else's lock.
const RELEASE = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
// Extends the TTL only if we still hold it.
const RENEW = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end`;

/**
 * Tries to take [key]. Returns `{ renew(), release() }` or null if it is held.
 * [client] is injectable for tests.
 */
async function acquire(key, ttlMs, client) {
  // Imported here so this file loads — and is unit-tested — without a Redis.
  client ??= (await import('../config/redis.js')).redis;
  const token = crypto.randomBytes(16).toString('hex');
  const got = await client.set(key, token, 'PX', ttlMs, 'NX');
  if (got !== 'OK') return null;

  return {
    renew: async () => (await client.eval(RENEW, 1, key, token, ttlMs)) === 1,
    release: async () => {
      await client.eval(RELEASE, 1, key, token);
    },
  };
}

/** Runs [fn] holding the lock, renewing it on a timer. Returns null if it is held elsewhere. */
async function withLock(key, ttlMs, fn, client) {
  const lock = await acquire(key, ttlMs, client);
  if (!lock) return null;
  const timer = setInterval(() => lock.renew().catch(() => {}), Math.max(1000, Math.floor(ttlMs / 3)));
  try {
    return { value: await fn() };
  } finally {
    clearInterval(timer);
    await lock.release().catch(() => {});
  }
}

export { acquire, withLock };
