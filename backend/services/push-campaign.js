// Push analytics, server side. A campaign is one push message as the admin panel
// sees it, shared by everyone it went to; see PushCampaign in schema.prisma.
//
// The server knows how many devices FCM accepted the message for. Whether a phone
// then received it, was tapped, and how long the reader stayed is reported by the
// app (controllers/app/notification.js `events`) and counted here.

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { funnel, defaultKey } from '../utils/push-funnel.js';

/** The campaign for `key`, made on first use. The first message's words are kept. */
async function ensure({ key, type, source = 'system', title, body }) {
  const campaignKey = key || defaultKey(type);
  return prisma.pushCampaign.upsert({
    where: { key: campaignKey },
    update: {},
    create: { key: campaignKey, type, source, title, body },
    select: { id: true, key: true },
  });
}

/** Adds what one send did to the campaign's totals. Never throws — counting must not fail a push. */
async function addSent(campaignId, { users = 0, sent = 0, failed = 0 }) {
  try {
    await prisma.pushCampaign.update({
      where: { id: campaignId },
      data: {
        targetedUsers: { increment: users },
        sentDevices: { increment: sent },
        failedDevices: { increment: failed },
      },
    });
  } catch (err) {
    logger.warn({ err: err.message, campaignId }, 'could not count push send');
  }
}

const MAX_STAY_MS = 30 * 60 * 1000;

/**
 * Saves what a device reported. Safe to repeat: one row per device per kind, and a
 * longer stay replaces a shorter one. Unknown campaigns and unknown kinds are skipped.
 * Returns how many events were kept.
 */
async function recordEvents({ deviceId, userId, events, now = new Date() }) {
  let kept = 0;
  for (const item of events) {
    const campaign = await prisma.pushCampaign.findUnique({
      where: { id: item.pushId },
      select: { id: true },
    });
    if (!campaign) continue;

    // The phone's clock is only a hint; never accept a time in the future.
    const at = item.at && new Date(item.at) < now ? new Date(item.at) : now;
    const durationMs =
      item.event === 'ENGAGED' ? Math.max(0, Math.min(Math.round(item.durationMs || 0), MAX_STAY_MS)) : null;

    const key = { campaignId: campaign.id, deviceId, event: item.event };
    const existing = await prisma.pushEvent.findUnique({
      where: { campaignId_deviceId_event: key },
      select: { id: true, durationMs: true },
    });

    if (!existing) {
      await prisma.pushEvent.create({
        data: { ...key, userId, durationMs, screen: item.screen || null, occurredAt: at },
      });
    } else if (durationMs !== null && durationMs > (existing.durationMs || 0)) {
      await prisma.pushEvent.update({
        where: { id: existing.id },
        data: { durationMs, screen: item.screen || null },
      });
    }
    kept += 1;
  }
  return kept;
}

/**
 * Per-campaign counts from the event table. `minSeconds` is what counts as having
 * read: an ENGAGED event shorter than that is a glance, not a read.
 */
async function eventTotals(campaignIds, minSeconds = 10) {
  if (!campaignIds.length) return new Map();
  const rows = await prisma.$queryRaw`
    SELECT "campaignId",
      COUNT(DISTINCT "deviceId")::int AS reached,
      COUNT(*) FILTER (WHERE event = 'OPENED')::int AS opened,
      COUNT(*) FILTER (WHERE event = 'ENGAGED' AND "durationMs" >= ${minSeconds * 1000})::int AS engaged,
      COUNT(*) FILTER (WHERE event = 'ENGAGED')::int AS readers,
      COALESCE(SUM("durationMs") FILTER (WHERE event = 'ENGAGED'), 0)::bigint AS "totalStayMs"
    FROM "PushEvent"
    WHERE "campaignId" = ANY(${campaignIds})
    GROUP BY "campaignId"`;
  return new Map(rows.map((r) => [r.campaignId, { ...r, totalStayMs: Number(r.totalStayMs) }]));
}

export { ensure, addSent, recordEvents, funnel, eventTotals, defaultKey, MAX_STAY_MS };
