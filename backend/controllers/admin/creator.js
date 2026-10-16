// Creators, managed from the admin panel.
//
// A creator is a User with a CreatorProfile — one account, one users table. This
// file never changes a user's role: someone can be a super admin and a creator,
// or an ordinary reader and a creator, and the two are granted separately.
//
// Only APPROVED creators' reels reach the feed, which is why status changes here
// matter: suspending a creator takes their reels out of the app without deleting
// anything, and approving brings them back.

import { prisma } from '../../config/database.js';
import * as audit from '../../services/audit.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { paginate, readSort } from '../../utils/pagination.js';
import { notFound, badRequest } from '../../utils/errors.js';

export const SORT_COLUMNS = {
  createdAt: 'createdAt',
  name: 'displayName',
  status: 'status',
  reels: 'reelCount',
  followers: 'followerCount',
};

const SELECT = {
  id: true,
  userId: true,
  displayName: true,
  bio: true,
  status: true,
  rejectionReason: true,
  isVerified: true,
  appliedAt: true,
  approvedAt: true,
  followerCount: true,
  reelCount: true,
  createdAt: true,
  user: { select: { id: true, email: true, name: true, avatarUrl: true, role: { select: { slug: true, name: true } } } },
};

/** GET /api/admin/creators */
export const list = async (req, res) => {
  const { q, status } = req.valid.query;

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { displayName: { contains: q, mode: 'insensitive' } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
            { user: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const { items, page } = await paginate(prisma.creatorProfile, {
    where,
    orderBy: readSort(req.valid.query, SORT_COLUMNS, { createdAt: 'desc' }),
    select: SELECT,
    query: req.valid.query,
  });

  return paginated(res, items, page);
};

/** POST /api/admin/creators */
export const create = async (req, res) => {
  const { userId, displayName, bio, isVerified, status = 'APPROVED' } = req.valid.body;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, creatorProfile: { select: { id: true } } },
  });
  if (!user) throw notFound('User');
  if (user.creatorProfile) throw badRequest('That user is already a creator');

  const approved = status === 'APPROVED';
  const creator = await prisma.creatorProfile.create({
    data: {
      userId,
      displayName: displayName || user.name || user.email.split('@')[0],
      bio: bio ?? null,
      isVerified: isVerified ?? false,
      status,
      ...(approved ? { approvedAt: new Date(), approvedById: req.auth.user.id } : {}),
    },
    select: SELECT,
  });

  await audit.record(req, {
    action: 'creator.create',
    entityType: 'CreatorProfile',
    entityId: creator.id,
    after: { userId, status },
  });

  return created(res, creator);
};

/** PATCH /api/admin/creators/:id */
export const update = async (req, res) => {
  const body = req.valid.body;

  const before = await prisma.creatorProfile.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('Creator');

  const data = {};
  for (const key of ['displayName', 'bio', 'isVerified']) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  if (body.status && body.status !== before.status) {
    const turnedAway = body.status === 'REJECTED' || body.status === 'SUSPENDED';
    if (turnedAway && !body.rejectionReason?.trim()) throw badRequest('Give a reason');

    data.status = body.status;
    data.rejectionReason = turnedAway ? body.rejectionReason.trim() : null;
    if (body.status === 'APPROVED') {
      data.approvedAt = new Date();
      data.approvedById = req.auth.user.id;
    }
  }

  const creator = await prisma.creatorProfile.update({
    where: { id: before.id },
    data,
    select: SELECT,
  });

  await audit.record(req, {
    action: 'creator.update',
    entityType: 'CreatorProfile',
    entityId: before.id,
    before: { status: before.status, displayName: before.displayName, isVerified: before.isVerified },
    after: { status: creator.status, displayName: creator.displayName, isVerified: creator.isVerified },
  });

  return ok(res, creator);
};

/** DELETE /api/admin/creators/:id */
export const remove = async (req, res) => {
  const creator = await prisma.creatorProfile.findUnique({
    where: { id: req.valid.params.id },
    select: { id: true, userId: true, _count: { select: { reels: true } } },
  });
  if (!creator) throw notFound('Creator');
  if (creator._count.reels > 0) {
    throw badRequest('This creator still has reels. Suspend them instead, or delete the reels first.');
  }

  await prisma.creatorProfile.delete({ where: { id: creator.id } });

  await audit.record(req, {
    action: 'creator.delete',
    entityType: 'CreatorProfile',
    entityId: creator.id,
    before: { userId: creator.userId },
  });

  return ok(res, { deleted: true });
};
