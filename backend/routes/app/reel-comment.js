import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/app/reel-comment.js';
import { REEL_COMMENT_MAX_LENGTH } from '../../config/constants.js';

const router = createRouter({
  tag: 'Reel comments',
  prefix: '/reel-comments',
  description:
    'Comments on reels. Its own path rather than nested under /reels/:id/comments, because ' +
    'every operation but listing addresses a comment by its own id — the same shape verse ' +
    'notes take against a verse.',
});

const reportReason = z.enum([
  'SPAM',
  'HARASSMENT_OR_ABUSE',
  'NON_DEVOTIONAL',
  'MISINFORMATION',
  'SEXUAL_OR_VIOLENT',
  'OTHER',
]);

router.get(
  '/',
  {
    summary: 'List comments on a reel',
    description:
      'Without `parentId`, the top of the thread — pinned first, then newest. With one, that ' +
      'comment’s replies, oldest first, because a reply thread is a conversation and reading ' +
      'one backwards makes no sense. Page size defaults to 20 for comments and 10 for ' +
      'replies. A comment hidden by moderation is returned with a null `text` rather than ' +
      'dropped, so the replies under it still make sense.',
    limit: 'read',
    query: z.object({
      reelId: z.string().min(1),
      parentId: z.string().min(1).optional(),
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).optional(),
    }),
    responds: { 200: 'A page of comments' },
  },
  controller.list
);

router.post(
  '/',
  {
    summary: 'Add a comment or reply',
    description:
      'Threads go exactly one level deep. A `parentId` that points at a reply is silently ' +
      're-pointed at that reply’s own parent rather than refused — the person typing did ' +
      'nothing wrong. The creator is notified, unless they are the one commenting.',
    limit: 'write',
    body: z.object({
      reelId: z.string().min(1),
      parentId: z.string().min(1).optional(),
      text: z.string().trim().min(1).max(REEL_COMMENT_MAX_LENGTH),
    }),
    responds: { 201: 'The comment', 404: 'No such reel or parent comment' },
  },
  controller.add
);

router.delete(
  '/:id',
  {
    summary: 'Delete a comment',
    description:
      'Allowed for whoever wrote it and for whoever posted the reel — a creator moderating ' +
      'their own comments is ordinary, not an admin action. Deleting a top-level comment ' +
      'takes its replies with it.',
    limit: 'write',
    params: schemas.id,
    responds: { 204: 'Removed', 403: 'Not yours to delete', 404: 'Already gone' },
  },
  controller.remove
);

router.post(
  '/:id/like',
  {
    summary: 'Like a comment',
    description: 'Idempotent, the same way liking a reel is.',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'The new like state and count', 404: 'No such comment' },
  },
  controller.like
);

router.delete(
  '/:id/like',
  {
    summary: 'Unlike a comment',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'The new like state and count', 404: 'No such comment' },
  },
  controller.unlike
);

router.post(
  '/:id/pin',
  {
    summary: 'Pin or unpin a comment',
    description:
      'The creator’s one pinned comment, toggled. Pinning a second clears the first, so ' +
      '"one" is enforced here rather than left to the caller to remember. Replies cannot be ' +
      'pinned — a pinned reply would sit at the top of a thread it is not the top of.',
    limit: 'write',
    params: schemas.id,
    responds: {
      200: 'The new pin state',
      403: 'Not your reel, or the comment is a reply',
      404: 'No such comment',
    },
  },
  controller.pin
);

router.post(
  '/:id/report',
  {
    summary: 'Report a comment',
    description: 'One open report per person per comment, same as reporting a reel.',
    limit: 'write',
    params: schemas.id,
    body: z.object({
      reason: reportReason,
      note: z.string().trim().max(1000).optional(),
    }),
    responds: { 201: 'The report', 404: 'No such comment' },
  },
  controller.report
);

export default router;
