// What happens after a message is sent: a tap on a tracked link, an open (approximate: mail privacy proxies open messages by
// themselves), the person signing up with an address we had invited, and what a clicker did afterwards.
//
// Tracking is identified only where we already know the person: a tap on a reader's link says "this reader tapped", which
// is what lets the admin panel show what they did next. An invitee's tap is recorded against the delivery, not a person.

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { linkFromUri, webPathFor } from '../utils/push-rich.js';
import { playUrlWithReferrer, utm, withParams } from '../utils/marketing-links.js';
import { emailKey } from '../utils/marketing-address.js';
import { CODE_PATTERN } from '../utils/share.js';

// A tap that comes from a mail scanner, a link previewer or a prefetch is recorded but not counted as interest.
const BOT = /bot|crawler|spider|preview|scanner|proofpoint|mimecast|barracuda|symantec|trendmicro|safelinks|microsoft office|outlook-ios|googleimageproxy|slurp|facebookexternalhit|whatsapp|telegram|curl|wget|python-requests|java\/|go-http-client|headless/i;
export const looksLikeBot = (userAgent) => !userAgent || BOT.test(String(userAgent));

const validCode = (code) => typeof code === 'string' && CODE_PATTERN.test(code);

/**
 * A reader taps a tracked link. → `{ kind, url, appUri, webUrl, getAppUrl, campaignId }` or null for a code we never made.
 * `url` is where a browser goes right now: the target (with utm values) for a WEB link, the website's own page for an APP
 * link (the site then offers the app or the store). Never throws on a bad position: it falls back to the website's home.
 */
export async function recordClick({ code, position, userAgent, method = 'GET', at = new Date() }) {
  if (!validCode(code)) return null;
  const delivery = await prisma.marketingDelivery.findUnique({ where: { code }, select: { id: true, campaignId: true, userId: true, clickedAt: true, channel: true } });
  if (!delivery) return null;
  const link = await prisma.marketingLink.findUnique({ where: { campaignId_position: { campaignId: delivery.campaignId, position: Number(position) || 0 } } });

  const base = env.WEB_BASE_URL;
  const marks = (pos) => utm(delivery.campaignId, delivery.channel, pos);
  const result = { campaignId: delivery.campaignId, kind: link?.kind ?? 'WEB', url: withParams(base, marks(null)), appUri: null, webUrl: null, getAppUrl: `${base}/get-app?mkt=${code}` };

  if (link?.kind === 'WEB') {
    result.url = withParams(link.target, marks(link.position));
  } else if (link?.kind === 'APP') {
    result.appUri = link.target;
    const path = webPathFor(linkFromUri(link.target)) ?? '/';
    result.webUrl = withParams(`${base}${path}`, marks(link.position));
    result.url = result.webUrl;
  }

  // HEAD is a probe, not a tap. A bot's tap is stored but marked.
  if (method !== 'HEAD' && link) {
    const isBot = looksLikeBot(userAgent);
    await prisma.marketingClick.create({ data: { campaignId: delivery.campaignId, linkId: link.id, deliveryId: delivery.id, isBot, createdAt: at } });
    if (!isBot) {
      if (!delivery.clickedAt) await prisma.marketingDelivery.update({ where: { id: delivery.id }, data: { clickedAt: at } });
      if (delivery.userId) await attribute({ userId: delivery.userId, campaignId: delivery.campaignId, deliveryId: delivery.id, kind: 'CLICK' });
    }
  }
  return result;
}

/** The 1×1 picture loaded: the message was opened (or a privacy proxy opened it). Records the first time only. */
export async function recordOpen({ code, method = 'GET', at = new Date() }) {
  if (!validCode(code) || method === 'HEAD') return false;
  const done = await prisma.marketingDelivery.updateMany({ where: { code, openedAt: null }, data: { openedAt: at } });
  return done.count > 0;
}

