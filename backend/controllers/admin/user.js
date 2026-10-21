// User administration: search, inspect, change role, ban.
//
// Bans are recorded twice on purpose. The flag on User and Device is the fast
// check the auth middleware reads on every request; the Ban table is the
// history — who issued it, why, and whether it was lifted. The flag alone
// answers "is this person blocked" and nothing else.

import { prisma } from '../../config/database.js';
import * as authService from '../../services/auth.js';
import * as audit from '../../services/audit.js';
import * as chatImages from '../../services/chat-images.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { paginate, readSort } from '../../utils/pagination.js';
import { notFound, badRequest, conflict, forbidden } from '../../utils/errors.js';
import { randomUUID } from 'node:crypto';
import { ROLES, DEFAULT_ROUND_TARGET } from '../../config/constants.js';

const LIST_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  authProvider: true,
  isPremium: true,
  premiumUntil: true,
  isBanned: true,
  createdAt: true,
  lastActiveAt: true,
  role: { select: { slug: true, name: true } },
  // A creator is the same account with a profile attached, not another kind of user.
  creatorProfile: { select: { id: true, status: true } },
};

// Columns the users table can be sorted by — see readSort.
export const SORT_COLUMNS = {
  createdAt: 'createdAt',
  lastActiveAt: 'lastActiveAt',
  name: 'name',
  email: 'email',
  role: 'role.name',
};

/** GET /api/admin/users */
export const list = async (req, res) => {
  const { q, role, isPremium, isBanned, staff } = req.valid.query;

  const where = {
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(role ? { role: { slug: role } } : {}),
    // Admin-type accounts: any role that carries permissions (moderator, admin, auditor…).
    ...(staff ? { role: { permissions: { some: {} } } } : {}),
    ...(isPremium !== undefined ? { isPremium } : {}),
    ...(isBanned !== undefined ? { isBanned } : {}),
  };

  const { items, page } = await paginate(prisma.user, {
    where,
    orderBy: readSort(req.valid.query, SORT_COLUMNS, { createdAt: 'desc' }),
    select: LIST_SELECT,
    query: req.valid.query,
  });

  return paginated(res, items, page);
};

/**
 * POST /api/admin/users
 * Adds a person by email before they have ever signed in. Nobody's password or
 * Google/Apple id is known yet, so the row is made as a LEGACY account — the
 * same placeholder the old-app carry-over uses. The first verified Google or
 * Apple sign-in with that address adopts it (claimLegacy in controllers/app/auth.js),
 * keeping the role chosen here. Until then it cannot sign in, and sign-ups being
 * closed does not stop it. Any role other than `user` needs role.manage.
 */
export const create = async (req, res) => {
  const { name, roleSlug } = req.valid.body;
  const email = req.valid.body.email.toLowerCase();

  const slug = roleSlug || ROLES.USER;
  if (slug !== ROLES.USER && !req.auth.permissions.has('role.manage')) {
    throw forbidden('Only a super admin can give someone an admin role');
  }

  const [role, taken] = await Promise.all([
    prisma.role.findUnique({ where: { slug } }),
    prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } }),
  ]);
  if (!role) throw notFound('Role');
  if (taken) throw conflict('Someone with that email already has an account — change their role instead');

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      authProvider: 'LEGACY',
      providerUserId: `invite:${randomUUID()}`,
      roleId: role.id,
      sadhanaProfile: { create: { dailyRoundTarget: DEFAULT_ROUND_TARGET } },
    },
    select: LIST_SELECT,
  });

  await audit.record(req, {
    action: 'user.create',
    entityType: 'User',
    entityId: user.id,
    after: { email, roleSlug: slug },
  });

  return created(res, user);
};

/** GET /api/admin/users/:id — the full picture for one person. */
export const get = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.valid.params.id },
    select: {
      ...LIST_SELECT,
      appLanguage: true,
      mantraLanguage: true,
      readingLanguage: true,
      timezone: true,
      premiumSince: true,
      bannedReason: true,
      bannedAt: true,
      sadhanaProfile: true,
      _count: {
        select: {
          sadhanaDays: true,
          chantSessions: true,
          issues: true,
          payments: true,
          devices: true,
        },
      },
      devices: {
        select: { id: true, deviceId: true, platform: true, appVersion: true, lastSeenAt: true },
        orderBy: { lastSeenAt: 'desc' },
        take: 10,
      },
      subscriptions: {
        select: { id: true, status: true, provider: true, currentPeriodEnd: true },
        orderBy: { currentPeriodEnd: 'desc' },
        take: 5,
      },
    },
  });
  if (!user) throw notFound('User');

  return ok(res, user);
};

/**
 * PATCH /api/admin/users/:id/role
 * A person can be an ordinary user and an admin at once — it is one account
 * with one role, and the app hides the admin entry point when the role carries
 * no permissions.
 */
