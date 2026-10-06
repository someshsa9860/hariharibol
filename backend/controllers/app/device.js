// Devices and push registration.
//
// A device row exists before anyone signs in — that is deliberate. It is how a
// fresh install can receive the sloka-of-the-day broadcast, and how an abusive
// installation can be blocked even after it creates a new account.

import { prisma } from '../../config/database.js';
import * as fcm from '../../services/fcm.js';
import { ok } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';

/**
 * POST /api/app/devices
 * Registers or updates this installation. Called on launch, and again whenever
 * the FCM token is rotated by the OS.
 */
export const register = async (req, res) => {
  const body = req.valid.body;
  const deviceId = body.deviceId || req.deviceId;
  const userId = req.auth.user?.id || null;

  const device = await prisma.device.upsert({
    where: { deviceId },
    update: {
      // Only ever claims a device, never releases it: signing out should not
      // detach push, or a signed-out user stops hearing from us entirely.
      ...(userId ? { userId } : {}),
      platform: body.platform || req.platform || 'unknown',
      deviceModel: body.deviceModel,
      osVersion: body.osVersion,
      appVersion: body.appVersion || req.appVersion,
      fcmToken: body.fcmToken,
      lastSeenAt: new Date(),
    },
    create: {
      deviceId,
      userId,
      platform: body.platform || req.platform || 'unknown',
      deviceModel: body.deviceModel,
      osVersion: body.osVersion,
      appVersion: body.appVersion || req.appVersion,
      fcmToken: body.fcmToken,
    },
    select: { id: true, deviceId: true, platform: true, isBanned: true },
  });

  return ok(res, device);
};

/** PATCH /api/app/devices/fcm-token — the OS rotated the token. */
export const updateToken = async (req, res) => {
  const { fcmToken } = req.valid.body;
  const deviceId = req.valid.body.deviceId || req.deviceId;

  const device = await prisma.device.update({
    where: { deviceId },
    data: { fcmToken, lastSeenAt: new Date() },
    select: { id: true, deviceId: true },
  });

  return ok(res, device);
};

/** GET /api/app/devices/topics — broadcast topics and whether this device is on them. */
export const topics = async (req, res) => {
  const deviceId = req.query.deviceId || req.deviceId;

  const [topics, device] = await Promise.all([
    prisma.fcmTopic.findMany({ where: { isActive: true }, orderBy: { key: 'asc' } }),
    deviceId
      ? prisma.device.findUnique({
          where: { deviceId },
          select: { id: true, topicSubscriptions: { select: { topicId: true } } },
        })
      : null,
  ]);

  const subscribed = new Set(device?.topicSubscriptions.map((s) => s.topicId) || []);

  return ok(
    res,
    topics.map((topic) => ({
      key: topic.key,
      name: topic.name,
      description: topic.description,
      subscribed: subscribed.has(topic.id),
    }))
  );
};

/** POST /api/app/devices/topics/:key — subscribe this device to a topic. */
export const subscribe = async (req, res) => {
  const { key } = req.valid.params;
  const deviceId = req.valid.body.deviceId || req.deviceId;

  const device = await prisma.device.findUnique({ where: { deviceId } });
  if (!device) throw notFound('Device');

  const done = await fcm.subscribeDevice(device.id, key);
  return ok(res, { subscribed: done });
};

/** DELETE /api/app/devices/topics/:key */
export const unsubscribe = async (req, res) => {
  const { key } = req.valid.params;
  const deviceId = req.query.deviceId || req.deviceId;

  const device = await prisma.device.findUnique({ where: { deviceId } });
  if (!device) throw notFound('Device');

  await fcm.unsubscribeDevice(device.id, key);
  return ok(res, { subscribed: false });
};
