// The Hindu calendar (panchang), worked out from the positions of the sun and moon.
//
// No database and no clock here — a date and a place go in, a day's panchang and
// the festivals that fall in a span of days come out, so it can be checked on its own:
//
//   node --test test/panchang.test.js
//
// Method (all stated so that a disagreement with a printed almanac can be traced):
//   - Positions: the `astronomy-engine` library (Don Cross; checked against JPL
//     Horizons, moon to a few arcseconds). Sunrise, sunset and moonrise are its
//     own, for the place given, with refraction.
//   - Tithi: every 12° the moon gains on the sun (`MoonPhase`). A day's tithi is the
//     one running at local sunrise (udaya tithi), the convention of the printed
//     North-Indian almanacs.
//   - Nakshatra and yoga: the moon (and sun + moon) on the sidereal zodiac, Lahiri
//     ayanamsa, in 13°20' parts.
//   - Month: amanta (new moon to new moon), named by the sidereal sign the sun is
//     in at the new moon that begins it; a month with no sankranti is adhika.
//     Purnimanta (the dark half already in the next month) is given too.
//   - Festivals: by month + tithi, each judged at the time of day its rule names
//     (sunrise, midday, sunset, pradosh, midnight, moonrise). Where printed almanacs
//     add further rules a date can differ by a day — see `vaishnavaEkadashi`.
//
// Weekday, sunrise and the rest are for ONE place (`location`). Cities near each
// other agree on most days; far apart they differ on the days a tithi changes near
// sunrise.

import * as Astronomy from 'astronomy-engine';

const MINUTE = 60000;
const DAY = 86400000;

// ── Places ─────────────────────────────────────────────────────────────────

const LOCATIONS = {
  'new-delhi': { key: 'new-delhi', name: 'New Delhi', lat: 28.6139, lon: 77.209, elevation: 216, timezone: 'Asia/Kolkata' },
  ujjain: { key: 'ujjain', name: 'Ujjain', lat: 23.1765, lon: 75.7885, elevation: 491, timezone: 'Asia/Kolkata' },
  mathura: { key: 'mathura', name: 'Mathura', lat: 27.4924, lon: 77.6737, elevation: 174, timezone: 'Asia/Kolkata' },
  mayapur: { key: 'mayapur', name: 'Mayapur', lat: 23.4231, lon: 88.3889, elevation: 10, timezone: 'Asia/Kolkata' },
  mumbai: { key: 'mumbai', name: 'Mumbai', lat: 19.076, lon: 72.8777, elevation: 14, timezone: 'Asia/Kolkata' },
};
const DEFAULT_LOCATION_KEY = 'new-delhi';

// ── Names ──────────────────────────────────────────────────────────────────

const TITHI_NAMES = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami',
  'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi',
];
// 1–15 bright half (15 = Purnima), 16–30 dark half (30 = Amavasya).
function tithiName(n) {
  if (n === 15) return 'Purnima';
  if (n === 30) return 'Amavasya';
  return TITHI_NAMES[(n - 1) % 15];
}

const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha',
  'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

const YOGAS = [
  'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shula',
  'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyana',
  'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti',
];

const MOVABLE_KARANAS = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti'];
// Half-tithi 1 of the lunation is Kimstughna, 2–57 cycle the seven, 58–60 are fixed.
function karanaName(halfTithi /* 1–60 */) {
  if (halfTithi === 1) return 'Kimstughna';
  if (halfTithi >= 58) return ['Shakuni', 'Chatushpada', 'Naga'][halfTithi - 58];
  return MOVABLE_KARANAS[(halfTithi - 2) % 7];
}

const SIGNS = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrishchika', 'Dhanu', 'Makara',
  'Kumbha', 'Meena',
];

// Amanta month names; the lunation that starts with the sun in sign i is MONTHS[(i + 1) % 12]
// (sun in Meena at the new moon → Chaitra).
const MONTHS = [
  'Chaitra', 'Vaishakha', 'Jyeshtha', 'Ashadha', 'Shravana', 'Bhadrapada', 'Ashwin', 'Kartika',
  'Margashirsha', 'Pausha', 'Magha', 'Phalguna',
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Time helpers ───────────────────────────────────────────────────────────

// Minutes east of UTC for a zone at an instant.
function zoneOffsetMinutes(timezone, at) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / MINUTE);
}

