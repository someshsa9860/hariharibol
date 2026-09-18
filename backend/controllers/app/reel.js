// The reels feed and everything a reader does to a reel itself — watching it,
// liking it, sharing it, reporting it. Comments are their own resource and
// live in controllers/app/reel-comment.js, the same way verse notes sit beside
// verses rather than inside them.
//
// Basic personalisation only: same-language reels and ones already gaining
// likes/comments/shares are boosted, already-watched reels are pushed down,
// recency decays the engagement boost so nothing camps at the top forever, and
// it is scored fresh on every request rather than stored. This is meant to be
// replaced by real personalisation (watch history, a rules engine like Sloka
// for You, eventually embeddings) once there is enough activity to justify it
// — see backend/CLAUDE.md's AI cost rule for why that work happens off the
// request path when it does.
//
// The ranking needs one ORDER BY over a computed expression Prisma's query
// builder cannot express, so it runs as a single raw, parameterised query
// that returns ids in rank order; the rows are then hydrated and shaped
// through Prisma as usual. Everything that decides *which* reels are eligible
// (published, creator in good standing, not the reader's own) lives in both
// this query and the `where` used for the count, so the two never disagree.
//
// Every counter on Reel is denormalised, so each write here changes two rows —
// the engagement row and the count that summarises it. They go in one
// transaction, always, because a like that is visible in the list but missing
// from the number is the bug nobody can explain afterwards.

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import * as language from '../../utils/language.js';
import * as notify from '../../services/notify.js';
import logger from '../../config/logger.js';
import { readPage } from '../../utils/pagination.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';
import {
  REEL_PAGE_SIZE_DEFAULT,
  REEL_COMPLETION_RATIO,
  REEL_MIN_VIEW_MS,
} from '../../config/constants.js';

// One score per position in the reader's language chain (readingLanguage,
// appLanguage, en) — earlier positions matter more. A reel with no
// languageCode is treated as universal (e.g. a plain chanting clip) rather
// than penalised, so it ranks alongside a reader's second-choice language.
const LANG_BOOST = [30, 20, 10];
const UNSPECIFIED_LANG_BOOST = 10;

// What an already-seen reel gives up. Watched-to-the-end is buried harder than
// merely started, because a reel someone swiped away from halfway is one they
// may well come back to, and one they finished is not.
const SEEN_PENALTY = 25;
const COMPLETED_PENALTY = 60;

const eligibleWhere = (userId) => ({
  status: 'PUBLISHED',
  creator: { status: 'APPROVED', userId: { not: userId } },
});

/** GET /api/app/reels */
export const feed = async (req, res) => {
  const user = req.auth.user;
  const { page, pageSize, skip } = readPage(req.valid.query, REEL_PAGE_SIZE_DEFAULT);
  const [lang0 = null, lang1 = null, lang2 = null] = language.readingChain(user);

  const [total, ranked] = await Promise.all([
    prisma.reel.count({ where: eligibleWhere(user.id) }),
    prisma.$queryRaw`
      SELECT r.id
      FROM "Reel" r
      JOIN "CreatorProfile" cp ON cp.id = r."creatorId"
      LEFT JOIN "ReelView" rv ON rv."reelId" = r.id AND rv."userId" = ${user.id}
      WHERE r.status = 'PUBLISHED'::"ReelStatus"
        AND cp.status = 'APPROVED'::"CreatorStatus"
        AND cp."userId" != ${user.id}
      ORDER BY
        (
          CASE
            WHEN r."languageCode" = ${lang0} THEN ${LANG_BOOST[0]}
            WHEN r."languageCode" = ${lang1} THEN ${LANG_BOOST[1]}
            WHEN r."languageCode" = ${lang2} THEN ${LANG_BOOST[2]}
            WHEN r."languageCode" IS NULL THEN ${UNSPECIFIED_LANG_BOOST}
            ELSE 0
          END
        ) + (
          -- Comments and shares take more effort than a like, so they count
          -- for more. Recency decay is the classic "hot" shape (Reddit/HN):
          -- engagement divided by (age in hours + 2) ^ 1.5, so a reel's boost
          -- fades over the following days rather than being permanent.
          (r."likeCount" + r."commentCount" * 2 + r."shareCount" * 3)::float
          / POWER(
              EXTRACT(EPOCH FROM (NOW() - COALESCE(r."publishedAt", r."createdAt"))) / 3600.0 + 2,
              1.5
            )
        ) - (
          -- Seen already. Not excluded outright: a small library would empty
          -- itself in an evening, and re-watching something is not a bug.
          CASE
            WHEN rv."completed" THEN ${COMPLETED_PENALTY}
            WHEN rv.id IS NOT NULL THEN ${SEEN_PENALTY}
            ELSE 0
          END
        ) DESC,
        r."publishedAt" DESC NULLS LAST,
        r.id ASC
      LIMIT ${pageSize} OFFSET ${skip}
    `,
  ]);

  const ids = ranked.map((row) => row.id);
  const rows = await prisma.reel.findMany({
    where: { id: { in: ids } },
    include: present.includes.reel(user.id),
  });

  // The raw query already returned ids in rank order; `findMany` with `in`
  // does not preserve it, so the hydrated rows are put back in that order.
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);

  return paginated(res, await present.reels(ordered, user), { page, pageSize, total });
};