/** The first time a reader does each thing: unique per reader, campaign and kind, so repeating it is harmless. */
export async function attribute({ userId, campaignId, deliveryId = null, kind }) {
  try {
    await prisma.marketingAttribution.create({ data: { userId, campaignId, deliveryId, kind } });
    return true;
  } catch (err) {
    if (err?.code === 'P2002') return false;
    logger.warn({ err: err.message, campaignId, kind }, 'marketing attribution failed');
    return false;
  }
}

/**
 * A person signed up. If their address is one we invited (a MarketingContact), the sign-up is attributed to the latest
 * campaign that was sent to it. The robust path for invitees, on both phones. → the campaign id, or null.
 */
export async function attributeSignup(user) {
  const key = emailKey(user.email);
  if (!key) return null;
  const contact = await prisma.marketingContact.findUnique({ where: { emailKey: key }, select: { id: true } });
  if (!contact) return null;
  const last = await prisma.marketingDelivery.findFirst({ where: { contactId: contact.id, sentAt: { not: null } }, orderBy: { sentAt: 'desc' }, select: { id: true, campaignId: true } });
  if (!last) return null;
  await attribute({ userId: user.id, campaignId: last.campaignId, deliveryId: last.id, kind: 'SIGNUP_EMAIL_MATCH' });
  return last.campaignId;
}

/** The app opened from a tracked link (Phase 4 sends it): attributes the open to the signed-in reader. */
export async function recordAppOpen({ userId, code, position }) {
  if (!validCode(code)) return null;
  const delivery = await prisma.marketingDelivery.findUnique({ where: { code }, select: { id: true, campaignId: true } });
  if (!delivery) return null;
  await attribute({ userId, campaignId: delivery.campaignId, deliveryId: delivery.id, kind: 'APP_OPEN' });
  const link = await prisma.marketingLink.findUnique({ where: { campaignId_position: { campaignId: delivery.campaignId, position: Number(position) || 0 } } });
  return { campaignId: delivery.campaignId, appUri: link?.kind === 'APP' ? link.target : null, target: link?.kind === 'WEB' ? link.target : null };
}

/** Google's install referrer (`utm_source=mkt&utm_content=<code>`), read by the app on first launch. */
export async function recordInstallReferrer({ userId, referrer }) {
  const params = new URLSearchParams(String(referrer || ''));
  if (params.get('utm_source') !== 'mkt') return null;
  const code = params.get('utm_content');
  if (!validCode(code)) return null;
  const delivery = await prisma.marketingDelivery.findUnique({ where: { code }, select: { id: true, campaignId: true } });
  if (!delivery) return null;
  await attribute({ userId, campaignId: delivery.campaignId, deliveryId: delivery.id, kind: 'INSTALL_REFERRER' });
  return { campaignId: delivery.campaignId };
}

/**
 * What readers who tapped did in the 24 hours and the 7 days after the tap, against the 7 days before it: rounds chanted,
 * readers who chanted, reel views and readers who read. Counted in the database for all clickers of a campaign at once.
 */
