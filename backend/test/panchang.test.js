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

// ── Parana: when the Ekadashi fast may be broken ────────────────────────────

// Parana windows from the individual Ekadashi pages of Drik Panchang for New Delhi
// (checked 2026-10-23), IST. Its times are to the minute and its sunrise is up to a
// minute later than the library's, so a minute or two either way is the same answer.
const PUBLISHED_PARANA = {
  '2026-10-23': ['06:27', '08:42'], // Papankusha
  '2026-06-26': ['05:25', '08:13'], // Nirjala
  '2026-07-26': ['05:39', '08:22'], // Devshayani
  '2026-07-11': ['13:50', '16:36'], // Yogini, first date: Hari Vasara outlasts the morning
  '2026-07-12': ['05:32', '08:18'], // Yogini, second date: Dwadashi over before sunrise
  '2026-08-24': ['13:41', '16:16'], // Shravana Putrada, first date
  '2026-11-21': ['13:11', '15:18'], // Prabodhini, first date
  '2026-11-22': ['06:49', '08:56'], // Prabodhini, second date
};
const paranas = year.festivals.filter((f) => f.kind === 'PARANA');
const minutesIst = (iso) => {
  const [h, m] = new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).split(':').map(Number);
  return h * 60 + m;
};
const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

test('parana windows match the published New Delhi times', () => {
  for (const [date, [from, to]] of Object.entries(PUBLISHED_PARANA)) {
    const row = paranas.find((p) => p.date === date);
    assert.ok(row, `no parana on ${date}`);
    assert.ok(Math.abs(minutesIst(row.details.startsAt) - minutesOf(from)) <= 2, `${row.name} ${date} starts ${minutesIst(row.details.startsAt)}`);
    assert.ok(Math.abs(minutesIst(row.details.endsAt) - minutesOf(to)) <= 2, `${row.name} ${date} ends ${minutesIst(row.details.endsAt)}`);
  }
});

test('every Ekadashi has a parana the morning after its fast, pushed that day only', () => {
  for (const eka of year.festivals.filter((f) => f.kind === 'EKADASHI')) {
    const name = eka.name.replace(' Ekadashi', '');
    const fasts = [...new Set([eka.date, eka.details.vaishnavaDate])];
    for (const fast of fasts) {
      const parana = paranas.find((p) => p.details.ekadashi === eka.name && p.details.fastDate === fast);
      if (!parana) {
        // only a fast kept at the very end of the previous year has its parana in the year before
        assert.ok(fast < '2026-01-01' || fast >= '2026-12-31', `${name} has no parana after ${fast}`);
        continue;
      }
      assert.equal(parana.date, addDays(fast, 1), name);
      assert.equal(parana.details.twoDates, fasts.length > 1, name);
      assert.equal(parana.notify, true);
      assert.deepEqual(parana.notifyDaysBefore, []);
    }
  }
});

test('a parana window is never inside Hari Vasara, never before sunrise, and ends within Dwadashi', () => {
  for (const p of paranas) {
    const d = p.details;
    const day = year.days.find((x) => x.date === p.date);
    const starts = new Date(d.startsAt).getTime();
    const ends = new Date(d.endsAt).getTime();
    assert.ok(starts < ends, `${p.name} ${p.date}: window is empty`);
    assert.ok(starts >= day.sunrise.getTime(), `${p.name} ${p.date}: opens before sunrise`);
    if (d.hariVasaraEndsAt) assert.ok(starts >= new Date(d.hariVasaraEndsAt).getTime(), `${p.name} ${p.date}: inside Hari Vasara`);
    // Dwadashi over before sunrise: the rule is simply "after sunrise", so there is no end to keep within.
    if (new Date(d.dwadashiEndsAt).getTime() > day.sunrise.getTime()) {
      assert.ok(ends <= new Date(d.dwadashiEndsAt).getTime(), `${p.name} ${p.date}: past Dwadashi`);
    }
    assert.ok(ends <= day.sunset.getTime(), `${p.name} ${p.date}: after sunset`);
  }
});

test('when the Smarta parana day is the Vaishnava fast day, the row says so', () => {
  const padmini = paranas.filter((p) => p.details.ekadashi === 'Padmini Ekadashi');
  assert.deepEqual(padmini.map((p) => [p.date, p.details.alsoFastToday]), [['2026-05-27', true], ['2026-05-28', false]]);
  assert.match(padmini[0].description, /^If you kept the fast the day before/);
  assert.match(paranas.find((p) => p.date === '2026-10-23').description, /^Break the fast between 6:2\d AM and 8:4\d AM \(New Delhi\)\.$/);
});
