// What a shared link looks like. Pure — no I/O — so the same rules are tested
// without a database and mirrored by the website (website/src/lib/share.ts) and
// the app (app/lib/core/share_links.dart).
//
// Two families of link, and they never share a path or a table:
//
//   content  hariharibol.com/shloka/<code>   a verse
//            hariharibol.com/naam/<code>     a mantra
//            hariharibol.com/darshan/<code>  a reel
//   referral hariharibol.com/satsang/<code>  an invitation
//
// A code is random. It is not the verse id or the sharer's id, so a link tells
// nobody which database row or which person is behind it.

import crypto from 'node:crypto';

export const CONTENT_ROUTES = {
  VERSE: 'shloka',
  MANTRA: 'naam',
  REEL: 'darshan',
};
export const REFERRAL_ROUTE = 'satsang';

const TYPE_BY_ROUTE = Object.fromEntries(Object.entries(CONTENT_ROUTES).map(([type, route]) => [route, type]));

// Base58: no 0, O, I, l — a code read aloud or typed from a screenshot survives.
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const CODE_LENGTH = 10;
export const CODE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{8,16}$/;

export function newCode(length = CODE_LENGTH) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// Referral codes are typed by hand when a link does not survive an install, so
// they use the readable alphabet and are shown upper-case.
const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6,12}$/;

export function newReferralCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += REFERRAL_ALPHABET[bytes[i] % REFERRAL_ALPHABET.length];
  return out;
}

export function normaliseReferralCode(raw) {
  const code = String(raw || '').trim().toUpperCase().replace(/[\s-]/g, '');
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

export function contentUrl(base, type, code) {
  const route = CONTENT_ROUTES[type];
  return route ? `${base}/${route}/${code}` : null;
}

export function referralUrl(base, code) {
  return `${base}/${REFERRAL_ROUTE}/${code}`;
}

/**
 * Reads a link or a path and says what it points at, or null. This is the one
 * parser: the website and the app use the same grammar and never interpret a URL
 * any other way. Only the configured host (or a bare path) is accepted, so a
 * link cannot send anyone to another site.
 */
export function parseLink(input, { host } = {}) {
  let path = String(input || '').trim();
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
      const url = new URL(path);
      const custom = url.protocol !== 'http:' && url.protocol !== 'https:';
      if (!custom && host && url.host !== host && url.host !== `www.${host}`) return null;
      path = custom ? `/${url.host}${url.pathname}` : url.pathname;
    }
  } catch {
    return null;
  }
  const [, route, code] = path.split('/');
  if (!route) return null;
  if (route === REFERRAL_ROUTE) {
    const referral = normaliseReferralCode(code);
    return referral ? { kind: 'referral', code: referral } : null;
  }
  const type = TYPE_BY_ROUTE[route];
  if (type && CODE_PATTERN.test(code || '')) return { kind: 'content', type, code };
  return null;
}

/** gmail ignores dots and +tags; two addresses that differ only so are one inbox. */
export function inbox(email) {
  const [local = '', domain = ''] = String(email || '').toLowerCase().split('@');
  const d = domain === 'googlemail.com' ? 'gmail.com' : domain;
  const base = local.split('+')[0];
  return `${d === 'gmail.com' ? base.replace(/\./g, '') : base}@${d}`;
}

