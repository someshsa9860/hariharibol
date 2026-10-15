// Which script a mantra's text is shown in: the reader's reading language first, so a
// Kannada reader sees Kannada letters under a Kannada title. The older mantra language
// is only the next choice, and reel narration keeps its own order. No database — the
// functions are loaded on their own.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { mantraChain, mantraTextChain, pick } from '../utils/language.js';

// The account the app creates: the mantra language is never changed after sign-in.
const kannadaReader = { appLanguage: 'hi', readingLanguage: 'kn', mantraLanguage: 'sa' };

const rows = [
  { languageCode: 'sa', text: 'हरे कृष्ण हरे कृष्ण' },
  { languageCode: 'hi', text: 'हरे कृष्ण हरे कृष्ण' },
  { languageCode: 'kn', text: 'ಹರೇ ಕೃಷ್ಣ ಹರೇ ಕೃಷ್ಣ' },
  { languageCode: 'en', text: 'Hare Krishna Hare Krishna' },
];

test('a Kannada reader with a Sanskrit mantra language gets Kannada letters', () => {
  assert.deepEqual(mantraTextChain(kannadaReader), ['kn', 'sa', 'hi', 'en']);
  assert.equal(pick(rows, mantraTextChain(kannadaReader)).languageCode, 'kn');
});

test('the old order would have given Devanagari — narration still uses it', () => {
  assert.equal(pick(rows, mantraChain(kannadaReader)).languageCode, 'sa');
});

test('an English reader gets the Roman text', () => {
  const reader = { appLanguage: 'hi', readingLanguage: 'en', mantraLanguage: 'sa' };
  assert.equal(pick(rows, mantraTextChain(reader)).languageCode, 'en');
});

test('a reading language with no row falls to the mantra language, then the rest', () => {
  const reader = { appLanguage: 'hi', readingLanguage: 'ne', mantraLanguage: 'sa' };
  assert.equal(pick(rows, mantraTextChain(reader)).languageCode, 'sa');
  assert.equal(pick(rows.filter((r) => r.languageCode !== 'sa'), mantraTextChain(reader)).languageCode, 'hi');
});

test('a chain never repeats a language and always ends where it did before', () => {
  const reader = { appLanguage: 'kn', readingLanguage: 'kn', mantraLanguage: 'kn' };
  assert.deepEqual(mantraTextChain(reader), ['kn', 'en', 'sa']);
});

test('signed out is unchanged: Sanskrit, then English', () => {
  assert.deepEqual(mantraTextChain(null), mantraChain(null));
  assert.deepEqual(mantraTextChain(null), ['sa', 'en']);
});
