// The rules of a shared link, with no database: what a code looks like, which path each kind of content
// lives at, and how a URL is built. Pure, so test/share.test.js can walk it.
//
//   https://hariharbol.com/shloka/<code>   a verse
//   https://hariharbol.com/mantra/<code>   a mantra
//   https://hariharbol.com/divya/<code>    a reel
//   https://hariharbol.com/satsang/<code>  a referral (never a piece of content — see utils/referral.js)

import crypto from 'node:crypto';

// No 0/O/1/I/L/U: a code read aloud or typed from a screenshot survives.
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
export const SHARE_CODE_LENGTH = 10;
export const REFERRAL_CODE_LENGTH = 8;

/** A random code. 30^10 is far past guessing, and nothing in it is derived from the content or a person. */
export function newCode(length = SHARE_CODE_LENGTH) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{6,16}$`);

/** Codes are upper case; links get typed and pasted in any case. Null when it cannot be a code at all. */
export function normaliseCode(raw) {
  const code = String(raw ?? '').trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** Public path segment → what it opens. The segment names the content, never the word "share". */
export const KIND_PATHS = Object.freeze({ SHLOKA: 'shloka', MANTRA: 'mantra', REEL: 'divya' });

export const kindOfPath = (segment) =>
  Object.entries(KIND_PATHS).find(([, path]) => path === segment)?.[0] ?? null;

export const REFERRAL_PATH = 'satsang';

export const isShareKind = (kind) => Object.hasOwn(KIND_PATHS, kind);

export function shareUrl(base, kind, code) {
  return `${base.replace(/\/$/, '')}/${KIND_PATHS[kind]}/${code}`;
}

export function referralUrl(base, code) {
  return `${base.replace(/\/$/, '')}/${REFERRAL_PATH}/${code}`;
}

/**
 * The route inside the app for a shared target. The app owns its routes; this only names the target, and the
 * app's one link handler turns it into a screen. Kept as a custom-scheme URL so a phone without the https
 * association still opens the app.
 */
export function appUri(scheme, kind, code) {
  return `${scheme}://${KIND_PATHS[kind]}/${code}`;
}

/**
 * Only these query parameters survive onto a landing page's links — attribution, never anything that could name a
 * destination. Refusing everything else is what stops the page being an open redirect.
 */
const KEPT_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'ref'];

export function keptQuery(query = {}) {
  const out = new URLSearchParams();
  for (const key of KEPT_PARAMS) {
    const value = query[key];
    if (typeof value === 'string' && /^[\w.-]{1,40}$/.test(value)) out.set(key, value);
  }
  return out.toString();
}
