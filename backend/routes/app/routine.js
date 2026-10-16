import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/routine.js';

const router = createRouter({
  tag: 'Routine',
  prefix: '/routine',
  description:
    'The Routine tab: a personal day list (devotion, work, home, errands) and an optional ' +
    'daily routine. The phone keeps its own copy and mirrors it here, so nothing in this ' +
    'family is needed to use the tab — it is how a list follows someone to a new phone.',
});

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const minute = z.number().int().min(0).max(1439);
const category = z.enum(['devotion', 'work', 'home', 'errand']);
const slot = z.enum(['morning', 'afternoon', 'evening', 'anytime']);

// The id is the one the phone made for the row; it is only unique per user.
const id = z.string().min(1).max(64);

// A time range is both ends or neither, and ends after it starts.
const hasValidWindow = (row) =>
  (row.windowStart === undefined) === (row.windowEnd === undefined) &&
  (row.windowStart === undefined || row.windowEnd > row.windowStart);
const windowMessage = { message: 'windowStart and windowEnd go together, and the end is after the start' };

const task = z
  .object({
    id,
    day,
    title: z.string().trim().min(1).max(200),
    category,
    slot,
    windowStart: minute.optional(),
    windowEnd: minute.optional(),
    isDone: z.boolean(),
    doneAt: minute.optional(),
  })
  .refine(hasValidWindow, windowMessage);

const dailyItem = z
  .object({
    id,
    title: z.string().trim().min(1).max(200),
    category,
    slot,
    windowStart: minute.optional(),
    windowEnd: minute.optional(),
    since: day,
    until: z.union([day, z.literal('')]),
  })
  .refine(hasValidWindow, windowMessage);

const check = z.object({ itemId: id, day, doneAt: minute.nullable().optional() });

const MAX_ROWS = 1000;

router.get(
  '/',
  {
    summary: 'Read the routine',
    description:
      'The whole daily routine, and the tasks and ticks from `since` on. A phone asks for the ' +
      'days its date strip can reach; days before that cannot be opened there.',
    limit: 'read',
    query: z.object({ since: day.optional() }),
    responds: { 200: 'tasks, daily and checks' },
  },
  controller.read
);

router.get(
  '/nudges',
  {
    summary: 'The verses for the standard routine reminders',
    description:
      'For each standard routine (wakeUp, morningChant, ... — the app\'s own keys) the verses its ' +
      'local reminder can carry, with the text in the reader\'s reading language when the verse ' +
      'is imported and the seeded English when not. The app schedules the notifications from ' +
      'this, one verse a day per routine. `voiceScript` (with {name}) and `voiceUrl` (null) are ' +
      'reserved for the voice messages of a later release.',
    limit: 'read',
    responds: { 200: 'kinds, each with its nudges' },
  },
  controller.nudges
);

router.post(
  '/sync',
  {
    summary: 'Send what changed, get the routine back',
    description:
      'Applies the changes — rows to create or overwrite, and rows to remove — then answers ' +
      'with the routine as it now stands, as GET / does. Safe to repeat: an upsert of a row ' +
      'already there changes nothing, and so does removing one already gone. Where two phones ' +
      'changed the same row, the one that arrives last wins.',
    limit: 'write',
    body: z.object({
      since: day,
      tasks: z.array(task).max(MAX_ROWS).default([]),
      daily: z.array(dailyItem).max(MAX_ROWS).default([]),
      checks: z.array(check).max(MAX_ROWS).default([]),
      removedTasks: z.array(id).max(MAX_ROWS).default([]),
      removedChecks: z.array(z.object({ itemId: id, day })).max(MAX_ROWS).default([]),
    }),
    responds: { 200: 'tasks, daily and checks, after the changes' },
  },
  controller.sync
);

export default router;
