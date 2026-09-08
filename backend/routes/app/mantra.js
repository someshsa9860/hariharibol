const { createRouter, z, schemas } = require('../../utils/router');
const controller = require('../../controllers/app/mantra');

const router = createRouter({
  tag: 'Mantras',
  prefix: '/mantras',
  description:
    'Mantras for chanting. Each response resolves the script from the reader’s mantra ' +
    'language and the meaning from their reading language, so the two halves may come from ' +
    'different rows — that is intended.',
});

router.get(
  '/',
  {
    summary: 'List mantras',
    description: 'Published mantras, filterable by category, deity, guru or tag.',
    public: true,
    limit: 'read',
    query: schemas.page.extend({
      category: z.string().max(50).optional(),
      deity: z.string().max(100).optional(),
      guru: z.string().max(100).optional(),
      tag: z.string().max(50).optional(),
    }),
    responds: { 200: 'A page of mantras' },
  },
  controller.list
);

router.get(
  '/categories',
  {
    summary: 'List mantra categories',
    description: 'Every category in use, with how many published mantras are in each.',
    public: true,
    limit: 'read',
    responds: { 200: 'Categories with counts' },
  },
  controller.categories
);

router.get(
  '/:slug',
  {
    summary: 'Get one mantra',
    description:
      'The mantra with audio, the approximate duration of one recitation, the standard ' +
      'round or repetition count, and — for a signed-in reader — how many rounds they have ' +
      'chanted of it. `availableLanguages` lets the app say "not available in Marathi" ' +
      'rather than quietly falling back.',
    public: true,
    limit: 'read',
    params: schemas.slug,
    responds: { 200: 'The mantra', 404: 'No such published mantra' },
  },
  controller.get
);

module.exports = router;
