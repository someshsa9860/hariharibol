// Who marketing can reach, in the admin panel: saved segments of readers, lists of invitees (imported from a CSV with an
// attestation of consent), the suppression list and the consent log.

import { prisma } from '../../config/database.js';
import { marketing } from '../../config/marketing.js';
import * as audit from '../../services/audit.js';
import * as audience from '../../services/marketing-audience.js';
import * as consent from '../../services/marketing-consent.js';
import * as contacts from '../../services/marketing-contacts.js';
import { describeFilter, parseFilter } from '../../utils/marketing-audience.js';
import { cleanEmail, cleanPhone, emailKey } from '../../utils/marketing-address.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { paginate } from '../../utils/pagination.js';
import { badRequest, conflict, notFound, unprocessable } from '../../utils/errors.js';

const stamp = (req) => ({ createdById: req.auth.user.id, createdByName: req.auth.user.name || req.auth.user.email || null });

/** A filter that does not parse is a 422 listing what is wrong. */
function requireFilter(raw) {
  const parsed = parseFilter(raw);
  if (!parsed.ok) throw unprocessable(parsed.errors[0], parsed.errors);
  return parsed.filter;
}

/* ---------- segments ---------- */

const segmentOut = (s) => ({ id: s.id, name: s.name, filter: s.filter, summary: describeFilter(s.filter), lastCount: s.lastCount, lastCountAt: s.lastCountAt, createdByName: s.createdByName, updatedAt: s.updatedAt });

export const listSegments = async (req, res) => {
  const rows = await prisma.marketingSegment.findMany({ orderBy: { updatedAt: 'desc' } });
  return ok(res, rows.map(segmentOut));
};

export const createSegment = async (req, res) => {
  const filter = requireFilter(req.valid.body.filter);
  const count = await audience.countUsers(filter, 'EMAIL');
  const row = await prisma.marketingSegment.create({ data: { name: req.valid.body.name, filter, lastCount: count, lastCountAt: new Date(), ...stamp(req) } });
  await audit.record(req, { action: 'marketing.segment.create', entityType: 'MarketingSegment', entityId: row.id, after: { name: row.name } });
  return created(res, segmentOut(row));
};

export const updateSegment = async (req, res) => {
  const before = await prisma.marketingSegment.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('Segment');
  const data = {};
  if (req.valid.body.name) data.name = req.valid.body.name;
  if (req.valid.body.filter) {
    data.filter = requireFilter(req.valid.body.filter);
    data.lastCount = await audience.countUsers(data.filter, 'EMAIL');
    data.lastCountAt = new Date();
  }
  const row = await prisma.marketingSegment.update({ where: { id: before.id }, data });
  await audit.record(req, { action: 'marketing.segment.update', entityType: 'MarketingSegment', entityId: row.id, before: { name: before.name }, after: { name: row.name } });
  return ok(res, segmentOut(row));
};

export const removeSegment = async (req, res) => {
  const row = await prisma.marketingSegment.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Segment');
  // Campaigns copy the filter when they are made, so deleting a segment changes none of them.
  await prisma.marketingSegment.delete({ where: { id: row.id } });
  await audit.record(req, { action: 'marketing.segment.delete', entityType: 'MarketingSegment', entityId: row.id, before: { name: row.name } });
  return ok(res, { deleted: true });
};

/** POST /api/admin/marketing/segments/preview — the size of a filter and a few readers who match. Nothing is saved. */
export const previewSegment = async (req, res) => {
  const filter = requireFilter(req.valid.body.filter);
  const channel = req.valid.body.channel ?? 'EMAIL';
  const [count, sample] = await Promise.all([audience.countUsers(filter, channel), audience.sampleUsers(filter, channel)]);
  return ok(res, { count, summary: describeFilter(filter), sample: sample.map((u) => ({ id: u.id, name: u.name, email: maskEmail(u.email), language: u.readingLanguage, country: u.countryCode, lastActiveAt: u.lastActiveAt })) });
};

/** "somesh@gmail.com" → "s•••h@gmail.com": a sample shows who, without handing the address round the team. */
export const maskEmail = (email) => {
  const [local = '', domain = ''] = String(email || '').split('@');
  return `${local.length > 2 ? `${local[0]}•••${local.at(-1)}` : `${local[0] ?? ''}•••`}@${domain}`;
};

/* ---------- lists ---------- */

const listOut = (l) => ({ id: l.id, name: l.name, description: l.description, memberCount: l.memberCount, createdByName: l.createdByName, createdAt: l.createdAt, updatedAt: l.updatedAt });

export const listLists = async (req, res) => {
  const rows = await prisma.marketingList.findMany({ orderBy: { updatedAt: 'desc' } });
  return ok(res, rows.map(listOut));
};

