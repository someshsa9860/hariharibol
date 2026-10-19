import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  Vocabulary,
  excerpt,
  fold,
  interpret,
  isVerseNumber,
  parseBookTag,
  soundKey,
  words,
} from '../utils/search-query.js';

const vocab = new Vocabulary(
  [
    ['kṛṣṇa', 90], ['bhagavān', 60], ['bhagavad', 40], ['dharma', 80], ['dharmakṣetre', 20],
    ['kurukṣetre', 20], ['karmaṇy', 5], ['arjuna', 70], ['uvāca', 70], ['śrī', 50],
    ['surrender', 30], ['soul', 25], ['eternal', 25], ['lord', 99], ['karma', 80],
  ].map(([word, n]) => ({ word, n }))
);

const books = [
  { id: 'bg', bookNumber: 1, slug: 'bhagavad-gita', title: 'Bhagavad Gita' },
  { id: 'sb', bookNumber: 2, slug: 'srimad-bhagavatam', title: 'Srimad Bhagavatam' },
];

test('fold and soundKey make Roman spellings of one word equal', () => {
  assert.equal(fold('Kṛṣṇa'), 'krisna');
  assert.equal(soundKey('krishna'), soundKey('kṛṣṇa'));
  assert.equal(soundKey('krsna'), soundKey('Krishna'));
  assert.equal(soundKey('bhagwad'), soundKey('bhagvad'));
  assert.equal(soundKey('geeta'), soundKey('gita'));
});

test('words splits on spaces and punctuation', () => {
  assert.deepEqual(words('Bhagavad-gita, 2.47'), ['Bhagavad', 'gita', '2', '47']);
});

test('a typed word finds the stored spelling by sound', () => {
  const found = vocab.lookup('krishna');
  assert.ok(found.exact.includes('kṛṣṇa'));
});

test('a typo finds the nearest word', () => {
  const found = vocab.lookup('dharmma');
  assert.ok([...found.exact, ...found.near].includes('dharma'));
  const nearly = vocab.lookup('suurender');
  assert.ok(nearly.variants.includes('surrender'));
});

test('the word being typed also matches longer words', () => {
  const found = vocab.lookup('surr', { prefix: true });
  assert.ok(found.prefix.includes('surrender'));
});

test('interpret says what it read a misspelt query as, and nothing for a right one', () => {
  const wrong = interpret('surrendr soal', vocab);
  assert.equal(wrong.corrected, 'surrender soul');

  const right = interpret('eternal soul', vocab);
  assert.equal(right.corrected, null);
});

test('interpret fixes spacing: joined and split words', () => {
  const joined = interpret('dharma kshetre', vocab);
  assert.equal(joined.terms.length, 1);
  assert.ok(joined.terms[0].variants.includes('dharmakṣetre'));

  const split = interpret('arjunauvaca', vocab);
  assert.equal(split.terms.length, 2);
  assert.ok(split.terms[1].variants.includes('uvāca'));
});

test('a book named at the start of the query is taken off it', () => {
  assert.deepEqual(parseBookTag('gita karma', books), { book: books[0], text: 'karma' });
  assert.equal(parseBookTag('bhagvat gita surrender', books).book.slug, 'bhagavad-gita');
  assert.equal(parseBookTag('bhagwatam eternal soul', books).book.slug, 'srimad-bhagavatam');
  assert.equal(parseBookTag('sb lord', books).book.slug, 'srimad-bhagavatam');
  assert.equal(parseBookTag('geeta karma', books).book.slug, 'bhagavad-gita');
});

test('ordinary queries and a bare book name are not a book tag', () => {
  assert.equal(parseBookTag('surrender', books).book, null);
  assert.equal(parseBookTag('eternal soul', books).book, null);
  assert.equal(parseBookTag('gita', books).book, null);
});

test('a book name stops at the first number', () => {
  assert.deepEqual(parseBookTag('gita 2.47', books), { book: books[0], text: '2 47' });
  assert.deepEqual(parseBookTag('sb 1.3.28', books), { book: books[1], text: '1 3 28' });
});

test('verse numbers', () => {
  assert.ok(isVerseNumber('2.47'));
  assert.ok(isVerseNumber('1.3.28'));
  assert.ok(!isVerseNumber('karma 2'));
});

test('excerpt brackets the match and keeps the passage short', () => {
  const text = 'You have a right to perform your prescribed duty, but you are not entitled to the fruits of action.';
  const out = excerpt(text, [{ variants: ['fruits'] }], { radius: 20 });
  assert.match(out, /\[fruits\]/);
  assert.ok(out.length < text.length);
  assert.equal(excerpt('nothing here', [{ variants: ['zzz'] }]), null);
});
