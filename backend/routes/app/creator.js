import { createRouter, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/app/creator.js';

const router = createRouter({
  tag: 'Creators',
  prefix: '/creators',
  description:
    'The people who post reels. A creator is a capability on a User, not a role — applying ' +
    'and being approved belong to the admin panel, so nothing here creates one.',
});

router.get(
  '/',
  {
    summary: 'Creators I follow',
    description:
      'Deliberately not a directory of every creator: a browsable list is a discovery ' +
      'surface that does not exist yet, and returning everyone approved would quietly ' +
      'become one.',
    limit: 'read',
    query: schemas.page,
    responds: { 200: 'A page of creators' },
  },
  controller.list
);

router.get(
  '/:id',
  {
    summary: 'Get a creator profile',
    description:
      'Approved creators only, plus the reader’s own profile whatever state it is in. A ' +
      'pending or rejected creator is a 404 rather than a 403 — from the reader’s side it ' +
      'simply does not exist.',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The profile', 404: 'No such creator' },
  },
  controller.get
);

router.get(
  '/:id/reels',
  {
    summary: 'A creator’s reels',
    description:
      'Pinned first, then newest. Plain chronology with no ranking over it — a profile is a ' +
      'body of work rather than a feed. A creator looking at their own profile sees ' +
      'everything they posted, including reels still awaiting review.',
    limit: 'read',
    params: schemas.id,
    query: schemas.page,
    responds: { 200: 'A page of reels', 404: 'No such creator' },
  },
  controller.reels
);

router.post(
  '/:id/follow',
  {
    summary: 'Follow a creator',
    description: 'Idempotent, the same way liking is.',
    limit: 'write',
    params: schemas.id,
    responds: {
      200: 'The new follow state and count',
      400: 'You cannot follow yourself',
      404: 'No such creator',
    },
  },
  controller.follow
);

router.delete(
  '/:id/follow',
  {
    summary: 'Unfollow a creator',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'The new follow state and count', 404: 'No such creator' },
  },
  controller.unfollow
);

export default router;
