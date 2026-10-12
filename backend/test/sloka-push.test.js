// What the daily sloka push says. No database — the function is loaded on its own.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { slokaPush, verseLabel } from '../utils/sloka-push.js';

const gita = {
  verseId: '1.2.47',
  sanskrit: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन ।',
  transliteration: 'karmaṇy evādhikāras te mā phaleṣu kadācana',
  cantoNumber: null,
  chapterNumber: 2,
  verseNumber: 47,
  verseNumberEnd: null,
  book: { slug: 'bhagavad-gita', title: 'Bhagavad Gita' },
  translations: [
    { languageCode: 'en', type: 'TRANSLATION', meaning: 'You have a right to your actions, never to their fruits.' },
    { languageCode: 'hi', type: 'TRANSLATION', meaning: 'तुम्हारा अधिकार कर्म पर है, फल पर नहीं।' },
  ],
};

test('the body is the verse, then its meaning, then where it comes from', () => {
  const { body } = slokaPush({ verse: gita, user: { readingLanguage: 'en', appLanguage: 'en' } });
  assert.equal(
    body,
    [
      'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन ।',
      'You have a right to your actions, never to their fruits.',
      'Bhagavad Gita 2.47',
    ].join('\n\n')
  );
});

test("the meaning is in the language this person reads", () => {
  const { body } = slokaPush({ verse: gita, user: { readingLanguage: 'hi', appLanguage: 'en' } });
  assert.match(body, /तुम्हारा अधिकार कर्म पर है/);
  assert.doesNotMatch(body, /right to your actions/);
});

test('a language with no rendering falls back along the chain to English', () => {
  const { body } = slokaPush({ verse: gita, user: { readingLanguage: 'ta', appLanguage: 'en' } });
  assert.match(body, /right to your actions/);
});

test('no Sanskrit falls back to the transliteration', () => {
  const { body } = slokaPush({ verse: { ...gita, sanskrit: null }, user: null });
  assert.ok(body.startsWith('karmaṇy evādhikāras te'));
});

test('a verse with no text at all still has a body', () => {
  const bare = { ...gita, sanskrit: null, transliteration: null, translations: [] };
  assert.equal(slokaPush({ verse: bare, user: null }).body, 'A verse chosen for you.');
});

test('a long meaning is cut, the verse and its reference are kept', () => {
  const long = { ...gita, translations: [{ languageCode: 'en', type: 'TRANSLATION', meaning: 'word '.repeat(200) }] };
  const { body } = slokaPush({ verse: long, user: null });
  const [verse, meaning, reference] = body.split('\n\n');
  assert.equal(verse, gita.sanskrit);
  assert.ok(meaning.length <= 221 && meaning.endsWith('…'));
  assert.equal(reference, 'Bhagavad Gita 2.47');
});

test("the data carries the verse's place so a tap needs no lookup", () => {
  const { data } = slokaPush({ verse: gita, user: null });
  assert.deepEqual(data, {
    deeplink: 'hariharibol://sloka/1.2.47',
    verseId: '1.2.47',
    bookSlug: 'bhagavad-gita',
    cantoNumber: null,
    chapterNumber: 2,
    verseNumber: 47,
  });
});

test('a Bhagavatam verse is cited with its canto, and a compound verse with its range', () => {
  const sb = {
    ...gita,
    verseId: '2.10.1.5',
    cantoNumber: 10,
    chapterNumber: 1,
    verseNumber: 5,
    verseNumberEnd: 7,
    book: { slug: 'srimad-bhagavatam', title: 'Srimad Bhagavatam' },
  };
  assert.equal(verseLabel(sb), 'Srimad Bhagavatam 10.1.5-7');
});
