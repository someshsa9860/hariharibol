// In-app notification history.
//
// A row is written whether or not a push actually went out, so someone who has
// notifications switched off — or whose token had gone stale — still sees the
// same list. The push is delivery; this is the record.

import { prisma } from '../../config/database.js';
import { ok, paginated } from '../../utils/respond.js';
import { paginate } from '../../utils/pagination.js';

/** GET /api/app/notifications */
export const list = async (req, res) => {
  const { type, unreadOnly } = req.valid.query;

  const { items, page } = await paginate(prisma.notification, {
    where: {
      userId: req.auth.user.id,
      ...(type ? { type } : {}),
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: 'desc' },
    query: req.valid.query,
  });

  return paginated(res, items, page);
};

/** GET /api/app/notifications/unread-count — the badge. */
export const unreadCount = async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.auth.user.id, readAt: null },
  });
  return ok(res, { count });
};

/** POST /api/app/notifications/:id/read */
export const markRead = async (req, res) => {
  // updateMany rather than update, so someone else's notification id is a
  // silent no-op instead of a 404 that confirms the row exists.
  const updated = await prisma.notification.updateMany({
    where: { id: req.valid.params.id, userId: req.auth.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return ok(res, { updated: updated.count > 0 });
};

/** POST /api/app/notifications/read-all */
export const markAllRead = async (req, res) => {
  const updated = await prisma.notification.updateMany({
    where: { userId: req.auth.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return ok(res, { updated: updated.count });
};
