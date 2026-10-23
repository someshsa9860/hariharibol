import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_MODELS, POOLS, SAFETY, USABLE_MODELS, capOf, dayOf, hasRoom, poolOf, poolUsed,
} from '../utils/ai-free-tier.js';

describe('which pool a model counts against', () => {
  it('knows the two pools on OpenAI’s Data controls page', () => {
    assert.equal(POOLS.large.limit, 250_000);
    assert.equal(POOLS.mini.limit, 2_500_000);
    assert.equal(poolOf('gpt-4o'), 'large');
    assert.equal(poolOf('gpt-4.1'), 'large');
    assert.equal(poolOf('o3'), 'large');
    assert.equal(poolOf('gpt-4o-mini'), 'mini');
    assert.equal(poolOf('gpt-4.1-mini'), 'mini');
    assert.equal(poolOf('gpt-4.1-nano'), 'mini');
    assert.equal(poolOf('o4-mini'), 'mini');
  });

  it('puts no model in both pools, and the mini models are not mistaken for their big siblings', () => {
    const all = [...POOLS.large.models, ...POOLS.mini.models];
    assert.equal(new Set(all).size, all.length);
    assert.notEqual(poolOf('gpt-4o'), poolOf('gpt-4o-mini'));
    assert.notEqual(poolOf('gpt-4.1'), poolOf('gpt-4.1-mini'));
  });

  it('reads a dated model name as the model it is a snapshot of', () => {
    assert.equal(poolOf('gpt-4o-mini-2024-07-18'), 'mini');
    assert.equal(poolOf('gpt-4.1-mini-2025-04-14'), 'mini');
    assert.equal(poolOf('gpt-4o-2024-08-06'), 'large');
  });

  it('gives gpt-6-luna, and anything it does not know, no free pool', () => {
    assert.equal(poolOf('gpt-6-luna'), null);
    assert.equal(poolOf('gemini-3.5-flash-lite'), null);
    assert.equal(poolOf(''), null);
    assert.equal(poolOf(undefined), null);
  });

  it('offers only models whose request the app already knows how to make, all from the big pool', () => {
    assert.deepEqual(USABLE_MODELS, ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1-nano']);
    assert.ok(USABLE_MODELS.every((model) => poolOf(model) === 'mini'));
    assert.ok(USABLE_MODELS.includes(DEFAULT_MODELS.text));
  });
});

describe('where we stop', () => {
  it('stops at 90% of a pool, because other projects on the organisation draw on it unseen', () => {
    assert.equal(SAFETY, 0.9);
    assert.equal(capOf('mini'), 2_250_000);
    assert.equal(capOf('large'), 225_000);
  });

  it('has room until the cap is reached, not after', () => {
    assert.equal(hasRoom('mini', 0), true);
    assert.equal(hasRoom('mini', 2_249_999), true);
    assert.equal(hasRoom('mini', 2_250_000), false);
    assert.equal(hasRoom('mini', 3_000_000), false);
    assert.equal(hasRoom('large', 224_999), true);
    assert.equal(hasRoom('large', 225_000), false);
  });

  it('rolls the day over at midnight UTC', () => {
    assert.equal(dayOf(new Date('2026-10-17T23:59:59.999Z')), '2026-10-17');
    assert.equal(dayOf(new Date('2026-10-18T00:00:00.000Z')), '2026-10-18');
    assert.match(dayOf(), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('what a pool has used today', () => {
  const rows = [
    { provider: 'openai', model: 'gpt-4o-mini', inputTokens: 1000, outputTokens: 200, calls: 3 },
    { provider: 'openai', model: 'gpt-4.1-mini', inputTokens: 5000, outputTokens: 800, calls: 2 },
    { provider: 'openai', model: 'gpt-4o', inputTokens: 70, outputTokens: 30, calls: 1 },
    { provider: 'openai', model: 'gpt-6-luna', inputTokens: 90_000, outputTokens: 9000, calls: 4 },
    { provider: 'gemini', model: 'gpt-4o-mini', inputTokens: 123_456, outputTokens: 0, calls: 1 },
  ];

  it('adds input and output together, across every model of the pool', () => {
    assert.equal(poolUsed(rows, 'mini'), 1000 + 200 + 5000 + 800);
    assert.equal(poolUsed(rows, 'large'), 100);
  });

  it('counts nothing for a model with no pool, or for another company’s model of the same name', () => {
    assert.equal(poolUsed(rows.filter((r) => r.model === 'gpt-6-luna'), 'mini'), 0);
    assert.equal(poolUsed(rows.filter((r) => r.provider === 'gemini'), 'mini'), 0);
    assert.equal(poolUsed([], 'mini'), 0);
  });

  it('reads the provider in any case', () => {
    assert.equal(poolUsed([{ provider: 'OPENAI', model: 'gpt-4o-mini', inputTokens: 5, outputTokens: 5 }], 'mini'), 10);
  });
});
