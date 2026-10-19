import { test } from 'node:test';
import assert from 'node:assert/strict';

import { favouriteCandidates, FAVOURITE_MIN_ROUNDS } from '../utils/favourite-mantra.js';

const m = (id, rounds, sessions = 1) => ({ id, rounds, sessions });

test('a habit in the window decides it', () => {
  const got = favouriteCandidates({ recent: [m('a', 20), m('b', 40)], allTime: [m('c', 9000)], legacyId: 'l' });
  assert.deepEqual(got, ['b', 'a', 'l', 'c']);
});

test('a few rounds of something new do not push the carried-over favourite aside', () => {
  const got = favouriteCandidates({ recent: [m('new', FAVOURITE_MIN_ROUNDS - 1)], allTime: [], legacyId: 'shiva' });
  assert.equal(got[0], 'shiva');
  assert.deepEqual(got, ['shiva', 'new']);
});

test('without a carried-over favourite, the recent leader stands even when small', () => {
  assert.equal(favouriteCandidates({ recent: [m('a', 1)], allTime: [m('z', 500)] })[0], 'a');
});

test('someone who stopped chanting still has the mantra they chanted most', () => {
  assert.deepEqual(favouriteCandidates({ recent: [], allTime: [m('a', 10), m('b', 50)] }), ['b', 'a']);
});

test('sessions break a tie, and nobody has none', () => {
  assert.equal(favouriteCandidates({ recent: [m('a', 10, 1), m('b', 10, 4)] })[0], 'b');
  assert.deepEqual(favouriteCandidates({}), []);
});

test('the plain counter is not a mantra', () => {
  assert.deepEqual(favouriteCandidates({ recent: [m(null, 100)] }), []);
});