/**
 * GET /api/app/reels/:id
 *
 * The share target and the deeplink landing point. Unlike the feed this does
 * not exclude the reader's own reels — following a link to something you
 * posted yourself should show it, not 404.
 */
export const get = async (req, res) => {
  const user = req.auth.user;

  const row = await prisma.reel.findFirst({
    where: {
      id: req.valid.params.id,
      OR: [
        { status: 'PUBLISHED', creator: { status: 'APPROVED' } },
        // Your own, whatever state it is in — including one still awaiting
        // review, which is the only way a creator can check what they posted.
        { creator: { userId: user.id } },
      ],
    },
    include: present.includes.reel(user.id),
  });
  if (!row) throw notFound('Reel');

  return ok(res, await present.reel(row, user));
};

// Loads a reel for a write, and refuses one the reader should not be acting
// on. Every engagement endpoint below starts here, so "does this reel exist
// and is it live" is answered in exactly one place.
async function loadLiveReel(id) {
  const reel = await prisma.reel.findFirst({
    where: { id, status: 'PUBLISHED', creator: { status: 'APPROVED' } },
    select: { id: true, creator: { select: { userId: true, displayName: true } } },
  });
  if (!reel) throw notFound('Reel');
  return reel;
}

/**
 * POST /api/app/reels/:id/like
 *
 * Idempotent. `createMany` with `skipDuplicates` is what makes it so: it
 * reports how many rows it actually wrote, so the counter moves on the first
 * like and stays put on a second one. A double tap is a normal thing for a
 * finger to do on a video, not an error to show someone.
 */
export const like = async (req, res) => {
  const user = req.auth.user;
  const reel = await loadLiveReel(req.valid.params.id);

  const likeCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.reelLike.createMany({
      data: [{ userId: user.id, reelId: reel.id }],
      skipDuplicates: true,
    });

    const updated = await tx.reel.update({
      where: { id: reel.id },
      data: count ? { likeCount: { increment: 1 } } : {},
      select: { likeCount: true },
    });
    return updated.likeCount;
  });

  return ok(res, { id: reel.id, isLiked: true, likeCount });
};

/** DELETE /api/app/reels/:id/like */
export const unlike = async (req, res) => {
  const user = req.auth.user;
  const id = req.valid.params.id;

  const likeCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.reelLike.deleteMany({ where: { userId: user.id, reelId: id } });

    const updated = await tx.reel.update({
      where: { id },
      // Clamped at zero. The counter is a cache of the rows, and a cache that
      // has drifted should settle back to something believable rather than
      // going negative and staying there.
      data: count ? { likeCount: { decrement: 1 } } : {},
      select: { likeCount: true },
    });
    return Math.max(0, updated.likeCount);
  });

  return ok(res, { id, isLiked: false, likeCount });
};

/**
 * POST /api/app/reels/:id/view
 *
 * The client reports where it got to, not "a view happened" — so this is safe
 * to call repeatedly for the same reel and the row simply moves forward.
 *
 * Two things are deliberately different here from the other counters:
 *
 *   - `Reel.viewCount` only moves on the *first* view by a given reader. It is
 *     a reach number used for ranking, and letting a rewatch inflate it would
 *     reward whoever loops their own reel rather than whoever made a good one.
 *   - A view under REEL_MIN_VIEW_MS is not recorded at all. Swiping through
 *     fifty reels is not fifty views, and without the floor viewCount stops
 *     meaning anything.
 */
