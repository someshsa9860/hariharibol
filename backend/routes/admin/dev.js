import { createRouter, z } from '../../utils/router.js';
import { devops } from '../../config/devops.js';
import * as controller from '../../controllers/admin/dev.js';

const router = createRouter({
  tag: 'Admin · Developer companion',
  prefix: '/dev',
  description:
    'What the developer companion app reads and writes: the live feed (also pushed over the websocket as ' +
    '`dev.event`), the home numbers, and the developer’s side of the chat with readers (`dev.chat.message`). ' +
    'Needs `dev.access`, which the owner (super admin) has and the admin role does not unless it is granted.',
});

const PERMISSION = 'dev.access';
const idParams = z.object({ id: z.string().min(1).max(40) });
const cursor = z.string().min(1).max(40).optional();

router.get(
  '/summary',
  { summary: 'Home numbers', permission: PERMISSION, limit: 'read', responds: { 200: 'Users, sign-ups, errors, unread chats' } },
  controller.summary
);

router.get(
  '/feed',
  {
    summary: 'The live feed',
    permission: PERMISSION,
    limit: 'read',
    query: z.object({
      before: cursor,
      type: z.string().max(40).optional(),
      severity: z.enum(['info', 'warning', 'critical']).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
    responds: { 200: 'Events, newest first' },
  },
  controller.feed
);

router.get(
  '/conversations',
  {
    summary: 'Conversations with readers',
    permission: PERMISSION,
    limit: 'read',
    query: z.object({
      before: cursor,
      unreadOnly: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
    responds: { 200: 'Conversations, most recent first' },
  },
  controller.conversations
);

router.post(
  '/conversations',
  {
    summary: 'Start a conversation with a reader',
    permission: PERMISSION,
    limit: 'write',
    body: z.object({ userId: z.string().min(1).max(40), body: z.string().trim().min(1).max(devops.CHAT_MAX_LENGTH) }),
    responds: { 201: 'The conversation id and first message' },
  },
  controller.start
);

router.get(
  '/conversations/:id/messages',
  {
    summary: 'Messages of a conversation',
    description: 'Oldest first within the page; `before` is a message id. Opening the newest page marks the reader’s messages read.',
    permission: PERMISSION,
    limit: 'read',
    params: idParams,
    query: z.object({ before: cursor, limit: z.coerce.number().int().min(1).max(100).optional() }),
    responds: { 200: 'The conversation, messages and whether there are older ones' },
  },
  controller.messages
);

router.post(
  '/conversations/:id/messages',
  {
    summary: 'Reply to a reader',
    permission: PERMISSION,
    limit: 'write',
    params: idParams,
    body: z.object({ body: z.string().trim().min(1).max(devops.CHAT_MAX_LENGTH) }),
    responds: { 201: 'The message' },
  },
  controller.reply
);

router.post(
  '/conversations/:id/read',
  { summary: 'Mark read', permission: PERMISSION, limit: 'write', params: idParams, responds: { 200: 'Done' } },
  controller.markRead
);

router.get(
  '/users',
  {
    summary: 'Find a reader to write to',
    permission: PERMISSION,
    limit: 'read',
    query: z.object({ q: z.string().trim().min(2).max(100), limit: z.coerce.number().int().min(1).max(50).optional() }),
    responds: { 200: 'Matching readers' },
  },
  controller.users
);

router.get('/prefs', { summary: 'Push preferences', permission: PERMISSION, limit: 'read', responds: { 200: 'Prefs' } }, controller.getPrefs);

router.put(
  '/prefs',
  {
    summary: 'Change push preferences',
    description: 'Whether pushes are on at all, and event types to leave out of pushes (they still appear in the feed).',
    permission: PERMISSION,
    limit: 'write',
    body: z.object({ pushEnabled: z.boolean().optional(), mutedTypes: z.array(z.string().max(40)).max(30).optional() }),
    responds: { 200: 'Prefs' },
  },
  controller.setPrefs
);

export default router;
