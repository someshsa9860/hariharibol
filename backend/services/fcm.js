// Push delivery. Two ways out, and which one is correct depends on the size of
// the audience:
//
//   sendToUser   a message meant for one person — their sloka, a reminder.
//                Fans out to that user's registered devices.
//   sendToTopic  a message meant for everyone. One call regardless of audience
//                size, so a broadcast never becomes a loop over the user table.
//
// This module only delivers. Writing the in-app Notification row is
// services/notify.js — a user who has push switched off must still see the
// message in their history.

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import * as firebase from './firebase.js';

// Firebase says the token is dead. Keeping it means retrying a delivery that
// can never land, on every send, forever.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

function buildMessage({ title, body, data }) {
  return {
    notification: { title, body },
    // FCM data values must all be strings — a number here fails the whole send.
    data: Object.fromEntries(
      Object.entries(data || {}).map(([key, value]) => [key, String(value ?? '')])
    ),
    android: { priority: 'high', notification: { channelId: 'default' } },
    apns: { payload: { aps: { sound: 'default' } } },
  };
}

async function dropDeadTokens(tokens) {
  if (!tokens.length) return;
  await prisma.device.updateMany({ where: { fcmToken: { in: tokens } }, data: { fcmToken: null } });
  logger.info({ count: tokens.length }, 'cleared dead fcm tokens');
}

async function sendToTokens(tokens, payload) {
  const messaging = firebase.messaging();
  if (!messaging) {
    logger.warn('push skipped — firebase is not configured');
    return { sent: 0, failed: 0, skipped: tokens.length };
  }
  if (!tokens.length) return { sent: 0, failed: 0, skipped: 0 };

  const message = buildMessage(payload);
  const response = await messaging.sendEachForMulticast({ ...message, tokens });

  const dead = [];
  response.responses.forEach((result, index) => {
    if (result.success) return;
    if (DEAD_TOKEN_CODES.has(result.error?.code)) dead.push(tokens[index]);
    else logger.warn({ err: result.error?.message }, 'push failed');
  });
  await dropDeadTokens(dead);

  return { sent: response.successCount, failed: response.failureCount, skipped: 0 };
}

async function sendToUser(userId, payload) {
  const devices = await prisma.device.findMany({
    where: { userId, fcmToken: { not: null }, isBanned: false },
    select: { fcmToken: true },
  });
  return sendToTokens(devices.map((d) => d.fcmToken), payload);
}

// Batched so one job can push a whole day's slokas without holding thousands of
// tokens in memory at once.
async function sendToUsers(userIds, payload, batchSize = 400) {
  const devices = await prisma.device.findMany({
    where: { userId: { in: userIds }, fcmToken: { not: null }, isBanned: false },
    select: { fcmToken: true },
  });
  const tokens = devices.map((d) => d.fcmToken);

  const totals = { sent: 0, failed: 0, skipped: 0 };
  for (let i = 0; i < tokens.length; i += batchSize) {
    const result = await sendToTokens(tokens.slice(i, i + batchSize), payload);
    totals.sent += result.sent;
    totals.failed += result.failed;
    totals.skipped += result.skipped;
  }
  return totals;
}

async function sendToTopic(topicKey, payload) {
  const messaging = firebase.messaging();
  if (!messaging) {
    logger.warn('topic push skipped — firebase is not configured');
    return { messageId: null };
  }
  const messageId = await messaging.send({ ...buildMessage(payload), topic: topicKey });
  return { messageId };
}

// Topic membership is mirrored in FcmSubscription so the admin panel can show
// who is on a topic — Firebase itself will not tell us.
async function subscribeDevice(deviceId, topicKey) {
  const [device, topic] = await Promise.all([
    prisma.device.findUnique({ where: { id: deviceId } }),
    prisma.fcmTopic.findUnique({ where: { key: topicKey } }),
  ]);
  if (!device?.fcmToken || !topic?.isActive) return false;

  const messaging = firebase.messaging();
  if (messaging) await messaging.subscribeToTopic([device.fcmToken], topicKey);

  await prisma.fcmSubscription.upsert({
    where: { deviceId_topicId: { deviceId: device.id, topicId: topic.id } },
    update: {},
    create: { deviceId: device.id, topicId: topic.id },
  });
  return true;
}

async function unsubscribeDevice(deviceId, topicKey) {
  const [device, topic] = await Promise.all([
    prisma.device.findUnique({ where: { id: deviceId } }),
    prisma.fcmTopic.findUnique({ where: { key: topicKey } }),
  ]);
  if (!device || !topic) return false;

  const messaging = firebase.messaging();
  if (messaging && device.fcmToken) {
    await messaging.unsubscribeFromTopic([device.fcmToken], topicKey);
  }

  await prisma.fcmSubscription
    .delete({ where: { deviceId_topicId: { deviceId: device.id, topicId: topic.id } } })
    .catch(() => null);
  return true;
}

export {
  sendToTokens,
  sendToUser,
  sendToUsers,
  sendToTopic,
  subscribeDevice,
  unsubscribeDevice,
};
