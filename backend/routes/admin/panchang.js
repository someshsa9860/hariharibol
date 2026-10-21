import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/panchang.js';

const router = createRouter({
  tag: 'Admin · Calendar',
  prefix: '/panchang',
  description:
    'The Hindu calendar: a month of panchang days and festivals, corrections to a day, festivals ' +
    'added or switched off, and the place the calendar is worked out for. A day or festival changed ' +
    'here is kept when a year is generated again.',
});

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const KINDS = ['EKADASHI', 'CHATURTHI', 'PRADOSH', 'PURNIMA', 'AMAVASYA', 'SANKRANTI', 'FESTIVAL'];
const text = (max) => z.string().trim().min(1).max(max);
const daysBefore = z.array(z.number().int().min(0).max(7)).max(4);

router.get(
  '/',
  {
    summary: 'A month of the calendar',
    permission: 'panchang.manage',
    limit: 'read',
    query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM') }),
    responds: { 200: 'Days, festivals, the place and the places to choose from' },
  },
  controller.month
);

router.patch(
  '/days/:date',
  {
    summary: 'Correct a day',
    description: 'Marks the day as edited, so generating the year again leaves it as it is.',
    permission: 'panchang.manage',
    limit: 'write',
    params: z.object({ date: dateString }),
    body: z.object({
      tithiNumber: z.number().int().min(1).max(30).optional(),
      tithiName: text(40).optional(),
      nakshatra: text(40).optional(),
      yoga: text(40).optional(),
      karana: text(40).optional(),
      monthAmanta: text(40).optional(),
      monthPurnimanta: text(40).optional(),
      isAdhika: z.boolean().optional(),
      sunSign: text(40).optional(),
      moonSign: text(40).optional(),
      sunrise: z.string().datetime().nullable().optional(),
      sunset: z.string().datetime().nullable().optional(),
      tithiEndsAt: z.string().datetime().nullable().optional(),
      notes: z.string().trim().max(1000).nullable().optional(),
    }),
    responds: { 200: 'The day', 404: 'Nothing generated for that date' },
  },
  controller.updateDay
);

router.post(
  '/festivals',
  {
    summary: 'Add a festival',
    permission: 'panchang.manage',
    limit: 'write',
    body: z.object({
      date: dateString,
      slug: z.string().trim().regex(/^[a-z0-9-]{2,80}$/, 'Lowercase letters, digits and dashes'),
      kind: z.enum(KINDS),
      name: text(120),
      description: z.string().trim().max(1000).nullable().optional(),
      notify: z.boolean().optional(),
      notifyDaysBefore: daysBefore.optional(),
    }),
    responds: { 201: 'The festival', 400: 'Already there' },
  },
  controller.createFestival
);

router.patch(
  '/festivals/:id',
  {
    summary: 'Change a festival',
    description: 'Move it, rename it, switch it off, or change how many days ahead the push goes. Moving it clears what was already announced.',
    permission: 'panchang.manage',
    limit: 'write',
    params: schemas.id,
    body: z.object({
      date: dateString.optional(),
      name: text(120).optional(),
      description: z.string().trim().max(1000).nullable().optional(),
      kind: z.enum(KINDS).optional(),
      isActive: z.boolean().optional(),
      notify: z.boolean().optional(),
      notifyDaysBefore: daysBefore.optional(),
    }),
    responds: { 200: 'The festival' },
  },
  controller.updateFestival
);

router.delete(
  '/festivals/:id',
  {
    summary: 'Delete a festival',
    permission: 'panchang.manage',
    limit: 'write',
    params: schemas.id,
    responds: { 204: 'Deleted' },
  },
  controller.removeFestival
);

router.put(
  '/location',
  {
    summary: 'Choose the place',
    description: 'The place the apps are shown, and the one the daily push is dated for. Generate the year for a place before choosing it.',
    permission: 'panchang.manage',
    limit: 'write',
    body: z.object({ key: z.string().min(1).max(40) }),
    responds: { 200: 'The place' },
  },
  controller.setLocation
);

router.post(
  '/generate',
  {
    summary: 'Work out a year',
    description: 'Computes the panchang and festivals of a year for the chosen place from the sun and moon (about two seconds). Days and festivals an admin edited are kept.',
    permission: 'panchang.manage',
    limit: 'write',
    body: z.object({ year: z.number().int().min(2000).max(2100) }),
    responds: { 200: 'What was written' },
  },
  controller.generate
);

export default router;
