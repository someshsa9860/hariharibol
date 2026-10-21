// Which rendering a verse opens with. The rule that matters: Dnyaneshwari's ovis
// (a poetic expansion) are never the default for a Marathi reader while a
// translation exists, and are still there to be picked from the compare sheet.
// No database — the function is loaded on its own.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { pickTranslation } from '../utils/language.js';

const ovi = { id: 'ovi', languageCode: 'mr', type: 'POETIC_EXPANSION', meaning: 'ओवी' };
const english = { id: 'en', languageCode: 'en', type: 'TRANSLATION', meaning: 'Dhritarashtra said' };
const marathi = { id: 'mr', languageCode: 'mr', type: 'TRANSLATION', meaning: 'धृतराष्ट्र म्हणाले' };
const hindi = { id: 'hi', languageCode: 'hi', type: 'TRANSLATION', meaning: 'धृतराष्ट्र ने कहा' };

test('a Marathi reader with no Marathi translation gets the next language, not the ovi', () => {
  assert.equal(pickTranslation([ovi, english], ['mr', 'en']).id, 'en');
});

test('the order the rows come in does not matter', () => {
  assert.equal(pickTranslation([english, ovi], ['mr', 'en']).id, 'en');
});

test('a Marathi translation beats the ovi in the same language', () => {
  assert.equal(pickTranslation([ovi, marathi, english], ['mr', 'en']).id, 'mr');
  assert.equal(pickTranslation([marathi, ovi, english], ['mr', 'en']).id, 'mr');
});

test('the ovi still stands in when it is all there is', () => {
  assert.equal(pickTranslation([ovi], ['mr', 'en']).id, 'ovi');
});

test('the reader’s own language still comes first among translations', () => {
  assert.equal(pickTranslation([english, hindi], ['hi', 'en']).id, 'hi');
  assert.equal(pickTranslation([english, hindi], ['en', 'hi']).id, 'en');
});

test('a reader who does not read Marathi is not affected', () => {
  assert.equal(pickTranslation([english], ['hi', 'en']).id, 'en');
});

test('rows that carry no type are chosen as before', () => {
  const rows = [
    { languageCode: 'hi', meaning: 'a' },
    { languageCode: 'en', meaning: 'b' },
  ];
  assert.equal(pickTranslation(rows, ['en', 'hi']).meaning, 'b');
});

test('nothing to choose from is null', () => {
  assert.equal(pickTranslation([], ['mr', 'en']), null);
  assert.equal(pickTranslation(undefined, ['mr', 'en']), null);
  assert.equal(pickTranslation([english], ['hi']), null);
});

test('word meanings follow the reading language, English being the fallback', async () => {
  const { pickWordMeanings } = await import('../utils/language.js');
  const en = [{ word: 'dharma', meaning: 'duty' }];
  const hi = [{ word: 'dharma', meaning: 'कर्तव्य' }];
  const rows = [{ languageCode: 'hi', wordMeanings: hi }, { languageCode: 'mr', wordMeanings: null }];
  assert.equal(pickWordMeanings(rows, ['hi', 'en'], en), hi);
  assert.equal(pickWordMeanings(rows, ['mr', 'en'], en), en);
  assert.equal(pickWordMeanings(rows, ['en', 'hi'], en), en);
});
