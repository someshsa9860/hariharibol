// Works one marketing campaign: `marketing.run` with `{ campaignId }`, and the minute-by-minute `marketing.tick` that queues
// the campaigns whose scheduled time has come.
//
// The same contract as jobs/processors/etiquette.js: the MarketingCampaign row is the truth and the job only works it, so a
// refreshed page or a restarted worker loses nothing. The queue is `attempts: 1`; a failure becomes a state of the row:
// paused and carried on by itself when it should pass (the mail server unreachable, the day's cap reached), paused until
// Resume when a person has to act (a refused login, a damaged reputation, the AI cost cap), or failed.
//
// What makes a restart safe is the delivery row. When a campaign starts, every reader and invitee gets one
// MarketingDelivery (unique per campaign and reader), so writing the audience again is harmless. A send claims its row
// (PENDING → SENDING) *before* the mail server is called and records the result after; a worker that dies between the two
// leaves a SENDING row, which is never sent again and is reported as failed ("interrupted") at the next start or the end —
// one reader may miss an email, no reader gets two.

import { DelayedError } from 'bullmq';

import { prisma } from '../../config/database.js';
import env from '../../config/env.js';
import logger from '../../config/logger.js';
import { marketing } from '../../config/marketing.js';
import { SETTING_KEYS } from '../../config/constants.js';
import * as settings from '../../services/setting.js';
import * as run from '../../services/marketing-run.js';
import * as mailer from '../../services/marketing-mailer.js';
import * as consent from '../../services/marketing-consent.js';
import * as audienceService from '../../services/marketing-audience.js';
import * as context from '../../services/marketing-context.js';
import * as ai from '../../services/marketing-ai.js';
import { renderEmail } from '../../services/marketing-render.js';
import { classifyError, ConfigError } from '../../utils/translation-run.js';
import { classifyMailError, gapMs, istDay, judgeReputation, listHeaders, nextIstMidnight, pickVariant, retryDelayMs } from '../../utils/marketing-send.js';
import { newDeliveryCode, oneClickUnsubscribeUrl, openPixelUrl, trackedUrl, unsubscribeUrl } from '../../utils/marketing-links.js';
import { emailKey } from '../../utils/marketing-address.js';
import { readingChain } from '../../utils/language.js';

const campaigns = prisma.marketingCampaign;
const deliveries = prisma.marketingDelivery;
const { ACTIVE_STATUSES, FINISHED_STATUSES } = run;

// campaignId → { controller, reason }: the campaigns this process is working, so a shutdown or a Cancel can stop them.
const active = new Map();

/** A stop that is not an error: the run is paused for a reason, with or without a time to try again. */
class RunPause extends Error {
  constructor(reason, message, { resumeAt = null, retryInMs = null } = {}) {
    super(message);
    this.name = 'RunPause';
    this.reason = reason;
    this.resumeAt = resumeAt;
    this.retryInMs = retryInMs;
  }
}

export const realDeps = {
  sleep: (ms, signal) =>
    new Promise((resolve) => {
      if (signal?.aborted) return resolve();
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
    }),
};

export default async function marketingProcessor(job, token) {
  if (job.name === 'marketing.tick') {
    const started = await run.startDueCampaigns();
    return { started };
  }
  return processRun(job, token, realDeps);
}

export function abortActiveRuns(reason = 'shutdown') {
  for (const entry of active.values()) {
    entry.reason ||= reason;
    entry.controller.abort();
  }
  return active.size;
}

