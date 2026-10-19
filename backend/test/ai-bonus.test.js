import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BONUS_LIMITS, DEFAULT_BONUS, left, normalise, perUser, split } from '../utils/ai-bonus.js';

test('the pool is shared among the readers, up to a ceiling each', () => {
  const base = { poolTokens: 1_500_000, maxPerUser: 20_000 };
  assert.equal(perUser({ ...base, users: 1 }), 20_000, 'one reader is held to the ceiling');
  assert.equal(perUser({ ...base, users: 75 }), 20_000, '1.5M / 75 is exactly the ceiling');
  assert.equal(perUser({ ...base, users: 300 }), 5_000);
  assert.equal(perUser({ ...base, users: 10_000 }), 150);
  assert.equal(perUser({ ...base, users: 0 }), 20_000, 'no readers counts as one');
});

test('more readers never means a bigger share', () => {
  let last = Infinity;
  for (const users of [1, 10, 100, 1000, 100_000, 10_000_000]) {
    const share = perUser({ poolTokens: 1_500_000, maxPerUser: 50_000, users });
    assert.ok(share <= last);
    last = share;
  }
});

test('the pool is never counted past what the free tier can hold', () => {
  assert.equal(perUser({ poolTokens: 9_000_000, maxPerUser: 5_000_000, users: 1, poolCap: 2_250_000 }), 2_250_000);
  assert.equal(perUser({ poolTokens: 0, maxPerUser: 20_000, users: 5 }), 0);
  assert.equal(perUser({ poolTokens: 1_000, maxPerUser: 0, users: 1 }), 0);
});

test('stored values that are not sensible whole numbers fall back to the defaults', () => {
  assert.deepEqual(normalise(), DEFAULT_BONUS);
  assert.deepEqual(normalise({ poolTokens: 'lots', maxPerUser: -5 }), DEFAULT_BONUS);
  assert.deepEqual(normalise({ poolTokens: BONUS_LIMITS.poolTokens.max + 1, maxPerUser: 1.5 }), DEFAULT_BONUS);
  assert.deepEqual(normalise({ poolTokens: 0, maxPerUser: 7 }), { poolTokens: 0, maxPerUser: 7 });
});

test('a debit takes from the bonus first, then the wallet', () => {
  assert.equal(left(100, 30), 70);
  assert.equal(left(100, 500), 0);
  assert.deepEqual(split({ tokens: 50, bonus: 100, bonusUsed: 0 }), { fromBonus: 50, fromWallet: 0 });
  assert.deepEqual(split({ tokens: 50, bonus: 100, bonusUsed: 80 }), { fromBonus: 20, fromWallet: 30 });
  assert.deepEqual(split({ tokens: 50, bonus: 0, bonusUsed: 0 }), { fromBonus: 0, fromWallet: 50 });
});
