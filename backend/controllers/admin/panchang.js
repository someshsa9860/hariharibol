// The Hindu calendar in the admin panel: see a month, correct a day, add or change a
// festival, choose the place, and (re)compute a year. The computing is services/panchang.js;
// an edited day or festival is marked `isEdited` so recomputing never overwrites it.

import { prisma } from '../../config/database.js';
import * as audit from '../../services/audit.js';
import * as setting from '../../services/setting.js';
import { ok, created, noContent } from '../../utils/respond.js';
import { notFound, badRequest } from '../../utils/errors.js';
import { LOCATIONS } from '../../services/panchang.js';
import {
  currentLocationKey, saveYear, presentDay, presentFestival, asDate, dateOnly, SETTING_KEY,
} from '../../services/panchang-store.js';

const adminDay = (d) => ({ ...presentDay(d), id: d.id, isEdited: d.isEdited });
const adminFestival = (f) => ({
  ...presentFestival(f),
  isActive: f.isActive,
  notify: f.notify,
  notifyDaysBefore: f.notifyDaysBefore,
  notifiedDays: f.notifiedDays,
  isEdited: f.isEdited,
  tithiNumber: f.tithiNumber,
});

/** GET /api/admin/panchang?month=YYYY-MM */
export const month = async (req, res) => {
  const key = await currentLocationKey();
  const [y, m] = req.valid.query.month.split('-').map(Number);
  const from = asDate(`${req.valid.query.month}-01`);
  const to = new Date(Date.UTC(y, m, 0));
  const where = { locationKey: key, date: { gte: from, lte: to } };

  const [days, festivals] = await Promise.all([
    prisma.panchangDay.findMany({ where, orderBy: { date: 'asc' } }),
    prisma.festival.findMany({ where, orderBy: [{ date: 'asc' }, { slug: 'asc' }] }),
  ]);
  return ok(res, {
    location: { key, ...LOCATIONS[key] },
    locations: Object.values(LOCATIONS),
    days: days.map(adminDay),
    festivals: festivals.map(adminFestival),
  });
};

/** PATCH /api/admin/panchang/days/:date */
export const updateDay = async (req, res) => {
  const key = await currentLocationKey();
  const where = { date_locationKey: { date: asDate(req.valid.params.date), locationKey: key } };
  const before = await prisma.panchangDay.findUnique({ where });
  if (!before) throw notFound('No panchang for that date — generate the year first');

  const body = req.valid.body;
  const data = {};
  for (const field of ['tithiName', 'nakshatra', 'yoga', 'karana', 'monthAmanta', 'monthPurnimanta', 'notes', 'sunSign', 'moonSign']) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (body.tithiNumber !== undefined) {
    data.tithiNumber = body.tithiNumber;
    data.paksha = body.tithiNumber <= 15 ? 'SHUKLA' : 'KRISHNA';
  }
  if (body.isAdhika !== undefined) data.isAdhika = body.isAdhika;
  for (const field of ['sunrise', 'sunset', 'tithiEndsAt']) {
    if (body[field] !== undefined) data[field] = body[field] ? new Date(body[field]) : null;
  }

  const day = await prisma.panchangDay.update({ where, data: { ...data, isEdited: true } });
  await audit.record(req, { action: 'panchang.day.update', entityType: 'PanchangDay', entityId: day.id, before, after: data });
  return ok(res, adminDay(day));
};

/** POST /api/admin/panchang/festivals */
export const createFestival = async (req, res) => {
  const key = await currentLocationKey();
  const b = req.valid.body;
  const exists = await prisma.festival.findUnique({
    where: { date_locationKey_slug: { date: asDate(b.date), locationKey: key, slug: b.slug } },
  });
  if (exists) throw badRequest('A festival with that name already sits on that date');

  const festival = await prisma.festival.create({
    data: {
      date: asDate(b.date), locationKey: key, slug: b.slug, kind: b.kind, name: b.name,
      description: b.description ?? null, notify: b.notify ?? true,
      notifyDaysBefore: b.notifyDaysBefore ?? [1], isEdited: true,
    },
  });
  await audit.record(req, { action: 'panchang.festival.create', entityType: 'Festival', entityId: festival.id, after: { name: b.name, date: b.date } });
  return created(res, adminFestival(festival));
};

/** PATCH /api/admin/panchang/festivals/:id */
export const updateFestival = async (req, res) => {
  const before = await prisma.festival.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('No such festival');
  const b = req.valid.body;
  const data = {};
  for (const field of ['name', 'description', 'kind', 'isActive', 'notify', 'notifyDaysBefore']) {
    if (b[field] !== undefined) data[field] = b[field];
  }
  if (b.date !== undefined) {
    data.date = asDate(b.date);
    data.notifiedDays = []; // a moved festival is announced afresh
  }
  const festival = await prisma.festival.update({ where: { id: before.id }, data: { ...data, isEdited: true } });
  await audit.record(req, { action: 'panchang.festival.update', entityType: 'Festival', entityId: festival.id, before: { name: before.name, date: dateOnly(before.date) }, after: b });
  return ok(res, adminFestival(festival));
};

/** DELETE /api/admin/panchang/festivals/:id */
export const removeFestival = async (req, res) => {
  const before = await prisma.festival.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('No such festival');
  await prisma.festival.delete({ where: { id: before.id } });
  await audit.record(req, { action: 'panchang.festival.delete', entityType: 'Festival', entityId: before.id, before: { name: before.name } });
  return noContent(res);
};

/** PUT /api/admin/panchang/location */
export const setLocation = async (req, res) => {
  const { key } = req.valid.body;
  if (!LOCATIONS[key]) throw badRequest('Unknown place');
  await setting.set(SETTING_KEY, key, { description: 'Place the panchang is worked out for', updatedById: req.auth.user.id });
  await audit.record(req, { action: 'panchang.location', entityType: 'AppSetting', entityId: SETTING_KEY, after: { key } });
  return ok(res, { key, ...LOCATIONS[key] });
};

/** POST /api/admin/panchang/generate — compute a year for the chosen place (about two seconds). */
export const generate = async (req, res) => {
  const key = await currentLocationKey();
  const result = await saveYear(req.valid.body.year, key);
  await audit.record(req, { action: 'panchang.generate', entityType: 'PanchangDay', entityId: `${key}-${req.valid.body.year}`, after: result });
  return ok(res, result);
};