export async function processRun(job, token, deps = realDeps) {
  const campaignId = job.data?.campaignId;
  let row = await campaigns.findUnique({ where: { id: campaignId } });
  if (!row) return { skipped: 'no such campaign' };
  if (row.jobId !== job.id) return { skipped: 'superseded by another job' };
  if (FINISHED_STATUSES.includes(row.status)) return { skipped: row.status.toLowerCase() };
  if (row.cancelRequested) {
    await finish(row, 'CANCELLED', { statusMessage: 'Cancelled before it started.' });
    return { cancelled: true };
  }

  const now = new Date();
  const claimed = await campaigns.updateMany({
    where: { id: campaignId, jobId: job.id, status: { in: ['QUEUED', 'PAUSED', 'RUNNING'] }, cancelRequested: false },
    data: { status: 'RUNNING', startedAt: row.startedAt ?? now, heartbeatAt: now, attempts: { increment: 1 }, pauseReason: null, statusMessage: null, resumeAt: null, pauseRequested: false },
  });
  if (!claimed.count) return { skipped: 'not claimable' };
  row = await campaigns.findUnique({ where: { id: campaignId } });
  run.publishCampaign(row);
  run.pushFeed(campaignId, { kind: 'status', level: 'info', text: row.attempts > 1 ? `Continuing (attempt ${row.attempts}).` : 'Started.' });

  const entry = { controller: new AbortController(), reason: null };
  active.set(campaignId, entry);
  const ctx = makeContext(row, job);
  const timer = setInterval(() => ctx.tick(entry).catch((err) => logger.warn({ err: err.message, campaignId }, 'marketing heartbeat failed')), marketing.heartbeatMs);

  let outcome;
  try {
    outcome = await execute(ctx, entry, deps);
  } catch (err) {
    outcome = { kind: 'error', error: err };
  } finally {
    clearInterval(timer);
    active.delete(campaignId);
    await ctx.settle();
  }
  return conclude(ctx, entry, outcome, job, token);
}

/* ---------- the working state of one attempt ---------- */

function makeContext(row, job) {
  const state = { activeSeconds: row.activeSeconds, calls: row.calls, inputTokens: row.inputTokens, outputTokens: row.outputTokens, costMicros: row.costMicros, retriesInARow: row.retriesInARow };
  let writing = Promise.resolve();
  let lastBeat = Date.now();
  let ticking = false;

  const data = () => ({
    activeSeconds: Math.round(state.activeSeconds), calls: state.calls, inputTokens: state.inputTokens, outputTokens: state.outputTokens,
    costMicros: state.costMicros, retriesInARow: state.retriesInARow, heartbeatAt: new Date(),
  });

  const flush = () => {
    writing = writing
      .then(() => campaigns.update({ where: { id: row.id }, data: data() }))
      .then(() => run.recount(row.id))
      .then(({ row: next }) => run.publishCampaign(next))
      .catch((err) => logger.warn({ err: err.message, campaignId: row.id }, 'marketing progress write failed'));
    return writing;
  };

  return {
    row, job, state, flush, data,
    settle: () => writing,
    say: (level, text, extra = {}) => run.pushFeed(row.id, { kind: 'status', level, text, ...extra }),

    /** Every few seconds: time spent, a sign of life, and whether the campaign was cancelled, paused or taken over. */
    async tick(entry) {
      if (ticking) return;
      ticking = true;
      try {
        const now = Date.now();
        state.activeSeconds += (now - lastBeat) / 1000;
        lastBeat = now;
        const fresh = await campaigns.findUnique({ where: { id: row.id }, select: { status: true, cancelRequested: true, pauseRequested: true, jobId: true } });
        if (!entry.reason) {
          if (!fresh || fresh.jobId !== job.id || fresh.status !== 'RUNNING') {
            entry.reason = 'lost';
            entry.controller.abort();
          } else if (fresh.cancelRequested) {
            entry.reason = 'cancel';
            entry.controller.abort();
          } else if (fresh.pauseRequested) {
            entry.reason = 'pause';
            entry.controller.abort();
          }
        }
        await flush();
      } finally {
        ticking = false;
      }
    },
  };
}

/* ---------- one attempt ---------- */

const words = (ms) => (ms < 90_000 ? `${Math.max(1, Math.round(ms / 1000))} seconds` : ms < 5_400_000 ? `${Math.round(ms / 60_000)} minutes` : `${Math.round(ms / 3_600_000)} hours`);

