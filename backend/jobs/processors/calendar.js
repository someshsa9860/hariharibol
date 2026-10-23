// Works one admin-started Hindu calendar translation run: `calendar.run` with `{ runId }`.
//
// The same contract as jobs/processors/etiquette.js: the CalendarRun row is the truth and the job is only the thing that
// works it, so a refreshed page or a restarted worker loses nothing; the queue is `attempts: 1` and a failure becomes a
// state of the row (classifyError): paused and retried by itself when it should pass (the provider busy, the network),
// paused until Resume when it needs a person (no credit, a bad key), failed when waiting will not mend it (the model
// keeps giving answers that fail our checks). Every item saved is a CalendarTranslation row, so a resumed run starts at
// the first item that has none.
//
// The items are short (a festival's name, a tithi), so many go in one request (`calendar.batchSize`), each as
// `{ ref, kind, text }` with a ref that is only its place in the batch. Each answer is checked (utils/calendar-translation.js
// `checkAnswer`); the items that pass are saved at once and only the rest are asked for again.

import { DelayedError } from 'bullmq';

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { calendar } from '../../config/calendar.js';
import * as service from '../../services/calendar-translation.js';
import { createAsk, providerOf } from '../../scripts/lib/translate-providers.js';
import { ConfigError, FINISHED_STATUSES, classifyError } from '../../utils/translation-run.js';
import { SYSTEM_PROMPT, TRANSLATE_SCHEMA, checkAnswer, languageInfo, userPrompt } from '../../utils/calendar-translation.js';

// runId → { controller, reason }: the runs this process is working, so a shutdown or a Cancel can stop them.
const active = new Map();
const runs = prisma.calendarRun;

/** The answers failed our checks every time they were asked for. Waiting will not mend it. */
export class ItemsFailedError extends Error {
  constructor(message, items) {
    super(message);
    this.name = 'ItemsFailedError';
    this.items = items;
  }
}

/** Everything outside the database the processor reaches for; a test hands in stand-ins. */
export const realDeps = {
  apiKey: service.apiKey,
  makeAsk: ({ provider, apiKey, model, signal, onWait }) => createAsk({ provider, apiKey, model, effort: 'off', signal, onWait }).ask,
  itemsForRun: service.itemsForRun,
  save: service.saveTranslations,
};