// UTC instant of local midnight at the start of "YYYY-MM-DD" in the zone.
function localMidnight(dateStr, timezone) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  return new Date(guess.getTime() - zoneOffsetMinutes(timezone, guess) * MINUTE);
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const norm = (deg) => ((deg % 360) + 360) % 360;

// ── Astronomy ──────────────────────────────────────────────────────────────

// Lahiri (Chitrapaksha) ayanamsa: 23°51'11" at J2000, drifting 50.29" a year.
function ayanamsa(date) {
  const years = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / (365.25 * DAY);
  return 23 + 51 / 60 + 11 / 3600 + (years * 50.29) / 3600;
}

function eclipticLongitude(body, date) {
  const t = Astronomy.MakeTime(date);
  const vec = Astronomy.GeoVector(body, t, true);
  return Astronomy.Ecliptic(vec).elon; // true ecliptic of date
}

const sunTropical = (date) => eclipticLongitude(Astronomy.Body.Sun, date);
const moonTropical = (date) => eclipticLongitude(Astronomy.Body.Moon, date);
const sunSidereal = (date) => norm(sunTropical(date) - ayanamsa(date));
const moonSidereal = (date) => norm(moonTropical(date) - ayanamsa(date));

// Degrees the moon is ahead of the sun, 0–360.
const elongation = (date) => Astronomy.MoonPhase(Astronomy.MakeTime(date));

/** Tithi 1–30 running at an instant. */
function tithiAt(date) {
  return Math.floor(elongation(date) / 12) + 1;
}

// First instant after `from` at which the elongation reaches `target` degrees.
function nextElongation(from, target) {
  const hit = Astronomy.SearchMoonPhase(target, Astronomy.MakeTime(from), 40);
  return hit ? hit.date : null;
}

// When the tithi running at `at` ends.
function tithiEnd(at) {
  const t = tithiAt(at);
  return nextElongation(at, (t % 30) * 12);
}

// When the tithi running at `at` began (a tithi lasts under 27 hours, so three days back is plenty).
function tithiStart(at) {
  const t = tithiAt(at);
  const hit = Astronomy.SearchMoonPhase((t - 1) * 12, Astronomy.MakeTime(at), -3);
  return hit ? hit.date : null;
}

// Bisect the first instant after `from` when f(date) changes from its value at `from`.
function nextChange(from, f, stepMinutes, limitDays = 3) {
  const start = f(from);
  let lo = from;
  for (let t = from.getTime() + stepMinutes * MINUTE; t < from.getTime() + limitDays * DAY; t += stepMinutes * MINUTE) {
    const hi = new Date(t);
    if (f(hi) !== start) {
      let a = lo.getTime();
      let b = hi.getTime();
      while (b - a > 5000) {
        const mid = Math.floor((a + b) / 2);
        if (f(new Date(mid)) === start) a = mid;
        else b = mid;
      }
      return new Date(b);
    }
    lo = hi;
  }
  return null;
}

const nakshatraIndexAt = (date) => Math.floor(moonSidereal(date) / (360 / 27));
const yogaIndexAt = (date) => Math.floor(norm(sunSidereal(date) + moonSidereal(date)) / (360 / 27));

function riseSet(body, direction, observer, from) {
  const hit = Astronomy.SearchRiseSet(body, observer, direction, Astronomy.MakeTime(from), 1);
  return hit ? hit.date : null;
}

// ── Lunations (new moon to new moon) ───────────────────────────────────────

// New moons from before `from` to after `to` (UTC instants), ascending.
function newMoonsAround(from, to) {
  const out = [];
  let t = Astronomy.MakeTime(new Date(from.getTime() - 35 * DAY));
  const stop = to.getTime() + 35 * DAY;
  for (;;) {
    const hit = Astronomy.SearchMoonPhase(0, t, 40);
    if (!hit || hit.date.getTime() > stop) break;
    out.push(hit.date);
    t = Astronomy.MakeTime(new Date(hit.date.getTime() + 20 * DAY));
  }
  return out;
}

