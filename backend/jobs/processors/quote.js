// Works one admin-started quote translation run: `quote.run` with `{ runId }`.
//
// The same contract as jobs/processors/scenes.js: the QuoteRun row is the truth and the job is only the thing that
// works it, so a refreshed page or a restarted worker loses nothing; the queue is `attempts: 1` and a failure becomes a
// state of the row (classifyError): paused and retried by itself when it should pass (the provider busy, the network),
// paused until Resume when it needs a person (no credit, a bad key), failed when waiting will not mend it (the model
// keeps giving answers that fail our checks). Every item saved is an QuoteTranslation row, so a resumed run starts
// at the first item that has none.
//
// Items go in several to a request (`quote.batchSize`). Each answer is checked (utils/quote.js `checkAnswer`);
// the items that pass are saved at once and only the rest are asked for again, so a half-good answer is not wasted.

import { DelayedError } from 'bullmq';

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { quote } from '../../config/quote.js';
import * as service from '../../services/quote.js';
import { createAsk, providerOf } from '../../scripts/lib/translate-providers.js';
import { ConfigError, FINISHED_STATUSES, classifyError, retryDelayMs } from '../../utils/translation-run.js';
import { SYSTEM_PROMPT, TRANSLATE_SCHEMA, checkAnswer, languageInfo, userPrompt } from '../../utils/quote.js';

// runId → { controller, reason }: the runs this process is working, so a shutdown or a Cancel can stop them.
const active = new Map();
const runs = prisma.quoteRun;

/** The answers failed our checks every time they were asked for. Waiting will not mend it. */
export class ItemsFailedError extends Error {
  constructor(message, slugs) {
    super(message);
    this.name = 'ItemsFailedError';
    this.slugs = slugs;
  }
}

/** Everything outside the database the processor reaches for; a test hands in stand-ins. */
export const realDeps = {
  apiKey: service.apiKey,
  makeAsk: ({ provider, apiKey, model, signal, onWait }) => createAsk({ provider, apiKey, model, effort: 'off', signal, onWait }).ask,
  itemsForRun: service.itemsForRun,
  save: service.saveTranslations,
};

export default function quoteProcessor(job, token) {
  return processRun(job, token, realDeps);
}

export function abortActiveRuns(reason = 'shutdown') {
  for (const entry of active.values()) {
    entry.reason ||= reason;
    entry.controller.abort();
  }
  return active.size;
}

export async function processRun(job, token, deps) {
  const runId = job.data?.runId;
  let row = await runs.findUnique({ where: { id: runId } });
  if (!row) return { skipped: 'no such run' };
  if (row.jobId !== job.id) return { skipped: 'superseded by another job' };
  if (FINISHED_STATUSES.includes(row.status)) return { skipped: row.status.toLowerCase() };
  if (row.cancelRequested) {
    await finish(row, 'CANCELLED', { stopReason: 'cancelled', statusMessage: 'Cancelled before it started.' });
    return { cancelled: true };
  }

  // Runs go in the order they were made. An earlier one that is waiting, working, or paused to try again by itself comes
  // first; this one looks again in a few seconds. (One that is paused for a person does not hold the queue up.)
  const ahead = await runs.findFirst({
    where: {
      id: { not: runId }, createdAt: { lt: row.createdAt },
      OR: [{ status: 'QUEUED' }, { status: 'RUNNING', heartbeatAt: { gt: new Date(Date.now() - quote.staleHeartbeatSeconds * 1000) } }, { status: 'PAUSED', resumeAt: { not: null } }],
    },
    select: { id: true },
  });
  if (ahead) {
    await job.moveToDelayed(Date.now() + quote.sameBookWaitMs, token);
    throw new DelayedError();
  }

  const now = new Date();
  const claimed = await runs.updateMany({
    where: { id: runId, jobId: job.id, status: { in: ['QUEUED', 'PAUSED', 'RUNNING'] }, cancelRequested: false },
    data: { status: 'RUNNING', startedAt: row.startedAt ?? now, heartbeatAt: now, attempts: { increment: 1 }, pauseReason: null, statusMessage: null, resumeAt: null, stopReason: null },
  });
  if (!claimed.count) return { skipped: 'not claimable' };
  row = await runs.findUnique({ where: { id: runId } });
  service.publishRun(row);
  service.pushFeed(runId, { kind: 'status', level: 'info', text: row.attempts > 1 ? `Continuing (attempt ${row.attempts}).` : 'Started.' });

  const ctx = makeContext(row, job);
  const entry = { controller: new AbortController(), reason: null };
  active.set(runId, entry);
  const timer = setInterval(() => ctx.tick(entry).catch((err) => logger.warn({ err: err.message, runId }, 'quote heartbeat failed')), quote.heartbeatMs);

  let outcome;
  try {
    outcome = await execute(ctx, entry, deps);
  } catch (err) {
    outcome = { kind: 'error', error: err };
  } finally {
    clearInterval(timer);
    active.delete(runId);
    await ctx.settle();
  }
  return conclude(ctx, entry, outcome, job, token);
}

