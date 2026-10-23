// Saving a computed year, and reading the calendar back.
//
// The computing is services/panchang.js + services/festivals.js; this is the part that
// touches the database, shared by `npm run seed:panchang` and the admin "Generate" button.

import { prisma } from '../config/database.js';
import * as setting from './setting.js';
import { buildYear } from './festivals.js';
import { LOCATIONS, DEFAULT_LOCATION_KEY } from './panchang.js';
import { plainWords } from '../utils/calendar-translation.js';

const SETTING_KEY = 'panchang.location';
const asDate = (s) => new Date(`${s}T00:00:00.000Z`);
const dateOnly = (d) => d.toISOString().slice(0, 10);

/** The place the calendar is for — an admin setting, New Delhi until one is chosen. */
async function currentLocationKey() {
  const key = await setting.get(SETTING_KEY, DEFAULT_LOCATION_KEY);
  return LOCATIONS[key] ? key : DEFAULT_LOCATION_KEY;
}

/**
 * Compute `year` for the place and save it. Rows an admin edited are left alone; a festival
 * the rules no longer produce is removed. Returns the counts.
 */
async function saveYear(year, locationKey) {
  const location = LOCATIONS[locationKey];
  if (!location) throw new Error(`Unknown place "${locationKey}"`);
  const { days, festivals } = buildYear(year, location);

  let written = 0;
  let kept = 0;
  for (const { date, ...fields } of days) {
    const where = { date_locationKey: { date: asDate(date), locationKey } };
    const existing = await prisma.panchangDay.findUnique({ where, select: { isEdited: true } });
    if (existing?.isEdited) {
      kept += 1;
      continue;
    }
    await prisma.panchangDay.upsert({ where, update: fields, create: { date: asDate(date), locationKey, ...fields } });
    written += 1;
  }

  let festivalsWritten = 0;
  for (const f of festivals) {
    const { date, notify, notifyDaysBefore, ...fields } = f;
    const where = { date_locationKey_slug: { date: asDate(date), locationKey, slug: f.slug } };
    const existing = await prisma.festival.findUnique({ where, select: { isEdited: true } });
    if (existing?.isEdited) continue;
    await prisma.festival.upsert({
      where,
      update: { ...fields },
      // Whether to push, and how many days ahead, is decided once, at creation — an admin's
      // choice survives a re-run. (No `notifyDaysBefore` means the column's default, the day before.)
      create: { date: asDate(date), locationKey, notify, ...(notifyDaysBefore ? { notifyDaysBefore } : {}), ...fields },
    });
    festivalsWritten += 1;
  }

  const keep = new Set(festivals.map((f) => `${f.date}|${f.slug}`));
  const old = await prisma.festival.findMany({
    where: { locationKey, isEdited: false, date: { gte: asDate(`${year}-01-01`), lte: asDate(`${year}-12-31`) } },
    select: { id: true, date: true, slug: true },
  });
  const stale = old.filter((o) => !keep.has(`${dateOnly(o.date)}|${o.slug}`));
  if (stale.length) await prisma.festival.deleteMany({ where: { id: { in: stale.map((o) => o.id) } } });

  return { days: written, adminEditedKept: kept, festivals: festivalsWritten, removed: stale.length };
}

/**
 * What the apps are sent for a festival. `words(kind, text)` gives a name or a description in the reader's language
 * (`wordsFor` in services/calendar-translation.js); the default leaves the English. A parana's description is the
 * day's own times, built in English for that date, so it is never passed through.
 */
function presentFestival(f, words = plainWords) {
  return {
    id: f.id,
    date: dateOnly(f.date),
    slug: f.slug,
    kind: f.kind,
    name: words('NAME', f.name),
    description: f.kind === 'PARANA' ? f.description : words('DESCRIPTION', f.description),
    paksha: f.paksha,
    month: f.month,
    vaishnavaDate: f.details?.vaishnavaDate && f.details.vaishnavaDate !== dateOnly(f.date) ? f.details.vaishnavaDate : null,
  };
}

/** What the apps are sent for a day; `words` as for `presentFestival`, applied to the panchang terms. */
function presentDay(d, words = plainWords) {
  return {
    date: dateOnly(d.date),
    weekday: d.weekday,
    sunrise: d.sunrise,
    sunset: d.sunset,
    moonrise: d.moonrise,
    tithi: { number: d.tithiNumber, name: words('TERM', d.tithiName), paksha: d.paksha, endsAt: d.tithiEndsAt },
    nakshatra: { number: d.nakshatraNumber, name: words('TERM', d.nakshatra), endsAt: d.nakshatraEndsAt },
    yoga: words('TERM', d.yoga),
    karana: words('TERM', d.karana),
    month: words('TERM', d.monthAmanta),
    monthPurnimanta: words('TERM', d.monthPurnimanta),
    isAdhika: d.isAdhika,
    sunSign: words('TERM', d.sunSign),
    moonSign: words('TERM', d.moonSign),
    vikramSamvat: d.vikramSamvat,
    shakaSamvat: d.shakaSamvat,
    notes: d.notes,
  };
}

export { saveYear, currentLocationKey, presentDay, presentFestival, SETTING_KEY, asDate, dateOnly };
