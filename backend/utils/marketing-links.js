// The links in a marketing message. Pure: the base addresses come in as arguments.
//
// A reader's tracked link is  <site>/l/<delivery code>/<position>  and needs no row of its own: the delivery says who,
// the position says which of the campaign's destinations (MarketingLink). The unsubscribe link carries the same code.
// The codes are opaque (random, 16 characters), so a link tells nobody who received it.

import { newCode } from './share.js';
import { marketing } from '../config/marketing.js';
import { TARGETS } from './push-rich.js';

export const newDeliveryCode = () => newCode(marketing.codeLength);

export const trackedUrl = (siteBase, code, position) => `${siteBase}/l/${code}/${position}`;
export const unsubscribeUrl = (siteBase, code) => `${siteBase}/unsubscribe/${code}`;
export const oneClickUnsubscribeUrl = (apiBase, code) => `${apiBase}/api/web/marketing/unsubscribe/${code}`;
export const openPixelUrl = (apiBase, code) => `${apiBase}/api/web/marketing/open/${code}`;

/** utm_* values for a campaign, so analytics on the destination site can tell where a visit came from. */
export function utm(campaignId, channel = 'EMAIL', position = null) {
  return {
    utm_source: 'mkt',
    utm_medium: channel === 'WHATSAPP' ? 'whatsapp' : 'email',
    utm_campaign: campaignId,
    ...(position ? { utm_content: String(position) } : {}),
  };
}

/** A URL with the given query values added (existing ones are kept). */
export function withParams(url, params) {
  const u = new URL(url);
  for (const [key, value] of Object.entries(params)) if (!u.searchParams.has(key)) u.searchParams.set(key, String(value));
  return u.toString();
}

/** The Play Store link carrying the install referrer, which the app reads after install to attribute the sign-up. */
export function playUrlWithReferrer(playUrl, code) {
  if (!playUrl) return null;
  const referrer = `utm_source=mkt&utm_medium=email&utm_content=${code}`;
  return withParams(playUrl, { referrer });
}

/** A link target an admin may save: an https URL for WEB; a known app destination for APP. → message or null. */
export function targetProblem(kind, target) {
  const value = String(target ?? '').trim();
  if (!value) return 'needs somewhere to go';
  if (kind === 'WEB') {
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:') return 'must be an https:// link';
      return null;
    } catch {
      return 'is not a link';
    }
  }
  // APP: "hariharibol://verse?book=gita&chapter=2", the same destinations a push can open.
  let u;
  try {
    u = new URL(value);
  } catch {
    return 'is not an app link';
  }
  if (u.protocol !== 'hariharibol:') return 'must start with hariharibol://';
  if (!TARGETS[u.hostname]) return `${u.hostname} is not a place in the app`;
  for (const name of TARGETS[u.hostname].required || []) if (!u.searchParams.get(name)) return `needs ${name}`;
  return null;
}
