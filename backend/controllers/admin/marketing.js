// Marketing campaigns in the admin panel: make one (a template, who it is for, where its links go), look at what it will
// do, start it now or at a time, and watch it. A campaign is a `MarketingCampaign` row worked by the worker
// (jobs/processors/marketing.js), the same shape as the Etiquette translation runs: Pause and Cancel on a running campaign
// only ask (the worker notices within a few seconds); Resume is for a paused or failed one; the live state comes over the
// websocket (`marketing.run`, `marketing.activity`) and every page of it can also be fetched.
//
// Reaching real people is `marketing.send`; everything that only prepares is `marketing.manage`.

import { prisma } from '../../config/database.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { redis } from '../../config/redis.js';
import { marketing } from '../../config/marketing.js';
import { SETTING_KEYS } from '../../config/constants.js';
import * as audit from '../../services/audit.js';
import * as settings from '../../services/setting.js';
import * as translationService from '../../services/translation.js';
import * as run from '../../services/marketing-run.js';
import * as mailer from '../../services/marketing-mailer.js';
import * as ai from '../../services/marketing-ai.js';
import * as audienceService from '../../services/marketing-audience.js';
import * as tracking from '../../services/marketing-tracking.js';
import { BLOCK_TYPES, LIMITS, MERGE_FIELDS } from '../../utils/marketing-blocks.js';
import { describeFilter, parseFilter } from '../../utils/marketing-audience.js';
import { targetProblem } from '../../utils/marketing-links.js';
import { TARGETS } from '../../utils/push-rich.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { paginate } from '../../utils/pagination.js';
import { badRequest, conflict, notFound, unprocessable } from '../../utils/errors.js';
import { maskEmail } from './marketing-audience.js';

const { ACTIVE_STATUSES, presentCampaign, publishCampaign, pushFeed } = run;
const who = (req) => req.auth.user.name || req.auth.user.email || 'an admin';
const LOCK_KEY = 'marketing:start';

/* ---------- overview ---------- */

