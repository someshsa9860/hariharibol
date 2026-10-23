import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/calendar.js';

const router = createRouter({
  tag: 'Calendar',
  prefix: '/calendar',
  description:
    'The Hindu calendar (panchang) for the place the admin panel has chosen — New Delhi until ' +
    'changed — and the Ekadashi, Chaturthi and festival days in it. Public.',
});

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const languageCode = z.string().regex(/^[a-zA-Z]{2,3}$/, 'A language code such as hi').optional();

router.get(
  '/',
  {
    summary: 'Days and festivals in a range',
    description:
      'Defaults to the current month; at most 62 days at a time. Names, descriptions and the panchang terms are in `language` ' +
      '(else the account’s app language, else the browser’s) where the admin has translated them, and English where not.',
    public: true,
    limit: 'read',
    query: z.object({ from: dateString.optional(), to: dateString.optional(), language: languageCode }),
    responds: { 200: 'Panchang days and festivals', 400: 'Range too long' },
  },
  controller.range
);

router.get(
  '/upcoming',
  {
    summary: 'Upcoming festivals',
    description: 'Ekadashi, Chaturthi, Purnima, Amavasya and the festivals, soonest first, in the same language as the calendar.',
    public: true,
    limit: 'read',
    query: z.object({ days: z.coerce.number().int().min(1).max(120).optional(), language: languageCode }),
    responds: { 200: 'Festivals' },
  },
  controller.upcoming
);

export default router;
