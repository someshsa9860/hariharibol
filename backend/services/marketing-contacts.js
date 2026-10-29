// Invitees: people who are not readers, imported from a CSV into a list. The admin panel parses the file in the browser
// and sends the rows in chunks; each chunk is first checked (nothing written), then committed.
//
// Every import carries an attestation — who confirmed that these people agreed to hear from us, worded as it was that day —
// stored on the MarketingImport row. A phone number gets a WhatsApp opt-in only when the import attested WhatsApp consent
// (Meta does not allow a message to a number with no recorded opt-in). An address that already belongs to a reader is not
// imported (the reader has their own switch), and one on the suppression list is never imported.

import { prisma } from '../config/database.js';
import { marketing } from '../config/marketing.js';
import { cleanEmail, cleanPhone, emailKey } from '../utils/marketing-address.js';
import { DEFAULT_LANGUAGE } from '../config/constants.js';
import * as consent from './marketing-consent.js';
import { keysOfReaders } from './marketing-audience.js';

export const MAX_ROWS_PER_CHUNK = 500;
const REASONS = ['invalid', 'duplicate', 'already_reader', 'suppressed', 'no_consent', 'conflict'];

const text = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const LANGUAGE = /^[a-z]{2,3}$/;

/**
 * Looks at rows without writing: → `{ rows: [{ index, status: 'new'|'existing'|reason, email, phone, name, language }], counts }`.
 * `seen` carries the keys of earlier chunks of the same import so a duplicate across chunks is still found.
 */
export async function classify(rows, { attestsEmail, attestsWhatsApp, seen = { emails: new Set(), phones: new Set() } }) {
  const parsed = rows.map((raw, index) => {
    const email = attestsEmail ? cleanEmail(String(raw?.email ?? '')) : null;
    const phone = cleanPhone(String(raw?.phone ?? '')) ;
    const gaveEmail = Boolean(String(raw?.email ?? '').trim());
    const gavePhone = Boolean(String(raw?.phone ?? '').trim());
    const lang = text(raw?.language, 10).toLowerCase();
    return {
      index,
      email,
      phone,
      key: email ? emailKey(email) : null,
      name: text(raw?.name, 120) || null,
      language: LANGUAGE.test(lang) ? lang : null,
      gaveEmail,
      gavePhone,
    };
  });

  const emails = parsed.map((p) => p.email).filter(Boolean);
  const phones = parsed.map((p) => p.phone).filter(Boolean);
  const [readerKeys, suppressedEmails, suppressedPhones, byKey, byPhone] = await Promise.all([
    keysOfReaders(emails),
    consent.suppressedAmong('EMAIL', emails),
    consent.suppressedAmong('WHATSAPP', phones),
    prisma.marketingContact.findMany({ where: { emailKey: { in: parsed.map((p) => p.key).filter(Boolean) } }, select: { id: true, emailKey: true, phone: true } }),
    prisma.marketingContact.findMany({ where: { phone: { in: phones } }, select: { id: true, emailKey: true, phone: true } }),
  ]);
  const contactByKey = new Map(byKey.map((c) => [c.emailKey, c]));
  const contactByPhone = new Map(byPhone.map((c) => [c.phone, c]));

  const counts = { new: 0, existing: 0, ...Object.fromEntries(REASONS.map((r) => [r, 0])) };
  const out = parsed.map((p) => {
    let status;
    let { email, phone } = p;
    // Nothing usable: an address the import did not attest is "no consent"; anything else that does not parse is "invalid".
    if (!email && !phone) status = p.gaveEmail && !attestsEmail && !p.gavePhone ? 'no_consent' : 'invalid';

    if (!status && email && suppressedEmails.has(email)) {
      email = null;
      if (!phone) status = 'suppressed';
    }
    if (!status && phone && suppressedPhones.has(phone)) {
      phone = null;
      if (!email) status = 'suppressed';
    }
    if (!status && email && readerKeys.has(p.key)) {
      email = null;
      if (!phone) status = 'already_reader';
    }
    if (!status) {
      const key = email ? emailKey(email) : null;
      const dup = (key && seen.emails.has(key)) || (phone && seen.phones.has(phone));
      if (dup) status = 'duplicate';
      else {
        if (key) seen.emails.add(key);
        if (phone) seen.phones.add(phone);
        const a = key ? contactByKey.get(key) : null;
        const b = phone ? contactByPhone.get(phone) : null;
        if (a && b && a.id !== b.id) status = 'conflict';
        else status = a || b ? 'existing' : 'new';
      }
    }
    counts[status] += 1;
    return { index: p.index, status, email, phone, name: p.name, language: p.language };
  });
  return { rows: out, counts };
}

/** Writes a chunk: contacts created or found, added to the list. → counts as `classify` plus `contactIds`. */
export async function commitChunk({ importId, listId, rows, attestsEmail, attestsWhatsApp, seen }) {
  const checked = await classify(rows, { attestsEmail, attestsWhatsApp, seen });
  const contactIds = [];
  const now = new Date();
  for (const row of checked.rows) {
    if (row.status !== 'new' && row.status !== 'existing') continue;
    const key = row.email ? emailKey(row.email) : null;
    const found = await prisma.marketingContact.findFirst({ where: { OR: [...(key ? [{ emailKey: key }] : []), ...(row.phone ? [{ phone: row.phone }] : [])] } });
    let contact = found;
    if (!contact) {
      contact = await prisma.marketingContact.create({
        data: {
          email: row.email, emailKey: key, phone: row.phone, name: row.name, language: row.language,
          whatsappOptInAt: row.phone && attestsWhatsApp ? now : null,
          importId,
        },
      });
      await consent.logConsent({ contactId: contact.id, channel: 'EMAIL', action: 'IMPORT_ATTESTED', source: 'import', detail: { importId, email: Boolean(row.email), whatsapp: Boolean(row.phone && attestsWhatsApp) } });
    } else {
      const patch = {};
      if (!contact.name && row.name) patch.name = row.name;
      if (!contact.language && row.language) patch.language = row.language;
      if (!contact.email && row.email) Object.assign(patch, { email: row.email, emailKey: key });
      if (!contact.phone && row.phone) Object.assign(patch, { phone: row.phone });
      if (row.phone && attestsWhatsApp && !contact.whatsappOptInAt) patch.whatsappOptInAt = now;
      if (Object.keys(patch).length) contact = await prisma.marketingContact.update({ where: { id: contact.id }, data: patch });
    }
    contactIds.push(contact.id);
  }
  if (listId && contactIds.length) {
    await prisma.marketingListMember.createMany({ data: contactIds.map((contactId) => ({ listId, contactId })), skipDuplicates: true });
    await recountList(listId);
  }
  return { ...checked, contactIds };
}

export async function recountList(listId) {
  const memberCount = await prisma.marketingListMember.count({ where: { listId } });
  await prisma.marketingList.update({ where: { id: listId }, data: { memberCount } });
  return memberCount;
}

/** Removes a contact from every list and deletes it (a person asked to be forgotten). The suppression list keeps only a hash. */
export async function forgetContact(contactId) {
  const contact = await prisma.marketingContact.findUnique({ where: { id: contactId }, include: { lists: { select: { listId: true } } } });
  if (!contact) return false;
  if (contact.email) await consent.suppress('EMAIL', contact.email, 'MANUAL', 'contact deleted');
  await prisma.marketingContact.delete({ where: { id: contactId } });
  for (const { listId } of contact.lists) await recountList(listId);
  return true;
}

export { DEFAULT_LANGUAGE, marketing };