/* ---------- the working state of one attempt ---------- */

function makeContext(row, job) {
  const state = {
    total: row.totalItems, done: row.doneItems, current: row.currentSlug,
    inputTokens: row.inputTokens, outputTokens: row.outputTokens, calls: row.calls, activeSeconds: row.activeSeconds, retriesInARow: row.retriesInARow,
  };
  let writing = Promise.resolve();
  let lastBeat = Date.now();
  let ticking = false;

  const data = () => ({
    totalItems: state.total, doneItems: state.done, currentSlug: state.current,
    inputTokens: state.inputTokens, outputTokens: state.outputTokens, calls: state.calls, activeSeconds: Math.round(state.activeSeconds),
    retriesInARow: state.retriesInARow, heartbeatAt: new Date(),
  });

  const flush = () => {
    writing = writing
      .then(() => runs.update({ where: { id: row.id }, data: data() }))
      .then((next) => service.publishRun(next))
      .catch((err) => logger.warn({ err: err.message, runId: row.id }, 'quote progress write failed'));
    return writing;
  };

  return {
    row, job, state, flush, data,
    settle: () => writing,
    say: (level, text, extra = {}) => service.pushFeed(row.id, { kind: 'status', level, text, ...extra }),

    /** Every few seconds: time spent, a sign of life, and whether the run was cancelled or taken over. */
    async tick(entry) {
      if (ticking) return;
      ticking = true;
      try {
        const now = Date.now();
        state.activeSeconds += (now - lastBeat) / 1000;
        lastBeat = now;
        const fresh = await runs.findUnique({ where: { id: row.id }, select: { status: true, cancelRequested: true, jobId: true } });
        if (!entry.reason) {
          if (!fresh || fresh.jobId !== job.id || fresh.status !== 'RUNNING') {
            entry.reason = 'lost';
            entry.controller.abort();
          } else if (fresh.cancelRequested) {
            entry.reason = 'cancel';
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

const words = (ms) => (ms < 90_000 ? `${Math.max(1, Math.round(ms / 1000))} seconds` : `${Math.round(ms / 60_000)} minutes`);
const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

async function execute(ctx, entry, deps) {
  const { row, state } = ctx;
  const info = languageInfo(row.language);
  if (!info) throw new ConfigError(`"${row.language}" is not a language quotes are translated into.`);
  const key = deps.apiKey(row.provider);
  if (!key) throw new ConfigError(`${providerOf(row.provider).keyEnv} is not set on the worker.`);
  const ask = deps.makeAsk({
    provider: row.provider, apiKey: key, model: row.model, signal: entry.controller.signal,
    onWait: (message) => service.pushFeed(row.id, { kind: 'wait', level: 'warn', text: message }),
  });

  // What is left: the total is fixed when the run first starts (so the bar is true after a pause); after that, the items with no translation yet.
  const todo = await deps.itemsForRun(row);
  if (state.total === 0) {
    state.total = todo.length;
    await ctx.flush();
  }
  if (todo.length === 0) return { kind: 'finished' };

  const aborted = () => entry.controller.signal.aborted;

  for (const batch of chunk(todo, quote.batchSize)) {
    if (aborted()) return { kind: 'interrupted' };
    let pending = batch;
    let problems = [];

    for (let attempt = 1; attempt <= quote.invalidTries && pending.length > 0; attempt++) {
      state.current = pending[0].slug;
      ctx.flush();

      const user = userPrompt({ languageName: info.name, endonym: info.endonym, items: pending });
      let result;
      try {
        result = await ask({
          system: SYSTEM_PROMPT,
          user: attempt === 1 ? user : `${user}\n\nYour last answer had these problems; fix them: ${problems.join('; ')}.`,
          schema: TRANSLATE_SCHEMA,
          maxTokens: quote.maxTokens,
        });
      } catch (err) {
        if (err?.usage) await count(ctx, row, err.usage); // a call that was paid for and gave nothing used the tokens too
        throw err;
      }
      await count(ctx, row, result.usage);

      const checked = checkAnswer(result.data, pending, row.language);
      if (checked.items.length) {
        const saved = await deps.save({ language: row.language, items: checked.items, provider: row.provider, runId: row.id });
        state.done += checked.items.length;
        state.retriesInARow = 0; // the run is moving again
        ctx.say('success', `${checked.items.length} translated (${saved} saved): ${checked.items.map((i) => i.slug).join(', ')}.`);
        const passed = new Set(checked.items.map((i) => i.slug));
        pending = pending.filter((item) => !passed.has(item.slug));
        ctx.flush();
      }
      if (!checked.ok) {
        problems = checked.problems;
        ctx.say('warn', `The answer did not pass for ${pending.length} item(s) (${problems.slice(0, 2).join('; ')}).${attempt < quote.invalidTries ? ' Asking again.' : ''}`);
      }
    }
    if (pending.length > 0) {
      throw new ItemsFailedError(
        `${pending.length} item(s) could not be translated into ${info.name} after ${quote.invalidTries} tries: ${problems.slice(0, 3).join('; ')}.`,
        pending.map((item) => item.slug),
      );
    }
  }
  state.current = null;
  return { kind: 'finished' };
}

/** One call's tokens: on the row and in the token calculator. */
async function count(ctx, row, usage) {
  const inputTokens = (usage?.inputTokens ?? 0) + (usage?.cacheReadTokens ?? 0) + (usage?.cacheWriteTokens ?? 0);
  const outputTokens = usage?.outputTokens ?? 0;
  ctx.state.calls += 1;
  ctx.state.inputTokens += inputTokens;
  ctx.state.outputTokens += outputTokens;
  await service.countTokens({ provider: row.provider, model: row.model, inputTokens, outputTokens });
  ctx.flush();
  return { inputTokens, outputTokens };
}

/* ---------- what the attempt came to ---------- */

async function conclude(ctx, entry, outcome, job, token) {
  const { row, state } = ctx;
  const progress = `${state.done} of ${state.total} items`;

  if (entry.reason === 'lost') return { skipped: 'the run was taken over' };
  if (entry.reason === 'cancel') {
    await finish(row, 'CANCELLED', { stopReason: 'cancelled', statusMessage: `Cancelled with ${progress} translated.` }, ctx);
    return { cancelled: true };
  }
  if (entry.reason === 'shutdown' || outcome.kind === 'interrupted') {
    return requeue(ctx, job, token, 'The worker restarted; continuing.');
  }

  if (outcome.kind === 'finished') {
    await finish(row, 'COMPLETED', { stopReason: 'finished', statusMessage: `${state.done} items translated.` }, ctx);
    return { completed: true, items: state.done };
  }

  const err = outcome.error;
  if (err instanceof ItemsFailedError) {
    await finish(row, 'FAILED', { stopReason: 'error', statusMessage: err.message }, ctx);
    return { failed: err.message };
  }
  if (err && typeof err === 'object') err.provider ??= row.provider; // classifyError names the company and the key setting from it
  const decision = classifyError(err, state.retriesInARow, quote);
  logger.warn({ runId: row.id, action: decision.action, reason: decision.reason, err: err?.message }, 'quote run stopped by an error');
  if (decision.action === 'fail') {
    await finish(row, 'FAILED', { stopReason: 'error', statusMessage: decision.message }, ctx);
    return { failed: decision.message };
  }
  await pause(ctx, decision, job, token);
  return { paused: decision.reason };
}

async function requeue(ctx, job, token, message) {
  const { row } = ctx;
  const resumeAt = new Date(Date.now() + 2_000);
  const next = await runs.update({ where: { id: row.id }, data: { ...ctx.data(), currentSlug: null, status: 'QUEUED', statusMessage: message, resumeAt } });
  service.publishRun(next);
  service.pushFeed(row.id, { kind: 'status', level: 'warn', text: 'The worker is restarting; this run will continue by itself.' });
  await job.moveToDelayed(resumeAt.getTime(), token);
  throw new DelayedError();
}

async function finish(row, status, extra, ctx) {
  const next = await runs.update({
    where: { id: row.id },
    data: { ...(ctx ? ctx.data() : {}), status, finishedAt: new Date(), pauseReason: null, resumeAt: null, currentSlug: null, ...extra },
  });
  service.publishRun(next);
  service.pushFeed(row.id, { kind: 'status', level: status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'error' : 'info', text: extra.statusMessage });
  return next;
}

async function pause(ctx, decision, job, token) {
  const { row, state } = ctx;
  const resumeAt = decision.retryInMs ? new Date(Date.now() + decision.retryInMs) : null;
  if (resumeAt) state.retriesInARow += 1;
  const next = await runs.update({
    where: { id: row.id },
    data: { ...ctx.data(), currentSlug: null, status: 'PAUSED', pauseReason: decision.reason, statusMessage: decision.message, resumeAt },
  });
  service.publishRun(next);
  service.pushFeed(row.id, { kind: 'status', level: 'warn', text: resumeAt ? `${decision.message} Trying again in ${words(decision.retryInMs)}.` : decision.message });
  if (resumeAt) {
    await job.moveToDelayed(resumeAt.getTime(), token);
    throw new DelayedError();
  }
}

/** BullMQ gave up on the job itself: mark the run so it does not sit "running" forever. Resume starts it again. */
export async function onJobFailed(job, err) {
  const runId = job?.data?.runId;
  if (!runId) return;
  const row = await runs.findUnique({ where: { id: runId } });
  if (!row || row.jobId !== job.id || FINISHED_STATUSES.includes(row.status) || row.status === 'PAUSED') return;
  const next = await runs.update({
    where: { id: runId },
    data: { status: 'FAILED', stopReason: 'error', finishedAt: new Date(), currentSlug: null, statusMessage: `The background job stopped unexpectedly: ${String(err?.message).slice(0, 300)}. Items translated so far are kept; press Resume to continue.` },
  });
  service.publishRun(next);
  service.pushFeed(runId, { kind: 'status', level: 'error', text: next.statusMessage });
}