async function execute(ctx, entry, deps) {
  const { row } = ctx;
  const signal = entry.controller.signal;

  if (row.channel !== 'EMAIL') throw new ConfigError('Only email campaigns can be sent yet.');
  if (!mailer.isConfigured()) throw new ConfigError('No email server is set on the worker (MARKETING_SMTP_HOST or SMTP_HOST).');
  if (!row.templateId) throw new ConfigError('The campaign has no template.');

  // A reader a dead worker left half-sent is never sent again.
  const stuck = await deliveries.updateMany({ where: { campaignId: row.id, status: 'SENDING' }, data: { status: 'FAILED', error: 'Interrupted before the mail server answered; not sent again.' } });
  if (stuck.count) ctx.say('warn', `${stuck.count} email(s) were interrupted by a restart before the mail server answered; they are not sent again.`);

  if (!row.materialisedAt) {
    await materialise(ctx, signal);
    if (signal.aborted) return { kind: 'interrupted' };
  }

  const fresh = await campaigns.findUnique({ where: { id: row.id } });
  if (fresh.mode === 'AI_PER_USER' && !fresh.sampleApprovedAt) {
    const wrote = await writeSample(ctx, fresh, signal);
    if (signal.aborted) return { kind: 'interrupted' };
    if (wrote !== 'none') throw new RunPause('sample_review', `${wrote} sample email(s) were written for you to read. Approve them to write and send the rest.`);
  }

  return sendAll(ctx, entry, deps);
}

/* ---------- writing the audience ---------- */

async function materialise(ctx, signal) {
  const { row } = ctx;
  const cap = await settings.getNumber(SETTING_KEYS.MARKETING_WEEKLY_CAP, marketing.defaultWeeklyCap);
  const since = new Date(Date.now() - 7 * 86_400_000);
  let created = 0;
  let skipped = 0;
  ctx.say('info', 'Writing the audience…');

  await audienceService.walkAudience(row.audience, row.channel, async ({ kind, rows }) => {
    if (signal.aborted) return;
    const data = [];
    const reasonOf = new Map();

    const addressOf = (r) => (kind === 'user' ? r.email : r.email);
    const addresses = rows.map(addressOf).filter(Boolean);
    const suppressed = await consent.suppressedAmong('EMAIL', addresses);
    const ownKeys = kind === 'contact' ? await audienceService.keysOfReaders(addresses) : new Set();

    // Messages to the same person lately, for the weekly cap.
    const recent = await deliveries.groupBy({
      by: [kind === 'user' ? 'userId' : 'contactId'],
      where: { channel: row.channel, [kind === 'user' ? 'userId' : 'contactId']: { in: rows.map((r) => r.id) }, sentAt: { gte: since } },
      _count: { _all: true },
    });
    const recentBy = new Map(recent.map((g) => [g[kind === 'user' ? 'userId' : 'contactId'], g._count._all]));

    // Two readers can share an inbox (gmail ignores dots): only the first is written.
    const seen = new Set();
    for (const r of rows) {
      const address = addressOf(r);
      let skipReason = null;
      if (!address) skipReason = 'no_address';
      else if (suppressed.has(address)) skipReason = 'suppressed';
      else if (ownKeys.has(emailKey(address))) skipReason = 'already_reader';
      else if ((recentBy.get(r.id) ?? 0) >= cap) skipReason = 'weekly_cap';
      else if (seen.has(emailKey(address))) skipReason = 'duplicate_address';
      if (address) seen.add(emailKey(address));
      reasonOf.set(r.id, skipReason);
      data.push({
        code: newDeliveryCode(),
        campaignId: row.id,
        channel: row.channel,
        ...(kind === 'user' ? { userId: r.id } : { contactId: r.id }),
        status: skipReason ? 'SKIPPED' : 'PENDING',
        skipReason,
        language: kind === 'user' ? readingChain(r)[0] : r.language || 'en',
      });
    }
    const made = await deliveries.createMany({ data, skipDuplicates: true });
    created += made.count;
    skipped += [...reasonOf.values()].filter(Boolean).length;
  });
  if (signal.aborted) return;

  await campaigns.update({ where: { id: row.id }, data: { materialisedAt: new Date() } });
  const { row: next } = await run.recount(row.id);
  run.publishCampaign(next);
  ctx.say('success', `Audience written: ${next.recipients} to send${next.skipped ? `, ${next.skipped} left out (unsubscribed, suppressed, over the weekly cap or without an address)` : ''}.`);
  return { created, skipped };
}

/* ---------- AI_PER_USER: the sample ---------- */

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

async function loadVariants(templateId) {
  return prisma.marketingTemplateVariant.findMany({ where: { templateId, status: 'APPROVED' } });
}

