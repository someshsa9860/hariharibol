// Marketing templates in the admin panel: a template has one variant per language, each a subject, a preheader and a list of
// content blocks (utils/marketing-blocks.js). A variant is DRAFT until a person approves it; only APPROVED variants are ever
// sent, and a reader whose language has none is sent English. A variant a person wrote or changed is never replaced by the AI
// unless the admin says so (`force`).
//
// The panel keeps no business logic: the preview calls the same renderer the sender uses.

import { prisma } from '../../config/database.js';
import env from '../../config/env.js';
import * as audit from '../../services/audit.js';
import * as ai from '../../services/marketing-ai.js';
import * as mailer from '../../services/marketing-mailer.js';
import * as consent from '../../services/marketing-consent.js';
import * as settings from '../../services/setting.js';
import { renderEmail } from '../../services/marketing-render.js';
import { SETTING_KEYS } from '../../config/constants.js';
import { MERGE_FIELDS, fieldsUsed, linkSlotsUsed, validateBlocks, validateLine, LIMITS } from '../../utils/marketing-blocks.js';
import { unsubscribeUrl } from '../../utils/marketing-links.js';
import { cleanEmail } from '../../utils/marketing-address.js';
import { ok, created } from '../../utils/respond.js';
import { badRequest, conflict, notFound, unprocessable } from '../../utils/errors.js';

const who = (req) => req.auth.user.name || req.auth.user.email || 'an admin';
const stamp = (req) => ({ createdById: req.auth.user.id, createdByName: req.auth.user.name || req.auth.user.email || null });

const variantOut = (v) => ({
  id: v.id, language: v.language, subject: v.subject, preheader: v.preheader, blocks: v.blocks, status: v.status, source: v.source,
  editedByHuman: v.editedByHuman, approvedByName: v.approvedByName, approvedAt: v.approvedAt, updatedAt: v.updatedAt,
  fields: fieldsUsed(v), linkSlots: linkSlotsUsed(v.blocks),
});

const SAMPLE_CARD = Object.fromEntries(Object.entries(MERGE_FIELDS).map(([k, v]) => [k, v.sample]));

async function loadTemplate(id) {
  const row = await prisma.marketingTemplate.findUnique({ where: { id }, include: { variants: { orderBy: { language: 'asc' } } } });
  if (!row) throw notFound('Template');
  return row;
}

/** Checks a variant's words → the tidied `{ subject, preheader, blocks }`, or throws 422 listing every problem. */
function checkVariant({ subject, preheader, blocks }) {
  const checked = validateBlocks(blocks);
  const problems = [...validateLine(subject, LIMITS.subject, 'The subject'), ...validateLine(preheader ?? '', LIMITS.preheader, 'The preheader', false), ...checked.errors];
  if (problems.length) throw unprocessable(problems[0], problems);
  return { subject: subject.trim(), preheader: (preheader ?? '').trim() || null, blocks: checked.blocks };
}

/** 422 for an unusable provider or model, in the wording the other AI pages use. */
function requireRunnable(provider, model) {
  const why = ai.whyNotRunnable(provider, model);
  if (why) throw unprocessable(why);
}

/** GET /api/admin/marketing/templates */
export const list = async (req, res) => {
  const rows = await prisma.marketingTemplate.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { variants: { select: { language: true, status: true, source: true, editedByHuman: true } }, _count: { select: { campaigns: true } } },
  });
  return ok(res, rows.map(({ variants, _count, ...t }) => ({ ...t, variants, campaigns: _count.campaigns })));
};

/** GET /api/admin/marketing/templates/:id */
export const get = async (req, res) => {
  const { variants, ...template } = await loadTemplate(req.valid.params.id);
  return ok(res, { ...template, variants: variants.map(variantOut) });
};

/** POST /api/admin/marketing/templates */
export const create = async (req, res) => {
  const row = await prisma.marketingTemplate.create({ data: { name: req.valid.body.name, brief: req.valid.body.brief ?? null, ...stamp(req) } });
  await audit.record(req, { action: 'marketing.template.create', entityType: 'MarketingTemplate', entityId: row.id, after: { name: row.name } });
  return created(res, row);
};

/** PATCH /api/admin/marketing/templates/:id */
export const update = async (req, res) => {
  const before = await loadTemplate(req.valid.params.id);
  const row = await prisma.marketingTemplate.update({ where: { id: before.id }, data: req.valid.body });
  await audit.record(req, { action: 'marketing.template.update', entityType: 'MarketingTemplate', entityId: row.id, before: { name: before.name }, after: { name: row.name } });
  return ok(res, row);
};

