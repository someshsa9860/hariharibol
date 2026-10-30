// Everything a campaign run shares that talks to something: the live channel to the admin panel, the activity feed in
// Redis, the run's job on the queue, and the checks before a campaign may start. The run itself is
// jobs/processors/marketing.js; the pure rules are utils/marketing-send.js.
//
// The same shape as services/etiquette.js: the MarketingCampaign row is the truth and the BullMQ job only works it.

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { redis } from '../config/redis.js';
import { marketing } from '../config/marketing.js';
import { SETTING_KEYS } from '../config/constants.js';
import { JOBS, queues } from '../jobs/index.js';
import { EVENTS, toPermission } from './websocket.js';
import * as settings from './setting.js';
import * as mailer from './marketing-mailer.js';
import * as ai from './marketing-ai.js';
import { parseFilter } from '../utils/marketing-audience.js';
import { targetProblem } from '../utils/marketing-links.js';
import { linkSlotsUsed } from '../utils/marketing-blocks.js';

const queue = queues.marketing;

export const ACTIVE_STATUSES = ['QUEUED', 'RUNNING', 'PAUSED'];
export const FINISHED_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'];
export const microsOf = (usd) => Math.round((usd || 0) * 1_000_000);
export const usdOf = (micros) => (micros || 0) / 1_000_000;

/* ---------- how a campaign is sent to the page ---------- */

export function presentCampaign(row, now = new Date()) {
  const total = row.recipients;
  const settled = Math.max(0, row.recipients - row.pending);
  const stalled = row.status === 'RUNNING' && row.heartbeatAt && now - new Date(row.heartbeatAt) > marketing.staleHeartbeatSeconds * 1000;
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    status: row.status,
    mode: row.mode,
    templateId: row.templateId,
    whatsappTemplateId: row.whatsappTemplateId,
    segmentId: row.segmentId,
    audience: row.audience,
    provider: row.provider,
    model: row.model,
    maxCostUsd: row.maxCostMicros != null ? usdOf(row.maxCostMicros) : null,
    ratePerMinute: row.ratePerMinute,
    scheduledAt: row.scheduledAt,
    pauseReason: row.pauseReason,
    statusMessage: row.statusMessage,
    resumeAt: row.resumeAt,
    cancelRequested: row.cancelRequested,
    pauseRequested: row.pauseRequested,
    sampleApproved: Boolean(row.sampleApprovedAt),
    materialised: Boolean(row.materialisedAt),
    totals: {
      recipients: row.recipients, pending: row.pending, sent: row.sent, delivered: row.delivered, read: row.read, bounced: row.bounced,
      complained: row.complained, failed: row.failed, skipped: row.skipped,
    },
    progress: { total, done: settled, percent: total ? Math.min(100, Math.round((settled / total) * 100)) : 0 },
    usage: { inputTokens: row.inputTokens, outputTokens: row.outputTokens, calls: row.calls, costUsd: usdOf(row.costMicros) },
    attempts: row.attempts,
    requestedBy: row.requestedById ? { id: row.requestedById, name: row.requestedByName } : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    heartbeatAt: row.heartbeatAt,
    stalled: Boolean(stalled),
  };
}

/* ---------- the live channel and the activity feed ---------- */

const feedKey = (id) => `${marketing.feedKey}:${id}`;

export function publishCampaign(row) {
  toPermission('marketing.read', EVENTS.MARKETING_RUN, presentCampaign(row));
}

/** Adds a line to a campaign's feed (Redis, newest first, capped) and sends it to the watchers. Never throws. */
export async function pushFeed(campaignId, line) {
  const entry = { at: new Date().toISOString(), ...line };
  toPermission('marketing.read', EVENTS.MARKETING_ACTIVITY, { campaignId, ...entry });
  try {
    await redis.multi().lpush(feedKey(campaignId), JSON.stringify(entry)).ltrim(feedKey(campaignId), 0, marketing.feedLines - 1).expire(feedKey(campaignId), marketing.feedDays * 86400).exec();
  } catch (err) {
    logger.warn({ err: err.message, campaignId }, 'marketing feed write failed');
  }
}

