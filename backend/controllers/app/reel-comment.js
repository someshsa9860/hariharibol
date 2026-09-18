// Comments on reels.
//
// Its own resource rather than a section of controllers/app/reel.js, the same
// way verse notes and verse highlights sit beside verses instead of inside
// them: a comment is read, written, liked, deleted and reported on its own,
// and folding all of that into the reel controller would double that file for
// something that is only ever addressed by its own id.
//
// **Threads go exactly one level deep.** Replying to a reply attaches to the
// same parent, so a thread renders at a fixed indent and never needs a tree.
// That is the shape Instagram and YouTube both settled on, and the flattening
// happens here rather than being trusted to the client — a `parentId` pointing
// at a reply is silently re-pointed at its parent instead of being rejected,
// because the person typing did nothing wrong.
//
// A hidden comment is kept, not deleted. Moderation takes the text away and
// leaves the row, so replies underneath still make sense and a thread does not
// silently renumber itself.

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import logger from '../../config/logger.js';
import { readPage } from '../../utils/pagination.js';
import { ok, created, noContent, paginated } from '../../utils/respond.js';
import { notFound, forbidden } from '../../utils/errors.js';
import { loadLiveReel, notifyCreator } from './reel.js';
import {
  REEL_COMMENT_PAGE_SIZE,
  REEL_REPLY_PAGE_SIZE,
} from '../../config/constants.js';

// How much of a comment goes into the notification the creator sees.
const NOTIFICATION_PREVIEW = 80;

const preview = (text) =>
  text.length > NOTIFICATION_PREVIEW ? `${text.slice(0, NOTIFICATION_PREVIEW - 1)}…` : text;

/**
 * GET /api/app/reel-comments?reelId=&parentId=
 *
 * One endpoint for both levels: without `parentId` it returns the top of the
 * thread, with one it returns that comment's replies. They differ only in a
 * where clause and a page size, and splitting them would mean two routes, two
 * controllers and two client methods to keep in step.
 *
 * Ordering differs between the two on purpose. Top-level comments are newest
 * first, because that is what a reader dropping into a live reel wants.
 * Replies are oldest first, because a reply thread is a conversation and
 * reading one backwards makes no sense.
 */
export const list = async (req, res) => {
  const user = req.auth.user;
  const { reelId, parentId } = req.valid.query;

  const isReplies = Boolean(parentId);
  const { page, pageSize, skip, take } = readPage(
    req.valid.query,
    isReplies ? REEL_REPLY_PAGE_SIZE : REEL_COMMENT_PAGE_SIZE
  );

  const where = { reelId, parentId: parentId || null };

  const [total, rows] = await Promise.all([
    prisma.reelComment.count({ where }),
    prisma.reelComment.findMany({
      where,
      // The creator can pin one comment, and a pinned comment sits above the
      // ordering rather than inside it.
      orderBy: isReplies
        ? [{ createdAt: 'asc' }]
        : [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      skip,
      take,
      include: present.includes.reelComment(user.id),
    }),
  ]);

  return paginated(res, present.reelComments(rows, user), { page, pageSize, total });
};

/**
 * POST /api/app/reel-comments
 *
 * Writes the comment and moves two counters: the reel's total, and — for a
 * reply — the parent's. All three in one transaction, because a comment
 * visible in the list but missing from the count under the video is the bug
 * nobody can reproduce later.
 */
export const add = async (req, res) => {
  const user = req.auth.user;
  const { reelId, text } = req.valid.body;

  const reel = await loadLiveReel(reelId);

  // One level deep: a parentId pointing at a reply is re-pointed at that
  // reply's own parent rather than refused.
  let parentId = req.valid.body.parentId || null;
  let replyingTo = null;
  if (parentId) {
    const parent = await prisma.reelComment.findFirst({
      where: { id: parentId, reelId: reel.id },
      select: { id: true, parentId: true, userId: true },
    });
    if (!parent) throw notFound('Comment');
    parentId = parent.parentId || parent.id;
    replyingTo = parent.userId;
  }

  const row = await prisma.$transaction(async (tx) => {
    const comment = await tx.reelComment.create({
      data: { reelId: reel.id, userId: user.id, parentId, text },
      include: present.includes.reelComment(user.id),
    });

    // The count under a reel is every comment on it, replies included — that
    // is what "42 comments" means to the person reading it.
    await tx.reel.update({ where: { id: reel.id }, data: { commentCount: { increment: 1 } } });

    if (parentId) {
      await tx.reelComment.update({
        where: { id: parentId },
        data: { replyCount: { increment: 1 } },
      });
    }

    return comment;
  });

  // Fire-and-forget, deliberately not awaited — see notifyCreator.
  const actorName = user.name || 'Someone';
  if (parentId && replyingTo) {
    notifyCreator(replyingTo, user, {
      title: `${actorName} replied to you`,
      body: preview(text),
      data: { kind: 'reel_reply', reelId: reel.id, commentId: row.id },
    });
  } else {
    notifyCreator(reel.creator.userId, user, {
      title: `${actorName} commented on your reel`,
      body: preview(text),
      data: { kind: 'reel_comment', reelId: reel.id, commentId: row.id },
    });
  }

  return created(res, present.reelComment(row, user));
};

/**
 * DELETE /api/app/reel-comments/:id
 *
 * Deletable by whoever wrote it and by whoever posted the reel — a creator
 * moderating their own comments is the ordinary case, not an admin action.
 *
 * Deleting a top-level comment takes its replies with it (the schema's
 * `SetNull` would otherwise leave them orphaned at the top of the thread), so
 * the reel's count comes down by the whole subtree rather than by one.
 */
export const remove = async (req, res) => {
  const user = req.auth.user;

  const comment = await prisma.reelComment.findUnique({
    where: { id: req.valid.params.id },
    select: {
      id: true,
      userId: true,
      reelId: true,
      parentId: true,
      replyCount: true,
      reel: { select: { creator: { select: { userId: true } } } },
    },
  });
  if (!comment) throw notFound('Comment');

  const isAuthor = comment.userId === user.id;
  const isReelOwner = comment.reel?.creator?.userId === user.id;
  if (!isAuthor && !isReelOwner) throw forbidden('That comment is not yours to delete');

  await prisma.$transaction(async (tx) => {
    // Counted rather than trusted: replyCount is a cache, and the number of
    // rows actually removed is what the reel's total has to come down by.
    const replies = comment.parentId
      ? 0
      : await tx.reelComment.count({ where: { parentId: comment.id } });

    if (replies) await tx.reelComment.deleteMany({ where: { parentId: comment.id } });
    await tx.reelComment.delete({ where: { id: comment.id } });

    await tx.reel.update({
      where: { id: comment.reelId },
      data: { commentCount: { decrement: 1 + replies } },
    });

    if (comment.parentId) {
      await tx.reelComment.update({
        where: { id: comment.parentId },
        data: { replyCount: { decrement: 1 } },
      });
    }
  });

  return noContent(res);
};

/**
 * POST /api/app/reel-comments/:id/like
 *
 * Same idempotent shape as liking a reel — `skipDuplicates` reports whether a
 * row was actually written, and the counter follows that rather than the
 * request.
 */
export const like = async (req, res) => {
  const user = req.auth.user;
  const id = req.valid.params.id;

  const exists = await prisma.reelComment.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound('Comment');

  const likeCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.reelCommentLike.createMany({
      data: [{ userId: user.id, commentId: id }],
      skipDuplicates: true,
    });
    const updated = await tx.reelComment.update({
      where: { id },
      data: count ? { likeCount: { increment: 1 } } : {},
      select: { likeCount: true },
    });
    return updated.likeCount;
  });

  return ok(res, { id, isLiked: true, likeCount });
};

