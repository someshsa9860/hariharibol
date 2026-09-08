import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/user.js';

const router = createRouter({
  tag: 'Admin · Users',
  prefix: '/users',
  description:
    'Search, inspect, promote and ban. One users table — an admin is a user whose role ' +
    'carries admin permissions, not a separate kind of account.',
});

router.get(
  '/',
  {
    summary: 'List users',
    description: 'Search by name or email, filter by role, entitlement or ban state.',
    permission: 'user.read',
    limit: 'read',
    query: schemas.page.extend({
      role: z.string().max(50).optional(),
      isPremium: z.coerce.boolean().optional(),
      isBanned: z.coerce.boolean().optional(),
    }),
    responds: { 200: 'A page of users' },
  },
  controller.list
);

router.get(
  '/:id',
  {
    summary: 'Get one user',
    description:
      'Profile, language choices, entitlement, devices, subscriptions and activity counts.',
    permission: 'user.read',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The user', 404: 'No such user' },
  },
  controller.get
);

router.patch(
  '/:id/role',
  {
    summary: 'Change a user’s role',
    description:
      'Takes effect immediately — the cached permission set is cleared, rather than the ' +
      'change waiting out a cache TTL.',
    permission: 'role.manage',
    limit: 'write',
    params: schemas.id,
    body: z.object({ roleSlug: z.string().min(1).max(50) }),
    responds: { 200: 'The updated user', 404: 'No such user or role' },
  },
  controller.setRole
);

router.post(
  '/:id/ban',
  {
    summary: 'Ban a user',
    description:
      'Sets the flag, writes a history row, and revokes every session. Without the last ' +
      'part the ban would only take hold whenever the access token happened to expire.',
    permission: 'user.ban',
    limit: 'write',
    params: schemas.id,
    body: z.object({ reason: z.string().trim().min(3).max(1000) }),
    responds: { 200: 'The banned user', 400: 'Already banned, or it is your own account' },
  },
  controller.ban
);

router.post(
  '/:id/unban',
  {
    summary: 'Lift a ban',
    permission: 'user.ban',
    limit: 'write',
    params: schemas.id,
    body: z.object({ reason: z.string().max(1000).optional() }),
    responds: { 200: 'The user' },
  },
  controller.unban
);

router.get(
  '/:id/bans',
  {
    summary: 'Get a user’s ban history',
    description: 'Who banned them, why, and whether it was lifted — the flag alone says none of that.',
    permission: 'user.read',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'Ban records' },
  },
  controller.bans
);

router.delete(
  '/:id',
  {
    summary: 'Delete a user',
    description:
      'Permanent, and cascades to their practice history. The audit trail survives — ' +
      'AuditLog.actorId is set-null rather than cascading, because the record has to outlive ' +
      'the person it is about.',
    permission: 'user.delete',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'Deleted', 400: 'That is your own account' },
  },
  controller.remove
);

export default router;