async function writeSample(ctx, campaign, signal) {
  const have = await deliveries.count({ where: { campaignId: campaign.id, aiBlocks: { not: null } } });
  if (have >= marketing.aiSampleSize) return have;
  const variants = await loadVariants(campaign.templateId);
  const pending = await deliveries.findMany({ where: { campaignId: campaign.id, status: 'PENDING', aiBlocks: null }, orderBy: { id: 'asc' }, take: marketing.aiSampleSize - have, include: { user: true, contact: true } });
  if (pending.length === 0) return 'none';
  ctx.say('info', `Writing ${pending.length} sample email(s) to read before the rest…`);
  let wrote = have;
  for (const delivery of pending) {
    if (signal.aborted) break;
    const made = await personalCopy(ctx, campaign, delivery, variants, signal);
    if (made) wrote += 1;
  }
  return wrote;
}

/** One reader's AI copy → saved on the delivery; null when the model's answer failed (the reader then gets the plain template). */
async function personalCopy(ctx, campaign, delivery, variants, signal) {
  const user = delivery.user;
  const chain = user ? readingChain(user) : [delivery.contact?.language || 'en', 'en'];
  const picked = pickVariant(variants, chain);
  if (!picked) return null;
  const cards = user ? await context.cardsFor([user]) : new Map();
  const card = user ? cards.get(user.id) : context.strangerCard(delivery.contact || {});
  const language = ai.languageInfo(chain[0]) ? chain[0] : picked.language;
  try {
    const { copy, usage } = await ai.writePersonal({ variant: picked.variant, card, language, provider: campaign.provider, model: campaign.model, templateId: campaign.templateId, signal });
    spend(ctx, usage);
    await deliveries.update({ where: { id: delivery.id }, data: { aiBlocks: copy, subject: copy.subject, language } });
    return copy;
  } catch (err) {
    if (err?.spent) spend(ctx, err.spent);
    if (err instanceof ai.CopyError) {
      ctx.say('warn', `The model's copy for one reader did not pass the checks; they get the plain template instead.`);
      return null;
    }
    throw err;
  }
}

function spend(ctx, usage) {
  ctx.state.calls += usage.calls;
  ctx.state.inputTokens += usage.inputTokens;
  ctx.state.outputTokens += usage.outputTokens;
  ctx.state.costMicros += usage.costMicros;
}

/* ---------- sending ---------- */