/** DELETE /api/admin/marketing/templates/:id — a template a campaign used stays, so the campaign's history reads. */
export const remove = async (req, res) => {
  const row = await loadTemplate(req.valid.params.id);
  const used = await prisma.marketingCampaign.count({ where: { templateId: row.id } });
  if (used) throw conflict(`${used} campaign(s) used this template, so it is kept. Archive it by renaming it instead.`);
  await prisma.marketingTemplate.delete({ where: { id: row.id } });
  await audit.record(req, { action: 'marketing.template.delete', entityType: 'MarketingTemplate', entityId: row.id, before: { name: row.name } });
  return ok(res, { deleted: true });
};

/** PUT /api/admin/marketing/templates/:id/variants/:language — written or corrected by hand. Back to draft: it must be approved again. */
export const saveVariant = async (req, res) => {
  const { id, language } = req.valid.params;
  const template = await loadTemplate(id);
  if (!ai.languageInfo(language)) throw badRequest(`"${language}" is not a language emails are written in.`);
  const data = checkVariant(req.valid.body);
  const where = { templateId_language: { templateId: template.id, language } };
  const row = await prisma.marketingTemplateVariant.upsert({
    where,
    create: { templateId: template.id, language, ...data, source: 'HUMAN', editedByHuman: true },
    update: { ...data, source: 'HUMAN', editedByHuman: true, status: 'DRAFT', approvedAt: null, approvedById: null, approvedByName: null },
  });
  await audit.record(req, { action: 'marketing.variant.save', entityType: 'MarketingTemplateVariant', entityId: row.id, after: { template: template.name, language } });
  return ok(res, variantOut(row));
};

/** POST /api/admin/marketing/templates/:id/variants/:language/approve */
export const approveVariant = async (req, res) => {
  const { id, language } = req.valid.params;
  const row = await prisma.marketingTemplateVariant.findUnique({ where: { templateId_language: { templateId: id, language } } });
  if (!row) throw notFound('Variant');
  // Approving re-checks it: a variant saved before a rule changed must not slip through.
  checkVariant({ subject: row.subject, preheader: row.preheader, blocks: row.blocks });
  const next = await prisma.marketingTemplateVariant.update({
    where: { id: row.id },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedById: req.auth.user.id, approvedByName: req.auth.user.name || req.auth.user.email || null },
  });
  await audit.record(req, { action: 'marketing.variant.approve', entityType: 'MarketingTemplateVariant', entityId: row.id, after: { language } });
  return ok(res, variantOut(next));
};

/** POST /api/admin/marketing/templates/:id/variants/:language/unapprove */
export const unapproveVariant = async (req, res) => {
  const { id, language } = req.valid.params;
  const row = await prisma.marketingTemplateVariant.findUnique({ where: { templateId_language: { templateId: id, language } } });
  if (!row) throw notFound('Variant');
  const next = await prisma.marketingTemplateVariant.update({ where: { id: row.id }, data: { status: 'DRAFT', approvedAt: null, approvedById: null, approvedByName: null } });
  await audit.record(req, { action: 'marketing.variant.unapprove', entityType: 'MarketingTemplateVariant', entityId: row.id, after: { language } });
  return ok(res, variantOut(next));
};

/** DELETE /api/admin/marketing/templates/:id/variants/:language */
export const removeVariant = async (req, res) => {
  const { id, language } = req.valid.params;
  const row = await prisma.marketingTemplateVariant.findUnique({ where: { templateId_language: { templateId: id, language } } });
  if (!row) throw notFound('Variant');
  await prisma.marketingTemplateVariant.delete({ where: { id: row.id } });
  await audit.record(req, { action: 'marketing.variant.delete', entityType: 'MarketingTemplateVariant', entityId: row.id, before: { language } });
  return ok(res, { deleted: true });
};

/* ---------- AI ---------- */

async function saveAiVariant(req, template, language, copy, source) {
  const where = { templateId_language: { templateId: template.id, language } };
  const data = { subject: copy.subject, preheader: copy.preheader || null, blocks: copy.blocks, source: 'AI', editedByHuman: false, status: 'DRAFT', approvedAt: null, approvedById: null, approvedByName: null };
  const row = await prisma.marketingTemplateVariant.upsert({ where, create: { templateId: template.id, language, ...data }, update: data });
  await audit.record(req, { action: `marketing.variant.${source}`, entityType: 'MarketingTemplateVariant', entityId: row.id, after: { template: template.name, language } });
  return row;
}

const usageOut = (u) => ({ inputTokens: u.inputTokens, outputTokens: u.outputTokens, calls: u.calls, costUsd: u.costMicros / 1_000_000 });

/** An existing variant a person wrote is asked about first: 409 with `editedByHuman` until the admin repeats it with `force`. */
async function guardHandWritten(template, language, force) {
  const have = template.variants.find((v) => v.language === language);
  if (have?.editedByHuman && !force) {
    throw conflict(`The ${ai.languageInfo(language).name} variant was written or changed by a person. Replace it with a new draft?`, { editedByHuman: true, language });
  }
}