/** GET /api/admin/marketing/overview?verify=true — what the Marketing pages need before anything is chosen. */
export const overview = async (req, res) => {
  const [byStatus, templates, segments, lists, contacts, suppressed, active, workerOnline, rate, daily, weekly, from, replyTo, postal, aiMax] = await Promise.all([
    prisma.marketingCampaign.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.marketingTemplate.count(),
    prisma.marketingSegment.count(),
    prisma.marketingList.count(),
    prisma.marketingContact.count(),
    prisma.marketingSuppression.count(),
    prisma.marketingCampaign.findMany({ where: { status: { in: ACTIVE_STATUSES } }, orderBy: { createdAt: 'asc' } }),
    translationService.workerOnline(),
    settings.getNumber(SETTING_KEYS.MARKETING_EMAIL_RATE_PER_MINUTE, marketing.defaultRatePerMinute),
    settings.getNumber(SETTING_KEYS.MARKETING_EMAIL_DAILY_CAP, marketing.defaultDailyCap),
    settings.getNumber(SETTING_KEYS.MARKETING_WEEKLY_CAP, marketing.defaultWeeklyCap),
    mailer.fromHeader(),
    mailer.replyTo(),
    settings.get(SETTING_KEYS.MARKETING_POSTAL_ADDRESS, ''),
    settings.get(SETTING_KEYS.MARKETING_AI_MAX_COST_USD, ''),
  ]);
  const count = (s) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  const smtp = req.valid.query.verify ? await mailer.verify() : null;
  const provider = ai.defaultProvider();

  const [sentMonth] = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "MarketingDelivery" WHERE "channel" = 'EMAIL' AND "sentAt" >= date_trunc('month', now())`;

  return ok(res, {
    counts: { campaigns: byStatus.reduce((n, r) => n + r._count._all, 0), drafts: count('DRAFT'), scheduled: count('SCHEDULED'), running: count('RUNNING') + count('QUEUED'), paused: count('PAUSED'), completed: count('COMPLETED'), templates, segments, lists, contacts, suppressed, sentThisMonth: sentMonth?.n ?? 0 },
    setup: {
      email: { configured: mailer.isConfigured(), own: Boolean(env.MARKETING_SMTP_HOST), from, replyTo: replyTo ?? null, configurationSet: env.MARKETING_SES_CONFIGURATION_SET || null, webhookConfigured: Boolean(env.MARKETING_SNS_TOPIC_ARN || env.MARKETING_WEBHOOK_SECRET), verified: smtp },
      postalAddress: postal || null,
      workerOnline,
      whatsapp: { configured: false },
    },
    limits: { ratePerMinute: rate, dailyCap: daily, weeklyCap: weekly, aiMaxCostUsd: aiMax ? Number(aiMax) : null, maxLinks: marketing.maxLinks, maxBlocks: marketing.maxBlocks, reputation: { window: marketing.reputationWindow, maxBounceRate: marketing.maxBounceRate, maxComplaintRate: marketing.maxComplaintRate } },
    ai: { providers: ai.providers(), defaultProvider: provider, model: ai.modelFor(provider), sampleSize: marketing.aiSampleSize },
    languages: ai.LANGUAGES,
    mergeFields: Object.entries(MERGE_FIELDS).map(([key, v]) => ({ key, ...v })),
    blocks: { types: BLOCK_TYPES, limits: LIMITS },
    appTargets: Object.entries(TARGETS).map(([key, v]) => ({ key, ...v })),
    active: active.map((r) => presentCampaign(r)),
  });
};

/* ---------- reading campaigns ---------- */

const SORT = { createdAt: 'createdAt', name: 'name', status: 'status', scheduledAt: 'scheduledAt' };

/** GET /api/admin/marketing/campaigns */
export const list = async (req, res) => {
  const { status, channel, q } = req.valid.query;
  const where = { ...(status ? { status } : {}), ...(channel ? { channel } : {}), ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) };
  const { items, page } = await paginate(prisma.marketingCampaign, { where, orderBy: { [SORT[req.valid.query.sort] ?? 'createdAt']: req.valid.query.dir === 'asc' ? 'asc' : 'desc' }, include: { template: { select: { id: true, name: true } } }, query: req.valid.query });
  const now = new Date();
  return paginated(res, items.map(({ template, ...row }) => ({ ...presentCampaign(row, now), template })), page);
};

async function skipReasons(campaignId) {
  const rows = await prisma.marketingDelivery.groupBy({ by: ['skipReason'], where: { campaignId, status: 'SKIPPED' }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.skipReason ?? 'unknown', r._count._all]));
}

/** GET /api/admin/marketing/campaigns/:id — one campaign with its links, funnel, failures and feed. */
export const get = async (req, res) => {
  const row = await prisma.marketingCampaign.findUnique({
    where: { id: req.valid.params.id },
    include: { template: { select: { id: true, name: true } }, segment: { select: { id: true, name: true } }, links: { orderBy: { position: 'asc' } } },
  });
  if (!row) throw notFound('Campaign');
  const id = row.id;
  const { row: fresh, opened, clicked } = await run.recount(id);

  const [clicksByLink, botClicks, failures, attributions, samples, skipped, feed, problems] = await Promise.all([
    prisma.marketingClick.groupBy({ by: ['linkId'], where: { campaignId: id, isBot: false }, _count: { _all: true } }),
    prisma.marketingClick.count({ where: { campaignId: id, isBot: true } }),
    prisma.marketingDelivery.findMany({ where: { campaignId: id, status: { in: ['FAILED', 'BOUNCED'] } }, orderBy: { updatedAt: 'desc' }, take: 20, select: { id: true, status: true, error: true, language: true, user: { select: { email: true } }, contact: { select: { email: true } } } }),
    prisma.marketingAttribution.groupBy({ by: ['kind'], where: { campaignId: id }, _count: { _all: true } }),
    row.mode === 'AI_PER_USER' ? prisma.marketingDelivery.findMany({ where: { campaignId: id, aiBlocks: { not: null } }, take: marketing.aiSampleSize, select: { id: true, language: true, subject: true, aiBlocks: true } }) : [],
    skipReasons(id),
    run.readFeed(id, 100),
    row.status === 'DRAFT' ? run.problemsToStart(row) : [],
  ]);
  const clickAt = new Map(clicksByLink.map((c) => [c.linkId, c._count._all]));

  const { template, segment, links, ...rest } = row;
  return ok(res, {
    campaign: presentCampaign(fresh),
    template, segment,
    audienceSummary: row.audience?.users ? describeFilter(row.audience.users) : null,
    links: links.map((l) => ({ position: l.position, kind: l.kind, target: l.target, label: l.label, clicks: clickAt.get(l.id) ?? 0 })),
    funnel: { recipients: fresh.recipients, sent: fresh.sent, delivered: fresh.delivered, opened, clicked, bounced: fresh.bounced, complained: fresh.complained, failed: fresh.failed, skipped: fresh.skipped, botClicks },
    skipReasons: skipped,
    failures: failures.map((f) => ({ id: f.id, status: f.status, error: f.error, language: f.language, email: maskEmail(f.user?.email ?? f.contact?.email ?? '') })),
    attributions: Object.fromEntries(attributions.map((a) => [a.kind, a._count._all])),
    samples,
    problems,
    feed,
    settings: { mode: rest.mode, provider: rest.provider, model: rest.model },
  });
};

/** GET /api/admin/marketing/campaigns/:id/deliveries */
export const deliveries = async (req, res) => {
  const { status, q } = req.valid.query;
  const where = {
    campaignId: req.valid.params.id,
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ user: { email: { contains: q, mode: 'insensitive' } } }, { contact: { email: { contains: q, mode: 'insensitive' } } }, { user: { name: { contains: q, mode: 'insensitive' } } }] } : {}),
  };
  const { items, page } = await paginate(prisma.marketingDelivery, {
    where, orderBy: { id: 'asc' }, query: req.valid.query,
    select: { id: true, status: true, skipReason: true, language: true, subject: true, error: true, sentAt: true, openedAt: true, clickedAt: true, bouncedAt: true, complainedAt: true, user: { select: { id: true, name: true, email: true } }, contact: { select: { id: true, name: true, email: true } } },
  });
  return paginated(res, items.map(({ user, contact, ...d }) => ({ ...d, who: user ? { kind: 'reader', id: user.id, name: user.name, email: maskEmail(user.email) } : contact ? { kind: 'invitee', id: contact.id, name: contact.name, email: maskEmail(contact.email ?? '') } : null })), page);
};

/** GET /api/admin/marketing/campaigns/:id/impact — what readers who tapped did next. */
export const impact = async (req, res) => {
  const row = await prisma.marketingCampaign.findUnique({ where: { id: req.valid.params.id }, select: { id: true } });
  if (!row) throw notFound('Campaign');
  return ok(res, await tracking.impact(row.id));
};

/* ---------- estimate (the review step) ---------- */

/** POST /api/admin/marketing/estimate — how many would get it, in which language, and what AI would cost. Nothing is sent. */
export const estimate = async (req, res) => {
  const { audience, templateId, mode, provider, model } = req.valid.body;
  const channel = 'EMAIL';
  if (audience?.users) {
    const parsed = parseFilter(audience.users);
    if (!parsed.ok) throw unprocessable(parsed.errors[0], parsed.errors);
  }
  const counts = await audienceService.countAudience(audience, channel);

  let byLanguage = [];
  let englishFallback = 0;
  let approved = [];
  if (templateId) {
    approved = (await prisma.marketingTemplateVariant.findMany({ where: { templateId, status: 'APPROVED' }, select: { language: true } })).map((v) => v.language);
  }
  if (audience?.users) {
    const where = await audienceService.userWhere(audience.users, channel);
    const grouped = await prisma.user.groupBy({ by: ['readingLanguage'], where, _count: { _all: true } });
    byLanguage = grouped.map((g) => ({ language: g.readingLanguage, readers: g._count._all, approved: approved.includes(g.readingLanguage) })).sort((a, b) => b.readers - a.readers);
    englishFallback = byLanguage.filter((g) => !g.approved && g.language !== 'en').reduce((n, g) => n + g.readers, 0);
  }

  let aiCost = null;
  if (mode === 'AI_PER_USER' && templateId) {
    const variant = await prisma.marketingTemplateVariant.findFirst({ where: { templateId, language: 'en' } });
    if (variant) aiCost = ai.estimatePerReader(variant, counts.total, provider ?? ai.defaultProvider(), model ?? ai.modelFor(provider ?? ai.defaultProvider()));
  }
  const rate = Math.min(await settings.getNumber(SETTING_KEYS.MARKETING_EMAIL_RATE_PER_MINUTE, marketing.defaultRatePerMinute), req.valid.body.ratePerMinute ?? Infinity);
  return ok(res, { ...counts, byLanguage, englishFallback, approvedLanguages: approved, aiCost, minutes: Math.ceil(counts.total / rate), ratePerMinute: rate, note: 'Readers who unsubscribed, are suppressed or are over the weekly cap are left out when the campaign starts, so the real number is a little lower.' });
};

/* ---------- making and editing ---------- */

async function checkLinks(links = []) {
  const seen = new Set();
  for (const link of links) {
    if (link.position > marketing.maxLinks) throw badRequest(`A campaign has at most ${marketing.maxLinks} links.`);
    if (seen.has(link.position)) throw badRequest(`Link ${link.position} is listed twice.`);
    seen.add(link.position);
    const bad = targetProblem(link.kind, link.target);
    if (bad) throw unprocessable(`Link ${link.position} ${bad}.`);
  }
}

async function resolveAudience(body) {
  let users = body.audience?.users ?? null;
  if (body.segmentId) {
    const seg = await prisma.marketingSegment.findUnique({ where: { id: body.segmentId } });
    if (!seg) throw notFound('Segment');
    users = seg.filter; // copied, so editing the segment later does not change this campaign
  }
  if (users) {
    const parsed = parseFilter(users);
    if (!parsed.ok) throw unprocessable(parsed.errors[0], parsed.errors);
    users = parsed.filter;
  }
  const lists = [...new Set(body.audience?.lists ?? [])];
  if (lists.length) {
    const found = await prisma.marketingList.count({ where: { id: { in: lists } } });
    if (found !== lists.length) throw notFound('List');
  }
  return { users, lists };
}

function aiFields(body, current = {}) {
  const mode = body.mode ?? current.mode ?? 'MERGE';
  if (mode !== 'AI_PER_USER') return { mode, provider: null, model: null, maxCostMicros: null };
  const provider = body.provider ?? current.provider ?? ai.defaultProvider();
  const model = body.model ?? current.model ?? ai.modelFor(provider);
  return { mode, provider, model, maxCostMicros: body.maxCostUsd !== undefined ? run.microsOf(body.maxCostUsd) : current.maxCostMicros ?? null };
}

/** POST /api/admin/marketing/campaigns */
export const create = async (req, res) => {
  const body = req.valid.body;
  await checkLinks(body.links);
  if (body.templateId && !(await prisma.marketingTemplate.findUnique({ where: { id: body.templateId }, select: { id: true } }))) throw notFound('Template');
  const audience = await resolveAudience(body);
  const row = await prisma.marketingCampaign.create({
    data: {
      name: body.name, channel: 'EMAIL', templateId: body.templateId ?? null, segmentId: body.segmentId ?? null, audience,
      ...aiFields(body), ratePerMinute: body.ratePerMinute ?? null,
      requestedById: req.auth.user.id, requestedByName: req.auth.user.name || req.auth.user.email || null,
      links: { create: (body.links ?? []).map((l) => ({ position: l.position, kind: l.kind, target: l.target.trim(), label: l.label ?? null })) },
    },
  });
  await audit.record(req, { action: 'marketing.campaign.create', entityType: 'MarketingCampaign', entityId: row.id, after: { name: row.name, mode: row.mode } });
  return created(res, presentCampaign(row));
};

async function editable(id) {
  const row = await prisma.marketingCampaign.findUnique({ where: { id } });
  if (!row) throw notFound('Campaign');
  if (row.status !== 'DRAFT') throw conflict(`Only a draft can be edited — this one is ${row.status.toLowerCase()}. ${row.status === 'SCHEDULED' ? 'Unschedule it first.' : ''}`.trim());
  return row;
}

/** PATCH /api/admin/marketing/campaigns/:id — a draft only. `links`, when sent, replaces all the links. */
export const update = async (req, res) => {
  const before = await editable(req.valid.params.id);
  const body = req.valid.body;
  const data = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.templateId !== undefined) {
    if (body.templateId && !(await prisma.marketingTemplate.findUnique({ where: { id: body.templateId }, select: { id: true } }))) throw notFound('Template');
    data.templateId = body.templateId;
  }
  if (body.audience !== undefined || body.segmentId !== undefined) {
    data.audience = await resolveAudience({ audience: body.audience ?? before.audience, segmentId: body.segmentId });
    if (body.segmentId !== undefined) data.segmentId = body.segmentId;
  }
  if (body.ratePerMinute !== undefined) data.ratePerMinute = body.ratePerMinute;
  if (body.mode !== undefined || body.provider !== undefined || body.model !== undefined || body.maxCostUsd !== undefined) Object.assign(data, aiFields(body, before));
  if (body.links) {
    await checkLinks(body.links);
    await prisma.marketingLink.deleteMany({ where: { campaignId: before.id } });
    await prisma.marketingLink.createMany({ data: body.links.map((l) => ({ campaignId: before.id, position: l.position, kind: l.kind, target: l.target.trim(), label: l.label ?? null })) });
  }
  const row = await prisma.marketingCampaign.update({ where: { id: before.id }, data });
  await audit.record(req, { action: 'marketing.campaign.update', entityType: 'MarketingCampaign', entityId: row.id, before: { name: before.name }, after: { name: row.name, changed: Object.keys(body) } });
  return ok(res, presentCampaign(row));
};

/** DELETE /api/admin/marketing/campaigns/:id — a draft that was never started. */
export const remove = async (req, res) => {
  const row = await editable(req.valid.params.id);
  await prisma.marketingCampaign.delete({ where: { id: row.id } });
  await audit.record(req, { action: 'marketing.campaign.delete', entityType: 'MarketingCampaign', entityId: row.id, before: { name: row.name } });
  return ok(res, { deleted: true });
};

/** POST /api/admin/marketing/campaigns/:id/duplicate — a new draft with the same words, audience and links. */
export const duplicate = async (req, res) => {
  const src = await prisma.marketingCampaign.findUnique({ where: { id: req.valid.params.id }, include: { links: true } });
  if (!src) throw notFound('Campaign');
  const row = await prisma.marketingCampaign.create({
    data: {
      name: `${src.name} (copy)`.slice(0, 160), channel: src.channel, templateId: src.templateId, segmentId: src.segmentId, audience: src.audience,
      mode: src.mode, provider: src.provider, model: src.model, maxCostMicros: src.maxCostMicros, ratePerMinute: src.ratePerMinute,
      requestedById: req.auth.user.id, requestedByName: req.auth.user.name || req.auth.user.email || null,
      links: { create: src.links.map((l) => ({ position: l.position, kind: l.kind, target: l.target, label: l.label })) },
    },
  });
  await audit.record(req, { action: 'marketing.campaign.duplicate', entityType: 'MarketingCampaign', entityId: row.id, after: { from: src.id } });
  return created(res, presentCampaign(row));
};

/* ---------- running ---------- */

async function queueNow(row) {
  const jobId = run.newJobId(row.id);
  const next = await prisma.marketingCampaign.update({
    where: { id: row.id },
    data: { jobId, status: 'QUEUED', statusMessage: 'Waiting for the worker.', pauseReason: null, resumeAt: null, cancelRequested: false, pauseRequested: false, scheduledAt: null },
  });
  try {
    await run.addRunJob(row.id, jobId);
  } catch (err) {
    logger.error({ err: err.message, campaignId: row.id }, 'could not queue a marketing campaign');
    const failed = await prisma.marketingCampaign.update({ where: { id: row.id }, data: { status: 'DRAFT', statusMessage: `Could not be queued: ${err.message}` } });
    publishCampaign(failed);
    throw unprocessable('The campaign could not be put on the queue. Is Redis reachable?');
  }
  return next;
}

/** POST /api/admin/marketing/campaigns/:id/start */
export const start = async (req, res) => {
  const row = await prisma.marketingCampaign.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Campaign');
  if (row.status !== 'DRAFT' && row.status !== 'SCHEDULED') throw conflict(`This campaign is ${row.status.toLowerCase()}; only a draft or a scheduled one can be started.`);

  const problems = await run.problemsToStart(row);
  if (problems.length) throw unprocessable(problems[0], problems);

  const got = await redis.set(LOCK_KEY, req.auth.user.id, 'EX', marketing.startLockSeconds, 'NX');
  if (!got) throw conflict('A campaign is being started. Try again in a moment.');
  try {
    // One at a time: the worker sends one campaign at a time anyway, and two would share one sender's reputation.
    const other = await prisma.marketingCampaign.findFirst({ where: { id: { not: row.id }, status: { in: ['QUEUED', 'RUNNING'] } }, select: { id: true, name: true } });
    const next = await queueNow(row);
    await audit.record(req, { action: 'marketing.campaign.start', entityType: 'MarketingCampaign', entityId: row.id, after: { name: row.name, mode: row.mode, audience: row.audience } });
    pushFeed(row.id, { kind: 'status', level: 'info', text: `Started by ${who(req)}.${other ? ` It waits for “${other.name}” to finish first.` : ''}` });
    publishCampaign(next);
    return ok(res, presentCampaign(next));
  } finally {
    await redis.del(LOCK_KEY).catch(() => {});
  }
};

/** POST /api/admin/marketing/campaigns/:id/schedule */
export const schedule = async (req, res) => {
  const row = await prisma.marketingCampaign.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Campaign');
  if (row.status !== 'DRAFT' && row.status !== 'SCHEDULED') throw conflict(`This campaign is ${row.status.toLowerCase()}.`);
  const at = new Date(req.valid.body.scheduledAt);
  if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 60_000) throw badRequest('Choose a time at least a minute from now.');
  const problems = await run.problemsToStart(row);
  if (problems.length) throw unprocessable(problems[0], problems);
  const next = await prisma.marketingCampaign.update({ where: { id: row.id }, data: { status: 'SCHEDULED', scheduledAt: at, statusMessage: null } });
  await audit.record(req, { action: 'marketing.campaign.schedule', entityType: 'MarketingCampaign', entityId: row.id, after: { scheduledAt: at.toISOString() } });
  pushFeed(row.id, { kind: 'status', level: 'info', text: `Scheduled by ${who(req)} for ${at.toISOString()}.` });
  publishCampaign(next);
  return ok(res, presentCampaign(next));
};

/** POST /api/admin/marketing/campaigns/:id/unschedule */
export const unschedule = async (req, res) => {
  const row = await prisma.marketingCampaign.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Campaign');
  if (row.status !== 'SCHEDULED') throw conflict('This campaign is not scheduled.');
  const next = await prisma.marketingCampaign.update({ where: { id: row.id }, data: { status: 'DRAFT', scheduledAt: null } });
  await audit.record(req, { action: 'marketing.campaign.unschedule', entityType: 'MarketingCampaign', entityId: row.id });
  publishCampaign(next);
  return ok(res, presentCampaign(next));
};

/** POST /api/admin/marketing/campaigns/:id/pause — a running campaign stops after the page in hand; a queued one at once. */
export const pause = async (req, res) => {
  const row = await prisma.marketingCampaign.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Campaign');
  if (row.status !== 'RUNNING' && row.status !== 'QUEUED') throw conflict(`Only a running campaign can be paused — this one is ${row.status.toLowerCase()}.`);
  let next;
  if (row.status === 'RUNNING' && !presentCampaign(row).stalled) {
    next = await prisma.marketingCampaign.update({ where: { id: row.id }, data: { pauseRequested: true, statusMessage: 'Pausing after the email in hand…' } });
  } else {
    const done = await prisma.marketingCampaign.updateMany({ where: { id: row.id, status: row.status, jobId: row.jobId }, data: { status: 'PAUSED', pauseReason: 'manual', statusMessage: 'Paused. Press Resume to carry on.', pauseRequested: false } });
    if (!done.count) throw conflict('The campaign changed while it was being paused. Look again.');
    await run.dropRunJob(row);
    next = await prisma.marketingCampaign.findUnique({ where: { id: row.id } });
  }
  await audit.record(req, { action: 'marketing.campaign.pause', entityType: 'MarketingCampaign', entityId: row.id, before: { status: row.status } });
  pushFeed(row.id, { kind: 'status', level: 'warn', text: `Pause requested by ${who(req)}.` });
  publishCampaign(next);
  return ok(res, presentCampaign(next));
};

/** POST /api/admin/marketing/campaigns/:id/resume */
export const resume = async (req, res) => {
  const row = await prisma.marketingCampaign.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Campaign');
  if (row.status !== 'PAUSED' && row.status !== 'FAILED') throw conflict(`Only a paused or failed campaign can be resumed — this one is ${row.status.toLowerCase()}.`);
  if (row.pauseReason === 'sample_review') throw conflict('Read the sample emails and approve them first.');
  const problems = await run.problemsToStart(row);
  if (problems.length) throw unprocessable(problems[0], problems);
  const next = await prisma.marketingCampaign.update({
    where: { id: row.id },
    data: { status: 'QUEUED', pauseReason: null, statusMessage: 'Resumed. Waiting for the worker.', resumeAt: null, retriesInARow: 0, cancelRequested: false, pauseRequested: false, finishedAt: null },
  });
  await run.ensureRunJob(next);
  const fresh = await prisma.marketingCampaign.findUnique({ where: { id: row.id } });
  await audit.record(req, { action: 'marketing.campaign.resume', entityType: 'MarketingCampaign', entityId: row.id, before: { status: row.status, pauseReason: row.pauseReason } });
  pushFeed(row.id, { kind: 'status', level: 'info', text: `Resumed by ${who(req)}.` });
  publishCampaign(fresh);
  return ok(res, presentCampaign(fresh));
};

/** POST /api/admin/marketing/campaigns/:id/approve-sample — AI_PER_USER: the sample copies were read; write and send the rest. */
export const approveSample = async (req, res) => {
  const row = await prisma.marketingCampaign.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Campaign');
  if (row.mode !== 'AI_PER_USER') throw conflict('This campaign does not write a copy for each reader.');
  if (row.status !== 'PAUSED' || row.pauseReason !== 'sample_review') throw conflict('This campaign is not waiting for a sample to be approved.');
  const next = await prisma.marketingCampaign.update({
    where: { id: row.id },
    data: { sampleApprovedAt: new Date(), status: 'QUEUED', pauseReason: null, statusMessage: 'Sample approved. Waiting for the worker.', resumeAt: null, retriesInARow: 0 },
  });
  await run.ensureRunJob(next);
  await audit.record(req, { action: 'marketing.campaign.approve_sample', entityType: 'MarketingCampaign', entityId: row.id });
  pushFeed(row.id, { kind: 'status', level: 'info', text: `Sample approved by ${who(req)}.` });
  publishCampaign(await prisma.marketingCampaign.findUnique({ where: { id: row.id } }));
  return ok(res, presentCampaign(next));
};

/** POST /api/admin/marketing/campaigns/:id/cancel */
export const cancel = async (req, res) => {
  const row = await prisma.marketingCampaign.findUnique({ where: { id: req.valid.params.id } });
  if (!row) throw notFound('Campaign');
  if (row.status === 'SCHEDULED') {
    const next = await prisma.marketingCampaign.update({ where: { id: row.id }, data: { status: 'CANCELLED', finishedAt: new Date(), statusMessage: `Cancelled by ${who(req)}.`, scheduledAt: null } });
    await audit.record(req, { action: 'marketing.campaign.cancel', entityType: 'MarketingCampaign', entityId: row.id, before: { status: row.status } });
    publishCampaign(next);
    return ok(res, presentCampaign(next));
  }
  if (!ACTIVE_STATUSES.includes(row.status)) throw conflict(`This campaign is already ${row.status.toLowerCase()}.`);

  const askOnly = row.status === 'RUNNING' && !presentCampaign(row).stalled;
  let next;
  if (askOnly) {
    next = await prisma.marketingCampaign.update({ where: { id: row.id }, data: { cancelRequested: true, statusMessage: 'Cancelling after the email in hand…' } });
  } else {
    const done = await prisma.marketingCampaign.updateMany({ where: { id: row.id, status: row.status, jobId: row.jobId }, data: { status: 'CANCELLED', cancelRequested: false, resumeAt: null, finishedAt: new Date(), statusMessage: `Cancelled by ${who(req)}.` } });
    if (!done.count) throw conflict('The campaign changed while it was being cancelled. Look again.');
    await run.dropRunJob(row);
    next = (await run.recount(row.id)).row;
  }
  await audit.record(req, { action: 'marketing.campaign.cancel', entityType: 'MarketingCampaign', entityId: row.id, before: { status: row.status }, after: { status: next.status, cancelRequested: next.cancelRequested } });
  pushFeed(row.id, { kind: 'status', level: 'warn', text: `Cancel requested by ${who(req)}.` });
  publishCampaign(next);
  return ok(res, presentCampaign(next));
};