async function sendAll(ctx, entry, deps) {
  const { row } = ctx;
  const signal = entry.controller.signal;
  const campaign = await campaigns.findUnique({ where: { id: row.id } });
  const variants = await loadVariants(campaign.templateId);
  if (!variants.some((v) => v.language === 'en')) throw new ConfigError('The English variant of the template is not approved.');
  const links = await prisma.marketingLink.findMany({ where: { campaignId: campaign.id } });
  const linkAt = new Map(links.map((l) => [l.position, l]));

  const [settingRate, dailyCap, postal, from, replyTo] = await Promise.all([
    settings.getNumber(SETTING_KEYS.MARKETING_EMAIL_RATE_PER_MINUTE, marketing.defaultRatePerMinute),
    settings.getNumber(SETTING_KEYS.MARKETING_EMAIL_DAILY_CAP, marketing.defaultDailyCap),
    settings.get(SETTING_KEYS.MARKETING_POSTAL_ADDRESS, ''),
    mailer.fromHeader(),
    mailer.replyTo(),
  ]);
  const perMinute = Math.min(settingRate, campaign.ratePerMinute || settingRate);
  const pace = gapMs(perMinute);

  const dayStart = () => new Date(new Date(`${istDay()}T00:00:00+05:30`).getTime());
  let sentToday = await deliveries.count({ where: { channel: 'EMAIL', sentAt: { gte: dayStart() } } });
  let lastDay = istDay();

  // The latest outcomes of this campaign, oldest first, for the reputation rule.
  const outcomes = async () => {
    const rows = await deliveries.findMany({
      where: { campaignId: campaign.id, OR: [{ sentAt: { not: null } }, { status: 'BOUNCED' }] },
      orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
      take: marketing.reputationWindow,
      select: { status: true, complainedAt: true },
    });
    return rows.reverse().map((d) => (d.complainedAt ? 'complaint' : d.status === 'BOUNCED' ? 'bounce' : 'ok'));
  };

  // Resumed after the AI cost cap stopped it: the rest are sent from the plain template, which costs nothing.
  const plainOnly = campaign.maxCostMicros != null && ctx.state.costMicros >= campaign.maxCostMicros;
  if (plainOnly && campaign.mode === 'AI_PER_USER') ctx.say('warn', 'The AI cost cap was already reached; the rest are sent from the plain template.');

  const retries = new Map(); // deliveryId → { due, n }

  for (;;) {
    if (signal.aborted) return { kind: 'interrupted' };

    const pending = await deliveries.findMany({
      where: { campaignId: campaign.id, status: 'PENDING' },
      orderBy: { id: 'asc' },
      take: marketing.sendPageSize,
      include: { user: { select: { id: true, email: true, name: true, readingLanguage: true, appLanguage: true, timezone: true, isPremium: true, marketingPreference: { select: { emailEnabled: true } } } }, contact: true },
    });
    const due = pending.filter((d) => !(retries.get(d.id)?.due > Date.now()));
    if (pending.length === 0) break;
    if (istDay() !== lastDay) { lastDay = istDay(); sentToday = 0; }
    if (sentToday >= dailyCap) {
      throw new RunPause('daily_cap', `Today's limit of ${dailyCap} emails is reached.`, { resumeAt: nextIstMidnight() });
    }
    if (!plainOnly && campaign.maxCostMicros != null && ctx.state.costMicros >= campaign.maxCostMicros) {
      throw new RunPause('cost_cap', `The AI cost cap of $${run.usdOf(campaign.maxCostMicros).toFixed(2)} is reached ($${run.usdOf(ctx.state.costMicros).toFixed(2)} spent). Raise the cap or press Resume to finish with the plain template.`);
    }
    const reputation = judgeReputation(await outcomes());
    if (reputation.pause) throw new RunPause('reputation', reputation.message);

    if (due.length === 0) {
      // Everything left is waiting out a retry delay.
      const next = Math.min(...[...retries.values()].map((r) => r.due));
      await deps.sleep(Math.min(Math.max(next - Date.now(), 250), 10_000), signal);
      continue;
    }

    const cards = await context.cardsFor(due.map((d) => d.user).filter(Boolean));
    const suppressed = await consent.suppressedAmong('EMAIL', due.map((d) => d.user?.email ?? d.contact?.email).filter(Boolean));

    for (const delivery of due) {
      if (signal.aborted) return { kind: 'interrupted' };
      if (sentToday >= dailyCap) break;
      const address = delivery.user?.email ?? delivery.contact?.email ?? null;

      // The reader may have unsubscribed, or the address bounced elsewhere, since the audience was written.
      if (!address || suppressed.has(address) || delivery.user?.marketingPreference?.emailEnabled === false || !delivery.user && !delivery.contact) {
        await deliveries.update({ where: { id: delivery.id }, data: { status: 'SKIPPED', skipReason: !address ? 'no_address' : 'suppressed' } });
        continue;
      }
      const claimed = await deliveries.updateMany({ where: { id: delivery.id, status: 'PENDING' }, data: { status: 'SENDING', attempts: { increment: 1 } } });
      if (!claimed.count) continue;

      const chain = delivery.user ? readingChain(delivery.user) : [delivery.contact?.language || 'en', 'en'];
      const picked = pickVariant(variants, chain);
      if (!picked) {
        await deliveries.update({ where: { id: delivery.id }, data: { status: 'FAILED', error: 'No approved variant, not even English.' } });
        continue;
      }

      let variant = picked.variant;
      let card = delivery.user ? cards.get(delivery.user.id) : context.strangerCard(delivery.contact);
      let language = picked.language;
      if (campaign.mode === 'AI_PER_USER' && !plainOnly) {
        const copy = delivery.aiBlocks ?? (await personalCopy(ctx, campaign, delivery, variants, signal));
        if (copy) {
          variant = { subject: copy.subject, preheader: copy.preheader, blocks: copy.blocks };
          card = { ...card }; // the finished words hold no merge fields; the card is kept for the footer greeting only
          language = ai.languageInfo(chain[0]) ? chain[0] : picked.language;
        }
      }

      let mail;
      try {
        mail = await renderEmail({
          variant, card, language,
          hrefOf: (slot) => (linkAt.has(slot) ? trackedUrl(env.WEB_BASE_URL, delivery.code, slot) : null),
          unsubscribeUrl: unsubscribeUrl(env.WEB_BASE_URL, delivery.code),
          postalAddress: postal || '',
          openPixel: openPixelUrl(env.API_BASE_URL, delivery.code),
          invitee: !delivery.user,
        });
      } catch (err) {
        await deliveries.update({ where: { id: delivery.id }, data: { status: 'FAILED', error: `Could not be built: ${String(err.message).slice(0, 300)}` } });
        continue;
      }

      await deps.sleep(pace, signal);
      try {
        const info = await mailer.send({
          to: address, subject: mail.subject, html: mail.html, text: mail.text, from, replyTo,
          headers: listHeaders({ unsubscribeUrl: oneClickUnsubscribeUrl(env.API_BASE_URL, delivery.code), mailto: env.MARKETING_UNSUBSCRIBE_MAILTO || null, configurationSet: env.MARKETING_SES_CONFIGURATION_SET || null, campaignId: campaign.id }),
        });
        await deliveries.update({ where: { id: delivery.id }, data: { status: 'SENT', sentAt: new Date(), providerMessageId: info.providerMessageId, subject: mail.subject, language, error: null } });
        sentToday += 1;
        ctx.state.retriesInARow = 0;
        retries.delete(delivery.id);
      } catch (err) {
        const verdict = classifyMailError(err);
        if (verdict.kind === 'auth' || verdict.kind === 'connection') {
          await deliveries.update({ where: { id: delivery.id }, data: { status: 'PENDING', error: verdict.message.slice(0, 500) } });
          throw verdict.kind === 'auth'
            ? new RunPause('smtp_auth', `The mail server refused the login or the account (${verdict.message.slice(0, 160)}). Fix the credentials or the account, then press Resume.`)
            : new RunPause('smtp_connection', `The mail server could not be reached (${verdict.message.slice(0, 160)}).`, { retryInMs: retryDelayMs(ctx.state.retriesInARow + 1) });
        }
        if (verdict.kind === 'hard_bounce' || verdict.kind === 'invalid') {
          await deliveries.update({ where: { id: delivery.id }, data: { status: 'BOUNCED', bouncedAt: new Date(), error: verdict.message.slice(0, 500) } });
          await consent.suppress('EMAIL', address, 'HARD_BOUNCE', 'refused at send time');
        } else if (verdict.kind === 'retry' && delivery.attempts + 1 < marketing.maxSendAttempts) {
          const n = (retries.get(delivery.id)?.n ?? 0) + 1;
          retries.set(delivery.id, { n, due: Date.now() + retryDelayMs(n) });
          await deliveries.update({ where: { id: delivery.id }, data: { status: 'PENDING', error: verdict.message.slice(0, 500) } });
        } else {
          await deliveries.update({ where: { id: delivery.id }, data: { status: 'FAILED', error: verdict.message.slice(0, 500) } });
        }
      }
    }
    await ctx.flush();
  }

  return { kind: 'finished' };
}

