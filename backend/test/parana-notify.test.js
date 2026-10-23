// The words of the parana push (the morning after an Ekadashi fast), in the reader's language.
// No database or Redis: `message` only reads the festival row it is given.
//
//   node --test test/parana-notify.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { clockTime } from '../utils/date.js';
import { message } from '../utils/festival-message.js';

const parana = (details = {}) => ({
  kind: 'PARANA',
  name: 'Papankusha Ekadashi parana',
  description: 'Break the fast between 6:26 AM and 8:42 AM (New Delhi).',
  paksha: 'SHUKLA',
  date: new Date('2026-10-23T00:00:00.000Z'),
  details: {
    ekadashi: 'Papankusha Ekadashi',
    startsAt: '2026-10-23T00:56:00.000Z', // 06:26 IST
    endsAt: '2026-10-23T03:12:00.000Z', // 08:42 IST
    place: 'New Delhi',
    timezone: 'Asia/Kolkata',
    twoDates: false,
    alsoFastToday: false,
    ...details,
  },
});

test('a parana push states the window and the place, in English', () => {
  const { title, body } = message(parana(), 0, ['en']);
  assert.equal(title, 'Fast-breaking time: 6:26 AM to 8:42 AM');
  assert.equal(body, 'Break your Papankusha Ekadashi fast today, between 6:26 AM and 8:42 AM (New Delhi time).');
});

test('with two dates for the Ekadashi it says "if you kept the fast yesterday" and never tells anyone to break', () => {
  const { body } = message(parana({ twoDates: true }), 0, ['en']);
  assert.equal(body, 'If you kept the Papankusha Ekadashi fast yesterday, break it today, between 6:26 AM and 8:42 AM (New Delhi time).');
  const both = message(parana({ twoDates: true, alsoFastToday: true }), 0, ['en']).body;
  assert.match(both, /Keeping the fast today instead\? Break it tomorrow\.$/);
});

test('the times are written in the reader\'s language and script', () => {
  const marathi = message(parana(), 0, ['mr', 'en']);
  assert.match(marathi.title, /६:२६/);
  assert.match(marathi.body, /६:२६/);
  const hindi = message(parana(), 0, ['hi', 'en']);
  assert.ok(hindi.title.startsWith('पारण का समय'));
  assert.match(hindi.body, /New Delhi/);
});

test('the clock is the calendar place\'s, not the server\'s, and unknown languages fall back to English', () => {
  const at = new Date('2026-10-23T00:56:00.000Z');
  assert.equal(clockTime(at, ['en'], 'Asia/Kolkata'), '6:26 AM');
  assert.equal(clockTime(at, ['en'], 'UTC'), '12:56 AM');
  assert.equal(clockTime(at, ['xx'], 'Asia/Kolkata').toUpperCase(), '6:26 AM');
});

test('a parana row without its times, or a heads-up before the day, reads like any festival', () => {
  const plain = message({ ...parana(), details: null }, 0, ['en']);
  assert.equal(plain.title, 'Papankusha Ekadashi parana today');
  assert.equal(plain.body, 'Break the fast between 6:26 AM and 8:42 AM (New Delhi).');
  assert.equal(message(parana(), 1, ['en']).title, 'Papankusha Ekadashi parana tomorrow');
});
