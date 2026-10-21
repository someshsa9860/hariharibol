import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/user.js';
import * as detail from '../../controllers/admin/user-detail.js';

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
    query: schemas.sorted(controller.SORT_COLUMNS).extend({
      role: z.string().max(50).optional(),
      isPremium: schemas.flag.optional(),
      isBanned: schemas.flag.optional(),
      staff: schemas.flag.optional(),
    }),
    responds: { 200: 'A page of users' },
  },
  controller.list
);

router.post(
  '/',
  {
    summary: 'Add a user or admin by email',
    description:
      'Makes the account before the person has signed in, as a placeholder that their first ' +
      'Google or Apple sign-in with the same address adopts, keeping the role chosen here. ' +
      'The default role is `user`; any other role (an admin) needs role.manage.',
    permission: 'user.write',
    limit: 'write',
    body: z.object({
      email: z.string().trim().email().max(255),
      name: z.string().trim().max(120).optional(),
      roleSlug: z.string().min(1).max(50).optional(),
    }),
    responds: { 201: 'The new account', 403: 'Only a super admin can add admins', 409: 'That email already has an account' },
  },
  controller.create
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

router.get(
  '/:id/overview',
  {
    summary: 'Everything about one person at a glance',
    description: 'The profile, plan, chanting totals and streaks, activity, what they read / watch / ask, devices and referrals.',
    permission: 'user.read',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The data', 404: 'No such user' },
  },
  detail.overview
);

router.get(
  '/:id/chanting',
  {
    summary: 'What a person chants',
    description: 'Per-mantra totals (rounds, sittings, minutes, last chanted) and their sittings, newest first, paged.',
    permission: 'user.read',
    limit: 'read',
    params: schemas.id,
    query: z.object({ page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(100).optional() }),
    responds: { 200: 'The data', 404: 'No such user' },
  },
  detail.chanting
);

router.get(
  '/:id/daily',
  {
    summary: 'A person day by day',
    description: 'One row per day (up to 365): rounds against target, tasks, sittings and minutes, and whether they were active.',
    permission: 'user.read',
    limit: 'read',
    params: schemas.id,
    query: z.object({ days: z.coerce.number().int().min(7).max(365).optional() }),
    responds: { 200: 'The data', 404: 'No such user' },
  },
  detail.daily
);

router.get(
  '/:id/engagement',
  {
    summary: 'What a person reads, saves, watches and is sent',
    description: 'Reading progress per book, saved items, notes, recent reels watched, Sakha conversations (titles and counts only — never what was said) and notifications.',
    permission: 'user.read',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The data', 404: 'No such user' },
  },
  detail.engagement
);

router.get(
  '/:id/billing',
  {
    summary: 'A person’s plan and money',
    description: 'Entitlement, subscriptions, payments, the Ask Sakha wallet and its ledger, and referral or admin grants.',
    permission: 'user.read',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The data', 404: 'No such user' },
  },
  detail.billing
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