function signIndexAt(date) {
  return Math.floor(sunSidereal(date) / 30);
}

// The lunation that contains `at` — its name, and whether it is the extra (adhika) month.
function lunationOf(newMoons, at) {
  let i = newMoons.length - 2;
  while (i > 0 && newMoons[i].getTime() > at.getTime()) i -= 1;
  const startSign = signIndexAt(newMoons[i]);
  const endSign = signIndexAt(newMoons[i + 1]);
  const isAdhika = startSign === endSign;
  return { index: i, start: newMoons[i], end: newMoons[i + 1], month: MONTHS[(startSign + 1) % 12], isAdhika };
}

// ── One day ────────────────────────────────────────────────────────────────

/**
 * The panchang of one civil day at a place.
 * @param {string} dateStr "YYYY-MM-DD", the local date
 * @param {object} location one of LOCATIONS (or the same shape)
 * @param {Date[]} [newMoons] pass the span's new moons to avoid searching again
 */
function panchangFor(dateStr, location, newMoons) {
  const observer = new Astronomy.Observer(location.lat, location.lon, location.elevation || 0);
  const midnight = localMidnight(dateStr, location.timezone);
  const sunrise = riseSet(Astronomy.Body.Sun, +1, observer, midnight);
  const sunset = riseSet(Astronomy.Body.Sun, -1, observer, sunrise);
  const moonrise = riseSet(Astronomy.Body.Moon, +1, observer, midnight);
  const moons = newMoons || newMoonsAround(midnight, new Date(midnight.getTime() + DAY));

  const tithi = tithiAt(sunrise);
  const nakIdx = nakshatraIndexAt(sunrise);
  const yogaIdx = yogaIndexAt(sunrise);
  const half = Math.floor(elongation(sunrise) / 6) + 1;
  const lunation = lunationOf(moons, sunrise);
  const moonSign = Math.floor(moonSidereal(sunrise) / 30);
  const vikram = vikramYear(dateStr, lunation.month);

  return {
    date: dateStr,
    weekday: weekdayOf(dateStr),
    weekdayName: WEEKDAYS[weekdayOf(dateStr)],
    sunrise,
    sunset,
    moonrise,
    tithiNumber: tithi,
    tithiName: tithiName(tithi),
    paksha: tithi <= 15 ? 'SHUKLA' : 'KRISHNA',
    tithiEndsAt: tithiEnd(sunrise),
    nakshatraNumber: nakIdx + 1,
    nakshatra: NAKSHATRAS[nakIdx],
    nakshatraEndsAt: nextChange(sunrise, nakshatraIndexAt, 30),
    yoga: YOGAS[yogaIdx],
    yogaEndsAt: nextChange(sunrise, yogaIndexAt, 30),
    karana: karanaName(half),
    monthAmanta: lunation.month,
    monthPurnimanta: tithi > 15 ? MONTHS[(MONTHS.indexOf(lunation.month) + 1) % 12] : lunation.month,
    isAdhika: lunation.isAdhika,
    sunSign: SIGNS[signIndexAt(sunrise)],
    moonSign: SIGNS[moonSign],
    vikramSamvat: vikram,
    shakaSamvat: vikram - 135,
  };
}

// Vikram Samvat (Chaitradi) turns over at Chaitra shukla pratipada, in March or April:
// it is the Gregorian year + 57 from then until December, + 56 in the months after the
// new Gregorian year (Pausha's tail, Magha, Phalguna).
function vikramYear(dateStr, month) {
  const year = Number(dateStr.slice(0, 4));
  const greg = Number(dateStr.slice(5, 7));
  const early = month === 'Magha' || month === 'Phalguna' || (month === 'Pausha' && greg <= 2);
  return early ? year + 56 : year + 57;
}

export {
  LOCATIONS, DEFAULT_LOCATION_KEY, MONTHS, SIGNS, NAKSHATRAS, WEEKDAYS,
  panchangFor, tithiAt, tithiName, tithiStart, tithiEnd, newMoonsAround, lunationOf, localMidnight, addDays, weekdayOf,
  sunSidereal, moonSidereal, ayanamsa, signIndexAt, riseSet, elongation, nextElongation,
  zoneOffsetMinutes,
};