export const setRole = async (req, res) => {
  const { roleSlug } = req.valid.body;

  const [user, role] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.valid.params.id },
      select: { id: true, roleId: true, email: true },
    }),
    prisma.role.findUnique({ where: { slug: roleSlug } }),
  ]);

  if (!user) throw notFound('User');
  if (!role) throw notFound('Role');

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { roleId: role.id },
    select: LIST_SELECT,
  });

  // The cached auth payload carries the permission set, so without this the
  // change would not take effect until the cache expired.
  await authService.invalidateUser(user.id);

  await audit.record(req, {
    action: 'user.role.update',
    entityType: 'User',
    entityId: user.id,
    before: { roleId: user.roleId },
    after: { roleId: role.id, roleSlug },
  });

  return ok(res, updated);
};

/**
 * POST /api/admin/users/:id/ban
 * Sets the flag, writes the history row, and ends every live session — leaving
 * a banned account with working tokens would mean the ban only takes effect
 * whenever the access token happens to expire.
 */
export const ban = async (req, res) => {
  const { reason } = req.valid.body;
  const userId = req.valid.params.id;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isBanned: true } });
  if (!user) throw notFound('User');
  if (user.isBanned) throw badRequest('That account is already banned');
  if (userId === req.auth.user.id) throw badRequest('You cannot ban yourself');

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { isBanned: true, bannedReason: reason, bannedAt: new Date() },
      select: LIST_SELECT,
    }),
    prisma.ban.create({ data: { userId, actorId: req.auth.user.id, reason } }),
  ]);

  await authService.revokeAllForUser(userId);

  await audit.record(req, {
    action: 'user.ban',
    entityType: 'User',
    entityId: userId,
    after: { reason },
  });

  return ok(res, updated);
};

/** POST /api/admin/users/:id/unban */
export const unban = async (req, res) => {
  const { reason } = req.valid.body;
  const userId = req.valid.params.id;

  const openBan = await prisma.ban.findFirst({
    where: { userId, liftedAt: null },
    orderBy: { bannedAt: 'desc' },
  });

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { isBanned: false, bannedReason: null, bannedAt: null },
      select: LIST_SELECT,
    }),
    ...(openBan
      ? [
          prisma.ban.update({
            where: { id: openBan.id },
            data: { liftedAt: new Date(), liftedById: req.auth.user.id, liftReason: reason },
          }),
        ]
      : []),
  ]);

  await authService.invalidateUser(userId);
  await audit.record(req, { action: 'user.unban', entityType: 'User', entityId: userId, after: { reason } });

  return ok(res, updated);
};

/** GET /api/admin/users/:id/bans — the ban history for one account. */
export const bans = async (req, res) => {
  const bans = await prisma.ban.findMany({
    where: { userId: req.valid.params.id },
    orderBy: { bannedAt: 'desc' },
    include: {
      actor: { select: { id: true, name: true, email: true } },
      device: { select: { deviceId: true, platform: true } },
    },
  });
  return ok(res, bans);
};

/**
 * POST /api/admin/devices/:deviceId/ban
 * Blocks an installation rather than an account. The reason this exists
 * separately: someone whose account is banned can sign up again in a minute,
 * and the device is the part that does not change.
 */
export const banDevice = async (req, res) => {
  const { reason } = req.valid.body;

  const device = await prisma.device.findUnique({ where: { deviceId: req.valid.params.deviceId } });
  if (!device) throw notFound('Device');

  const [updated] = await prisma.$transaction([
    prisma.device.update({
      where: { id: device.id },
      data: { isBanned: true, bannedReason: reason, bannedAt: new Date() },
    }),
    prisma.ban.create({ data: { deviceId: device.id, actorId: req.auth.user.id, reason } }),
  ]);

  await audit.record(req, {
    action: 'device.ban',
    entityType: 'Device',
    entityId: device.id,
    after: { reason },
  });

  return ok(res, updated);
};

/**
 * DELETE /api/admin/users/:id
 * A real delete. The cascades in the schema take the practice history with it;
 * the audit trail survives, because AuditLog.actorId is set-null rather than
 * cascading — the record has to outlive the person it is about.
 */
export const remove = async (req, res) => {
  const userId = req.valid.params.id;
  if (userId === req.auth.user.id) throw badRequest('You cannot delete your own account here');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) throw notFound('User');

  const pictures = await chatImages.keysWhere({ conversation: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await chatImages.deleteFiles(pictures);
  await authService.invalidateUser(userId);

  await audit.record(req, {
    action: 'user.delete',
    entityType: 'User',
    entityId: userId,
    before: { email: user.email },
  });

  return ok(res, { deleted: true });
};
