// The server's own words in the person's language — error messages and the
// daily sloka's title. No database; the modules load on their own.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { catalog, translateError, slokaTitle, slokaFallback, slokaReason } from '../utils/messages.js';
import { notFound, badRequest, tooMany, AppError } from '../utils/errors.js';
import { requestChain } from '../utils/language.js';
import { slokaPush } from '../utils/sloka-push.js';

const LANGUAGES = ['as', 'bn', 'gu', 'hi', 'kn', 'ml', 'mr', 'or', 'pa', 'ta', 'te'];
const placeholders = (text) => [...text.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort().join();

test('every language has the same messages, with the same placeholders', () => {
  assert.deepEqual(Object.keys(catalog).sort(), LANGUAGES);
  const reference = catalog.hi;
  for (const code of LANGUAGES) {
    assert.deepEqual(Object.keys(catalog[code]).sort(), Object.keys(reference).sort(), `${code} keys`);
    for (const [id, text] of Object.entries(catalog[code])) {
      assert.ok(text.trim(), `${code}.${id} is empty`);
      assert.equal(placeholders(text), placeholders(reference[id]), `${code}.${id} placeholders`);
    }
  }
});

test('an error is worded in the first language of the chain that has it', () => {
  const err = notFound('Verse');
  assert.match(translateError(err, ['hi', 'en']), /नहीं मिला/);
  assert.equal(translateError(err, ['en']), 'Verse not found');
  assert.equal(translateError(err, ['xx', 'en']), 'Verse not found');
  assert.match(translateError(err, ['xx', 'ta', 'en']), /கிடைக்கவில்லை/);
});

test('a message with a value keeps the value', () => {
  assert.match(translateError(badRequest('Incorrect code. 3 attempts left.'), ['hi']), /3/);
  assert.match(translateError(badRequest('The smallest donation is 10 INR'), ['mr']), /10 INR/);
});

test('a message nobody wrote an entry for goes out in English', () => {
  const err = badRequest('Unknown upload kind: zip');
  assert.equal(translateError(err, ['hi']), 'Unknown upload kind: zip');
});

test('a dependency failing is told by its code', () => {
  const err = new AppError(503, 'PAYMENTS_UNAVAILABLE', 'Razorpay is not configured');
  assert.equal(translateError(err, ['en']), 'Razorpay is not configured');
  assert.notEqual(translateError(err, ['hi']), 'Razorpay is not configured');
  assert.match(translateError(tooMany(), ['hi']), /अनुरोध/);
});

test('the language of a request: signed-in app language, then the header, then English', () => {
  assert.deepEqual(requestChain({ auth: { user: { appLanguage: 'ta' } }, acceptLanguage: 'hi' }), ['ta', 'hi', 'en']);
  assert.deepEqual(requestChain({ acceptLanguage: 'hi' }), ['hi', 'en']);
  assert.deepEqual(requestChain({ auth: { user: null } }), ['en']);
});

test('the sloka title, fallback and reason follow the chain', () => {
  assert.equal(slokaTitle(['en']), 'Your sloka for today');
  assert.equal(slokaTitle(['hi', 'en']), 'आज का आपका श्लोक');
  assert.equal(slokaFallback(['xx', 'en']), 'A verse chosen for you.');
  assert.equal(slokaReason('anger', ['en']), 'Because you mentioned anger');
  assert.match(slokaReason('क्रोध', ['hi', 'en']), /क्रोध/);
});

test('the push is titled, and its book named, in the reading language', () => {
  const verse = {
    verseId: '1.2.47',
    sanskrit: 'कर्मण्येवाधिकारस्ते',
    cantoNumber: null,
    chapterNumber: 2,
    verseNumber: 47,
    verseNumberEnd: null,
    book: { slug: 'bhagavad-gita', title: 'Bhagavad Gita', titleI18n: { hi: 'भगवद्गीता' } },
    translations: [],
  };
  const hi = slokaPush({ verse, user: { readingLanguage: 'hi', appLanguage: 'en' } });
  assert.equal(hi.title, 'आज का आपका श्लोक');
  assert.match(hi.body, /भगवद्गीता 2\.47$/);
  const en = slokaPush({ verse, user: { readingLanguage: 'en', appLanguage: 'hi' } });
  assert.equal(en.title, 'Your sloka for today');
  assert.match(en.body, /Bhagavad Gita 2\.47$/);
});
