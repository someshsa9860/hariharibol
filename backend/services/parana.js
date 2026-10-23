// When the Ekadashi fast may be broken (parana) — the morning after the fast.
//
// Pure, like services/panchang.js: a day's sunrise and sunset go in, a window comes out.
//
// The rule, as Drik Panchang states it for every Ekadashi:
//   - break the fast after sunrise on the next day, and within Dwadashi (unless Dwadashi
//     ended before sunrise, when it is simply after sunrise);
//   - never in Hari Vasara, the first quarter of Dwadashi's own length;
//   - Pratahkala, the first fifth of the day, is the preferred time. Madhyahna (the third
//     fifth) is avoided: if Hari Vasara outlasts Pratahkala the fast is broken after it, in
//     Aparahna (the fourth fifth). Checked against Drik Panchang's New Delhi windows.
//
// The window is for the one place the calendar is kept for (see services/panchang.js).

import { tithiAt, tithiStart, tithiEnd } from './panchang.js';

const MINUTE = 60000;

/**
 * The parana window on the day whose sunrise and sunset are given.
 * @param {{ sunrise: Date, sunset: Date }} day
 * @param {number} dwadashi 12 for the bright half's Dwadashi, 27 for the dark half's
 * @returns {null | {
 *   startsAt: Date, endsAt: Date, hariVasaraEndsAt: Date | null, dwadashiEndsAt: Date,
 *   pratahkalaEndsAt: Date, afterMadhyahna: boolean,
 * }} null when the day is not the morning after an Ekadashi
 */
function paranaWindow({ sunrise, sunset }, dwadashi) {
  const fifth = (sunset.getTime() - sunrise.getTime()) / 5;
  const pratahkalaEndsAt = new Date(sunrise.getTime() + fifth);
  const madhyahnaEndsAt = new Date(sunrise.getTime() + fifth * 3);
  const aparahnaEndsAt = new Date(sunrise.getTime() + fifth * 4);

  // Where sunrise sits against Dwadashi: 0 inside it, 29 = Ekadashi still running (Dwadashi
  // begins later this morning), 1 = Dwadashi already over.
  const ahead = (tithiAt(sunrise) - dwadashi + 30) % 30;

  if (ahead === 1) {
    return {
      startsAt: sunrise,
      endsAt: pratahkalaEndsAt,
      hariVasaraEndsAt: null,
      dwadashiEndsAt: tithiStart(sunrise),
      pratahkalaEndsAt,
      afterMadhyahna: false,
    };
  }
  if (ahead !== 0 && ahead !== 29) return null;

  const begins = ahead === 0 ? tithiStart(sunrise) : tithiEnd(sunrise);
  const ends = tithiEnd(new Date(begins.getTime() + MINUTE));
  const hariVasaraEndsAt = new Date(begins.getTime() + (ends.getTime() - begins.getTime()) / 4);

  let startsAt;
  let endsAt;
  let afterMadhyahna = false;
  if (hariVasaraEndsAt < pratahkalaEndsAt) {
    startsAt = hariVasaraEndsAt > sunrise ? hariVasaraEndsAt : sunrise;
    endsAt = ends < pratahkalaEndsAt ? ends : pratahkalaEndsAt;
  } else {
    afterMadhyahna = true;
    startsAt = hariVasaraEndsAt > madhyahnaEndsAt ? hariVasaraEndsAt : madhyahnaEndsAt;
    endsAt = ends < aparahnaEndsAt ? ends : aparahnaEndsAt;
    // Dwadashi ends before that window opens: whatever of it is left after Hari Vasara.
    if (endsAt <= startsAt) {
      startsAt = hariVasaraEndsAt;
      endsAt = ends;
    }
  }
  return { startsAt, endsAt, hariVasaraEndsAt, dwadashiEndsAt: ends, pratahkalaEndsAt, afterMadhyahna };
}

export { paranaWindow };
