const { createRouter, z, schemas } = require('../../utils/router');
const controller = require('../../controllers/app/task');

const router = createRouter({
  tag: 'Tasks',
  prefix: '/sadhana/tasks',
  description:
    'The day’s task list. Moving a task creates a copy on the target day rather than editing ' +
    'the original, so past days keep an honest record of what was actually planned and done.',
});

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

router.get(
  '/',
  {
    summary: 'List a day’s tasks',
    description: 'Defaults to today in the user’s own timezone.',
    limit: 'read',
    query: z.object({ date: dateString.optional() }),
    responds: { 200: 'Tasks for the day' },
  },
  controller.list
);

router.get(
  '/carried',
  {
    summary: 'List tasks that keep being carried forward',
    description:
      'Still pending, and moved at least once — ordered by how many times. Usually the most ' +
      'useful thing the practice report has to say.',
    limit: 'read',
    responds: { 200: 'Carried tasks, most-deferred first' },
  },
  controller.carried
);

router.post(
  '/',
  {
    summary: 'Add a task',
    limit: 'write',
    body: z.object({
      title: z.string().trim().min(1).max(200),
      note: z.string().max(1000).optional(),
      date: dateString.optional(),
    }),
    responds: { 201: 'The new task' },
  },
  controller.create
);

router.patch(
  '/:id',
  {
    summary: 'Update a task',
    description:
      'Title, note, order, and done or not. Un-ticking clears the completion time, so a ' +
      'report can never show a finish time for something unfinished. A task that was moved ' +
      'to another day is read-only — edit its copy on that day.',
    limit: 'write',
    params: schemas.id,
    body: z.object({
      title: z.string().trim().min(1).max(200).optional(),
      note: z.string().max(1000).nullable().optional(),
      status: z.enum(['PENDING', 'DONE', 'SKIPPED']).optional(),
      displayOrder: z.coerce.number().int().min(0).optional(),
    }),
    responds: { 200: 'The updated task', 400: 'Task was moved', 403: 'Not your task' },
  },
  controller.update
);

router.post(
  '/:id/move',
  {
    summary: 'Move a task to a later day',
    description:
      'Marks this task MOVED and creates a copy on the target day — tomorrow unless a date is ' +
      'given. Only forward: a task cannot be pushed into the past, which would rewrite a day ' +
      'that has already been reported on.',
    limit: 'write',
    params: schemas.id,
    body: z.object({ date: dateString.optional() }),
    responds: {
      201: 'The copy on the new day',
      400: 'Already moved, already done, or the date is not in the future',
    },
  },
  controller.move
);

router.delete(
  '/:id',
  {
    summary: 'Delete a task',
    limit: 'write',
    params: schemas.id,
    responds: { 204: 'Deleted', 403: 'Not your task' },
  },
  controller.remove
);

module.exports = router;