export async function readFeed(campaignId, count = 100) {
  const lines = await redis.lrange(feedKey(campaignId), 0, Math.min(count, marketing.feedLines) - 1).catch(() => []);
  return lines.map((l) => JSON.parse(l));
}

/* ---------- the job on the queue ---------- */

const LIVE_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'];
export const newJobId = (id) => `marketing-${id}-${Date.now().toString(36)}`;

export async function addRunJob(id, jobId = newJobId(id)) {
  await queue.add(JOBS.MARKETING_RUN, { campaignId: id }, { jobId });
  return jobId;
}

/** A live job for the campaign, soon: a delayed one is brought forward, a finished or missing one is replaced. */
export async function ensureRunJob(row) {
  const job = row.jobId ? await queue.getJob(row.jobId) : null;
  if (job) {
    const state = await job.getState();
    if (state === 'delayed') {
      await job.promote().catch((err) => logger.warn({ err: err.message, campaignId: row.id }, 'promote failed'));
      return row.jobId;
    }
    if (LIVE_STATES.includes(state)) return row.jobId;
    await job.remove().catch(() => {});
  }
  const jobId = newJobId(row.id);
  await prisma.marketingCampaign.update({ where: { id: row.id }, data: { jobId } });
  await addRunJob(row.id, jobId);
  return jobId;
}

export async function dropRunJob(row) {
  if (!row.jobId) return;
  const job = await queue.getJob(row.jobId).catch(() => null);
  if (job) await job.remove().catch(() => {});
}

/** The safety net: a campaign that should be working but has no live job gets a new one. */
export async function reconcileRuns() {
  const youngerThan = new Date(Date.now() - 30_000);
  const rows = await prisma.marketingCampaign.findMany({
    where: { updatedAt: { lt: youngerThan }, OR: [{ status: { in: ['QUEUED', 'RUNNING'] } }, { status: 'PAUSED', resumeAt: { not: null } }] },
  });
  const requeued = [];
  for (const row of rows) {
    const job = row.jobId ? await queue.getJob(row.jobId).catch(() => null) : null;
    const state = job ? await job.getState().catch(() => 'unknown') : 'missing';
    if (LIVE_STATES.includes(state)) continue;
    if (job) await job.remove().catch(() => {});
    const jobId = newJobId(row.id);
    const next = await prisma.marketingCampaign.update({
      where: { id: row.id },
      data: { jobId, status: 'QUEUED', resumeAt: null, pauseReason: null, statusMessage: 'Picked up again after its background job was lost.' },
    });
    await addRunJob(row.id, jobId);
    publishCampaign(next);
    pushFeed(row.id, { kind: 'status', level: 'warn', text: 'Its background job was lost; queued again.' });
    logger.warn({ campaignId: row.id, was: state }, 'marketing campaign re-queued');
    requeued.push(row.id);
  }
  return requeued;
}

/* ---------- before a campaign may start ---------- */

/**
 * What stops a campaign from starting: a list of plain messages, empty when it may. Does not read the audience size (the
 * worker does when it writes the audience).
 */
