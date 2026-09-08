import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/dashboard.js';

const router = createRouter({
  tag: 'Admin · Dashboard',
  prefix: '',
  description: 'The admin landing screen, and what the signed-in admin is allowed to do.',
});

router.get(
  '/me',
  {
    summary: 'Get my admin profile and permissions',
    description:
      'The panel renders its navigation from this. An admin is an ordinary user whose role ' +
      'carries permissions — reaching this endpoint does not imply full access, so the panel ' +
      'is told exactly what this person may do.',
    responds: { 200: 'Profile with permissions, grouped for the sidebar' },
  },
  controller.me
);

router.get(
  '/dashboard',
  {
    summary: 'Get the dashboard counts',
    description:
      'Users, content, money and engagement. AI spend sits next to revenue on purpose: the ' +
      'paid feature is the one with an AI cost behind it, and those two numbers drifting ' +
      'apart is the first sign that has stopped being true.',
    permission: 'user.read',
    limit: 'read',
    responds: { 200: 'Counts' },
  },
  controller.stats
);

router.get(
  '/dashboard/signups',
  {
    summary: 'Get new accounts per day',
    permission: 'user.read',
    limit: 'read',
    query: z.object({ days: z.coerce.number().int().min(1).max(365).optional() }),
    responds: { 200: 'A date/count series' },
  },
  controller.signups
);

export default router;
