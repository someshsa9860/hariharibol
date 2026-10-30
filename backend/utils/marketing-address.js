// Email addresses and phone numbers as marketing handles them: one form to compare and de-duplicate by, and the keyed
// hash the suppression list keeps instead of the address. Pure; the hash takes its key as an argument so a test can
// supply one (services/marketing-consent.js passes the server's).

import crypto from 'node:crypto';

import { inbox } from './share.js';
import { isPlaceholderEmail } from './legacy.js';

const EMAIL = /^[^\s@<>"',;:()[\]\\]+@[^\s@<>"',;:()[\]\\]+\.[^\s@<>"',;:()[\]\\]{2,}$/;

/** The address in lower case, or null when it is not an address, is too long, or is a legacy stand-in. */
export function cleanEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email) || /\.\./.test(email)) return null;
  return isPlaceholderEmail(email) ? null : email;
}

/** The form two addresses of one inbox share (gmail ignores dots and +tags), for de-duplication and suppression. */
export const emailKey = (email) => {
  const clean = cleanEmail(email);
  return clean ? inbox(clean) : null;
};

/**
 * A phone number as E.164 (+919876543210), or null. A number with a "+" or "00" is taken as written; a bare 10-digit
 * number starting 6 to 9 is an Indian mobile; anything else is refused rather than guessed.
 */
export function cleanPhone(value, defaultCountry = '91') {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  let v = String(value).trim().replace(/[\s().-]/g, '');
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  if (!v.startsWith('+')) {
    if (/^[6-9]\d{9}$/.test(v)) v = `+${defaultCountry}${v}`;
    else if (/^0[6-9]\d{9}$/.test(v)) v = `+${defaultCountry}${v.slice(1)}`;
    else if (new RegExp(`^${defaultCountry}[6-9]\\d{9}$`).test(v)) v = `+${v}`;
    else return null;
  }
  return /^\+[1-9]\d{7,14}$/.test(v) ? v : null;
}

/** The number without its plus sign, as WhatsApp writes it. */
export const waIdOf = (phone) => (phone ? phone.replace(/^\+/, '') : null);

/** HMAC-SHA256 of the normalised address, hex (64 characters). `channel` is EMAIL or WHATSAPP. */
export function suppressionHash(channel, address, secret) {
  const normal = channel === 'WHATSAPP' ? cleanPhone(address) : emailKey(address);
  if (!normal) return null;
  return crypto.createHmac('sha256', secret).update(`${channel}:${normal}`).digest('hex');
}
