import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOOK_IDS, bookOfVerseId, chapterIdOfVerse, chapterLabel, chapterFile, bookOf } from '../scripts/lib/claude-translate-source.js';
import { langChapterKey, checkpointKey } from '../scripts/lib/claude-translate-store.js';

test('both books are registered, the Bhagavatam with 335 chapters', () => {
  assert.deepEqual(BOOK_IDS, ['bhagavat-gita', 'srimad-bhagavatam']);
  assert.equal(bookOf('bhagavat-gita').chapters.length, 18);
  assert.equal(bookOf('srimad-bhagavatam').chapters.length, 335);
});

test('verse ids say which book and chapter they belong to', () => {
  assert.equal(bookOfVerseId('1.2.47'), 'bhagavat-gita');
  assert.equal(chapterIdOfVerse('1.2.47'), 2);
  assert.equal(bookOfVerseId('2.1.1.1'), 'srimad-bhagavatam');
  assert.equal(chapterIdOfVerse('2.1.47.3'), 147);
  assert.equal(chapterIdOfVerse('2.10.90.1'), 1090);
});

test('storage keys differ by book', () => {
  assert.equal(langChapterKey('hi', 2), 'json/bhagavat-gita/hi/ch-2.json');
  assert.equal(langChapterKey('hi', 147, 'srimad-bhagavatam'), 'json/srimad-bhagavatam/hi/c1-ch-47.json');
  assert.notEqual(checkpointKey('v1', 'bhagavat-gita'), checkpointKey('v1', 'srimad-bhagavatam'));
});

test('chapter labels read as canto.chapter for the Bhagavatam', () => {
  assert.match(chapterLabel(147, 'srimad-bhagavatam'), /1\.47|Canto 1/);
  assert.ok(chapterFile);
});