export async function impact(campaignId) {
  const [row] = await prisma.$queryRaw`
    WITH c AS (
      SELECT "userId", "clickedAt" AS t FROM "MarketingDelivery"
      WHERE "campaignId" = ${campaignId} AND "userId" IS NOT NULL AND "clickedAt" IS NOT NULL
    ), chant AS (
      SELECT c."userId",
        COALESCE(SUM(s."rounds") FILTER (WHERE s."startedAt" >= c.t - interval '7 days' AND s."startedAt" < c.t), 0) AS before7,
        COALESCE(SUM(s."rounds") FILTER (WHERE s."startedAt" >= c.t AND s."startedAt" < c.t + interval '1 day'), 0) AS after24,
        COALESCE(SUM(s."rounds") FILTER (WHERE s."startedAt" >= c.t AND s."startedAt" < c.t + interval '7 days'), 0) AS after7
      FROM c LEFT JOIN "ChantSession" s ON s."userId" = c."userId" AND s."startedAt" >= c.t - interval '7 days' AND s."startedAt" < c.t + interval '7 days'
      GROUP BY c."userId", c.t
    ), reels AS (
      SELECT c."userId",
        COUNT(v.*) FILTER (WHERE v."lastViewedAt" >= c.t - interval '7 days' AND v."lastViewedAt" < c.t) AS before7,
        COUNT(v.*) FILTER (WHERE v."lastViewedAt" >= c.t AND v."lastViewedAt" < c.t + interval '1 day') AS after24,
        COUNT(v.*) FILTER (WHERE v."lastViewedAt" >= c.t AND v."lastViewedAt" < c.t + interval '7 days') AS after7
      FROM c LEFT JOIN "ReelView" v ON v."userId" = c."userId" AND v."lastViewedAt" >= c.t - interval '7 days' AND v."lastViewedAt" < c.t + interval '7 days'
      GROUP BY c."userId", c.t
    ), reads AS (
      SELECT c."userId",
        COUNT(r.*) FILTER (WHERE r."lastReadAt" >= c.t - interval '7 days' AND r."lastReadAt" < c.t) AS before7,
        COUNT(r.*) FILTER (WHERE r."lastReadAt" >= c.t AND r."lastReadAt" < c.t + interval '1 day') AS after24,
        COUNT(r.*) FILTER (WHERE r."lastReadAt" >= c.t AND r."lastReadAt" < c.t + interval '7 days') AS after7
      FROM c LEFT JOIN "ReadingProgress" r ON r."userId" = c."userId" AND r."lastReadAt" >= c.t - interval '7 days' AND r."lastReadAt" < c.t + interval '7 days'
      GROUP BY c."userId", c.t
    )
    SELECT
      (SELECT COUNT(*) FROM c)::int AS clickers,
      (SELECT COALESCE(SUM(before7),0) FROM chant)::int AS "roundsBefore7", (SELECT COALESCE(SUM(after24),0) FROM chant)::int AS "roundsAfter24", (SELECT COALESCE(SUM(after7),0) FROM chant)::int AS "roundsAfter7",
      (SELECT COUNT(*) FROM chant WHERE before7 > 0)::int AS "chantersBefore7", (SELECT COUNT(*) FROM chant WHERE after24 > 0)::int AS "chantersAfter24", (SELECT COUNT(*) FROM chant WHERE after7 > 0)::int AS "chantersAfter7",
      (SELECT COALESCE(SUM(before7),0) FROM reels)::int AS "reelsBefore7", (SELECT COALESCE(SUM(after24),0) FROM reels)::int AS "reelsAfter24", (SELECT COALESCE(SUM(after7),0) FROM reels)::int AS "reelsAfter7",
      (SELECT COUNT(*) FROM reads WHERE before7 > 0)::int AS "readersBefore7", (SELECT COUNT(*) FROM reads WHERE after24 > 0)::int AS "readersAfter24", (SELECT COUNT(*) FROM reads WHERE after7 > 0)::int AS "readersAfter7"`;
  const n = (v) => Number(v ?? 0);
  return {
    clickers: n(row?.clickers),
    chanting: { rounds: { before7: n(row?.roundsBefore7), after24: n(row?.roundsAfter24), after7: n(row?.roundsAfter7) }, readers: { before7: n(row?.chantersBefore7), after24: n(row?.chantersAfter24), after7: n(row?.chantersAfter7) } },
    reels: { views: { before7: n(row?.reelsBefore7), after24: n(row?.reelsAfter24), after7: n(row?.reelsAfter7) } },
    reading: { readers: { before7: n(row?.readersBefore7), after24: n(row?.readersAfter24), after7: n(row?.readersAfter7) } },
    note: 'Counted for readers who tapped a link, from the tap. “Before” is the 7 days ahead of the tap.',
  };
}

export { playUrlWithReferrer };
