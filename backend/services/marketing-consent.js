// Who may be written to: the reader's own choices (MarketingPreference), the suppression list, and the consent log that
// proves what was agreed and when.
//
// No preference row means email on and WhatsApp off. The suppression list keeps only an HMAC of the address, so an
// address that unsubscribed, bounced or complained stays blocked after its account is deleted without the address being
// kept. The key is derived from JWT_SECRET, like the encrypted settings (services/setting.js); rotating it forgets the
// list, so it is rotated only with the same care.

import crypto from 'node:crypto';

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import { marketing } from '../config/marketing.js';
import { cleanEmail, cleanPhone, emailKey, suppressionHash } from '../utils/marketing-address.js';

const secret = crypto.createHash('sha256').update(`marketing-suppression:${env.JWT_SECRET}`).digest();

export const hashOf = (channel, address) => suppressionHash(channel, address, secret);

/* ---------- the suppression list ---------- */

/** Adds an address to the list (once). → true when it was added now. */
export async function suppress(channel, address, reason, note = null) {
  const hash = hashOf(channel, address);
  if (!hash) return false;
  const found = await prisma.marketingSuppression.findUnique({ where: { channel_hash: { channel, hash } }, select: { id: true } });
  if (found) return false;
  try {
    await prisma.marketingSuppression.create({ data: { channel, hash, reason, note: note ? String(note).slice(0, 200) : null } });
    return true;
  } catch (err) {
    if (err?.code === 'P2002') return false;
    throw err;
  }
}

export async function unsuppress(channel, address) {
  const hash = hashOf(channel, address);
  if (!hash) return false;
  const gone = await prisma.marketingSuppression.deleteMany({ where: { channel, hash } });
  return gone.count > 0;
}

export async function isSuppressed(channel, address) {
  const hash = hashOf(channel, address);
  if (!hash) return false;
  return Boolean(await prisma.marketingSuppression.findUnique({ where: { channel_hash: { channel, hash } }, select: { id: true } }));
}

/** Which of `addresses` are suppressed → a Set of the addresses (as given). One query. */
export async function suppressedAmong(channel, addresses) {
  const byHash = new Map();
  for (const address of addresses) {
    const hash = hashOf(channel, address);
    if (hash) byHash.set(hash, [...(byHash.get(hash) || []), address]);
  }
  if (byHash.size === 0) return new Set();
  const rows = await prisma.marketingSuppression.findMany({ where: { channel, hash: { in: [...byHash.keys()] } }, select: { hash: true } });
  return new Set(rows.flatMap((r) => byHash.get(r.hash) || []));
}

/* ---------- the consent log ---------- */

export async function logConsent({ userId = null, contactId = null, channel, action, source, detail = null }) {
  return prisma.marketingConsentLog.create({
    data: { userId, contactId, channel, action, source, wordingVersion: marketing.consentWordingVersion, ...(detail ? { detail } : {}) },
  });
}

/* ---------- a reader's preference ---------- */

export async function preferenceOf(userId) {
  const row = await prisma.marketingPreference.findUnique({ where: { userId } });
  return {
    emailEnabled: row?.emailEnabled ?? true,
    whatsapp: {
      phone: row?.whatsappPhone ?? null,
      verified: Boolean(row?.whatsappVerifiedAt),
      optedIn: Boolean(row?.whatsappOptInAt && !row?.whatsappOptOutAt),
    },
  };
}

/** Switches a reader's marketing email on or off. Off also puts the address on the suppression list, so a new account
 *  with the same address stays unsubscribed; on removes it (only when the reader asks, never from a bounce). */
export async function setEmailEnabled(userId, enabled, source) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  await prisma.marketingPreference.upsert({
    where: { userId },
    create: { userId, emailEnabled: enabled },
    update: { emailEnabled: enabled },
  });
  if (user?.email && cleanEmail(user.email)) {
    if (enabled) {
      const row = await prisma.marketingSuppression.findUnique({ where: { channel_hash: { channel: 'EMAIL', hash: hashOf('EMAIL', user.email) } } });
      // Only an unsubscribe is undone by the reader turning email back on; a bounce or complaint stays.
      if (row?.reason === 'UNSUBSCRIBE') await unsuppress('EMAIL', user.email);
    } else {
      await suppress('EMAIL', user.email, 'UNSUBSCRIBE', source);
    }
  }
  await logConsent({ userId, channel: 'EMAIL', action: enabled ? 'EMAIL_ON' : 'EMAIL_OFF', source });
}

/* ---------- unsubscribe by a delivery code ---------- */

/**
 * The person behind a delivery code: `{ delivery, userId, contactId, email }` or null. The email is the current address of
 * the account or contact (null once either is gone).
 */
export async function whoIs(code) {
  const delivery = await prisma.marketingDelivery.findUnique({
    where: { code },
    include: { user: { select: { id: true, email: true } }, contact: { select: { id: true, email: true, phone: true } } },
  });
  if (!delivery) return null;
  return {
    delivery,
    userId: delivery.user?.id ?? delivery.userId ?? null,
    contactId: delivery.contact?.id ?? delivery.contactId ?? null,
    email: delivery.user?.email ?? delivery.contact?.email ?? null,
    phone: delivery.contact?.phone ?? null,
  };
}

/** The reader unsubscribes through a link in an email. Idempotent. → `{ ok, already }` or null for an unknown code. */
export async function unsubscribeByCode(code, source = 'unsubscribe') {
  const who = await whoIs(code);
  if (!who) return null;
  if (who.delivery.channel === 'WHATSAPP') {
    const phone = who.phone;
    if (phone) await suppress('WHATSAPP', phone, 'UNSUBSCRIBE', source);
    if (who.userId) {
      await prisma.marketingPreference.updateMany({ where: { userId: who.userId }, data: { whatsappOptOutAt: new Date() } });
      await logConsent({ userId: who.userId, channel: 'WHATSAPP', action: 'WHATSAPP_STOP', source });
    }
    return { ok: true, already: false, channel: 'WHATSAPP' };
  }
  const already = who.email ? await isSuppressed('EMAIL', who.email) : false;
  if (who.userId) await setEmailEnabled(who.userId, false, source);
  else if (who.email) {
    await suppress('EMAIL', who.email, 'UNSUBSCRIBE', source);
    await logConsent({ contactId: who.contactId, channel: 'EMAIL', action: 'EMAIL_OFF', source });
  }
  return { ok: true, already, channel: 'EMAIL' };
}

/** The reader changed their mind on the unsubscribe page. Only an unsubscribe is undone. */
export async function resubscribeByCode(code, source = 'unsubscribe') {
  const who = await whoIs(code);
  if (!who || who.delivery.channel !== 'EMAIL') return null;
  if (who.userId) {
    await setEmailEnabled(who.userId, true, source);
  } else if (who.email) {
    const row = await prisma.marketingSuppression.findUnique({ where: { channel_hash: { channel: 'EMAIL', hash: hashOf('EMAIL', who.email) } } });
    if (row?.reason === 'UNSUBSCRIBE') await unsuppress('EMAIL', who.email);
    await logConsent({ contactId: who.contactId, channel: 'EMAIL', action: 'EMAIL_ON', source });
  }
  return { ok: true };
}

export { cleanEmail, cleanPhone, emailKey };