export const recordView = async (req, res) => {
  const user = req.auth.user;
  const { watchedMs, durationMs } = req.valid.body;
  const id = req.valid.params.id;

  const reel = await prisma.reel.findFirst({
    where: { id, status: 'PUBLISHED', creator: { status: 'APPROVED' } },
    select: { id: true, durationMs: true, creatorId: true },
  });
  if (!reel) throw notFound('Reel');

  if (watchedMs < REEL_MIN_VIEW_MS) {
    return ok(res, { id, counted: false });
  }

  // The reel's own duration is the truth where it has one; the client's is the
  // fallback for a stream whose length was never recorded at upload.
  const total = reel.durationMs || durationMs || 0;
  const completed = total > 0 && watchedMs >= total * REEL_COMPLETION_RATIO;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.reelView.findUnique({
      where: { userId_reelId: { userId: user.id, reelId: id } },
      select: { id: true, completed: true, lastWatchedMs: true },
    });

    if (!existing) {
      await tx.reelView.create({
        data: {
          userId: user.id,
          reelId: id,
          watchCount: 1,
          lastWatchedMs: watchedMs,
          completed,
        },
      });
      await tx.reel.update({ where: { id }, data: { viewCount: { increment: 1 } } });
      // CreatorProfile.totalViews is the same reach number rolled up, so it
      // moves on exactly the same condition.
      await tx.creatorProfile.update({
        where: { id: reel.creatorId },
        data: { totalViews: { increment: 1 } },
      });
      return;
    }

    await tx.reelView.update({
      where: { id: existing.id },
      data: {
        watchCount: { increment: 1 },
        lastWatchedMs: watchedMs,
        // Once completed, always completed — a later partial rewatch does not
        // undo the fact that this reader has seen the whole thing.
        completed: existing.completed || completed,
        lastViewedAt: new Date(),
      },
    });
  });

  return ok(res, { id, counted: true, completed });
};

/**
 * POST /api/app/reels/:id/share
 *
 * Logged per event rather than as a running total, so which platform actually
 * drives traffic is answerable later. The reel's shareCount is the rolled-up
 * number the card renders.
 */
export const share = async (req, res) => {
  const user = req.auth.user;
  const reel = await loadLiveReel(req.valid.params.id);

  const shareCount = await prisma.$transaction(async (tx) => {
    await tx.reelShare.create({
      data: { reelId: reel.id, userId: user.id, platform: req.valid.body.platform },
    });
    const updated = await tx.reel.update({
      where: { id: reel.id },
      data: { shareCount: { increment: 1 } },
      select: { shareCount: true },
    });
    return updated.shareCount;
  });

  return ok(res, { id: reel.id, shareCount });
};

/**
 * POST /api/app/reels/:id/report
 *
 * One open report per person per reel. Reporting the same thing twice is not
 * an error — it is someone tapping again because nothing visibly happened —
 * so the existing report is returned rather than a second one written.
 */
export const report = async (req, res) => {
  const user = req.auth.user;
  const reel = await loadLiveReel(req.valid.params.id);

  const existing = await prisma.reelReport.findFirst({
    where: { reelId: reel.id, reporterId: user.id, reviewedAt: null },
  });
  if (existing) return created(res, { id: existing.id, alreadyReported: true });

  const row = await prisma.reelReport.create({
    data: {
      reelId: reel.id,
      reporterId: user.id,
      reason: req.valid.body.reason,
      note: req.valid.body.note || null,
    },
  });

  logger.info({ reelId: reel.id, reason: row.reason }, 'reel reported');
  return created(res, { id: row.id, alreadyReported: false });
};

/**
 * GET /api/app/reels/saved
 *
 * Reels the reader bookmarked. A saved reel is a `Favorite` row like any other
 * bookmark rather than a table of its own — see the Favorite model.
 */
export const saved = async (req, res) => {
  const user = req.auth.user;
  const { page, pageSize, skip, take } = readPage(req.valid.query, REEL_PAGE_SIZE_DEFAULT);

  const where = { userId: user.id, reelId: { not: null } };

  const [total, favorites] = await Promise.all([
    prisma.favorite.count({ where }),
    prisma.favorite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { reel: { include: present.includes.reel(user.id) } },
    }),
  ]);

  // A reel taken down after it was saved leaves the bookmark pointing at
  // something nobody should be shown any more.
  const rows = favorites
    .map((favorite) => favorite.reel)
    .filter((reel) => reel && reel.status === 'PUBLISHED');

  return paginated(res, await present.reels(rows, user), { page, pageSize, total });
};

/**
 * Tells a creator that something happened on their reel.
 *
 * Never awaited by the caller and never allowed to fail a write: a comment
 * that saved but whose notification did not is a much smaller problem than a
 * comment that appeared to fail because a push did.
 */
export async function notifyCreator(creatorUserId, actor, { title, body, data }) {
  // Engaging with your own reel is not news.
  if (!creatorUserId || creatorUserId === actor.id) return;

  try {
    await notify.toUser(creatorUserId, { type: 'REEL', title, body, data });
  } catch (err) {
    logger.warn({ err: err.message, creatorUserId }, 'reel notification failed');
  }
}

// Exported for reel-comment.js, which needs the same "is this reel live"
// answer before it will attach a comment to it.
export { loadLiveReel };
