// A book call can name the reading languages itself (`?languages=mr,en`), and those
// win over the account's saved ones: the phone changes its language at once and
// tells the account a moment later, so without this the text ran one change behind.
// No database — the helpers are loaded on their own.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { fromQuery, withReadingLanguages, readingChain } from '../utils/language.js';

test('a list of codes is read in the order given', () => {
  assert.deepEqual(fromQuery('mr,en'), ['mr', 'en']);
  assert.deepEqual(fromQuery('hi,en,mr'), ['hi', 'en', 'mr']);
});

test('case and spaces do not matter, a repeat is dropped, three is the most', () => {
  assert.deepEqual(fromQuery(' MR , en '), ['mr', 'en']);
  assert.deepEqual(fromQuery('en,en,hi'), ['en', 'hi']);
  assert.deepEqual(fromQuery('a,b,c,d,e'), ['a', 'b', 'c']);
});

test('nothing usable is an empty list', () => {
  assert.deepEqual(fromQuery(undefined), []);
  assert.deepEqual(fromQuery(''), []);
  assert.deepEqual(fromQuery(','), []);
});

test('the named languages beat the account’s', () => {
  const account = { id: 'u1', readingLanguage: 'hi', appLanguage: 'en' };
  const reader = withReadingLanguages(account, ['mr', 'en']);
  assert.deepEqual(readingChain(reader), ['mr', 'en']);
  // The account itself is left alone, and is still the one whose favourites are read.
  assert.equal(reader.id, 'u1');
  assert.equal(account.readingLanguage, 'hi');
});

test('the app language comes after the reading one, then English', () => {
  const reader = withReadingLanguages({ id: 'u1' }, ['mr', 'hi']);
  assert.deepEqual(readingChain(reader), ['mr', 'hi', 'en']);
});

test('one named language leaves the app language out, not at the account’s', () => {
  const account = { id: 'u1', readingLanguage: 'hi', appLanguage: 'ta' };
  assert.deepEqual(readingChain(withReadingLanguages(account, ['mr'])), ['mr', 'en']);
});

test('a signed-out caller can name languages too', () => {
  assert.deepEqual(readingChain(withReadingLanguages(null, ['mr', 'en'])), ['mr', 'en']);
  assert.deepEqual(readingChain(withReadingLanguages(undefined, ['bn'])), ['bn', 'en']);
});

test('naming none leaves the account’s languages — and a signed-out caller — as they were', () => {
  const account = { id: 'u1', readingLanguage: 'hi', appLanguage: 'en' };
  assert.equal(withReadingLanguages(account, []), account);
  assert.equal(withReadingLanguages(null, []), null);
  assert.deepEqual(readingChain(withReadingLanguages(null, [])), ['en']);
});
