// The panchang engine against published 2026 almanacs. No database.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildYear } from '../services/festivals.js';
import { LOCATIONS, panchangFor, addDays, weekdayOf } from '../services/panchang.js';

const delhi = LOCATIONS['new-delhi'];
const year = buildYear(2026, delhi);
const on = (slug) => year.festivals.filter((f) => f.slug === slug).map((f) => f.date);

// New Delhi dates from Drik Panchang's Ekadashi list for 2026 (checked 2026-10-21); the
// three it or ISKCON print a day apart (Mar 14/15, Aug 8/9, Oct 21/22) are left out.
const PUBLISHED_EKADASHI = {
  'Shattila Ekadashi': '2026-01-14',
  'Jaya Ekadashi': '2026-01-29',
  'Vijaya Ekadashi': '2026-02-13',
  'Amalaki Ekadashi': '2026-02-27',
  'Kamada Ekadashi': '2026-03-29',
  'Varuthini Ekadashi': '2026-04-13',
  'Mohini Ekadashi': '2026-04-27',
  'Nirjala Ekadashi': '2026-06-25',
  'Devshayani Ekadashi': '2026-07-25',
  'Aja Ekadashi': '2026-09-07',
  'Parivartini Ekadashi': '2026-09-22',
  'Indira Ekadashi': '2026-10-06',
  'Rama Ekadashi': '2026-11-05',
  'Utpanna Ekadashi': '2026-12-04',
  'Mokshada Ekadashi': '2026-12-20',
};

test('Ekadashi dates match the published list', () => {
  const found = Object.fromEntries(year.festivals.filter((f) => f.kind === 'EKADASHI').map((f) => [f.name, f.date]));
  for (const [name, date] of Object.entries(PUBLISHED_EKADASHI)) assert.equal(found[name], date, name);
});

test('the year holds 24 Ekadashis, two of them in the adhika month', () => {
  const eka = year.festivals.filter((f) => f.kind === 'EKADASHI');
  assert.equal(eka.length, 24);
  assert.deepEqual(eka.filter((f) => /^Adhika/.test(f.month)).map((f) => f.name), ['Padmini Ekadashi', 'Parama Ekadashi']);
});

test('every Ekadashi day has the Ekadashi tithi (or the one around it)', () => {
  for (const f of year.festivals.filter((x) => x.kind === 'EKADASHI')) {
    const day = year.days.find((d) => d.date === f.date);
    assert.ok([10, 11, 25, 26].includes(day.tithiNumber), `${f.name} ${f.date} tithi ${day.tithiNumber}`);
  }
});

test('named festivals fall on their published 2026 dates', () => {
  assert.deepEqual(on('maha-shivaratri'), ['2026-02-15']);
  assert.deepEqual(on('rama-navami'), ['2026-03-26']);
  assert.deepEqual(on('janmashtami'), ['2026-09-04']);
  assert.deepEqual(on('ganesh-chaturthi'), ['2026-09-14']);
  assert.deepEqual(on('vijayadashami'), ['2026-10-20']);
  assert.deepEqual(on('diwali'), ['2026-11-08']);
  assert.deepEqual(on('sankranti-makara'), ['2026-01-14']);
});

test('a Chaturthi each fortnight except Bhadrapada\'s, which is Ganesh Chaturthi', () => {
  assert.equal(on('sankashti-chaturthi').length, 13); // 2026 begins and ends mid-lunation
  assert.equal(on('vinayaka-chaturthi').length, 11);
});

test('a year has 365 days, weekdays follow the dates, and the samvat turns in spring', () => {
  assert.equal(year.days.length, 365);
  for (const d of year.days) assert.equal(d.weekday, weekdayOf(d.date));
  assert.equal(year.days[0].vikramSamvat, 2082);
  assert.equal(year.days.at(-1).vikramSamvat, 2083);
});

test('one day, read whole', () => {
  const d = panchangFor('2026-01-14', delhi);
  assert.equal(d.tithiName, 'Ekadashi');
  assert.equal(d.paksha, 'KRISHNA');
  assert.equal(d.monthAmanta, 'Pausha');
  assert.equal(d.monthPurnimanta, 'Pausha'.replace('Pausha', 'Magha'));
  assert.equal(d.sunrise.toISOString().slice(0, 13), '2026-01-14T01'); // about 07:15 IST
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
