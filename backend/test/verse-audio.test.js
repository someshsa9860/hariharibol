// Where a verse's recitation is looked for. A verse's own recording wins; otherwise
// its book's recitation folder plus the verse's place in the book. No database —
// the function is loaded on its own.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { verseAudioPath } from '../utils/verse-audio.js';

const gita = { recitationParent: 'legacy/bhagvat-gita/mp3/chpaters-sloks' };

test('a book with a folder gives each verse <folder>/<chapter>/<verse>.mp3', () => {
  const verse = { audioPath: null, cantoNumber: null, chapterNumber: 2, verseNumber: 47 };
  assert.equal(verseAudioPath(verse, gita), 'legacy/bhagvat-gita/mp3/chpaters-sloks/2/47.mp3');
});

test("a verse's own recording beats the folder", () => {
  const verse = { audioPath: 'verses/audio/own.mp3', cantoNumber: null, chapterNumber: 2, verseNumber: 47 };
  assert.equal(verseAudioPath(verse, gita), 'verses/audio/own.mp3');
});

test('a book with no folder gives nothing unless the verse has its own', () => {
  const verse = { audioPath: null, cantoNumber: null, chapterNumber: 2, verseNumber: 47 };
  assert.equal(verseAudioPath(verse, { recitationParent: null }), null);
  assert.equal(verseAudioPath(verse, { recitationParent: '   ' }), null);
  assert.equal(verseAudioPath(verse, undefined), null);
});

test('a book with cantos adds the canto', () => {
  const verse = { audioPath: null, cantoNumber: 10, chapterNumber: 1, verseNumber: 5 };
  assert.equal(verseAudioPath(verse, { recitationParent: 'sb' }), 'sb/10/1/5.mp3');
});

test('a short work with no chapter is <folder>/<verse>.mp3', () => {
  const verse = { audioPath: null, cantoNumber: null, chapterNumber: null, verseNumber: 12 };
  assert.equal(verseAudioPath(verse, { recitationParent: 'hanuman-chalisa' }), 'hanuman-chalisa/12.mp3');
});

test('slashes at either end of the folder make no difference', () => {
  const verse = { audioPath: null, cantoNumber: null, chapterNumber: 1, verseNumber: 1 };
  assert.equal(verseAudioPath(verse, { recitationParent: '/a/b/' }), 'a/b/1/1.mp3');
  assert.equal(verseAudioPath(verse, { recitationParent: 'a/b' }), 'a/b/1/1.mp3');
});

test('a compound verse is filed under its first number', () => {
  const verse = { audioPath: null, cantoNumber: null, chapterNumber: 1, verseNumber: 13, verseNumberEnd: 14 };
  assert.equal(verseAudioPath(verse, { recitationParent: 'x' }), 'x/1/13.mp3');
});
