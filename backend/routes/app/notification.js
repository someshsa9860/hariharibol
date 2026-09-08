const { createRouter, z, schemas } = require('../../utils/router');
const controller = require('../../controllers/app/notification');

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
      type: z.enum(['SLOKA', 'SADHANA', 'ANNOUNCEMENT', 'SYSTEM']).optional(),
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

module.exports = router;
