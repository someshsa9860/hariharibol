import { createRouter, z } from '../../utils/router.js';
import { devops } from '../../config/devops.js';
import * as controller from '../../controllers/app/developer-chat.js';

const router = createRouter({
  tag: 'Developer chat',
  prefix: '/developer-chat',
  description:
    'A reader’s one open line to the developer. Messages also arrive live as the websocket event ' +
    '`dev.chat.message`; the developer answers from the companion app.',
});

router.get(
  '/',
  {
    summary: 'The conversation',
    description: 'Newest messages last, `before` (a message id) pages back. Opening the newest page marks the developer’s replies read.',
    limit: 'read',
    query: z.object({ before: z.string().max(40).optional(), limit: z.coerce.number().int().min(1).max(100).optional() }),
    responds: { 200: 'Conversation id, messages (oldest first) and whether there are older ones' },
  },
  controller.get
);

router.get(
  '/unread',
  { summary: 'Unread developer replies', description: 'The badge on the entry point.', limit: 'read', responds: { 200: 'count' } },
  controller.unread
);

router.post(
  '/messages',
  {
    summary: 'Write to the developer',
    limit: 'write',
    body: z.object({ body: z.string().trim().min(1).max(devops.CHAT_MAX_LENGTH) }),
    responds: { 201: 'The message' },
  },
  controller.send
);

router.post(
  '/read',
  { summary: 'Mark the developer’s replies read', limit: 'write', responds: { 200: 'count 0' } },
  controller.markRead
);

export default router;