/* ---------- what the attempt came to ---------- */

async function conclude(ctx, entry, outcome, job, token) {
  const { row } = ctx;

  if (entry.reason === 'lost') return { skipped: 'the campaign was taken over' };
  if (entry.reason === 'cancel') {
    await finish(row, 'CANCELLED', { statusMessage: 'Cancelled.' }, ctx);
    return { cancelled: true };
  }
  if (entry.reason === 'pause') {
    const next = await campaigns.update({ where: { id: row.id }, data: { ...ctx.data(), status: 'PAUSED', pauseReason: 'manual', pauseRequested: false, statusMessage: 'Paused. Press Resume to carry on.' } });
    run.publishCampaign((await run.recount(row.id)).row);
    run.pushFeed(row.id, { kind: 'status', level: 'info', text: 'Paused.' });
    return { paused: 'manual', status: next.status };
  }
  if (entry.reason === 'shutdown' || outcome.kind === 'interrupted') {
    return requeue(ctx, job, token, 'The worker restarted; continuing.');
  }

  if (outcome.kind === 'finished') {
    const left = await deliveries.updateMany({ where: { campaignId: row.id, status: 'SENDING' }, data: { status: 'FAILED', error: 'Interrupted before the mail server answered; not sent again.' } });
    const { row: totals } = await run.recount(row.id);
    await finish(row, 'COMPLETED', { statusMessage: `${totals.sent} sent${totals.bounced ? `, ${totals.bounced} bounced` : ''}${totals.failed + left.count ? `, ${totals.failed} failed` : ''}.` }, ctx);
    return { completed: true, sent: totals.sent };
  }

  const err = outcome.error;
  if (err instanceof RunPause) {
    await pause(ctx, { reason: err.reason, message: err.message, resumeAt: err.resumeAt, retryInMs: err.retryInMs }, job, token);
    return { paused: err.reason };
  }
  if (err && typeof err === 'object') err.provider ??= row.provider || ai.defaultProvider();
  const decision = classifyError(err, ctx.state.retriesInARow, marketing);
  logger.warn({ campaignId: row.id, action: decision.action, reason: decision.reason, err: err?.message }, 'marketing campaign stopped by an error');
  if (decision.action === 'fail') {
    await finish(row, 'FAILED', { statusMessage: decision.message }, ctx);
    return { failed: decision.message };
  }
  await pause(ctx, { reason: decision.reason, message: decision.message, retryInMs: decision.retryInMs ?? null }, job, token);
  return { paused: decision.reason };
}