/** DELETE /api/app/reel-comments/:id/like */
export const unlike = async (req, res) => {
  const user = req.auth.user;
  const id = req.valid.params.id;

  const likeCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.reelCommentLike.deleteMany({
      where: { userId: user.id, commentId: id },
    });
    const updated = await tx.reelComment.update({
      where: { id },
      data: count ? { likeCount: { decrement: 1 } } : {},
      select: { likeCount: true },
    });
    return Math.max(0, updated.likeCount);
  });

  return ok(res, { id, isLiked: false, likeCount });
};

/**
 * POST /api/app/reel-comments/:id/pin
 *
 * The creator's one pinned comment. Setting a new one clears the old, so the
 * "one" is enforced here rather than left to the caller to remember.
 */
export const pin = async (req, res) => {
  const user = req.auth.user;
  const id = req.valid.params.id;

  const comment = await prisma.reelComment.findUnique({
    where: { id },
    select: {
      id: true,
      reelId: true,
      parentId: true,
      isPinned: true,
      reel: { select: { creator: { select: { userId: true } } } },
    },
  });
  if (!comment) throw notFound('Comment');
  if (comment.reel?.creator?.userId !== user.id) {
    throw forbidden('Only the creator can pin a comment on their reel');
  }
  // A pinned reply would sit at the top of a thread it is not the top of.
  if (comment.parentId) throw forbidden('Only a top-level comment can be pinned');

  const pinned = !comment.isPinned;

  await prisma.$transaction(async (tx) => {
    if (pinned) {
      await tx.reelComment.updateMany({
        where: { reelId: comment.reelId, isPinned: true },
        data: { isPinned: false },
      });
    }
    await tx.reelComment.update({ where: { id }, data: { isPinned: pinned } });
  });

  return ok(res, { id, isPinned: pinned });
};

/**
 * POST /api/app/reel-comments/:id/report
 *
 * Same idempotence as reporting a reel: tapping again because nothing visibly
 * happened returns the open report instead of writing a second one.
 */
export const report = async (req, res) => {
  const user = req.auth.user;
  const id = req.valid.params.id;

  const comment = await prisma.reelComment.findUnique({ where: { id }, select: { id: true } });
  if (!comment) throw notFound('Comment');

  const existing = await prisma.reelReport.findFirst({
    where: { commentId: id, reporterId: user.id, reviewedAt: null },
  });
  if (existing) return created(res, { id: existing.id, alreadyReported: true });

  const row = await prisma.reelReport.create({
    data: {
      commentId: id,
      reporterId: user.id,
      reason: req.valid.body.reason,
      note: req.valid.body.note || null,
    },
  });

  logger.info({ commentId: id, reason: row.reason }, 'reel comment reported');
  return created(res, { id: row.id, alreadyReported: false });
};
