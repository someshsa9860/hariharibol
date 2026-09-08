const { createRouter, z, schemas } = require('../../utils/router');
const controller = require('../../controllers/app/sloka');

const router = createRouter({
  tag: 'Sloka for You',
  prefix: '/sloka',
  description:
    'The daily sloka, global and personal. Slokas come only from the Bhagavad Gita and the ' +
    'Srimad Bhagavatam, and only from verses an editor has marked eligible. No AI runs on ' +
    'these requests — the verse-to-struggle mapping is built ahead of time by a batch job, ' +
    'so serving a sloka is an indexed query.',
});

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

router.get(
  '/today',
  {
    summary: 'Get the sloka of the day',
    description:
      'The global sloka — the same verse for everyone, free and public. This is what someone ' +
      'sees before they have an account.',
    public: true,
    limit: 'read',
    query: z.object({ date: dateString.optional() }),
    responds: { 200: 'The day’s sloka', 404: 'Nothing published for that date' },
  },
  controller.today
);

router.get(
  '/mine',
  {
    summary: 'Get my sloka for today',
    description:
      'The verse chosen for this user, written overnight by the sloka job. If the job has ' +
      'not reached them yet one is picked on the spot, so a new account never opens to an ' +
      'empty screen.\n\nFor a Premium reader the pick is drawn from what they reported ' +
      'struggling with; for everyone else it comes from the eligible pool. Free either way — ' +
      'what Premium buys is the choosing, not the verse.',
    limit: 'read',
    query: z.object({ date: dateString.optional() }),
    responds: { 200: 'The personal sloka', 404: 'No verses are marked sloka-eligible yet' },
  },
  controller.mine
);

router.post(
  '/mood',
  {
    summary: 'Report a struggle and receive a sloka for it',
    description:
      'The Premium feature. Name what is weighing on you — one of the six vikaras, or a ' +
      'practice difficulty — and get a verse chosen for it, with a plain reason the app can ' +
      'show. A free monthly quota is allowed through before the paywall applies, because ' +
      'gating it entirely would mean most people never see what Premium is for.',
    limit: 'write',
    body: z.object({
      issueSlug: z.string().min(1).max(100),
      intensity: z.coerce.number().int().min(1).max(5).optional(),
      note: z.string().max(2000).optional(),
    }),
    responds: {
      201: 'The chosen sloka and the reason for it',
      402: 'Free quota used up for this month',
      404: 'No such issue, or nothing mapped to it yet',
    },
  },
  controller.mood
);

router.post(
  '/:id/seen',
  {
    summary: 'Mark a sloka as read',
    description:
      'Separates "delivered" from "actually read" — the delivery job needs both to avoid ' +
      'sending twice, and the weekly learning uses it to work out what a user engages with.',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'Marked' },
  },
  controller.markSeen
);

router.get(
  '/history',
  {
    summary: 'List my past slokas',
    description: 'The last 60 personal slokas, newest first, with the struggle each answered.',
    limit: 'read',
    responds: { 200: 'Past slokas' },
  },
  controller.history
);

module.exports = router;
