// The server's own words in the person's language — error messages and the
// daily sloka's title. No database; the modules load on their own.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  catalog,
  translateError,
  notice,
  hariBol,
  greeted,
  greetedTitle,
  slokaTitle,
  slokaFallback,
  slokaReason,
  NOTICES,
} from '../utils/messages.js';
import { notFound, badRequest, tooMany, AppError } from '../utils/errors.js';
import { requestChain } from '../utils/language.js';
import { slokaPush } from '../utils/sloka-push.js';
import { recipientOf } from '../utils/recipient.js';

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
  assert.equal(hi.title, 'हरि बोल — आज का आपका श्लोक');
  assert.match(hi.body, /भगवद्गीता 2\.47$/);
  const en = slokaPush({ verse, user: { readingLanguage: 'en', appLanguage: 'hi' } });
  assert.equal(en.title, 'Hari Bol — Your sloka for today');
  assert.match(en.body, /Bhagavad Gita 2\.47$/);
});

test('a push to a named reader opens "Hari Bol <first name>" in their script', () => {
  const verse = {
    verseId: '1.2.47',
    sanskrit: 'कर्मण्येवाधिकारस्ते',
    chapterNumber: 2,
    verseNumber: 47,
    book: { slug: 'bhagavad-gita', title: 'Bhagavad Gita' },
    translations: [],
  };
  const named = slokaPush({ verse, user: { name: 'Somesh Sharma', readingLanguage: 'hi' } });
  assert.equal(named.title, 'हरि बोल Somesh — आज का आपका श्लोक');
  assert.equal(slokaPush({ verse, user: { name: 'Somesh Sharma', readingLanguage: 'en' } }).title, 'Hari Bol Somesh — Your sloka for today');
});

test('the greeting is "Hari Bol" and never "Hi" or "Dear", with or without a name', () => {
  assert.equal(hariBol('Somesh', ['en']), 'Hari Bol Somesh');
  assert.equal(hariBol(null, ['en']), 'Hari Bol');
  assert.equal(hariBol('Somesh', ['mr', 'en']), `${catalog.mr.hariBol} Somesh`);
  assert.equal(greeted('Somesh', ['en'], '3 rounds left today.'), 'Hari Bol Somesh, 3 rounds left today.');
  assert.equal(greetedTitle(null, ['en'], 'Time to chant'), 'Hari Bol — Time to chant');
  for (const id of Object.keys(NOTICES)) {
    for (const code of ['en', ...LANGUAGES]) {
      assert.doesNotMatch(notice(id, [code], ['x', 'y', 'z']), /^(hi|dear)\b/i, `${code}.${id}`);
    }
  }
});

test('every notification wording exists in every language with its placeholders', () => {
  for (const [id, english] of Object.entries(NOTICES)) {
    for (const code of LANGUAGES) {
      assert.ok(catalog[code][id], `${code}.${id} is missing`);
      assert.equal(placeholders(catalog[code][id]), placeholders(english), `${code}.${id} placeholders`);
    }
  }
});

test('a notice follows the chain and falls back to English', () => {
  assert.equal(notice('chantTitle', ['en']), 'Time to chant');
  assert.equal(notice('chantTitle', ['xx', 'en']), 'Time to chant');
  assert.equal(notice('chantRoundsLeft', ['en'], [3]), '3 rounds left today.');
  assert.match(notice('chantRoundsLeft', ['hi', 'en'], [3]), /3/);
  assert.notEqual(notice('chantTitle', ['hi', 'en']), 'Time to chant');
  assert.equal(notice('festivalInDays', ['en'], ['Ekadashi', 2]), 'Ekadashi in 2 days');
});

test('the person a push is for: first name only, in their app language', () => {
  assert.deepEqual(recipientOf({ name: 'Somesh Sharma', appLanguage: 'mr' }), { name: 'Somesh', chain: ['mr', 'en'] });
  assert.deepEqual(recipientOf({ name: '  ', appLanguage: null }), { name: null, chain: ['en'] });
  assert.deepEqual(recipientOf(null), { name: null, chain: ['en'] });
});

test('errors that used to go out in English are worded in the reader\'s language', () => {
  const messages = [
    'Invalid access token',
    'Ask Sakha is not part of your plan yet.',
    'Please wait for the current reply to finish',
    'No longer available',
    'That purchase belongs to another account',
    'This link is not available',
    'Already exists: email',
    'An account already exists for this email. Please sign in with Google.',
    'Please keep a message under 2000 characters.',
  ];
  for (const message of messages) {
    const translated = translateError({ message, code: 'BAD_REQUEST' }, ['hi', 'en']);
    assert.notEqual(translated, message, message);
  }
  assert.match(translateError({ message: 'Please keep a message under 2000 characters.', code: 'BAD_REQUEST' }, ['hi', 'en']), /2000/);
  assert.match(translateError({ message: 'An account already exists for this email. Please sign in with Google.', code: 'CONFLICT' }, ['hi', 'en']), /Google/);
});
