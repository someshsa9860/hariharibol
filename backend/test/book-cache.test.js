// The pure half of the book export: canonical JSON, hashing, and the decision of
// whether a unit is uploaded. No database, no bucket, no Redis.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

import * as cache from '../utils/book-cache.js';
import { acquire } from '../services/redis-lock.js';

test('canonicalize sorts keys at every depth', () => {
  const a = { b: 1, a: { d: [3, { y: 1, x: 2 }], c: null } };
  const b = { a: { c: null, d: [3, { x: 2, y: 1 }] }, b: 1 };
  assert.equal(cache.canonicalize(a), cache.canonicalize(b));
  assert.equal(cache.canonicalize(a), '{"a":{"c":null,"d":[3,{"x":2,"y":1}]},"b":1}');
});

test('canonicalize keeps array order and drops undefined keys', () => {
  assert.equal(cache.canonicalize({ list: [2, 1], gone: undefined }), '{"list":[2,1]}');
});

test('same content hashes the same, any change hashes differently', () => {
  const body = { verses: [{ n: 1, t: 'यदा' }], schemaVersion: 1 };
  const same = { schemaVersion: 1, verses: [{ t: 'यदा', n: 1 }] };
  assert.equal(cache.serialize(body).hash, cache.serialize(same).hash);
  assert.notEqual(cache.serialize(body).hash, cache.serialize({ ...body, schemaVersion: 2 }).hash);
  assert.notEqual(
    cache.serialize(body).hash,
    cache.serialize({ ...body, verses: [{ n: 1, t: 'यदा ' }] }).hash
  );
});

test('the hash is of the uncompressed bytes, and gzip round-trips to them', () => {
  const { bytes, hash, sizeBytes } = cache.serialize({ a: 'x'.repeat(1000) });
  const gz = cache.gzip(bytes);
  assert.ok(gz.length < bytes.length);
  assert.equal(sizeBytes, bytes.length);
  assert.equal(cache.sha256(zlib.gunzipSync(gz)), hash);
  assert.deepEqual(cache.gzip(bytes), gz, 'gzip is deterministic');
});

test('plan: new, changed, missing file, unchanged', () => {
  const existing = { hash: 'h1', version: 4 };
  assert.equal(cache.plan(null, 'h1'), 'create');
  assert.equal(cache.plan(existing, 'h2'), 'update');
  assert.equal(cache.plan(existing, 'h1', false), 'repair');
  assert.equal(cache.plan(existing, 'h1', true), 'skip');
  assert.equal(cache.plan(existing, 'h1'), 'skip');
});

test('nextVersion bumps only on a real change', () => {
  const existing = { hash: 'h1', version: 4 };
  assert.equal(cache.nextVersion(null, 'create'), 1);
  assert.equal(cache.nextVersion(existing, 'update'), 5);
  assert.equal(cache.nextVersion(existing, 'repair'), 4);
});

test('backoff doubles each attempt, within jitter', () => {
  assert.equal(cache.backoffMs(1, 1000, () => 0.5), 1000);
  assert.equal(cache.backoffMs(2, 1000, () => 0.5), 2000);
  assert.equal(cache.backoffMs(3, 1000, () => 0.5), 4000);
  assert.equal(cache.backoffMs(1, 1000, () => 0), 750);
  assert.equal(cache.backoffMs(1, 1000, () => 1), 1250);
});

test('withRetry retries then succeeds, and gives up after the limit', async () => {
  const waits = [];
  let calls = 0;
  const flaky = async () => {
    calls += 1;
    if (calls < 3) throw new Error('boom');
    return 'ok';
  };
  const sleep = async (ms) => waits.push(ms);
  assert.equal(await cache.withRetry(flaky, { retries: 3, baseMs: 100, sleep }), 'ok');
  assert.equal(calls, 3);
  assert.equal(waits.length, 2);

  calls = 0;
  await assert.rejects(
    cache.withRetry(async () => { calls += 1; throw new Error('always'); }, { retries: 2, baseMs: 1, sleep }),
    /always/
  );
  assert.equal(calls, 2);
});

// A minimal stand-in for the two Redis commands the lock uses.
function fakeRedis() {
  const store = new Map();
  return {
    set: async (k, v, _px, _ttl, nx) => (nx === 'NX' && store.has(k) ? null : (store.set(k, v), 'OK')),
    eval: async (script, _n, key, token) => {
      if (store.get(key) !== token) return 0;
      if (script.includes("'del'")) store.delete(key);
      return 1;
    },
  };
}

test('lock: a second holder is refused until the first releases', async () => {
  const redis = fakeRedis();
  const first = await acquire('k', 1000, redis);
  assert.ok(first);
  assert.equal(await acquire('k', 1000, redis), null);
  await first.release();
  assert.ok(await acquire('k', 1000, redis));
});

test('lock: release by a stale holder does not free someone else’s lock', async () => {
  const redis = fakeRedis();
  const first = await acquire('k', 1000, redis);
  redis.set('k', 'someone-else', 'PX', 1000); // first's lock expired and was retaken
  await first.release();
  assert.equal(await acquire('k', 1000, redis), null);
});