/** POST /api/admin/marketing/templates/:id/ai/draft */
export const draft = async (req, res) => {
  const { id } = req.valid.params;
  const { language, brief, tone, force } = req.valid.body;
  const provider = req.valid.body.provider ?? ai.defaultProvider();
  const model = req.valid.body.model ?? ai.modelFor(provider);
  const template = await loadTemplate(id);
  requireRunnable(provider, model);
  await guardHandWritten(template, language, force);

  const text = (brief ?? template.brief ?? '').trim();
  if (!text) throw badRequest('Say what the email is for.');
  let made;
  try {
    made = await ai.draftTemplate({ brief: text, tone, language, provider, model, templateId: template.id, userId: req.auth.user.id });
  } catch (err) {
    if (err instanceof ai.CopyError) throw unprocessable(err.message, err.problems);
    throw unprocessable(`${provider} could not be reached or refused the request: ${String(err.message).slice(0, 200)}`);
  }
  if (brief && brief.trim() !== (template.brief ?? '')) await prisma.marketingTemplate.update({ where: { id: template.id }, data: { brief: brief.trim() } });
  const row = await saveAiVariant(req, template, language, made.copy, 'draft');
  return created(res, { variant: variantOut(row), usage: usageOut(made.usage) });
};

/** POST /api/admin/marketing/templates/:id/ai/translate — one language at a time; the panel loops for “translate to all”. */
export const translate = async (req, res) => {
  const { id } = req.valid.params;
  const { from, to, force } = req.valid.body;
  const provider = req.valid.body.provider ?? ai.defaultProvider();
  const model = req.valid.body.model ?? ai.modelFor(provider);
  if (from === to) throw badRequest('Choose a different language to translate into.');
  const template = await loadTemplate(id);
  const source = template.variants.find((v) => v.language === from);
  if (!source) throw notFound(`${ai.languageInfo(from)?.name ?? from} variant`);
  requireRunnable(provider, model);
  await guardHandWritten(template, to, force);

  let made;
  try {
    made = await ai.translateVariant({ variant: { subject: source.subject, preheader: source.preheader, blocks: source.blocks }, language: to, provider, model, templateId: template.id, userId: req.auth.user.id });
  } catch (err) {
    if (err instanceof ai.CopyError) throw unprocessable(err.message, err.problems);
    throw unprocessable(`${provider} could not be reached or refused the request: ${String(err.message).slice(0, 200)}`);
  }
  const row = await saveAiVariant(req, template, to, made.copy, 'translate');
  return created(res, { variant: variantOut(row), usage: usageOut(made.usage) });
};

/* ---------- preview and test send ---------- */

async function renderFor(body, chain) {
  const postal = (await settings.get(SETTING_KEYS.MARKETING_POSTAL_ADDRESS, '')) || '';
  return renderEmail({
    variant: { subject: body.subject, preheader: body.preheader, blocks: body.blocks },
    card: body.card ? { ...SAMPLE_CARD, ...body.card } : SAMPLE_CARD,
    hrefOf: (slot) => `${env.WEB_BASE_URL}/l/PREVIEW/${slot}`,
    language: chain,
    unsubscribeUrl: unsubscribeUrl(env.WEB_BASE_URL, 'PREVIEW'),
    postalAddress: postal,
    openPixel: null,
  });
}

/** POST /api/admin/marketing/templates/preview — renders the words as given (saved or not) with the sample reader's values. */
export const preview = async (req, res) => {
  const { language, ...body } = req.valid.body;
  const data = checkVariant(body);
  const mail = await renderFor({ ...data, card: body.card }, language);
  return ok(res, { subject: mail.subject, html: mail.html, text: mail.text, fields: fieldsUsed(data), sample: SAMPLE_CARD });
};

/** POST /api/admin/marketing/templates/test-send — to the admin's own address only. */
export const testSend = async (req, res) => {
  const { language, ...body } = req.valid.body;
  const to = cleanEmail(req.auth.user.email || '');
  if (!to) throw unprocessable('Your account has no email address to send a test to.');
  if (!mailer.isConfigured()) throw unprocessable('No email server is set (MARKETING_SMTP_HOST or SMTP_HOST on the server).');
  const data = checkVariant(body);
  const mail = await renderFor({ ...data, card: body.card }, language);
  try {
    await mailer.send({ to, subject: `[Test] ${mail.subject}`, html: mail.html, text: mail.text, from: await mailer.fromHeader(), replyTo: await mailer.replyTo() });
  } catch (err) {
    throw unprocessable(`The test email could not be sent: ${String(err.message).slice(0, 200)}`);
  }
  await audit.record(req, { action: 'marketing.test_send', entityType: 'MarketingTemplate', entityId: req.valid.body.templateId ?? 'draft', after: { language } });
  return ok(res, { sentTo: to });
};

