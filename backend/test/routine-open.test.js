import { test } from 'node:test';
import assert from 'node:assert/strict';

import { opensOf } from '../utils/routine-open.js';

test('a meal opens its prayer by slug', () => {
  assert.deepEqual(opensOf({ opensKind: 'prayer', prayerSlug: 'prasada-sevaya' }), { kind: 'prayer', slug: 'prasada-sevaya' });
});

test('a prayer with no slug opens nothing rather than a broken link', () => {
  assert.equal(opensOf({ opensKind: 'prayer', prayerSlug: null }), null);
});

test('a chant and a read open their own page, the server names no mantra or book', () => {
  assert.deepEqual(opensOf({ opensKind: 'chant', prayerSlug: null }), { kind: 'chant' });
  assert.deepEqual(opensOf({ opensKind: 'read', prayerSlug: null }), { kind: 'read' });
});

test('a kind with nothing to open, or an unknown one, opens nothing', () => {
  assert.equal(opensOf({ opensKind: null, prayerSlug: null }), null);
  assert.equal(opensOf({ opensKind: 'sleep', prayerSlug: null }), null);
});
