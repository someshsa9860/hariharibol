// What the admin verse routes accept as a verse's word-for-word (`wordMeanings`):
// `[{ word: string | null, meaning: string }]`, and nothing else. No database, no
// server — the schema is loaded on its own.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { wordMeaningsSchema } from '../utils/word-meanings-schema.js';

const accepts = (value) => wordMeaningsSchema.safeParse(value).success;

test('a list of word and meaning is accepted as it is', () => {
  const list = [
    { word: 'om', meaning: 'O my Lord' },
    { word: 'namah', meaning: 'offering my obeisances' },
  ];
  assert.deepEqual(wordMeaningsSchema.parse(list), list);
});

test('an empty list is accepted, and is how a verse is cleared', () => {
  assert.deepEqual(wordMeaningsSchema.parse([]), []);
});

test('a word the source did not split out is null', () => {
  assert.ok(accepts([{ word: null, meaning: 'crores (22,500,000)' }]));
});

test('both are trimmed', () => {
  assert.deepEqual(wordMeaningsSchema.parse([{ word: '  om ', meaning: ' O my Lord\n' }]), [
    { word: 'om', meaning: 'O my Lord' },
  ]);
});

test('Devanagari and diacritics pass through untouched', () => {
  const list = [{ word: 'dharma-kṣetre', meaning: 'in the place of pilgrimage' }, { word: 'धर्म', meaning: 'धर्म का' }];
  assert.deepEqual(wordMeaningsSchema.parse(list), list);
});

test('it must be a list', () => {
  for (const value of ['om — O my Lord', { word: 'om', meaning: 'O my Lord' }, null, 7]) {
    assert.equal(accepts(value), false, JSON.stringify(value));
  }
});

test('every entry needs a meaning, and a blank one does not count', () => {
  assert.equal(accepts([{ word: 'om' }]), false);
  assert.equal(accepts([{ word: 'om', meaning: '' }]), false);
  assert.equal(accepts([{ word: 'om', meaning: '   ' }]), false);
  assert.equal(accepts([{ word: 'om', meaning: null }]), false);
});

test('every entry names its word, even if the name is null', () => {
  assert.equal(accepts([{ meaning: 'O my Lord' }]), false);
  assert.equal(accepts([{ word: undefined, meaning: 'O my Lord' }]), false);
});

test('the unsplit { raw } blob the old importer wrote is refused', () => {
  assert.equal(accepts([{ raw: 'om—O my Lord; namah—offering my obeisances' }]), false);
});

test('a word or a meaning that is not text is refused', () => {
  assert.equal(accepts([{ word: 1, meaning: 'O my Lord' }]), false);
  assert.equal(accepts([{ word: 'om', meaning: 1 }]), false);
  assert.equal(accepts([{ word: ['om'], meaning: 'O my Lord' }]), false);
  assert.equal(accepts(['om']), false);
  assert.equal(accepts([null]), false);
});

test('an entry that carries a whole purport is refused', () => {
  assert.equal(accepts([{ word: 'om', meaning: 'x'.repeat(400) }]), true);
  assert.equal(accepts([{ word: 'om', meaning: 'x'.repeat(401) }]), false);
  assert.equal(accepts([{ word: 'x'.repeat(200), meaning: 'a' }]), true);
  assert.equal(accepts([{ word: 'x'.repeat(201), meaning: 'a' }]), false);
});

test('the longest verses in the books fit, a runaway list does not', () => {
  const entries = (n) => Array.from({ length: n }, (_, i) => ({ word: `w${i}`, meaning: `m${i}` }));
  assert.equal(accepts(entries(104)), true);
  assert.equal(accepts(entries(300)), true);
  assert.equal(accepts(entries(301)), false);
});

test('the refusal says which entry and which field', () => {
  const result = wordMeaningsSchema.safeParse([{ word: 'om', meaning: 'O my Lord' }, { word: 'namah', meaning: '' }]);
  assert.equal(result.success, false);
  assert.deepEqual(result.error.issues[0].path, [1, 'meaning']);
});
