// The public side of marketing messages: what a stranger's tap on an email does. Anonymous — the opaque delivery code in the
// link is the only credential, and it can do exactly three things: unsubscribe (or take that back), be redirected, be counted
// as opened. Nothing it returns says more about the person than an unsubscribe page needs.

import * as consent from '../../services/marketing-consent.js';
import * as tracking from '../../services/marketing-tracking.js';
import { ok } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';
import { maskEmail } from '../admin/marketing-audience.js';

// A 1×1 transparent GIF.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/** GET /api/web/marketing/unsubscribe/:code — enough to show “unsubscribe <masked address>?”. */
export const unsubscribeInfo = async (req, res) => {
  const who = await consent.whoIs(req.valid.params.code);
  if (!who) throw notFound('Link');
  const suppressed = who.email ? await consent.isSuppressed(who.delivery.channel, who.email) : false;
  return ok(res, { channel: who.delivery.channel, address: who.email ? maskEmail(who.email) : null, unsubscribed: suppressed });
};

/** POST /api/web/marketing/unsubscribe/:code — the one-click unsubscribe mail programs call; honoured at once. */
export const unsubscribe = async (req, res) => {
  const done = await consent.unsubscribeByCode(req.valid.params.code, 'unsubscribe');
  if (!done) throw notFound('Link');
  return ok(res, { unsubscribed: true, already: done.already });
};

/** POST /api/web/marketing/resubscribe/:code — the page’s “I changed my mind”. */
export const resubscribe = async (req, res) => {
  const done = await consent.resubscribeByCode(req.valid.params.code, 'unsubscribe');
  if (!done) throw notFound('Link');
  return ok(res, { subscribed: true });
};

/** GET /api/web/marketing/click/:code/:n — records the tap and says where to go. The website’s /l route does the redirect. */
export const click = async (req, res) => {
  const { code, n } = req.valid.params;
  const found = await tracking.recordClick({ code, position: n, userAgent: req.get('x-client-user-agent') || req.get('user-agent'), method: req.get('x-client-method') === 'HEAD' ? 'HEAD' : 'GET' });
  if (!found) throw notFound('Link');
  return ok(res, found);
};

/** GET /api/web/marketing/open/:code — the tracking picture. Always answers with the picture, known code or not. */
export const open = async (req, res) => {
  await tracking.recordOpen({ code: req.valid.params.code }).catch(() => {});
  res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, max-age=0', 'Content-Length': PIXEL.length });
  return res.status(200).end(PIXEL);
};
