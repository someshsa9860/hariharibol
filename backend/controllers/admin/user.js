// User administration: search, inspect, change role, ban.
//
// Bans are recorded twice on purpose. The flag on User and Device is the fast
// check the auth middleware reads on every request; the Ban table is the
// history — who issued it, why, and whether it was lifted. The flag alone
// answers "is this person blocked" and nothing else.

import { prisma } from '../../config/database.js';
import * as authService from '../../services/auth.js';
import * as audit from '../../services/audit.js';
import { ok, paginated } from '../../utils/respond.js';
import { paginate } from '../../utils/pagination.js';
import { notFound, badRequest } from '../../utils/errors.js';

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
};

/** GET /api/admin/users */
export const list = async (req, res) => {
  const { q, role, isPremium, isBanned } = req.valid.query;

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
    ...(isPremium !== undefined ? { isPremium } : {}),
    ...(isBanned !== undefined ? { isBanned } : {}),
  };

  const { items, page } = await paginate(prisma.user, {
    where,
    orderBy: { createdAt: 'desc' },
    select: LIST_SELECT,
    query: req.valid.query,
  });

  return paginated(res, items, page);
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

  await prisma.user.delete({ where: { id: userId } });
  await authService.invalidateUser(userId);

  await audit.record(req, {
    action: 'user.delete',
    entityType: 'User',
    entityId: userId,
    before: { email: user.email },
  });

  return ok(res, { deleted: true });
};
