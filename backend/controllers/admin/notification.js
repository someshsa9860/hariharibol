// Broadcasts.
//
// Two ways to reach people, and the difference matters:
//
//   topic     one call to Firebase regardless of how many devices are on it.
//             Nothing is written to Notification, so it does not appear in
//             anyone's in-app history. Right for time-bound announcements.
//   audience  a real fan-out. A Notification row per user, so it appears in the
//             app whether or not push was delivered. Right for anything that
//             should still be readable tomorrow.
//
// The expensive one is deliberately the one that has to be asked for.

const { prisma } = require('../../config/database');
const audit = require('../../services/audit');
const notify = require('../../services/notify');
const { ok, paginated } = require('../../utils/respond');
const { paginate } = require('../../utils/pagination');
const { badRequest } = require('../../utils/errors');

/** POST /api/admin/notifications/topic */
exports.broadcastTopic = async (req, res) => {
  const { topicKey, title, body, data } = req.valid.body;

  const topic = await prisma.fcmTopic.findUnique({ where: { key: topicKey } });
  if (!topic || !topic.isActive) throw badRequest('No such active topic');

  const result = await notify.toTopic(topicKey, { title, body, data });

  await audit.record(req, {
    action: 'notification.broadcast.topic',
    entityType: 'FcmTopic',
    entityId: topic.id,
    after: { topicKey, title },
  });

  return ok(res, { sent: true, messageId: result.messageId });
};

/**
 * POST /api/admin/notifications/audience
 *
 * Writes a row per user and pushes in batches. Capped, because an unbounded
 * fan-out from an admin form is how someone accidentally writes a million rows
 * — anything larger belongs in a job, not a request.
 */
exports.broadcastAudience = async (req, res) => {
  const { title, body, data, audience } = req.valid.body;

  const where = {
    isBanned: false,
    ...(audience === 'premium' ? { isPremium: true } : {}),
    ...(audience === 'free' ? { isPremium: false } : {}),
    ...(audience === 'active'
      ? { lastActiveAt: { gte: new Date(Date.now() - 30 * 86400000) } }
      : {}),
  };

  const total = await prisma.user.count({ where });
  if (total > 50000) {
    throw badRequest(`That audience is ${total} people — too large to send from here.`);
  }

  const users = await prisma.user.findMany({ where, select: { id: true } });

  const result = await notify.toUsers(
    users.map((u) => u.id),
    { type: 'ANNOUNCEMENT', title, body, data }
  );

  await audit.record(req, {
    action: 'notification.broadcast.audience',
    entityType: 'Notification',
    after: { audience, title, recipients: users.length },
  });

  return ok(res, { recipients: users.length, created: result.created });
};

/** POST /api/admin/notifications/user/:userId — a message to one person. */
exports.toUser = async (req, res) => {
  const { title, body, data, type = 'SYSTEM' } = req.valid.body;

  const notification = await notify.toUser(req.valid.params.userId, { type, title, body, data });

  await audit.record(req, {
    action: 'notification.direct',
    entityType: 'Notification',
    entityId: notification.id,
    after: { userId: req.valid.params.userId, title },
  });

  return ok(res, notification);
};

/** GET /api/admin/notifications — what has been sent, for checking delivery. */
exports.list = async (req, res) => {
  const { type, userId } = req.valid.query;

  const { items, page } = await paginate(prisma.notification, {
    where: { ...(type ? { type } : {}), ...(userId ? { userId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, email: true, name: true } } },
    query: req.valid.query,
  });

  return paginated(res, items, page);
};
