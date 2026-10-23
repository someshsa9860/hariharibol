// A year of panchang rows and festivals for one place, from services/panchang.js.
//
// Pure: no database, no clock. `scripts/seed-panchang.js` saves what this returns and
// `jobs/processors/festival-notify.js` reads what was saved.
//
// Each festival is a rule — an amanta month, a tithi, and the time of day the tithi has
// to be running at (the tithi at sunrise is not what most festivals follow). Where the
// tithi is running at that time on two days the first is taken; where it runs on neither
// (a skipped tithi) the day it falls inside is taken. Ekadashi is the exception: it is
// the day the tithi is running at sunrise, and the Vaishnava date, which can be a day
// later, is carried beside it (`details.vaishnavaDate`).

import { panchangFor, newMoonsAround, lunationOf, addDays, localMidnight, tithiAt, signIndexAt, SIGNS } from './panchang.js';
import { paranaWindow } from './parana.js';

const MINUTE = 60000;
const DAY = 86400000;

// Where in the day a festival's tithi is looked for.
const ANCHORS = {
  sunrise: (d) => d.sunrise,
  midday: (d) => new Date(d.sunrise.getTime() + (d.sunset - d.sunrise) * 0.5),
  aparahna: (d) => new Date(d.sunrise.getTime() + (d.sunset - d.sunrise) * 0.7),
  sunset: (d) => new Date(d.sunset.getTime() - 5 * MINUTE),
  pradosh: (d) => new Date(d.sunset.getTime() + 40 * MINUTE),
  nishita: (d) => new Date(d.sunset.getTime() + (d.nextSunrise - d.sunset) / 2),
  moonrise: (d) => d.moonrise,
};

// ── The rules ──────────────────────────────────────────────────────────────

// [slug, name, amanta month, paksha S|K, tithi 1–15 (15 = Purnima/Amavasya), anchor, kind]
const FESTIVAL_RULES = [
  ['vasant-panchami', 'Vasant Panchami', 'Magha', 'S', 5, 'midday', 'FESTIVAL'],
  ['maha-shivaratri', 'Maha Shivaratri', 'Magha', 'K', 14, 'nishita', 'FESTIVAL'],
  ['rama-navami', 'Rama Navami', 'Chaitra', 'S', 9, 'midday', 'FESTIVAL'],
  ['hanuman-jayanti', 'Hanuman Jayanti', 'Chaitra', 'S', 15, 'sunrise', 'FESTIVAL'],
  ['akshaya-tritiya', 'Akshaya Tritiya', 'Vaishakha', 'S', 3, 'sunrise', 'FESTIVAL'],
  ['narasimha-chaturdashi', 'Narasimha Chaturdashi', 'Vaishakha', 'S', 14, 'sunset', 'FESTIVAL'],
  ['rath-yatra', 'Jagannath Rath Yatra', 'Ashadha', 'S', 2, 'sunrise', 'FESTIVAL'],
  ['guru-purnima', 'Guru Purnima', 'Ashadha', 'S', 15, 'sunrise', 'FESTIVAL'],
  ['janmashtami', 'Krishna Janmashtami', 'Shravana', 'K', 8, 'nishita', 'FESTIVAL'],
  ['ganesh-chaturthi', 'Ganesh Chaturthi', 'Bhadrapada', 'S', 4, 'midday', 'CHATURTHI'],
  ['radhashtami', 'Radhashtami', 'Bhadrapada', 'S', 8, 'midday', 'FESTIVAL'],
  ['vamana-dwadashi', 'Vamana Dwadashi', 'Bhadrapada', 'S', 12, 'sunrise', 'FESTIVAL'],
  ['anant-chaturdashi', 'Anant Chaturdashi', 'Bhadrapada', 'S', 14, 'sunrise', 'FESTIVAL'],
  ['navaratri-begins', 'Sharad Navaratri begins', 'Ashwin', 'S', 1, 'sunrise', 'FESTIVAL'],
  ['durga-ashtami', 'Durga Ashtami', 'Ashwin', 'S', 8, 'sunrise', 'FESTIVAL'],
  ['vijayadashami', 'Vijayadashami (Dussehra)', 'Ashwin', 'S', 10, 'aparahna', 'FESTIVAL'],
  ['sharad-purnima', 'Sharad Purnima', 'Ashwin', 'S', 15, 'pradosh', 'FESTIVAL'],
  ['dhanteras', 'Dhanteras', 'Ashwin', 'K', 13, 'pradosh', 'FESTIVAL'],
  ['naraka-chaturdashi', 'Naraka Chaturdashi', 'Ashwin', 'K', 14, 'sunrise', 'FESTIVAL'],
  ['diwali', 'Diwali (Lakshmi Puja)', 'Ashwin', 'K', 15, 'pradosh', 'FESTIVAL'],
  ['govardhan-puja', 'Govardhan Puja', 'Kartika', 'S', 1, 'sunrise', 'FESTIVAL'],
  ['tulsi-vivah', 'Tulsi Vivah', 'Kartika', 'S', 12, 'sunrise', 'FESTIVAL'],
  ['kartika-purnima', 'Kartika Purnima (Dev Diwali)', 'Kartika', 'S', 15, 'pradosh', 'FESTIVAL'],
  ['gita-jayanti', 'Gita Jayanti', 'Margashirsha', 'S', 11, 'sunrise', 'FESTIVAL'],
  ['datta-jayanti', 'Datta Jayanti', 'Margashirsha', 'S', 15, 'pradosh', 'FESTIVAL'],
];

