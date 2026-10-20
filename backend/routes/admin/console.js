import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/console.js';

const router = createRouter({
  tag: 'Admin · Console',
  prefix: '/console',
  description:
    'Super-admin only. A fixed list of backend commands and a SQL box. Every run is written to the audit log. ' +
    'There is no way to run an arbitrary shell command.',
});

router.get(
  '/commands',
  {
    summary: 'List the commands that can be run, and recent runs',
    permission: 'console.run',
    limit: 'read',
    responds: { 200: 'Commands, recent runs and the id of the one running now' },
  },
  controller.listCommands
);

router.post(
  '/commands/:id/run',
  {
    summary: 'Start a command',
    description: 'Returns at once with a run id; poll GET /console/runs/:id for the output. One command runs at a time.',
    permission: 'console.run',
    limit: 'write',
    params: z.object({ id: z.string().min(1).max(60) }),
    body: z.object({ params: z.record(z.string().max(200)).optional() }),
    responds: { 201: 'The run, still running', 400: 'Bad parameter or unavailable here', 404: 'No such command', 409: 'Another command is running' },
  },
  controller.runCommand
);

router.get(
  '/runs/:id',
  {
    summary: 'Get a command run with its output so far',
    permission: 'console.run',
    limit: 'read',
    params: z.object({ id: z.string().min(1).max(60) }),
    responds: { 200: 'The run', 404: 'No such run (runs live in memory and clear on restart)' },
  },
  controller.getRun
);

router.post(
  '/sql',
  {
    summary: 'Run one SQL statement',
    description:
      'Read mode runs in a READ ONLY transaction. Write mode needs confirm: true and, unless dryRun is false, ' +
      'is rolled back after reporting what it would have done. 15 second limit; at most 1000 rows are returned.',
    permission: 'console.run',
    limit: 'write',
    body: z.object({
      sql: z.string().min(1).max(20000),
      mode: z.enum(['read', 'write']).default('read'),
      confirm: z.boolean().optional(),
      dryRun: z.boolean().default(true),
    }),
    responds: { 200: 'Rows, or the number of rows affected', 400: 'Not allowed, or Postgres rejected it' },
  },
  controller.runSql
);

router.get(
  '/schema',
  {
    summary: 'List every table with its columns and an estimated row count',
    permission: 'console.run',
    limit: 'read',
    responds: { 200: 'Tables in the public schema' },
  },
  controller.schema
);

export default router;
