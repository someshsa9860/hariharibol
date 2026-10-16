import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/creator.js';

const router = createRouter({
  tag: 'Admin · Creators',
  prefix: '/creators',
  description:
    'A creator is an ordinary user with a creator profile — the same account, the same role. ' +
    'Making someone a creator never touches their role, and an admin can be a creator too.',
});

const profileBody = {
  displayName: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(1000).nullable(),
  isVerified: z.boolean(),
};

router.get(
  '/',
  {
    summary: 'List creators',
    description: 'Every status, so pending applications and suspended creators are visible too.',
    permission: 'creator.manage',
    limit: 'read',
    query: schemas.sorted(controller.SORT_COLUMNS).extend({
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(),
    }),
    responds: { 200: 'A page of creators' },
  },
  controller.list
);

router.post(
  '/',
  {
    summary: 'Make a user a creator',
    description:
      'Attaches a creator profile to an existing user. Created approved by default, since an ' +
      'admin is the reviewer. The name defaults to the user’s own.',
    permission: 'creator.manage',
    limit: 'write',
    body: z.object({
      userId: z.string().min(1),
      displayName: profileBody.displayName.optional(),
      bio: profileBody.bio.optional(),
      isVerified: profileBody.isVerified.optional(),
      status: z.enum(['PENDING', 'APPROVED']).optional(),
    }),
    responds: { 201: 'The creator', 400: 'That user is already a creator', 404: 'No such user' },
  },
  controller.create
);

router.patch(
  '/:id',
  {
    summary: 'Edit a creator or change their standing',
    description:
      'Approve, reject or suspend (a reason is required to reject or suspend). Moving a creator ' +
      'out of APPROVED hides their reels from the feed; approving brings them back.',
    permission: 'creator.manage',
    limit: 'write',
    params: schemas.id,
    body: z
      .object({
        ...profileBody,
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']),
        rejectionReason: z.string().trim().max(500).nullable(),
      })
      .partial(),
    responds: { 200: 'The creator', 400: 'A reason is needed', 404: 'No such creator' },
  },
  controller.update
);

router.delete(
  '/:id',
  {
    summary: 'Remove a creator profile',
    description:
      'Removes the profile only — the user and their role are untouched. Refused while the ' +
      'creator still has reels, because they would be deleted with it; suspend instead.',
    permission: 'creator.manage',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'Removed', 400: 'The creator still has reels', 404: 'No such creator' },
  },
  controller.remove
);

export default router;