async function requeue(ctx, job, token, message) {
  const { row } = ctx;
  const resumeAt = new Date(Date.now() + 2_000);
  const next = await campaigns.update({ where: { id: row.id }, data: { ...ctx.data(), status: 'QUEUED', statusMessage: message, resumeAt } });
  run.publishCampaign(next);
  run.pushFeed(row.id, { kind: 'status', level: 'warn', text: 'The worker is restarting; this campaign will continue by itself.' });
  await job.moveToDelayed(resumeAt.getTime(), token);
  throw new DelayedError();
}

async function finish(row, status, extra, ctx) {
  await campaigns.update({ where: { id: row.id }, data: { ...(ctx ? ctx.data() : {}), status, finishedAt: new Date(), pauseReason: null, resumeAt: null, pauseRequested: false, ...extra } });
  const { row: next } = await run.recount(row.id);
  run.publishCampaign(next);
  run.pushFeed(row.id, { kind: 'status', level: status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'error' : 'info', text: extra.statusMessage });
  return next;
}

async function pause(ctx, { reason, message: said, resumeAt = null, retryInMs = null }, job, token) {
  let message = said;
  const { row, state } = ctx;
  let at = resumeAt ?? (retryInMs ? new Date(Date.now() + retryInMs) : null);
  if (retryInMs) state.retriesInARow += 1;
  if (!resumeAt && state.retriesInARow > marketing.maxAutoRetries) {
    at = null;
    message = `${message} It has been retried ${state.retriesInARow - 1} times; press Resume when it is fixed.`;
  }
  await campaigns.update({ where: { id: row.id }, data: { ...ctx.data(), status: 'PAUSED', pauseReason: reason, statusMessage: message, resumeAt: at } });
  const { row: next } = await run.recount(row.id);
  run.publishCampaign(next);
  run.pushFeed(row.id, { kind: 'status', level: 'warn', text: at ? `${message} Carrying on in ${words(at.getTime() - Date.now())}.` : message });
  if (at) {
    await job.moveToDelayed(at.getTime(), token);
    throw new DelayedError();
  }
}

/** BullMQ gave up on the job itself: mark the campaign so it does not sit "running" forever. Resume starts it again. */
export async function onJobFailed(job, err) {
  const campaignId = job?.data?.campaignId;
  if (!campaignId) return;
  const row = await campaigns.findUnique({ where: { id: campaignId } });
  if (!row || row.jobId !== job.id || FINISHED_STATUSES.includes(row.status) || row.status === 'PAUSED') return;
  const next = await campaigns.update({
    where: { id: campaignId },
    data: { status: 'FAILED', finishedAt: new Date(), statusMessage: `The background job stopped unexpectedly: ${String(err?.message).slice(0, 300)}. Emails already sent are kept; press Resume to continue.` },
  });
  run.publishCampaign(next);
  run.pushFeed(campaignId, { kind: 'status', level: 'error', text: next.statusMessage });
}

export { ACTIVE_STATUSES };