// Festivals the push goes out for by default; the rest are in the calendar only.
const NOTIFY_KINDS = new Set(['EKADASHI', 'CHATURTHI', 'PURNIMA', 'AMAVASYA', 'FESTIVAL', 'PARANA']);

// Kinds that go out on their own day only, with no "tomorrow" heads-up (the Ekadashi push the
// day before is the heads-up for the fast, and a parana time is of no use a day early).
const SAME_DAY_KINDS = new Set(['PARANA']);

// "6:26 AM" at the calendar's place, for the English description kept on a parana row.
function clock(date, timezone) {
  return date
    .toLocaleTimeString('en-IN', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true })
    .toUpperCase();
}

// Ekadashi names by amanta month (the month the dark half is counted in, not the purnimanta
// month printed calendars of North India use): [krishna, shukla].
const EKADASHI_NAMES = {
  Chaitra: ['Varuthini', 'Kamada'],
  Vaishakha: ['Apara', 'Mohini'],
  Jyeshtha: ['Yogini', 'Nirjala'],
  Ashadha: ['Kamika', 'Devshayani'],
  Shravana: ['Aja', 'Shravana Putrada'],
  Bhadrapada: ['Indira', 'Parivartini'],
  Ashwin: ['Rama', 'Papankusha'],
  Kartika: ['Utpanna', 'Prabodhini'],
  Margashirsha: ['Saphala', 'Mokshada'],
  Pausha: ['Shattila', 'Pausha Putrada'],
  Magha: ['Vijaya', 'Jaya'],
  Phalguna: ['Papamochani', 'Amalaki'],
};
const ADHIKA_EKADASHI_NAMES = ['Parama', 'Padmini']; // [krishna, shukla]

// ── Building a year ────────────────────────────────────────────────────────

/**
 * Panchang rows and festivals for every day of `year` at `location`.
 * Days a fortnight either side are worked out too, so a lunation cut by the year's
 * edge is still read whole; only dates inside the year are returned.
 */
