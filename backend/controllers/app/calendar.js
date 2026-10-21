// The Hindu calendar, read-only: a day's panchang and the festivals on it.
// Public — the website shows it signed out. Computed and saved by services/panchang-store.js.

import { prisma } from '../../config/database.js';
import { ok } from '../../utils/respond.js';
import { badRequest } from '../../utils/errors.js';
import { localDateString, shiftDays } from '../../utils/date.js';
import { LOCATIONS } from '../../services/panchang.js';
import { currentLocationKey, presentDay, presentFestival, asDate } from '../../services/panchang-store.js';

const MAX_SPAN_DAYS = 62;

/** GET /api/app/calendar?from=&to= — days and festivals in a range (default: this month). */
export const range = async (req, res) => {
  const key = await currentLocationKey();
  const location = LOCATIONS[key];
  const today = localDateString(location.timezone);
  const from = req.valid.query.from || `${today.slice(0, 8)}01`;
  const to = req.valid.query.to || shiftDays(shiftDays(from, 31).slice(0, 8) + '01', -1);
  if (to < from || shiftDays(from, MAX_SPAN_DAYS) < to) throw badRequest(`Ask for at most ${MAX_SPAN_DAYS} days at a time`);

  const where = { locationKey: key, date: { gte: asDate(from), lte: asDate(to) } };
  const [days, festivals] = await Promise.all([
    prisma.panchangDay.findMany({ where, orderBy: { date: 'asc' } }),
    prisma.festival.findMany({ where: { ...where, isActive: true }, orderBy: [{ date: 'asc' }, { slug: 'asc' }] }),
  ]);

  return ok(res, {
    location: { key, name: location.name, timezone: location.timezone },
    from,
    to,
    today,
    days: days.map(presentDay),
    festivals: festivals.map(presentFestival),
  });
};

/** GET /api/app/calendar/upcoming?days=30 — the festivals coming up, soonest first. */
export const upcoming = async (req, res) => {
  const key = await currentLocationKey();
  const today = localDateString(LOCATIONS[key].timezone);
  const span = req.valid.query.days ?? 30;
  const festivals = await prisma.festival.findMany({
    where: {
      locationKey: key,
      isActive: true,
      kind: { notIn: ['SANKRANTI', 'PRADOSH'] },
      date: { gte: asDate(today), lte: asDate(shiftDays(today, span)) },
    },
    orderBy: [{ date: 'asc' }, { slug: 'asc' }],
    take: 40,
  });
  return ok(res, { today, festivals: festivals.map(presentFestival) });
};
