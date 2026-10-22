import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/app/notification.js';

const router = createRouter({
  tag: 'Notifications',
  prefix: '/notifications',
  description:
    'The in-app notification list. Written whether or not a push was delivered, so the ' +
    'history has no holes on a device with notifications switched off.',
});

router.get(
  '/',
  {
    summary: 'List my notifications',
    limit: 'read',
    query: schemas.page.extend({
      type: z.enum(['SLOKA', 'SADHANA', 'ANNOUNCEMENT', 'SYSTEM', 'REEL', 'REFERRAL', 'FESTIVAL', 'SUPPORT']).optional(),
      unreadOnly: z.coerce.boolean().optional(),
    }),
    responds: { 200: 'A page of notifications' },
  },
  controller.list
);

router.get(
  '/unread-count',
  {
    summary: 'Count my unread notifications',
    description: 'What the badge shows.',
    limit: 'read',
    responds: { 200: 'The count' },
  },
  controller.unreadCount
);

router.post(
  '/events',
  {
    summary: 'Report what happened to a push',
    description:
      'The app says a push arrived, was tapped, and how long the reader stayed afterwards. ' +
      'Feeds the delivery statistics in the admin panel. Repeating a report changes nothing.',
    limit: 'write',
    body: z.object({
      deviceId: z.string().max(200).optional(),
      events: z
        .array(
          z.object({
            pushId: z.string().min(1).max(60),
            event: z.enum(['DELIVERED', 'OPENED', 'ENGAGED']),
            at: z.string().datetime().optional(),
            durationMs: z.number().int().min(0).max(86400000).optional(),
            screen: z.string().max(200).optional(),
          })
        )
        .min(1)
        .max(50),
    }),
    responds: { 200: 'How many were kept' },
  },
  controller.events
);

router.post(
  '/:id/read',
  {
    summary: 'Mark one as read',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'Whether anything changed' },
  },
  controller.markRead
);

router.post(
  '/read-all',
  {
    summary: 'Mark everything as read',
    limit: 'write',
    responds: { 200: 'How many were marked' },
  },
  controller.markAllRead
);

export default router;