function buildYear(year, location) {
  const first = `${year}-01-01`;
  const last = `${year}-12-31`;
  const from = addDays(first, -16);
  const to = addDays(last, 16);

  const newMoons = newMoonsAround(localMidnight(from, location.timezone), localMidnight(to, location.timezone));

  const days = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    days.push({ date, ...panchangFor(date, location, newMoons) });
  }
  for (let i = 0; i < days.length; i += 1) {
    const d = days[i];
    d.nextSunrise = days[i + 1]?.sunrise ?? new Date(d.sunrise.getTime() + DAY);
  }
  for (const d of days) {
    for (const [name, at] of Object.entries(ANCHORS)) {
      if (name === 'sunrise') continue;
      const when = at(d);
      d[`at_${name}`] = when ? { tithi: tithiAt(when), lunation: lunationOf(newMoons, when) } : null;
    }
    d.at_sunrise = { tithi: d.tithiNumber, lunation: lunationOf(newMoons, d.sunrise) };
  }

  const inYear = (date) => date >= first && date <= last;
  const festivals = [];
  const push = (f) => {
    if (inYear(f.date)) festivals.push(f);
  };
  const lunationIds = [...new Set(days.map((d) => d.at_sunrise.lunation.index))];

  // The days of one lunation on which tithi `n` is running at `anchor`; if none, the
  // days it runs at any of the daytime anchors; if still none, the day it begins in.
  function daysFor(lunationIndex, n, anchor) {
    const key = `at_${anchor}`;
    const inLunation = (d) => d[key]?.lunation.index === lunationIndex;
    let hits = days.filter((d) => inLunation(d) && d[key].tithi === n);
    if (hits.length) return hits;
    for (const alt of ['sunrise', 'midday', 'sunset']) {
      hits = days.filter((d) => d[`at_${alt}`]?.lunation.index === lunationIndex && d[`at_${alt}`].tithi === n);
      if (hits.length) return hits;
    }
    // Skipped tithi: it begins after one sunrise and ends before the next.
    return days.filter(
      (d, i) =>
        d.at_sunrise.lunation.index === lunationIndex &&
        days[i + 1] &&
        d.tithiNumber === (n === 1 ? 30 : n - 1) &&
        days[i + 1].tithiNumber === (n === 30 ? 1 : n + 1)
    );
  }

  const lunationInfo = (index) => days.find((d) => d.at_sunrise.lunation.index === index)?.at_sunrise.lunation;

  for (const index of lunationIds) {
    const lun = lunationInfo(index);
    if (!lun) continue;

    // Ekadashi, Chaturthi, Purnima, Amavasya, Pradosh — every fortnight.
    for (const paksha of ['S', 'K']) {
      const base = paksha === 'S' ? 0 : 15;

      // Ekadashi: tithi 11 (or 26) at sunrise.
      const eka = days.filter((d) => d.at_sunrise.lunation.index === index && d.tithiNumber === base + 11);
      let chosen = eka;
      if (!chosen.length) {
        // Begins and ends between two sunrises.
        chosen = days.filter(
          (d, i) =>
            d.at_sunrise.lunation.index === index &&
            d.tithiNumber === base + 10 &&
            days[i + 1]?.tithiNumber === base + 12
        );
      }
      if (chosen.length) {
        const smarta = chosen[0];
        const second = chosen.length > 1 ? chosen[1] : null;
        const arunodaya = new Date(smarta.sunrise.getTime() - 96 * MINUTE);
        const viddha = tithiAt(arunodaya) === base + 10; // Dashami still running at dawn
        const vaishnavaDate = second ? second.date : viddha ? addDays(smarta.date, 1) : smarta.date;
        const names = lun.isAdhika ? ADHIKA_EKADASHI_NAMES : EKADASHI_NAMES[lun.month];
        const name = names[paksha === 'S' ? 1 : 0];
        push({
          date: smarta.date,
          slug: 'ekadashi',
          kind: 'EKADASHI',
          name: `${name} Ekadashi`,
          paksha: paksha === 'S' ? 'SHUKLA' : 'KRISHNA',
          tithiNumber: base + 11,
          month: lun.isAdhika ? `Adhika ${lun.month}` : lun.month,
          details: { vaishnavaDate, anchor: 'sunrise' },
        });

        // Parana: the morning after each day the fast is kept — one day, or two when the
        // Smarta and Vaishnava dates differ. The first of two can be the second's fast day,
        // so a row says when the fast is kept again that day (`alsoFastToday`) and the push is
        // worded "if you kept the fast yesterday", never telling anyone to break a fast they
        // are still keeping.
        const fastDates = [...new Set([smarta.date, vaishnavaDate])];
        for (const fast of fastDates) {
          const day = days.find((d) => d.date === addDays(fast, 1));
          const window = day && paranaWindow(day, base + 12);
          if (!window) continue;
          push({
            date: day.date,
            slug: 'parana',
            kind: 'PARANA',
            name: `${name} Ekadashi parana`,
            description:
              `${fastDates.length > 1 ? 'If you kept the fast the day before, break it' : 'Break the fast'} between ` +
              `${clock(window.startsAt, location.timezone)} and ${clock(window.endsAt, location.timezone)} (${location.name}).`,
            paksha: paksha === 'S' ? 'SHUKLA' : 'KRISHNA',
            tithiNumber: base + 12,
            month: lun.isAdhika ? `Adhika ${lun.month}` : lun.month,
            details: {
              ekadashi: `${name} Ekadashi`,
              fastDate: fast,
              twoDates: fastDates.length > 1,
              alsoFastToday: fastDates.includes(day.date),
              startsAt: window.startsAt.toISOString(),
              endsAt: window.endsAt.toISOString(),
              hariVasaraEndsAt: window.hariVasaraEndsAt?.toISOString() ?? null,
              dwadashiEndsAt: window.dwadashiEndsAt.toISOString(),
              afterMadhyahna: window.afterMadhyahna,
              place: location.name,
              timezone: location.timezone,
              anchor: 'sunrise',
            },
          });
        }
      }

      // Chaturthi: Vinayaka (bright half, midday) and Sankashti (dark half, moonrise).
      if (paksha === 'S' && !(lun.month === 'Bhadrapada' && !lun.isAdhika)) {
        const hit = daysFor(index, 4, 'midday')[0];
        if (hit) {
          push({
            date: hit.date, slug: 'vinayaka-chaturthi', kind: 'CHATURTHI',
            name: 'Vinayaka Chaturthi', paksha: 'SHUKLA', tithiNumber: 4,
            month: lun.isAdhika ? `Adhika ${lun.month}` : lun.month, details: { anchor: 'midday' },
          });
        }
      }
      if (paksha === 'K') {
        const hit = daysFor(index, 19, 'moonrise')[0];
        if (hit) {
          const tuesday = hit.weekday === 2;
          push({
            date: hit.date, slug: 'sankashti-chaturthi', kind: 'CHATURTHI',
            name: tuesday ? 'Angaraki Sankashti Chaturthi' : 'Sankashti Chaturthi',
            paksha: 'KRISHNA', tithiNumber: 19,
            month: lun.isAdhika ? `Adhika ${lun.month}` : lun.month, details: { anchor: 'moonrise' },
          });
        }
      }

      // Pradosh: trayodashi at the evening twilight.
      const pradosh = daysFor(index, base + 13, 'pradosh')[0];
      if (pradosh) {
        push({
          date: pradosh.date, slug: 'pradosh', kind: 'PRADOSH',
          name: `${paksha === 'S' ? 'Shukla' : 'Krishna'} Pradosh Vrat`,
          paksha: paksha === 'S' ? 'SHUKLA' : 'KRISHNA', tithiNumber: base + 13,
          month: lun.isAdhika ? `Adhika ${lun.month}` : lun.month, details: { anchor: 'pradosh' },
        });
      }
    }

    const purnima = daysFor(index, 15, 'sunrise')[0];
    if (purnima) {
      push({
        date: purnima.date, slug: 'purnima', kind: 'PURNIMA', name: 'Purnima', paksha: 'SHUKLA',
        tithiNumber: 15, month: lun.isAdhika ? `Adhika ${lun.month}` : lun.month, details: { anchor: 'sunrise' },
      });
    }
    const amavasya = daysFor(index, 30, 'sunrise')[0];
    if (amavasya) {
      push({
        date: amavasya.date, slug: 'amavasya', kind: 'AMAVASYA', name: 'Amavasya', paksha: 'KRISHNA',
        tithiNumber: 30, month: lun.isAdhika ? `Adhika ${lun.month}` : lun.month, details: { anchor: 'sunrise' },
      });
    }

    // Named festivals — never in an adhika month.
    if (lun.isAdhika) continue;
    for (const [slug, name, month, paksha, tithi, anchor, kind] of FESTIVAL_RULES) {
      if (month !== lun.month) continue;
      const n = paksha === 'S' ? tithi : 15 + tithi;
      const hit = daysFor(index, n, anchor)[0];
      if (!hit) continue;
      push({
        date: hit.date, slug, kind, name, paksha: paksha === 'S' ? 'SHUKLA' : 'KRISHNA', tithiNumber: n,
        month, details: { anchor },
      });
    }
  }

  // Sankrantis: the sun entering a sidereal sign. After sunset it is kept the next day.
  for (let i = 0; i < days.length - 1; i += 1) {
    const a = days[i];
    const b = days[i + 1];
    const signA = signIndexAt(a.sunrise);
    if (signA === signIndexAt(b.sunrise)) continue;
    let lo = a.sunrise.getTime();
    let hi = b.sunrise.getTime();
    while (hi - lo > 1000) {
      const mid = Math.floor((lo + hi) / 2);
      if (signIndexAt(new Date(mid)) === signA) lo = mid;
      else hi = mid;
    }
    const entersSign = (signA + 1) % 12;
    const date = hi <= a.sunset.getTime() ? a.date : b.date;
    push({
      date, slug: `sankranti-${SIGNS[entersSign].toLowerCase()}`, kind: 'SANKRANTI',
      name: entersSign === 9 ? 'Makar Sankranti' : `${SIGNS[entersSign]} Sankranti`,
      paksha: null, tithiNumber: null, month: null,
      details: { entersAt: new Date(hi).toISOString(), sign: SIGNS[entersSign] },
    });
  }

  const rows = days.filter((d) => inYear(d.date)).map((d) => ({
    date: d.date, weekday: d.weekday, sunrise: d.sunrise, sunset: d.sunset, moonrise: d.moonrise,
    tithiNumber: d.tithiNumber, tithiName: d.tithiName, paksha: d.paksha, tithiEndsAt: d.tithiEndsAt,
    nakshatra: d.nakshatra, nakshatraNumber: d.nakshatraNumber, nakshatraEndsAt: d.nakshatraEndsAt,
    yoga: d.yoga, yogaEndsAt: d.yogaEndsAt, karana: d.karana,
    monthAmanta: d.monthAmanta, monthPurnimanta: d.monthPurnimanta, isAdhika: d.isAdhika,
    sunSign: d.sunSign, moonSign: d.moonSign, vikramSamvat: d.vikramSamvat, shakaSamvat: d.shakaSamvat,
  }));

  festivals.sort((x, y) => (x.date === y.date ? x.slug.localeCompare(y.slug) : x.date.localeCompare(y.date)));
  for (const f of festivals) {
    f.notify = NOTIFY_KINDS.has(f.kind);
    if (SAME_DAY_KINDS.has(f.kind)) f.notifyDaysBefore = [];
  }
  return { days: rows, festivals };
}

export { buildYear, FESTIVAL_RULES, EKADASHI_NAMES, NOTIFY_KINDS, SAME_DAY_KINDS };
