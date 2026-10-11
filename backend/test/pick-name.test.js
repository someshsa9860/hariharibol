// Which name a mantra goes by for a reader: the first language in their reading
// chain that has one, with the mantra's own (English) name when none does. The
// rule that matters: English is the base column, so a chain that reaches it
// stops there. And the search that has to find that name once it is shown. No
// database — the functions are loaded on their own.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { mantraNameClauses, pickName } from '../utils/language.js';

const BASE = 'Hare Krishna Mahamantra';

const marathi = { languageCode: 'mr', name: 'हरे कृष्ण महामंत्र' };
const hindi = { languageCode: 'hi', name: 'हरे कृष्ण महामंत्र (हिन्दी)' };
const tamil = { languageCode: 'ta', name: 'ஹரே கிருஷ்ண மகாமந்திரம்' };
// The Sanskrit row carries the mantra's text and, always, no name.
const sanskrit = { languageCode: 'sa', name: null };

test('a Marathi reader gets the Marathi name', () => {
  assert.equal(pickName([sanskrit, marathi, hindi], ['mr', 'en'], BASE), marathi.name);
});

test('the order the rows come in does not matter', () => {
  assert.equal(pickName([hindi, marathi], ['mr', 'en'], BASE), marathi.name);
  assert.equal(pickName([marathi, hindi], ['mr', 'en'], BASE), marathi.name);
});

test('a reader whose language has no name gets the mantra’s own', () => {
  assert.equal(pickName([hindi, sanskrit], ['mr', 'en'], BASE), BASE);
});

test('the next language in the chain stands in before English does', () => {
  assert.equal(pickName([tamil, marathi], ['ta', 'mr', 'en'], BASE), tamil.name);
  assert.equal(pickName([marathi], ['ta', 'mr', 'en'], BASE), marathi.name);
});

test('someone who reads English is not given their app language’s name', () => {
  // Reading English with the app in Marathi: the chain is [en, mr].
  assert.equal(pickName([marathi], ['en', 'mr'], BASE), BASE);
});

test('a name written on the English row beats the mantra’s own', () => {
  const english = { languageCode: 'en', name: 'The Great Mantra' };
  assert.equal(pickName([english, marathi], ['en'], BASE), english.name);
  assert.equal(pickName([english], ['mr', 'en'], BASE), english.name);
});

test('a row with no name, or an empty one, is skipped, not returned', () => {
  assert.equal(pickName([{ languageCode: 'mr', name: null }, hindi], ['mr', 'hi', 'en'], BASE), hindi.name);
  assert.equal(pickName([{ languageCode: 'mr', name: '' }], ['mr', 'en'], BASE), BASE);
});

test('no rows at all leaves the mantra’s own name', () => {
  assert.equal(pickName([], ['mr', 'en'], BASE), BASE);
  assert.equal(pickName(undefined, ['mr', 'en'], BASE), BASE);
  assert.equal(pickName(null, ['en'], BASE), BASE);
});

test('a signed-out reader (English only) gets the mantra’s own name', () => {
  assert.equal(pickName([marathi, hindi], ['en'], BASE), BASE);
});

// ── searching for a name ────────────────────────────────────────────────────

const contains = (q) => ({ contains: q, mode: 'insensitive' });

test('a name search always matches the mantra’s own (English) name', () => {
  const [english] = mantraNameClauses('maha', ['mr', 'en']);
  assert.deepEqual(english, { name: contains('maha') });
});

test('and a translated name, in the languages the reader’s chain reads', () => {
  const [, translated] = mantraNameClauses('महामंत्र', ['mr', 'hi', 'en']);
  assert.deepEqual(translated, {
    translations: {
      some: { isPublished: true, languageCode: { in: ['mr', 'hi', 'en'] }, name: contains('महामंत्र') },
    },
  });
});

test('a name in a language the reader does not read is not searched', () => {
  const [, translated] = mantraNameClauses('x', ['mr', 'en']);
  assert.ok(!translated.translations.some.languageCode.in.includes('ta'));
});

test('only published translations count, so a draft name cannot surface a mantra', () => {
  const [, translated] = mantraNameClauses('x', ['en']);
  assert.equal(translated.translations.some.isPublished, true);
});
