const { createRouter, z, schemas } = require('../../utils/router');
const controller = require('../../controllers/admin/notification');

const router = createRouter({
  tag: 'Admin · Notifications',
  prefix: '/notifications',
  description:
    'Broadcasts. A topic send is one call to Firebase and leaves no in-app history; an ' +
    'audience send writes a row per user and does. The expensive one is the one you have to ' +
    'ask for.',
});

const messageBody = {
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(500),
  data: z.record(z.string()).optional(),
};

router.post(
  '/topic',
  {
    summary: 'Broadcast to a topic',
    description:
      'One call to Firebase regardless of audience size. Nothing is written to the ' +
      'notification list, so this is right for something time-bound and wrong for anything ' +
      'that should still be readable tomorrow.',
    permission: 'notification.send',
    limit: 'write',
    body: z.object({ topicKey: z.string().min(1).max(100), ...messageBody }),
    responds: { 200: 'Sent', 400: 'No such active topic' },
  },
  controller.broadcastTopic
);

router.post(
  '/audience',
  {
    summary: 'Broadcast to an audience',
    description:
      'Writes a notification row per user and pushes in batches, so it appears in the app ' +
      'whether or not push was delivered. Capped at 50,000 — an unbounded fan-out from an ' +
      'admin form is how someone accidentally writes a million rows.',
    permission: 'notification.send',
    limit: 'write',
    body: z.object({
      audience: z.enum(['all', 'premium', 'free', 'active']),
      ...messageBody,
    }),
    responds: { 200: 'Recipient count', 400: 'Audience too large to send from here' },
  },
  controller.broadcastAudience
);

router.post(
  '/user/:userId',
  {
    summary: 'Send to one person',
    permission: 'notification.send',
    limit: 'write',
    params: z.object({ userId: z.string().min(1) }),
    body: z.object({
      type: z.enum(['SLOKA', 'SADHANA', 'ANNOUNCEMENT', 'SYSTEM']).optional(),
      ...messageBody,
    }),
    responds: { 200: 'The notification' },
  },
  controller.toUser
);

router.get(
  '/',
  {
    summary: 'List sent notifications',
    description: 'For checking delivery — `sentAt` is set only when push actually went out.',
    permission: 'notification.send',
    limit: 'read',
    query: schemas.page.extend({
      type: z.enum(['SLOKA', 'SADHANA', 'ANNOUNCEMENT', 'SYSTEM']).optional(),
      userId: z.string().optional(),
    }),
    responds: { 200: 'A page of notifications' },
  },
  controller.list
);

module.exports = router;
