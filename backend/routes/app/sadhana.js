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

router.put(
  '/chant/session/:id/detail',
  {
    summary: 'Save a session’s rounds and taps',
    description:
      'The tap-by-tap record of a sitting, grouped by round. Send the rounds that changed; ' +
      'each is replaced as a whole, keyed by its `index`, so a retried request is harmless. ' +
      'Totals (beads, duration, average gap) are worked out here from the taps rather than ' +
      'trusted from the client. Accepted after the session has finished, so the last sync ' +
      'on close can land.',
    limit: 'write',
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      malas: z
        .array(
          z.object({
            index: z.coerce.number().int().min(1).max(500),
            complete: z.boolean().optional(),
            taps: z
              .array(
                z.object({
                  seq: z.coerce.number().int().min(1),
                  at: z.coerce.number().int().min(0),
                  gapMs: z.coerce.number().int().min(0).max(86400000),
                  auto: z.boolean().optional(),
                })
              )
              .max(120),
          })
        )
        .min(1)
        .max(20),
    }),
    responds: { 200: 'The rounds as stored', 403: 'Not your session' },
  },
  controller.saveChantDetail
);

router.post(
  '/chant/session/:id/transcripts',
  {
    summary: 'Save what was heard for taps',
    description:
      'Speech-recognition text for individual taps, sent only when the user turned on word ' +
      'detection. Rows expire after 7 days and are deleted by a nightly job — this is working ' +
      'data for spotting missed words, not history. One row per `seq`; sending it again ' +
      'replaces the text and restarts the expiry.',
    limit: 'write',
    params: z.object({ id: z.string().min(1) }),
    body: z.object({
      items: z
        .array(
          z.object({
            seq: z.coerce.number().int().min(1),
            malaIndex: z.coerce.number().int().min(1).max(500),
            text: z.string().max(500),
            confidence: z.coerce.number().min(0).max(1).optional(),
            locale: z.string().max(16).optional(),
            heardAt: z.coerce.date(),
          })
        )
        .min(1)
        .max(200),
    }),
    responds: { 200: 'How many were stored', 403: 'Not your session' },
  },
  controller.saveChantTranscripts
);

router.get(
  '/chant/sessions',
  {
    summary: 'List past chanting sessions',
    description:
      'Newest first. Each carries its rounds, duration and — for sessions recorded tap by tap ' +
      '— the number of rounds on record and the average time a round took.',
    limit: 'read',
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).optional(),
    }),
    responds: { 200: 'A page of sessions' },
  },
  controller.listChantSessions
);

router.get(
  '/chant/session/:id',
  {
    summary: 'Get one session in full',
    description:
      'The session, every round with its start, end, duration and taps, and the words heard ' +
      'for each tap while those are still within their 7-day life.',
    limit: 'read',
    params: z.object({ id: z.string().min(1) }),
    responds: { 200: 'The session with its rounds', 403: 'Not your session' },
  },
  controller.getChantSession
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