export default function calendarProcessor(job, token) {
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
      OR: [{ status: 'QUEUED' }, { status: 'RUNNING', heartbeatAt: { gt: new Date(Date.now() - calendar.staleHeartbeatSeconds * 1000) } }, { status: 'PAUSED', resumeAt: { not: null } }],
    },
    select: { id: true },
  });
  if (ahead) {
    await job.moveToDelayed(Date.now() + calendar.sameBookWaitMs, token);
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
  const timer = setInterval(() => ctx.tick(entry).catch((err) => logger.warn({ err: err.message, runId }, 'calendar heartbeat failed')), calendar.heartbeatMs);

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
    total: row.totalItems, done: row.doneItems, current: row.currentItem,
    inputTokens: row.inputTokens, outputTokens: row.outputTokens, calls: row.calls, activeSeconds: row.activeSeconds, retriesInARow: row.retriesInARow,
  };
  let writing = Promise.resolve();
  let lastBeat = Date.now();
  let ticking = false;

  const data = () => ({
    totalItems: state.total, doneItems: state.done, currentItem: state.current,
    inputTokens: state.inputTokens, outputTokens: state.outputTokens, calls: state.calls, activeSeconds: Math.round(state.activeSeconds),
    retriesInARow: state.retriesInARow, heartbeatAt: new Date(),
  });

  const flush = () => {
    writing = writing
      .then(() => runs.update({ where: { id: row.id }, data: data() }))
      .then((next) => service.publishRun(next))
      .catch((err) => logger.warn({ err: err.message, runId: row.id }, 'calendar progress write failed'));
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
const shorten = (text, length = 120) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

async function execute(ctx, entry, deps) {
  const { row, state } = ctx;
  const info = languageInfo(row.language);
  if (!info) throw new ConfigError(`"${row.language}" is not a language the Hindu calendar is translated into.`);
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

  for (const batch of chunk(todo, calendar.batchSize)) {
    if (aborted()) return { kind: 'interrupted' };
    // A ref is the item's place in this batch: short, and the same on every ask, so a second ask names the same items.
    let pending = batch.map((item, i) => ({ ...item, ref: String(i + 1) }));
    let problems = [];

    for (let attempt = 1; attempt <= calendar.invalidTries && pending.length > 0; attempt++) {
      state.current = shorten(pending[0].source);
      ctx.flush();

      const user = userPrompt({ languageName: info.name, endonym: info.endonym, items: pending });
      let result;
      try {
        result = await ask({
          system: SYSTEM_PROMPT,
          user: attempt === 1 ? user : `${user}\n\nYour last answer had these problems; fix them: ${problems.join('; ')}.`,
          schema: TRANSLATE_SCHEMA,
          maxTokens: calendar.maxTokens,
        });
      } catch (err) {
        if (err?.usage) await count(ctx, row, err.usage); // a call that was paid for and gave nothing used the tokens too
        throw err;
      }
      await count(ctx, row, result.usage);

      const checked = checkAnswer(result.data, pending, row.language);
      if (checked.items.length) {
        const byRef = new Map(pending.map((item) => [item.ref, item]));
        const passed = checked.items.map(({ ref, text }) => ({ kind: byRef.get(ref).kind, source: byRef.get(ref).source, sourceKey: byRef.get(ref).sourceKey, text }));
        const saved = await deps.save({ language: row.language, items: passed, provider: row.provider, runId: row.id });
        state.done += passed.length;
        state.retriesInARow = 0; // the run is moving again
        ctx.say('success', `${passed.length} translated (${saved} saved): ${passed.slice(0, 4).map((i) => shorten(i.source, 40)).join(', ')}${passed.length > 4 ? ' …' : ''}.`);
        const done = new Set(checked.items.map((i) => i.ref));
        pending = pending.filter((item) => !done.has(item.ref));
        ctx.flush();
      }
      if (!checked.ok) {
        problems = checked.problems;
        ctx.say('warn', `The answer did not pass for ${pending.length} item(s) (${problems.slice(0, 2).join('; ')}).${attempt < calendar.invalidTries ? ' Asking again.' : ''}`);
      }
    }
    if (pending.length > 0) {
      throw new ItemsFailedError(
        `${pending.length} item(s) could not be translated into ${info.name} after ${calendar.invalidTries} tries: ${problems.slice(0, 3).join('; ')}.`,
        pending.map((item) => item.source),
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
  const decision = classifyError(err, state.retriesInARow, calendar);
  logger.warn({ runId: row.id, action: decision.action, reason: decision.reason, err: err?.message }, 'calendar run stopped by an error');
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
  const next = await runs.update({ where: { id: row.id }, data: { ...ctx.data(), currentItem: null, status: 'QUEUED', statusMessage: message, resumeAt } });
  service.publishRun(next);
  service.pushFeed(row.id, { kind: 'status', level: 'warn', text: 'The worker is restarting; this run will continue by itself.' });
  await job.moveToDelayed(resumeAt.getTime(), token);
  throw new DelayedError();
}

async function finish(row, status, extra, ctx) {
  const next = await runs.update({
    where: { id: row.id },
    data: { ...(ctx ? ctx.data() : {}), status, finishedAt: new Date(), pauseReason: null, resumeAt: null, currentItem: null, ...extra },
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
    data: { ...ctx.data(), currentItem: null, status: 'PAUSED', pauseReason: decision.reason, statusMessage: decision.message, resumeAt },
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
    data: { status: 'FAILED', stopReason: 'error', finishedAt: new Date(), currentItem: null, statusMessage: `The background job stopped unexpectedly: ${String(err?.message).slice(0, 300)}. Items translated so far are kept; press Resume to continue.` },
  });
  service.publishRun(next);
  service.pushFeed(runId, { kind: 'status', level: 'error', text: next.statusMessage });
}
