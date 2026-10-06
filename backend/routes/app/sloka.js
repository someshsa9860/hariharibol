import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/app/sloka.js';

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
      'empty screen. The pick is drawn from what they last reported struggling with, if ' +
      'anything; otherwise it comes from the eligible pool.',
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
      'Name what is weighing on you — one of the six vikaras, or a practice difficulty — and ' +
      'get a verse chosen for it, with a plain reason the app can show.',
    limit: 'write',
    body: z.object({
      issueSlug: z.string().min(1).max(100),
      intensity: z.coerce.number().int().min(1).max(5).optional(),
      note: z.string().max(2000).optional(),
    }),
    responds: {
      201: 'The chosen sloka and the reason for it',
      404: 'No such issue, or nothing mapped to it yet',
    },
  },
  controller.mood
);

router.get(
  '/mood/today',
  {
    summary: "List today's mood slokas",
    description:
      'Every vikara or practice difficulty reported today, each with the verse it was answered ' +
      'with. `/sloka/mood` keeps only the latest of these on the dashboard, so this is what ' +
      'lets an earlier one be reopened and read again, with no limit.',
    limit: 'read',
    query: z.object({ date: dateString.optional() }),
    responds: { 200: "Today's mood slokas, newest first" },
  },
  controller.moodToday
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

export default router;
