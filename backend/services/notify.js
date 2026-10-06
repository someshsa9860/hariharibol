// One call to reach a user, wherever they are: the in-app list, a push
// notification, and a live websocket event if the app happens to be open.
//
// The Notification row is written first and always. Push can fail, be switched
// off, or arrive on a device the user no longer carries — the history in the
// app is the record that must not have holes in it.

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import * as fcm from './fcm.js';
import * as websocket from './websocket.js';

async function toUser(userId, { type, title, body, data, push = true }) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, data: data || null },
  });

  // The app updates its badge and list without waiting for a poll.
  websocket.toUser(userId, 'notification', {
    id: notification.id,
    type,
    title,
    body,
    data: data || null,
  });

  if (!push) return notification;

  try {
    const result = await fcm.sendToUser(userId, {
      title,
      body,
      data: { ...(data || {}), notificationId: notification.id, type },
    });
    if (result.sent > 0) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { sentAt: new Date() },
      });
    }
  } catch (err) {
    logger.error({ err: err.message, userId }, 'push send failed');
  }

  return notification;
}

// Many users, one message. Rows are written in bulk and the push goes out in
// batches, because this is what the daily sloka job calls.
async function toUsers(userIds, { type, title, body, data, push = true }) {
  if (!userIds.length) return { created: 0 };

  const created = await prisma.notification.createMany({
    data: userIds.map((userId) => ({ userId, type, title, body, data: data || null })),
  });

  for (const userId of userIds) {
    websocket.toUser(userId, 'notification', { type, title, body, data: data || null });
  }

  if (push) {
    try {
      await fcm.sendToUsers(userIds, { title, body, data: { ...(data || {}), type } });
      await prisma.notification.updateMany({
        where: { userId: { in: userIds }, type, sentAt: null },
        data: { sentAt: new Date() },
      });
    } catch (err) {
      logger.error({ err: err.message, count: userIds.length }, 'batch push failed');
    }
  }

  return { created: created.count };
}

// Announcements go to an FCM topic rather than to a user list — one call
// instead of a fan-out — so no Notification rows are written. Anything that
// must appear in a user's history should use `toUsers` instead.
async function toTopic(topicKey, { title, body, data }) {
  const result = await fcm.sendToTopic(topicKey, { title, body, data });
  websocket.broadcast('announcement', { title, body, data: data || null });
  return result;
}

export { toUser, toUsers, toTopic };