export async function problemsToStart(campaign) {
  const problems = [];
  if (campaign.channel !== 'EMAIL') {
    problems.push('Only email campaigns can be sent yet.');
    return problems;
  }
  if (!mailer.isConfigured()) problems.push('No email server is set (MARKETING_SMTP_HOST or SMTP_HOST on the server).');
  const postal = ((await settings.get(SETTING_KEYS.MARKETING_POSTAL_ADDRESS, '')) || '').trim();
  if (!postal) problems.push('Set the postal address for the footer (Settings → “Marketing email: postal address”); readers overseas are owed it.');

  const audience = campaign.audience || {};
  if (!audience.users && !(audience.lists?.length)) problems.push('Choose who it is for: a segment of readers, a list of invitees, or both.');
  if (audience.users) {
    const parsed = parseFilter(audience.users);
    if (!parsed.ok) problems.push(...parsed.errors);
  }

  if (!campaign.templateId) {
    problems.push('Choose a template.');
  } else {
    const variants = await prisma.marketingTemplateVariant.findMany({ where: { templateId: campaign.templateId, status: 'APPROVED' } });
    if (!variants.some((v) => v.language === 'en')) problems.push('Approve the English variant of the template: a reader whose language has none is sent English.');
    const links = await prisma.marketingLink.findMany({ where: { campaignId: campaign.id } });
    const have = new Set(links.map((l) => l.position));
    for (const variant of variants) {
      for (const slot of linkSlotsUsed(variant.blocks)) {
        if (!have.has(slot)) problems.push(`The ${ai.languageInfo(variant.language)?.name ?? variant.language} variant has a button for link ${slot}, but the campaign has no link ${slot}.`);
      }
    }
    for (const link of links) {
      const bad = targetProblem(link.kind, link.target);
      if (bad) problems.push(`Link ${link.position} ${bad}.`);
    }
  }

  if (campaign.mode === 'AI_PER_USER') {
    const why = ai.whyNotRunnable(campaign.provider, campaign.model);
    if (why) problems.push(why);
  }
  return [...new Set(problems)];
}

/** The campaigns whose scheduled time has come → each is queued. (`marketing.tick`.) */
export async function startDueCampaigns(now = new Date()) {
  const due = await prisma.marketingCampaign.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } } });
  const started = [];
  for (const row of due) {
    const problems = await problemsToStart(row);
    if (problems.length) {
      const next = await prisma.marketingCampaign.update({ where: { id: row.id }, data: { status: 'DRAFT', statusMessage: `Its scheduled time came but it could not start: ${problems[0]}` } });
      publishCampaign(next);
      pushFeed(row.id, { kind: 'status', level: 'error', text: next.statusMessage });
      continue;
    }
    const claimed = await prisma.marketingCampaign.updateMany({ where: { id: row.id, status: 'SCHEDULED' }, data: { status: 'QUEUED', statusMessage: 'Waiting for the worker.' } });
    if (!claimed.count) continue;
    const jobId = newJobId(row.id);
    const next = await prisma.marketingCampaign.update({ where: { id: row.id }, data: { jobId } });
    await addRunJob(row.id, jobId);
    pushFeed(row.id, { kind: 'status', level: 'info', text: 'Its scheduled time has come; queued.' });
    publishCampaign(next);
    started.push(row.id);
  }
  return started;
}

/* ---------- the totals ---------- */

/**
 * The campaign's totals, counted from its deliveries (never moved by hand, so they cannot drift): recipients are those not
 * skipped, `sent` those the provider accepted, and so on. Writes them to the row and returns it.
 */
export async function recount(campaignId) {
  const [byStatus, sent, complained, opened, clicked] = await Promise.all([
    prisma.marketingDelivery.groupBy({ by: ['status'], where: { campaignId }, _count: { _all: true } }),
    prisma.marketingDelivery.count({ where: { campaignId, sentAt: { not: null } } }),
    prisma.marketingDelivery.count({ where: { campaignId, complainedAt: { not: null } } }),
    prisma.marketingDelivery.count({ where: { campaignId, openedAt: { not: null } } }),
    prisma.marketingDelivery.count({ where: { campaignId, clickedAt: { not: null } } }),
  ]);
  const n = (status) => byStatus.find((r) => r.status === status)?._count._all ?? 0;
  const skipped = n('SKIPPED');
  const total = byStatus.reduce((sum, r) => sum + r._count._all, 0);
  const row = await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: {
      recipients: total - skipped,
      pending: n('PENDING') + n('SENDING'),
      sent, skipped, complained,
      delivered: n('DELIVERED') + n('READ'),
      read: n('READ'),
      bounced: n('BOUNCED'),
      failed: n('FAILED'),
    },
  });
  return { row, opened, clicked };
}