export const createList = async (req, res) => {
  const row = await prisma.marketingList.create({ data: { name: req.valid.body.name, description: req.valid.body.description ?? null, ...stamp(req) } });
  await audit.record(req, { action: 'marketing.list.create', entityType: 'MarketingList', entityId: row.id, after: { name: row.name } });
  return created(res, listOut(row));
};

export const updateList = async (req, res) => {
  const before = await prisma.marketingList.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('List');
  const row = await prisma.marketingList.update({ where: { id: before.id }, data: req.valid.body });
  await audit.record(req, { action: 'marketing.list.update', entityType: 'MarketingList', entityId: row.id, before: { name: before.name }, after: { name: row.name } });
  return ok(res, listOut(row));
};

export const removeList = async (req, res) => {
  const row = await prisma.marketingList.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('List');
  await prisma.marketingList.delete({ where: { id: row.id } });
  await audit.record(req, { action: 'marketing.list.delete', entityType: 'MarketingList', entityId: row.id, before: { name: row.name, members: row.memberCount } });
  return ok(res, { deleted: true });
};

/* ---------- contacts ---------- */

const contactOut = (c) => ({
  id: c.id, email: c.email, phone: c.phone, name: c.name, language: c.language, whatsappOptIn: Boolean(c.whatsappOptInAt), createdAt: c.createdAt,
  lists: c.lists?.map((m) => ({ id: m.list.id, name: m.list.name })),
});

/** GET /api/admin/marketing/contacts?listId=&q= */
export const listContacts = async (req, res) => {
  const { listId, q } = req.valid.query;
  const where = {
    ...(listId ? { lists: { some: { listId } } } : {}),
    ...(q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}),
  };
  const { items, page } = await paginate(prisma.marketingContact, { where, orderBy: { createdAt: 'desc' }, include: { lists: { include: { list: { select: { id: true, name: true } } } } }, query: req.valid.query });
  return paginated(res, items.map(contactOut), page);
};

/** DELETE /api/admin/marketing/contacts/:id — forget a person: the contact goes, and the address is blocked (by hash only). */
export const removeContact = async (req, res) => {
  const done = await contacts.forgetContact(req.valid.params.id);
  if (!done) throw notFound('Contact');
  await audit.record(req, { action: 'marketing.contact.delete', entityType: 'MarketingContact', entityId: req.valid.params.id });
  return ok(res, { deleted: true });
};

/** DELETE /api/admin/marketing/lists/:id/contacts/:contactId — off one list, not forgotten. */
export const removeFromList = async (req, res) => {
  const { id, contactId } = req.valid.params;
  const gone = await prisma.marketingListMember.deleteMany({ where: { listId: id, contactId } });
  if (!gone.count) throw notFound('Member');
  await contacts.recountList(id);
  return ok(res, { deleted: true });
};

const importSettings = (body) => ({ attestsEmail: body.attestsEmail ?? true, attestsWhatsApp: body.attestsWhatsApp ?? false });

/** POST /api/admin/marketing/contacts/import/check — what a chunk of rows would do. Nothing is written. */
export const checkImport = async (req, res) => {
  const { rows } = req.valid.body;
  if (rows.length > contacts.MAX_ROWS_PER_CHUNK) throw badRequest(`Send at most ${contacts.MAX_ROWS_PER_CHUNK} rows at a time.`);
  const checked = await contacts.classify(rows, importSettings(req.valid.body));
  return ok(res, { counts: checked.counts, rows: checked.rows.filter((r) => r.status !== 'new' && r.status !== 'existing').slice(0, 50).map(({ index, status }) => ({ index, status })) });
};

/**
 * POST /api/admin/marketing/contacts/import — writes a chunk. The first chunk creates the import (and records the
 * attestation); later chunks pass its `importId`, so one file is one import however many chunks it was sent in.
 */
