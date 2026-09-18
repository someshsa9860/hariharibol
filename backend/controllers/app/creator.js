// Creator profiles, and following them.
//
// A CreatorProfile is a capability on a User, not a Role — Role/Permission is
// admin-panel access, which has nothing to do with whether someone posts
// reels. See the model's own comment.
//
// Nothing here creates or approves a creator: applying and being reviewed
// belong to the admin panel, and until that exists a creator is made by seed
// or by hand. What this file covers is the reader's side — opening a profile,
// browsing what they posted, and following them.

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import { readPage } from '../../utils/pagination.js';
import { ok, paginated } from '../../utils/respond.js';
import { notFound, badRequest } from '../../utils/errors.js';
import { REEL_PAGE_SIZE_DEFAULT } from '../../config/constants.js';

// Only an approved creator has a profile worth showing. A pending or rejected
// one is not a 403 — from the reader's side it simply does not exist.
const visibleWhere = (userId) => ({
  OR: [{ status: 'APPROVED' }, { userId }],
});

/**
 * GET /api/app/creators
 *
 * The reader's own following list. Not a directory of everyone — a browsable
 * creator list is a discovery surface that does not exist yet, and returning
 * every approved creator would quietly become one.
 */
export const list = async (req, res) => {
  const user = req.auth.user;
  const { page, pageSize, skip, take } = readPage(req.valid.query);

  const where = { followers: { some: { followerId: user.id } }, status: 'APPROVED' };

  const [total, rows] = await Promise.all([
    prisma.creatorProfile.count({ where }),
    prisma.creatorProfile.findMany({
      where,
      orderBy: { followerCount: 'desc' },
      skip,
      take,
      include: {
        user: { select: { avatarUrl: true } },
        followers: { where: { followerId: user.id }, select: { followerId: true } },
      },
    }),
  ]);

  return paginated(res, await present.creators(rows, user), { page, pageSize, total });
};

/** GET /api/app/creators/:id */
export const get = async (req, res) => {
  const user = req.auth.user;

  const row = await prisma.creatorProfile.findFirst({
    where: { id: req.valid.params.id, ...visibleWhere(user.id) },
    include: {
      user: { select: { avatarUrl: true } },
      followers: { where: { followerId: user.id }, select: { followerId: true } },
    },
  });
  if (!row) throw notFound('Creator');

  return ok(res, await present.creator(row, user));
};

/**
 * GET /api/app/creators/:id/reels
 *
 * A creator's own grid. Pinned first, then newest — the profile is a body of
 * work rather than a feed, so this is plain chronology with no ranking over
 * it, and it deliberately *does* include the reader's own reels when they are
 * looking at their own profile.
 */
export const reels = async (req, res) => {
  const user = req.auth.user;
  const { page, pageSize, skip, take } = readPage(req.valid.query, REEL_PAGE_SIZE_DEFAULT);

  const creator = await prisma.creatorProfile.findFirst({
    where: { id: req.valid.params.id, ...visibleWhere(user.id) },
    select: { id: true, userId: true },
  });
  if (!creator) throw notFound('Creator');

  // Looking at your own profile shows everything you posted, whatever state it
  // is in. Anyone else sees only what is published.
  const isMine = creator.userId === user.id;
  const where = { creatorId: creator.id, ...(isMine ? {} : { status: 'PUBLISHED' }) };

  const [total, rows] = await Promise.all([
    prisma.reel.count({ where }),
    prisma.reel.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
      include: present.includes.reel(user.id),
    }),
  ]);

  return paginated(res, await present.reels(rows, user), { page, pageSize, total });
};

/**
 * POST /api/app/creators/:id/follow
 *
 * Idempotent, the same way liking is: `skipDuplicates` reports whether a row
 * was written and the follower count follows that, so a double tap on a slow
 * connection cannot inflate the number.
 */
export const follow = async (req, res) => {
  const user = req.auth.user;
  const id = req.valid.params.id;

  const creator = await prisma.creatorProfile.findFirst({
    where: { id, status: 'APPROVED' },
    select: { id: true, userId: true },
  });
  if (!creator) throw notFound('Creator');
  if (creator.userId === user.id) throw badRequest('You cannot follow yourself');

  const followerCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.creatorFollow.createMany({
      data: [{ followerId: user.id, creatorId: creator.id }],
      skipDuplicates: true,
    });
    const updated = await tx.creatorProfile.update({
      where: { id: creator.id },
      data: count ? { followerCount: { increment: 1 } } : {},
      select: { followerCount: true },
    });
    return updated.followerCount;
  });

  return ok(res, { id: creator.id, isFollowing: true, followerCount });
};

/** DELETE /api/app/creators/:id/follow */
export const unfollow = async (req, res) => {
  const user = req.auth.user;
  const id = req.valid.params.id;

  const followerCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.creatorFollow.deleteMany({
      where: { followerId: user.id, creatorId: id },
    });
    const updated = await tx.creatorProfile.update({
      where: { id },
      data: count ? { followerCount: { decrement: 1 } } : {},
      select: { followerCount: true },
    });
    // Clamped, same as every other denormalised counter — a cache that has
    // drifted settles back to something believable rather than going negative.
    return Math.max(0, updated.followerCount);
  });

  return ok(res, { id, isFollowing: false, followerCount });
};
