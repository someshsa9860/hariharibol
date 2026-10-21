import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/notification.js';
import { TARGETS, STYLES, IMPORTANCE } from '../../utils/push-rich.js';

const router = createRouter({
  tag: 'Admin · Notifications',
  prefix: '/notifications',
  description:
    'Broadcasts. A topic send is one call to Firebase and leaves no in-app history; an ' +
    'audience send writes a row per user and does. The expensive one is the one you have to ' +
    'ask for.',
});

// Where a tap goes: one of the app's own words (`sakha`, `verse`, …) and the few
// values that word takes. What each needs is checked in utils/push-rich.js.
const link = z.object({
  target: z.enum(Object.keys(TARGETS)),
  slug: z.string().trim().max(120).optional(),
  id: z.string().trim().max(60).optional(),
  book: z.string().trim().max(120).optional(),
  canto: z.string().trim().max(10).optional(),
  chapter: z.string().trim().max(10).optional(),
  verse: z.string().trim().max(10).optional(),
});

const messageBody = {
  // An uploaded picture's key, or a pasted https link.
  image: z.string().trim().max(1000).optional(),
  style: z.enum(STYLES).optional(),
  importance: z.enum(IMPORTANCE).optional(),
  link: link.optional(),
  // At most two buttons; each opens a place in the app.
  actions: z
    .array(z.object({ label: z.string().trim().min(1).max(24), link }))
    .max(2)
    .optional(),
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
  '/options',
  {
    summary: 'What a push can carry',
    description: 'The tap targets the app understands, the styles and the importance levels.',
    permission: 'notification.send',
    limit: 'read',
    responds: { 200: 'Targets, styles and importance levels' },
  },
  controller.options
);

const minSeconds = z.coerce.number().int().min(1).max(600).default(10);

router.get(
  '/campaigns',
  {
    summary: 'Delivery statistics, one row per notification',
    description:
      'Sent (devices FCM accepted), delivered (devices that reported it arrived or tapped it), ' +
      'opened, and read — opened and then stayed at least `minSeconds`.',
    permission: 'notification.send',
    limit: 'read',
    query: schemas.sorted(controller.CAMPAIGN_SORT_COLUMNS).extend({
      type: z.enum(['SLOKA', 'SADHANA', 'ANNOUNCEMENT', 'SYSTEM', 'REEL', 'REFERRAL', 'FESTIVAL']).optional(),
      minSeconds,
    }),
    responds: { 200: 'A page of notifications with their funnel' },
  },
  controller.listCampaigns
);

router.get(
  '/campaigns/:id',
  {
    summary: 'One notification in detail',
    permission: 'notification.send',
    limit: 'read',
    params: schemas.id,
    query: z.object({ minSeconds }),
    responds: { 200: 'The funnel, reading time, platforms and latest opens', 404: 'No such notification' },
  },
  controller.getCampaign
);

router.get(
  '/',
  {
    summary: 'List sent notifications',
    description: 'For checking delivery — `sentAt` is set only when push actually went out.',
    permission: 'notification.send',
    limit: 'read',
    query: schemas.sorted(controller.SORT_COLUMNS).extend({
      type: z.enum(['SLOKA', 'SADHANA', 'ANNOUNCEMENT', 'SYSTEM']).optional(),
      userId: z.string().optional(),
    }),
    responds: { 200: 'A page of notifications' },
  },
  controller.list
);

export default router;