export const importContacts = async (req, res) => {
  const body = req.valid.body;
  if (body.rows.length > contacts.MAX_ROWS_PER_CHUNK) throw badRequest(`Send at most ${contacts.MAX_ROWS_PER_CHUNK} rows at a time.`);
  const flags = importSettings(body);
  if (!flags.attestsEmail && !flags.attestsWhatsApp) throw badRequest('Confirm that these people agreed to hear from us, by email or by WhatsApp.');

  const list = await prisma.marketingList.findUnique({ where: { id: body.listId } });
  if (!list) throw notFound('List');

  let record = body.importId ? await prisma.marketingImport.findUnique({ where: { id: body.importId } }) : null;
  if (body.importId && !record) throw notFound('Import');
  if (!record) {
    record = await prisma.marketingImport.create({
      data: {
        fileName: body.fileName ?? null, attestation: body.attestation, wordingVersion: marketing.consentWordingVersion,
        ...flags, attestedById: req.auth.user.id, attestedByName: req.auth.user.name || req.auth.user.email || null,
      },
    });
    await audit.record(req, { action: 'marketing.import.attest', entityType: 'MarketingImport', entityId: record.id, after: { list: list.name, ...flags } });
  }

  const result = await contacts.commitChunk({ importId: record.id, listId: list.id, rows: body.rows, attestsEmail: record.attestsEmail, attestsWhatsApp: record.attestsWhatsApp });
  const summary = { ...(record.summary || {}) };
  for (const [key, n] of Object.entries(result.counts)) summary[key] = (summary[key] ?? 0) + n;
  const added = (summary.new ?? 0) + (summary.existing ?? 0);
  const rows = (record.rows ?? 0) + body.rows.length;
  const next = await prisma.marketingImport.update({ where: { id: record.id }, data: { rows, added, skipped: rows - added, summary } });
  return ok(res, { importId: next.id, counts: result.counts, totals: { rows: next.rows, added: next.added, skipped: next.skipped, summary: next.summary }, memberCount: (await prisma.marketingList.findUnique({ where: { id: list.id }, select: { memberCount: true } })).memberCount });
};

/* ---------- suppression ---------- */

const suppressionOut = (s) => ({ id: s.id, channel: s.channel, reason: s.reason, note: s.note, createdAt: s.createdAt, hash: `${s.hash.slice(0, 8)}…` });

/**
 * GET /api/admin/marketing/suppression?q=<address>. The list holds only hashes, so it cannot be searched by text: typing an
 * address looks it up. With no `q` it lists the newest.
 */
export const listSuppression = async (req, res) => {
  const { q, channel, reason } = req.valid.query;
  if (q) {
    const ch = channel ?? (q.includes('@') ? 'EMAIL' : 'WHATSAPP');
    const hash = consent.hashOf(ch, q);
    const row = hash ? await prisma.marketingSuppression.findUnique({ where: { channel_hash: { channel: ch, hash } } }) : null;
    return paginated(res, row ? [suppressionOut(row)] : [], { page: 1, pageSize: 1, total: row ? 1 : 0 }, { lookedUp: true, suppressed: Boolean(row) });
  }
  const { items, page } = await paginate(prisma.marketingSuppression, { where: { ...(channel ? { channel } : {}), ...(reason ? { reason } : {}) }, orderBy: { createdAt: 'desc' }, query: req.valid.query });
  const counts = await prisma.marketingSuppression.groupBy({ by: ['reason'], _count: { _all: true } });
  return paginated(res, items.map(suppressionOut), page, { byReason: Object.fromEntries(counts.map((c) => [c.reason, c._count._all])) });
};

/** POST /api/admin/marketing/suppression — block an address by hand. */
export const addSuppression = async (req, res) => {
  const { email, phone, note } = req.valid.body;
  if (email && !cleanEmail(email)) throw badRequest('That is not an email address.');
  if (phone && !cleanPhone(phone)) throw badRequest('That is not a phone number (use +country code…).');
  if (!email && !phone) throw badRequest('Give an email address or a phone number.');
  const channel = email ? 'EMAIL' : 'WHATSAPP';
  const added = await consent.suppress(channel, email ?? phone, 'MANUAL', note ?? null);
  if (!added) throw conflict('That address is already blocked.');
  await audit.record(req, { action: 'marketing.suppression.add', entityType: 'MarketingSuppression', entityId: channel, after: { channel, note } });
  return created(res, { added: true });
};

/** POST /api/admin/marketing/suppression/remove — let an address be written to again (it is on them to have asked). */
export const removeSuppression = async (req, res) => {
  const { email, phone } = req.valid.body;
  const channel = email ? 'EMAIL' : 'WHATSAPP';
  const done = await consent.unsuppress(channel, email ?? phone);
  if (!done) throw notFound('That address on the list');
  await consent.logConsent({ channel, action: 'SUPPRESSION_REMOVED', source: 'admin', detail: { by: req.auth.user.id } });
  await audit.record(req, { action: 'marketing.suppression.remove', entityType: 'MarketingSuppression', entityId: channel });
  return ok(res, { removed: true });
};

/** GET /api/admin/marketing/consent?email= — the consent log of one account or contact. */
export const consentLog = async (req, res) => {
  const { email } = req.valid.query;
  const key = emailKey(email);
  if (!key) throw badRequest('That is not an email address.');
  const [user, contact] = await Promise.all([
    prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } }),
    prisma.marketingContact.findUnique({ where: { emailKey: key }, select: { id: true } }),
  ]);
  const rows = await prisma.marketingConsentLog.findMany({
    where: { OR: [...(user ? [{ userId: user.id }] : []), ...(contact ? [{ contactId: contact.id }] : [])] },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return ok(res, { found: Boolean(user || contact), suppressed: await consent.isSuppressed('EMAIL', email), log: rows });
};
