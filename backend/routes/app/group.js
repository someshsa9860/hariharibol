import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/group.js';

const router = createRouter({
  tag: 'Chanting groups',
  prefix: '/groups',
  description:
    'Private groups that chant together. The person who makes a group is its owner and the only one ' +
    'who can delete it; admins invite people, remove members and make other admins. A group is ' +
    'invisible to anyone not in it or invited to it (404). The live room is WebRTC audio between the ' +
    'members: these routes record who is in the room, return the ICE servers, and relay the handshake ' +
    'as websocket events (`group.signal`).',
});

const id = z.object({ id: z.string().min(1) });
const member = z.object({ id: z.string().min(1), userId: z.string().min(1) });

const name = z.string().trim().min(2).max(80);
const description = z.string().trim().max(300);

router.get(
  '/',
  {
    summary: 'My groups and invitations',
    description: 'Groups the caller is in (with who is chanting now) and invitations waiting for an answer.',
    limit: 'read',
    responds: { 200: '`{ groups, invitations }`' },
  },
  controller.list
);

router.post(
  '/',
  {
    summary: 'Make a group',
    description: 'The caller becomes its owner. At most 20 owned groups per person.',
    limit: 'write',
    body: z.object({
      name,
      description: description.optional(),
      mantraId: z.string().min(1).nullish(),
    }),
    responds: { 201: 'The group', 409: 'Too many groups' },
  },
  controller.create
);

router.get(
  '/:id',
  {
    summary: 'A group, its members and its live room',
    description: 'Members only. Admins also see people who have been invited and not yet answered.',
    limit: 'read',
    params: id,
    responds: { 200: 'The group', 404: 'Not a member' },
  },
  controller.read
);

router.patch(
  '/:id',
  {
    summary: 'Edit a group',
    description: 'Admins: name, description and the mantra the group is chanting (`null` clears it).',
    limit: 'write',
    params: id,
    body: z.object({
      name: name.optional(),
      description: description.nullish(),
      mantraId: z.string().min(1).nullish(),
    }),
    responds: { 200: 'The group', 403: 'Not an admin' },
  },
  controller.update
);

router.delete(
  '/:id',
  {
    summary: 'Delete a group',
    description: 'Only the person who made the group. Admins cannot, however many there are.',
    limit: 'write',
    params: id,
    responds: { 204: 'Deleted', 403: 'Not the owner' },
  },
  controller.remove
);

router.post(
  '/:id/invite',
  {
    summary: 'Invite someone by email',
    description:
      'Admins. The person must already have a HariHariBol account under that email; they get a ' +
      'notification and the invitation appears in `GET /groups`. Inviting twice is harmless.',
    limit: 'write',
    params: id,
    body: z.object({ email: z.string().trim().email().max(255) }),
    responds: { 201: 'Invited', 404: 'No account with that email', 409: 'Already in the group, or the group is full' },
  },
  controller.invite
);

router.post(
  '/:id/accept',
  { summary: 'Accept an invitation', limit: 'write', params: id, responds: { 200: 'The group', 404: 'No invitation' } },
  controller.accept
);

router.post(
  '/:id/decline',
  { summary: 'Decline an invitation', limit: 'write', params: id, responds: { 204: 'Declined' } },
  controller.decline
);

router.post(
  '/:id/leave',
  {
    summary: 'Leave a group',
    description: 'Anyone but the owner, who deletes the group instead.',
    limit: 'write',
    params: id,
    responds: { 204: 'Left', 409: 'The owner cannot leave' },
  },
  controller.leave
);

router.delete(
  '/:id/members/:userId',
  {
    summary: 'Remove a member or cancel an invitation',
    description:
      'Admins remove ordinary members; only the owner removes an admin. The owner cannot be removed.',
    limit: 'write',
    params: member,
    responds: { 204: 'Removed', 403: 'Not allowed' },
  },
  controller.removeMember
);

router.put(
  '/:id/members/:userId/role',
  {
    summary: 'Make someone an admin, or an ordinary member again',
    description:
      'An admin can make another member an admin. Taking admin away is the owner’s alone. ' +
      'The owner’s own role never changes.',
    limit: 'write',
    params: member,
    body: z.object({ role: z.enum(['ADMIN', 'MEMBER']) }),
    responds: { 200: 'The new role', 403: 'Not allowed' },
  },
  controller.setRole
);

router.get(
  '/:id/live',
  {
    summary: 'Who is chanting now',
    limit: 'read',
    params: id,
    responds: { 200: '`{ live }` — the open session or null' },
  },
  controller.liveStatus
);

router.post(
  '/:id/live/start',
  {
    summary: 'Start chanting together',
    description:
      'Admins. Opens the room (or joins the one already open), tells the other members, and returns ' +
      'the ICE servers and the people already there. The caller then offers to each of them.',
    limit: 'write',
    params: id,
    responds: { 200: '`{ sessionId, iceServers, participants }`', 409: 'The room is full' },
  },
  controller.liveStart
);

router.post(
  '/:id/live/join',
  {
    summary: 'Join the room',
    description: 'Any member, while the room is open (410 when nobody is chanting). Returns what start returns.',
    limit: 'write',
    params: id,
    responds: { 200: '`{ sessionId, iceServers, participants }`', 410: 'No room is open', 409: 'The room is full' },
  },
  controller.liveJoin
);

router.post(
  '/:id/live/heartbeat',
  {
    summary: 'Still here',
    description:
      'Send about every 20 seconds while in the room; a minute of silence drops the caller from it. ' +
      '`open: false` means the room has closed.',
    limit: 'read',
    params: id,
    responds: { 200: '`{ open, joined }`' },
  },
  controller.liveHeartbeat
);

router.post(
  '/:id/live/leave',
  { summary: 'Leave the room', limit: 'write', params: id, responds: { 204: 'Left' } },
  controller.liveLeave
);

router.post(
  '/:id/live/end',
  {
    summary: 'End the room for everyone',
    limit: 'write',
    params: id,
    responds: { 204: 'Ended', 403: 'Not an admin' },
  },
  controller.liveEnd
);

router.post(
  '/:id/live/signal',
  {
    summary: 'Pass a WebRTC handshake message to someone in the room',
    description:
      'Delivered as the websocket event `group.signal` `{ groupId, from, kind, data }`. `kind` is ' +
      '`offer`, `answer` (both carry `{ sdp }`) or `candidate` (the ICE candidate object). Both people ' +
      'must be in the room.',
    limit: 'signal',
    params: id,
    body: z.object({
      to: z.string().min(1),
      kind: z.enum(['offer', 'answer', 'candidate']),
      data: z.record(z.string(), z.unknown()),
    }),
    responds: { 204: 'Relayed', 404: 'That person is not in the room', 410: 'No room is open' },
  },
  controller.liveSignal
);

export default router;
