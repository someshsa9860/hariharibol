import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/sadhana.js';

const router = createRouter({
  tag: 'Sadhana',
  prefix: '/sadhana',
  description:
    'Daily practice: round targets, chanting and the productivity report. Every date here is ' +
    'the user’s own local date, resolved from their timezone — never the server’s.',
});

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

router.get(
  '/today',
  {
    summary: 'Get today’s practice',
    description:
      'The whole practice screen in one call: the day with its target and progress, its ' +
      'tasks, its chanting sessions, the standing preferences and the current streak. Pass ' +
      '`date` to read another day. The day row is created on first read, so a new user gets ' +
      'a usable screen without a setup step.',
    limit: 'read',
    query: z.object({ date: dateString.optional() }),
    responds: { 200: 'The day, its tasks and its sessions' },
  },
  controller.today
);

router.patch(
  '/today',
  {
    summary: 'Set today’s target or note',
    description:
      'Changes this day only. The standing target used to prefill future days is on the ' +
      'profile — PATCH /me/sadhana-profile.',
    limit: 'write',
    body: z.object({
      date: dateString.optional(),
      roundTarget: z.coerce.number().int().min(0).max(200).optional(),
      note: z.string().max(2000).nullable().optional(),
    }),
    responds: { 200: 'The updated day' },
  },
  controller.updateDay
);

router.post(
  '/chant/manual',
  {
    summary: 'Log rounds chanted on beads',
    description:
      'Rounds chanted away from the phone, entered afterwards. Lands in the same table as ' +
      'in-app sessions so a day’s total never has to be assembled from two places.',
    limit: 'write',
    body: z.object({
      date: dateString.optional(),
      rounds: z.coerce.number().int().min(1).max(200),
      mantraId: z.string().optional(),
      durationSeconds: z.coerce.number().int().min(0).optional(),
    }),
    responds: { 201: 'The session and the recounted day' },
  },
  controller.logManualRounds
);

router.post(
  '/chant/session',
  {
    summary: 'Start an in-app chanting session',
    description:
      'Opens a session for bead-by-bead counting. Progress is written as it goes, so closing ' +
      'the app mid-round does not lose the count.',
    limit: 'write',
    body: z.object({ mantraId: z.string().optional() }),
    responds: { 201: 'The open session' },
  },
  controller.startSession
);

router.patch(
  '/chant/session/:id',
  {
    summary: 'Update or finish a chanting session',
    description:
      'Sends bead and round progress, and closes the session with `finish: true`. Counts only ' +
      'ever move forward — a request that arrives late cannot roll the total backwards.',
    limit: 'write',
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      rounds: z.coerce.number().int().min(0).max(200).optional(),
      beads: z.coerce.number().int().min(0).max(108).optional(),
      finish: z.boolean().optional(),
    }),
    responds: {
      200: 'The session and the recounted day',
      400: 'Session is already finished',
      403: 'Not your session',
    },
  },
  controller.updateSession
);

router.get(
  '/days',
  {
    summary: 'List practice days',
    description: 'Day rows for a date range, for the calendar view. Defaults to the last 30 days.',
    limit: 'read',
    query: z.object({ from: dateString.optional(), to: dateString.optional() }),
    responds: { 200: 'Day rows in the range' },
  },
  controller.days
);

router.get(
  '/report',
  {
    summary: 'Get the productivity report',
    description:
      'Rounds and tasks per day across the window, lifetime streak, the split between ' +
      'in-app and manual chanting, and the struggles reported most often. Every day in the ' +
      'window is present including the empty ones — a chart that quietly closes its gaps ' +
      'overstates how consistent someone has been.',
    limit: 'read',
    query: z.object({ from: dateString.optional(), to: dateString.optional() }),
    responds: { 200: 'The report' },
  },
  controller.report
);

export default router;
