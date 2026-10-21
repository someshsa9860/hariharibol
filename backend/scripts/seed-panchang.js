// Fills the panchang for a year at one place: a row per day and the year's festivals.
//
//   npm run seed:panchang                      2026, New Delhi (or the panchang.location setting)
//   npm run seed:panchang -- 2027 ujjain       another year and place (see LOCATIONS in services/panchang.js)
//
// Safe to run again: rows an admin edited (`isEdited`) are left as they are, everything
// else is recomputed. Computed by services/panchang.js — see its header for the method.

import { prisma } from '../config/database.js';
import { saveYear } from '../services/panchang-store.js';
import { LOCATIONS, DEFAULT_LOCATION_KEY } from '../services/panchang.js';

const year = Number(process.argv[2] || 2026);
let key = process.argv[3];
if (!key) {
  const row = await prisma.appSetting.findUnique({ where: { key: 'panchang.location' } });
  key = row?.value || DEFAULT_LOCATION_KEY;
}
const location = LOCATIONS[key];
if (!location) {
  console.error(`Unknown place "${key}". Choose one of: ${Object.keys(LOCATIONS).join(', ')}`);
  process.exit(1);
}

const result = await saveYear(year, key);
console.log(
  `${year} at ${location.name}: ${result.days} days written (${result.adminEditedKept} admin-edited kept), ` +
    `${result.festivals} festivals written, ${result.removed} stale removed`
);
await prisma.$disconnect();
process.exit(0); // the shared redis client would otherwise keep the process open
