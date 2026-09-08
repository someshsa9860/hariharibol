const { createRouter, z } = require('../../utils/router');
const controller = require('../../controllers/admin/sloka');

const router = createRouter({
  tag: 'Admin · Sloka',
  prefix: '/slokas',
  description:
    'Curating the daily sloka. The nightly job fills any date nobody has set, so this is ' +
    'about overriding it — a festival day, or replacing one that landed badly.',
});

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

// The three fixed paths are registered before '/:date', because express matches
// in order and '/pool' would otherwise be read as a date.

router.get(
  '/pool',
  {
    summary: 'Check the health of the eligible pool',
    description:
      'How many verses are marked eligible, and how many of those are mapped to a struggle. ' +
      'The personalised picker avoids repeating within 45 days, so a pool smaller than that ' +
      'is guaranteed to repeat — `isTooSmall` says so before users notice.',
    permission: 'sloka.manage',
    limit: 'read',
    responds: { 200: 'Pool counts' },
  },
  controller.pool
);

router.get(
  '/delivery',
  {
    summary: 'See what was sent and what was opened',
    description:
      'Picked, notified and actually seen for one date. Seen against notified is the honest ' +
      'measure of whether the personalisation is landing.',
    permission: 'sloka.manage',
    limit: 'read',
    query: z.object({ date: dateString.optional() }),
    responds: { 200: 'Delivery counts' },
  },
  controller.delivery
);

router.get(
  '/',
  {
    summary: 'Get the sloka calendar',
    description:
      'A window of dates with what is set, plus the dates that are still empty. The nightly ' +
      'job will fill those, but an editor planning around a festival wants to see the gaps ' +
      'before it does.',
    permission: 'sloka.manage',
    limit: 'read',
    query: z.object({ from: dateString.optional(), to: dateString.optional() }),
    responds: { 200: 'The calendar' },
  },
  controller.calendar
);

router.put(
  '/:date',
  {
    summary: 'Set the sloka for a date',
    description:
      'Only a sloka-eligible verse from the Gita or the Bhagavatam is accepted. Leave ' +
      '`isPublished` false to draft a future date safely — nothing is sent until it is true.',
    permission: 'sloka.manage',
    limit: 'write',
    params: z.object({ date: dateString }),
    body: z.object({
      verseId: z.string().min(1),
      imagePath: z.string().max(500).nullable().optional(),
      isPublished: z.boolean().optional(),
    }),
    responds: {
      201: 'The sloka',
      400: 'Verse is not eligible, or from the wrong book',
      404: 'No such verse',
    },
  },
  controller.set
);

router.delete(
  '/:date',
  {
    summary: 'Clear the sloka for a date',
    description: 'Refused once it has been sent — that already happened and cannot be unsaid.',
    permission: 'sloka.manage',
    limit: 'write',
    params: z.object({ date: dateString }),
    responds: { 204: 'Cleared', 400: 'Already sent', 404: 'Nothing set for that date' },
  },
  controller.remove
);

module.exports = router;
