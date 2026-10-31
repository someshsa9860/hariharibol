// Home's "for what you are working on": the pure half. Which reported issues come first, and how a day picks where a
// band of verses starts. No database.
//
//   node --test test/home-issue-verses.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rankIssues, rotate, dayNumber, topBand } from '../utils/home-issues.js';

test('rankIssues puts the most reported first, then the most recent', () => {
  const rows = [
    { issueId: 'a', count: 2, lastAt: '2026-10-20T10:00:00Z' },
    { issueId: 'b', count: 5, lastAt: '2026-10-01T10:00:00Z' },
    { issueId: 'c', count: 2, lastAt: '2026-10-25T10:00:00Z' },
  ];
  assert.deepEqual(rankIssues(rows, 10), ['b', 'c', 'a'].map((issueId) => rows.find((row) => row.issueId === issueId)));
});

test('rankIssues keeps at most max issues', () => {
  const rows = [1, 2, 3, 4].map((n) => ({ issueId: `i${n}`, count: n, lastAt: '2026-10-20T00:00:00Z' }));
  const ranked = rankIssues(rows, 3);
  assert.equal(ranked.length, 3);
  assert.deepEqual(ranked.map((row) => row.issueId), ['i4', 'i3', 'i2']);
});

test('rankIssues does not change the rows it was given', () => {
  const rows = [
    { issueId: 'a', count: 1, lastAt: '2026-10-01T00:00:00Z' },
    { issueId: 'b', count: 3, lastAt: '2026-10-01T00:00:00Z' },
  ];
  rankIssues(rows, 2);
  assert.equal(rows[0].issueId, 'a');
});

test('rankIssues of nothing is nothing', () => {
  assert.deepEqual(rankIssues([], 3), []);
});

test('rotate starts from a day-chosen index and keeps every item once', () => {
  const list = ['a', 'b', 'c', 'd'];
  const turned = rotate(list, 6); // 6 % 4 = 2
  assert.deepEqual(turned, ['c', 'd', 'a', 'b']);
  assert.deepEqual([...turned].sort(), [...list].sort());
});

test('rotate gives the same order for the same day, however often it is asked', () => {
  const list = ['a', 'b', 'c'];
  assert.deepEqual(rotate(list, 20000), rotate(list, 20000));
});

test('rotate moves on to the next start the next day', () => {
  const list = ['a', 'b', 'c'];
  assert.notDeepEqual(rotate(list, 20000)[0], rotate(list, 20001)[0]);
});

test('rotate handles a negative day number without going out of range', () => {
  assert.deepEqual(rotate(['a', 'b', 'c'], -1), ['c', 'a', 'b']);
});

test('rotate of nothing is nothing', () => {
  assert.deepEqual(rotate([], 5), []);
});

test('dayNumber counts whole days from the epoch for a calendar date', () => {
  assert.equal(dayNumber('1970-01-01'), 0);
  assert.equal(dayNumber('1970-01-02'), 1);
  assert.equal(dayNumber('2026-10-29') - dayNumber('2026-10-28'), 1);
});

test('topBand keeps the candidates within 80% of the best weight', () => {
  const candidates = [
    { verseId: 'x', weight: 10 },
    { verseId: 'y', weight: 8.5 },
    { verseId: 'z', weight: 7.9 },
  ];
  assert.deepEqual(topBand(candidates).map((row) => row.verseId), ['x', 'y']);
});
