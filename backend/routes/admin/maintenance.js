import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/maintenance.js';
import { maintenance } from '../../config/maintenance.js';

const router = createRouter({
  tag: 'Admin · Maintenance',
  prefix: '/maintenance',
  description:
    'Runs a short, fixed list of backend scripts (seed and similar) from the panel. It is not a shell: the body names a ' +
    'command from the list in config/maintenance.js and nothing else. One run at a time, killed after a time limit, ' +
    'and every start and finish is in the audit log. Super admin only.',
});

router.get(
  '/',
  {
    summary: 'List the commands and read a run’s output',
    description: 'Pass `run` and `since` (the `offset` last received) to get only the new output.',
    permission: 'system.maintenance',
    limit: 'read',
    query: z.object({ run: z.string().max(60).optional(), since: z.coerce.number().int().min(0).default(0) }),
    responds: { 200: 'The commands, the latest run with its output, and recent runs' },
  },
  controller.overview
);

router.post(
  '/run',
  {
    summary: 'Run one of the listed commands',
    permission: 'system.maintenance',
    limit: 'write',
    body: z.object({ command: z.enum(maintenance.commands.map((c) => c.id)) }),
    responds: { 200: 'The run, just started', 404: 'Not a listed command', 409: 'Another command is still running' },
  },
  controller.run
);

export default router;
