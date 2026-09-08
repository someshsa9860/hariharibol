const { createRouter } = require('../../utils/router');
const controller = require('../../controllers/app/reference');

const router = createRouter({
  tag: 'Reference',
  prefix: '/reference',
  description:
    'The seeded lists the app fills its pickers and filters from. All of it is managed from ' +
    'admin, so adding a language or a deity is a data change rather than an app release — ' +
    'the app should read these rather than hardcoding them.',
});

router.get(
  '/languages',
  {
    summary: 'List languages',
    description:
      'Each entry says which of the three slots it may be used for. Sanskrit is a mantra ' +
      'language and not an app language, so the settings screen can grey out what does not ' +
      'apply instead of offering it and being refused.',
    public: true,
    limit: 'read',
    responds: { 200: 'Active languages' },
  },
  controller.languages
);

router.get(
  '/deities',
  {
    summary: 'List deities',
    description: 'Used to attribute and filter content. Seeded with the Vaishnav set.',
    public: true,
    limit: 'read',
    responds: { 200: 'Published deities' },
  },
  controller.deities
);

router.get(
  '/gurus',
  {
    summary: 'List gurus',
    description:
      'The parampara a mantra or a narration comes through. Overlaps with translators by ' +
      'design — the same person can be both, but lineage and authorship are different things.',
    public: true,
    limit: 'read',
    responds: { 200: 'Published gurus' },
  },
  controller.gurus
);

router.get(
  '/translators',
  {
    summary: 'List translators',
    description:
      'The acharyas and saints whose renderings the app carries, with which books each one ' +
      'covers. Devotional commentators only — no academic or non-devotee commentary is ' +
      'published on this platform.',
    public: true,
    limit: 'read',
    responds: { 200: 'Published translators with their books' },
  },
  controller.translators
);

module.exports = router;
