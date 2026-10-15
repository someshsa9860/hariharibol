// Which transliteration a verse shows. It follows the reading language, in that
// language's own script, and falls back to the verse's Roman text.
// No database — the function is loaded on its own.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { pickTransliteration } from '../utils/language.js';

const IAST = 'sañjaya uvāca';
const marathi = { languageCode: 'mr', type: 'TRANSLATION', transliteration: 'सञ्जय उवाच' };
const ovi = { languageCode: 'mr', type: 'POETIC_EXPANSION', transliteration: null };
const tamil = { languageCode: 'ta', type: 'TRANSLATION', transliteration: 'சஞ்ஜய உவாச' };
const english = { languageCode: 'en', type: 'TRANSLATION', transliteration: null };

test('a Marathi reader gets the Marathi transliteration, not the Roman one', () => {
  assert.equal(pickTransliteration([english, marathi], ['mr', 'en'], IAST), 'सञ्जय उवाच');
});

test('an English reader has none stored, so the Roman text stands', () => {
  assert.equal(pickTransliteration([english, marathi], ['en'], IAST), IAST);
});

test('the reading chain decides the order, not the order of the rows', () => {
  assert.equal(pickTransliteration([marathi, tamil], ['ta', 'mr', 'en'], IAST), 'சஞ்ஜய உவாச');
  assert.equal(pickTransliteration([tamil, marathi], ['mr', 'ta', 'en'], IAST), 'सञ्जय उवाच');
});

test('a row of the language with none is passed over for one that has it', () => {
  assert.equal(pickTransliteration([ovi, marathi], ['mr', 'en'], IAST), 'सञ्जय उवाच');
});

test('a reader whose languages have none gets the Roman text', () => {
  assert.equal(pickTransliteration([marathi, tamil], ['bn', 'en'], IAST), IAST);
});

test('blank text is not a transliteration', () => {
  assert.equal(pickTransliteration([{ ...marathi, transliteration: '  ' }], ['mr', 'en'], IAST), IAST);
});

test('nothing at all is the fallback, which may itself be null', () => {
  assert.equal(pickTransliteration(undefined, ['mr', 'en'], IAST), IAST);
  assert.equal(pickTransliteration([], ['mr', 'en']), null);
});

// A verse with nothing stored in the reader's language: the Devanagari is carried across
// into their script instead of falling back to Roman letters.
const SANSKRIT = 'सञ्जय उवाच';

test('a Kannada reader with nothing stored gets the verse in Kannada letters, not Roman', () => {
  assert.equal(pickTransliteration([english], ['kn', 'en'], IAST, SANSKRIT), 'ಸಞ್ಜಯ ಉವಾಚ');
});

test('a stored transliteration still wins over the conversion', () => {
  assert.equal(pickTransliteration([tamil], ['ta', 'en'], IAST, SANSKRIT), 'சஞ்ஜய உவாச');
});

test('the first language in the chain with an answer decides', () => {
  // Telugu has nothing stored but can be converted, so it beats a stored Marathi behind it.
  assert.equal(pickTransliteration([marathi], ['te', 'mr', 'en'], IAST, SANSKRIT), 'సఞ్జయ ఉవాచ');
});

test('English and Devanagari readers keep the Roman text — nothing to convert into', () => {
  assert.equal(pickTransliteration([english], ['en'], IAST, SANSKRIT), IAST);
  assert.equal(pickTransliteration([english], ['hi', 'en'], IAST, SANSKRIT), IAST);
});

test('verse numbers and dandas come across too', () => {
  assert.equal(pickTransliteration([], ['kn', 'en'], IAST, 'तस्मात् ।\n॥३-४१॥'), 'ತಸ್ಮಾತ್ ।\n॥೩-೪೧॥');
});

test('without the Devanagari there is nothing to convert', () => {
  assert.equal(pickTransliteration([english], ['kn', 'en'], IAST), IAST);
  assert.equal(pickTransliteration([english], ['kn', 'en'], IAST, '   '), IAST);
});
