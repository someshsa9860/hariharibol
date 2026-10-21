import { test } from 'node:test';
import assert from 'node:assert/strict';

import { funnel, defaultKey } from '../utils/push-funnel.js';

test('a funnel gives rates against what they follow from', () => {
  const f = funnel({ sent: 200, delivered: 150, opened: 50, engaged: 20, readers: 40, totalStayMs: 400000 });
  assert.equal(f.deliveredRate, 75);
  assert.equal(f.openedRate, 25);
  assert.equal(f.engagedRate, 40); // of those who opened
  assert.equal(f.averageStaySeconds, 10);
});

test('a funnel with nothing sent has no rates rather than NaN', () => {
  const f = funnel({ sent: 0, delivered: 0, opened: 0, engaged: 0, readers: 0, totalStayMs: 0 });
  assert.equal(f.deliveredRate, null);
  assert.equal(f.engagedRate, null);
  assert.equal(f.averageStaySeconds, null);
});

test('senders that name no campaign share one per kind per day', () => {
  const day = new Date('2026-10-21T08:00:00Z');
  assert.equal(defaultKey('SLOKA', day), 'sloka:2026-10-21');
  assert.equal(defaultKey('SLOKA', new Date('2026-10-22T01:00:00Z')), 'sloka:2026-10-22');
});
