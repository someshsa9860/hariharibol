// A few at a time, never more. No database, no Redis.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { eachLimited } from '../utils/concurrency.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('every item is visited once, never more than the limit at once', async () => {
  const items = Array.from({ length: 23 }, (_, i) => i);
  const seen = [];
  let running = 0;
  let most = 0;
  await eachLimited(items, 4, async (item) => {
    running += 1;
    most = Math.max(most, running);
    await tick();
    seen.push(item);
    running -= 1;
  });
  assert.deepEqual([...seen].sort((a, b) => a - b), items);
  assert.equal(most, 4);
});

test('nothing to do is done at once, and a limit below one is one', async () => {
  let calls = 0;
  await eachLimited([], 8, async () => { calls += 1; });
  assert.equal(calls, 0);

  let running = 0;
  let most = 0;
  await eachLimited([1, 2, 3], 0, async () => {
    running += 1;
    most = Math.max(most, running);
    await tick();
    running -= 1;
  });
  assert.equal(most, 1);
});
