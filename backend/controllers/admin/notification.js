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

import { prisma } from '../../config/database.js';
import * as audit from '../../services/audit.js';
import * as notify from '../../services/notify.js';
import { ok, paginated } from '../../utils/respond.js';
import { paginate, readSort } from '../../utils/pagination.js';
import * as campaigns from '../../services/push-campaign.js';
import { badRequest, notFound } from '../../utils/errors.js';

/** POST /api/admin/notifications/topic */
export const broadcastTopic = async (req, res) => {
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
export const broadcastAudience = async (req, res) => {
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
    { type: 'ANNOUNCEMENT', title, body, data, source: 'audience', campaign: `audience:${audience}:${Date.now()}` }
  );

  await audit.record(req, {
    action: 'notification.broadcast.audience',
    entityType: 'Notification',
    after: { audience, title, recipients: users.length },
  });

  return ok(res, { recipients: users.length, created: result.created, campaignId: result.campaignId });
};

/** POST /api/admin/notifications/user/:userId — a message to one person. */
export const toUser = async (req, res) => {
  const { title, body, data, type = 'SYSTEM' } = req.valid.body;

  const notification = await notify.toUser(req.valid.params.userId, {
    type,
    title,
    body,
    data,
    source: 'user',
    campaign: `user:${Date.now()}`,
  });

  await audit.record(req, {
    action: 'notification.direct',
    entityType: 'Notification',
    entityId: notification.id,
    after: { userId: req.valid.params.userId, title },
  });

  return ok(res, notification);
};

// Columns the notifications table can be sorted by — see readSort.
export const SORT_COLUMNS = {
  createdAt: 'createdAt',
  type: 'type',
  title: 'title',
};

/** GET /api/admin/notifications — what has been sent, for checking delivery. */
export const list = async (req, res) => {
  const { q, type, userId } = req.valid.query;

  const { items, page } = await paginate(prisma.notification, {
    where: {
      ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] } : {}),
      ...(type ? { type } : {}),
      ...(userId ? { userId } : {}),
    },
    orderBy: readSort(req.valid.query, SORT_COLUMNS, { createdAt: 'desc' }),
    include: { user: { select: { id: true, email: true, name: true } } },
    query: req.valid.query,
  });

  return paginated(res, items, page);
};

export const CAMPAIGN_SORT_COLUMNS = {
  createdAt: 'createdAt',
  type: 'type',
  title: 'title',
  sentDevices: 'sentDevices',
};

const withStats = (campaign, totals) => ({
  ...campaign,
  funnel: campaigns.funnel({
    sent: campaign.sentDevices,
    delivered: totals?.reached || 0,
    opened: totals?.opened || 0,
    engaged: totals?.engaged || 0,
    readers: totals?.readers || 0,
    totalStayMs: totals?.totalStayMs || 0,
  }),
});

/**
 * GET /api/admin/notifications/campaigns
 *
 * Every push as one row — how many devices it was sent to, how many confirmed it
 * arrived, how many tapped it, how many then read for at least `minSeconds`.
 */
export const listCampaigns = async (req, res) => {
  const { q, type, minSeconds } = req.valid.query;

  const { items, page } = await paginate(prisma.pushCampaign, {
    where: {
      ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] } : {}),
      ...(type ? { type } : {}),
    },
    orderBy: readSort(req.valid.query, CAMPAIGN_SORT_COLUMNS, { createdAt: 'desc' }),
    query: req.valid.query,
  });

  const totals = await campaigns.eventTotals(items.map((c) => c.id), minSeconds);
  return paginated(res, items.map((c) => withStats(c, totals.get(c.id))), page);
};

/** GET /api/admin/notifications/campaigns/:id — one push in detail. */
export const getCampaign = async (req, res) => {
  const { id } = req.valid.params;
  const { minSeconds } = req.valid.query;

  const campaign = await prisma.pushCampaign.findUnique({ where: { id } });
  if (!campaign) throw notFound('Notification');

  const [totals, stays, byPlatform, inApp, recent] = await Promise.all([
    campaigns.eventTotals([id], minSeconds),
    // How long readers stayed, bucketed — the shape of attention, not just a mean.
    prisma.$queryRaw`
      SELECT CASE
          WHEN "durationMs" < 5000 THEN 'under 5s'
          WHEN "durationMs" < 10000 THEN '5-10s'
          WHEN "durationMs" < 30000 THEN '10-30s'
          WHEN "durationMs" < 60000 THEN '30-60s'
          ELSE 'over 60s' END AS bucket,
        COUNT(*)::int AS count
      FROM "PushEvent" WHERE "campaignId" = ${id} AND event = 'ENGAGED'
      GROUP BY 1`,
    prisma.$queryRaw`
      SELECT d.platform, COUNT(DISTINCT e."deviceId")::int AS reached,
        COUNT(*) FILTER (WHERE e.event = 'OPENED')::int AS opened
      FROM "PushEvent" e JOIN "Device" d ON d.id = e."deviceId"
      WHERE e."campaignId" = ${id} GROUP BY d.platform`,
    prisma.notification.aggregate({
      where: { campaignId: id },
      _count: { _all: true, readAt: true },
    }),
    prisma.pushEvent.findMany({
      where: { campaignId: id, event: { in: ['OPENED', 'ENGAGED'] } },
      orderBy: { occurredAt: 'desc' },
      take: 50,
      select: {
        id: true, event: true, durationMs: true, screen: true, occurredAt: true,
        device: { select: { platform: true, appVersion: true } },
      },
    }),
  ]);

  const order = ['under 5s', '5-10s', '10-30s', '30-60s', 'over 60s'];
  return ok(res, {
    ...withStats(campaign, totals.get(id)),
    minSeconds,
    stayBuckets: order.map((bucket) => ({
      bucket,
      count: stays.find((s) => s.bucket === bucket)?.count || 0,
    })),
    byPlatform,
    inApp: { notifications: inApp._count._all, read: inApp._count.readAt },
    recent,
  });
};
