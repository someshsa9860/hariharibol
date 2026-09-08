import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/setting.js';

const router = createRouter({
  tag: 'Admin · Settings',
  prefix: '/settings',
  description:
    'The handful of values that can change without a deploy. Anything static belongs in ' +
    'config/ instead — this is only for what must change at runtime.',
});

router.get(
  '/',
  {
    summary: 'List settings',
    description:
      'The known settings with their help text, plus anything set that is no longer in the ' +
      'catalogue. A secret’s value is never returned — only whether one has been set.',
    permission: 'setting.read',
    limit: 'read',
    responds: { 200: 'Settings' },
  },
  controller.list
);

router.put(
  '/:key',
  {
    summary: 'Set a value',
    description:
      'Marking a value secret encrypts it at rest and makes it unreadable through the API ' +
      'from then on. An admin panel that can display an API key is one that leaks it the ' +
      'first time someone screenshots a bug.',
    permission: 'setting.write',
    limit: 'write',
    params: z.object({ key: z.string().min(1).max(100) }),
    body: z.object({
      value: z.string().max(5000),
      isSecret: z.boolean().optional(),
    }),
    responds: { 200: 'Saved', 400: 'Value is not one of the allowed options' },
  },
  controller.set
);

export default router;
