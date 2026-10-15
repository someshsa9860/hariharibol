// Works one admin-started translation run: `translation.run` with `{ runId }`.
//
// The TranslationRun row is the truth and the job is only the thing that works it, so a refreshed page,
// a restarted API or a restarted worker loses nothing. The job never fails on its own account (the queue
// is `attempts: 1`): whatever goes wrong is turned into a state of the row by `classifyError` —
//
//   a failure that should pass (Anthropic or S3 busy, the network) → PAUSED, and the job is moved to
//        "delayed" so the run starts again by itself after a wait
//   a failure that needs a person (no credit, a bad key, no access to the bucket) → PAUSED until Resume
//   a failure waiting will not mend (a verse that will not translate) → FAILED, with the verse and why
//
// Every verse saved so far stays in S3, so a resumed run begins at the first one that is not. The
// pipeline is scripts/lib/claude-translate-run.js, unchanged: this file feeds it and reports what it does.

import { DelayedError } from 'bullmq';

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { translation } from '../../config/translation.js';
import * as service from '../../services/translation.js';
import { ConfigError, FINISHED_STATUSES, classifyError, microsOf, usdOf } from '../../utils/translation-run.js';

import { createClaude, thinkingSettings } from '../../scripts/lib/claude-translate-client.js';
import { run as runPipeline } from '../../scripts/lib/claude-translate-run.js';
import { DEFAULT_GROUP_BUDGET } from '../../scripts/lib/claude-translate-source.js';
import { checkpointKey } from '../../scripts/lib/claude-translate-store.js';

/** What a run writes in the pipeline's checkpoint, so the command-line script can tell it from another run of its own. */
export const RUNNER = 'admin-worker';

// runId → { controller, reason }: the runs this process is working, so a shutdown or a Cancel can stop them.
const active = new Map();

const runs = prisma.translationRun;

/** Everything outside the database the processor reaches for; a test hands in stand-ins. */
export const realDeps = {
  apiKey: service.apiKey,
  workspace: service.openWorkspace,
  estimate: service.estimate,
  runPipeline,
  makeAsk({ apiKey, model, effort, signal, onWait }) {
    thinkingSettings(model, effort); // a model that cannot do what is asked fails here, as a config problem, not on the first verse
    return createClaude({ apiKey, model, effort, signal, onWait }).ask;
  },
};

export default function translationProcessor(job, token) {
  return processRun(job, token, realDeps);
}

/** Stops every run this process is working (a worker shutting down); each puts itself back in the queue. */
export function abortActiveRuns(reason = 'shutdown') {
  for (const entry of active.values()) {
    entry.reason ||= reason;
    entry.controller.abort();
  }
  return active.size;
}

/**
 * @param {import('bullmq').Job} job
 * @param {string} token  the worker's lock on the job — needed to hand the job back as delayed
 * @param {typeof realDeps} deps
 */
export async function processRun(job, token, deps) {
  const runId = job.data?.runId;
  let row = await runs.findUnique({ where: { id: runId } });
  if (!row) return { skipped: 'no such run' };
  // The row names the one job that may work it; an older job (a retry that raced a Resume) does nothing.
  if (row.jobId !== job.id) return { skipped: 'superseded by another job' };
  if (FINISHED_STATUSES.includes(row.status)) return { skipped: row.status.toLowerCase() };
  if (row.cancelRequested) {
    await finish(row, 'CANCELLED', { stopReason: 'cancelled', statusMessage: 'Cancelled before it started.' });
    return { cancelled: true };
  }

  const now = new Date();
  const claimed = await runs.updateMany({
    where: { id: runId, jobId: job.id, status: { in: ['QUEUED', 'PAUSED', 'RUNNING'] }, cancelRequested: false },
    data: {
      status: 'RUNNING', startedAt: row.startedAt ?? now, heartbeatAt: now, attempts: { increment: 1 },
      pauseReason: null, statusMessage: null, resumeAt: null, stopReason: null, errorVerseId: null,
    },
  });
  if (!claimed.count) return { skipped: 'not claimable' };
  row = await runs.findUnique({ where: { id: runId } });
  service.publishRun(row);
  service.pushFeed(runId, { kind: 'status', level: 'info', text: row.attempts > 1 ? `Continuing (attempt ${row.attempts}).` : 'Started.' });

  const ctx = makeContext(row, job);
  const entry = { controller: new AbortController(), reason: null };
  active.set(runId, entry);
  const timer = setInterval(() => ctx.tick(entry).catch((err) => logger.warn({ err: err.message, runId }, 'translation heartbeat failed')), translation.heartbeatMs);

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

/**
 * The counters the row holds, kept in memory while the attempt runs and written back after each call and
 * each verse. Only this job writes them, so the memory copy is the newer one.
 */
function makeContext(row, job) {
  const state = {
    doneVerses: row.doneVerses, totalVerses: row.totalVerses, current: row.currentVerseId,
    score1: row.score1, score2: row.score2, score3: row.score3,
    inputTokens: row.inputTokens, outputTokens: row.outputTokens, calls: row.calls, costMicros: row.costMicros,
    activeSeconds: row.activeSeconds, retriesInARow: row.retriesInARow,
  };
  let writing = Promise.resolve();
  let lastBeat = Date.now();
  let ticking = false;

  const data = () => ({
    doneVerses: state.doneVerses, totalVerses: state.totalVerses, currentVerseId: state.current,
    score1: state.score1, score2: state.score2, score3: state.score3,
    inputTokens: state.inputTokens, outputTokens: state.outputTokens, calls: state.calls, costMicros: state.costMicros,
    activeSeconds: Math.round(state.activeSeconds), retriesInARow: state.retriesInARow, heartbeatAt: new Date(),
  });

  // Writes in order, one at a time; a failed write is logged and the next one carries the same numbers.
  const flush = () => {
    writing = writing
      .then(() => runs.update({ where: { id: row.id }, data: data() }))
      .then((next) => service.publishRun(next))
      .catch((err) => logger.warn({ err: err.message, runId: row.id }, 'translation progress write failed'));
    return writing;
  };

  const ctx = {
    row, job, state, flush,
    settle: () => writing,

    /** One pipeline event: the counters it moves, and a line for the feed. */
    event(name, f) {
      if (name === 'verse-start') {
        state.current = f.verseId;
        flush();
      } else if (name === 'call' || name === 'call-failed') {
        // A call that came back whole and one that was paid for and gave nothing both cost money.
        state.calls += 1;
        state.inputTokens += (f.inputTokens ?? 0) + (name === 'call' ? f.cacheReadTokens ?? 0 : 0);
        state.outputTokens += f.outputTokens ?? 0;
        state.costMicros += microsOf(f.costUsd);
        flush();
      } else if (name === 'verse') {
        state.doneVerses += 1;
        state.current = null;
        state.retriesInARow = 0; // the run is moving again
        const score = Object.values(f.correctness || {})[0];
        if (score >= 1 && score <= 3) state[`score${score}`] += 1;
        flush();
      }
      service.feedFromEvent(row.id, name, f);
    },

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
  return ctx;
}

/* ---------- one attempt ---------- */

async function execute(ctx, entry, deps) {
  const { row, state } = ctx;
  const key = deps.apiKey();
  if (!key) throw new ConfigError('ANTHROPIC_API_KEY is not set on the worker.');
  const { store, getSource } = await deps.workspace();

  // Which verses are left, so the progress bar is true after a pause as well as at the start. Left means
  // not yet translated under the run's own version: a verse made under another one counts as left.
  const verseLimit = row.verseLimit ? Math.max(0, row.verseLimit - state.doneVerses) : null;
  if (verseLimit === 0) return { kind: 'finished', stopReason: 'limit' };
  const left = await deps.estimate({ language: row.language, chapters: row.chapters, limit: verseLimit ?? 0, model: row.model, version: row.version });
  state.totalVerses = state.doneVerses + left.willTranslate;
  await ctx.flush();
  if (left.willTranslate === 0) return { kind: 'finished', stopReason: 'finished' };

  // The checkpoint's spend is the whole version's, across languages and runs; this run's budget is its own.
  const checkpoint = await store.getJson(checkpointKey(row.version));
  let maxSpend = null;
  if (row.budgetMicros != null) {
    const remaining = usdOf(row.budgetMicros - state.costMicros);
    if (remaining <= 0) return { kind: 'budget' };
    maxSpend = (checkpoint?.costUsd ?? 0) + remaining;
  }

  const ask = deps.makeAsk({
    apiKey: key, model: row.model, effort: translation.effort, signal: entry.controller.signal,
    onWait: (message) => service.pushFeed(row.id, { kind: 'wait', level: 'warn', text: message }),
  });
  const cfg = {
    model: row.model, effort: translation.effort, version: row.version, langs: [row.language], chapters: row.chapters,
    only: null, limit: verseLimit ?? 0, maxSpend, maxTokens: translation.maxTokens, groupBudget: DEFAULT_GROUP_BUDGET,
    maxRounds: translation.maxRounds,
    // The pipeline refuses to start while the checkpoint says another run is active. Our own earlier attempt,
    // killed without a chance to clear it, is not "another".
    force: Boolean(checkpoint?.running && checkpoint.runner === RUNNER),
    runner: RUNNER,
  };

  const result = await deps.runPipeline({
    store, getSource, ask, cfg, signal: entry.controller.signal,
    log: { say: () => {}, event: (name, fields) => ctx.event(name, fields) },
  });
  return { kind: result.stopReason, stopReason: result.stopReason };
}

/* ---------- what the attempt came to ---------- */

async function conclude(ctx, entry, outcome, job, token) {
  const { row, state } = ctx;
  const progress = `${state.doneVerses} of ${state.totalVerses} verses`;

  // Stopped from outside: the reason says whose doing it was, whatever the pipeline made of it.
  if (entry.reason === 'lost') return { skipped: 'the run was taken over' };
  if (entry.reason === 'cancel') {
    await finish(row, 'CANCELLED', { stopReason: 'cancelled', statusMessage: `Cancelled with ${progress} done.` }, ctx);
    return { cancelled: true };
  }
  if (entry.reason === 'shutdown' || outcome.kind === 'interrupted') {
    // The worker is going away. Put the run back; whichever worker comes up next carries on.
    const resumeAt = new Date(Date.now() + 2_000);
    const next = await runs.update({ where: { id: row.id }, data: { ...progressData(ctx), status: 'QUEUED', statusMessage: 'The worker restarted; continuing.', resumeAt } });
    service.publishRun(next);
    service.pushFeed(row.id, { kind: 'status', level: 'warn', text: 'The worker is restarting; this run will continue by itself.' });
    await job.moveToDelayed(resumeAt.getTime(), token);
    throw new DelayedError();
  }

  switch (outcome.kind) {
    case 'finished':
    case 'limit':
      await finish(row, 'COMPLETED', { stopReason: outcome.stopReason, statusMessage: outcome.stopReason === 'limit' ? `Stopped at the limit of ${row.verseLimit} verses.` : `${state.doneVerses} verses translated.` }, ctx);
      return { completed: true, verses: state.doneVerses };
    case 'max-spend':
    case 'budget':
      await pause(ctx, { reason: 'budget', message: `The spending limit of $${usdOf(row.budgetMicros).toFixed(2)} was reached after ${progress}. Raise it and press Resume to continue.` });
      return { paused: 'budget' };
    case 'error': {
      const decision = classifyError(outcome.error, state.retriesInARow);
      logger.warn({ runId: row.id, action: decision.action, reason: decision.reason, err: outcome.error?.message }, 'translation run stopped by an error');
      if (decision.action === 'fail') {
        await finish(row, 'FAILED', { stopReason: 'error', statusMessage: decision.message, errorVerseId: decision.verseId ?? null }, ctx);
        return { failed: decision.message };
      }
      await pause(ctx, decision, job, token);
      return { paused: decision.reason };
    }
    default:
      await finish(row, 'FAILED', { stopReason: 'error', statusMessage: `The run stopped for an unexpected reason (${outcome.kind}).` }, ctx);
      return { failed: outcome.kind };
  }
}

const progressData = (ctx) => {
  const { state } = ctx;
  return {
    doneVerses: state.doneVerses, totalVerses: state.totalVerses, currentVerseId: null,
    score1: state.score1, score2: state.score2, score3: state.score3,
    inputTokens: state.inputTokens, outputTokens: state.outputTokens, calls: state.calls, costMicros: state.costMicros,
    activeSeconds: Math.round(state.activeSeconds), retriesInARow: state.retriesInARow, heartbeatAt: new Date(),
  };
};

/** A run that has ended, one way or another. */
async function finish(row, status, extra, ctx) {
  const next = await runs.update({
    where: { id: row.id },
    data: { ...(ctx ? progressData(ctx) : {}), status, finishedAt: new Date(), pauseReason: null, resumeAt: null, currentVerseId: null, ...extra },
  });
  service.publishRun(next);
  service.pushFeed(row.id, { kind: 'status', level: status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'error' : 'info', text: extra.statusMessage });
  service.forgetCoverage();
  return next;
}

// "30 seconds", "5 minutes": a feed line is read by people in any timezone, so it says how long, not at what time.
const waitWords = (ms) => (ms < 90_000 ? `${Math.max(1, Math.round(ms / 1000))} seconds` : `${Math.round(ms / 60_000)} minutes`);

/**
 * A run that waits. With `retryInMs` the job is moved to "delayed" and the run starts again by itself;
 * without it, the run waits for Resume and the job ends.
 */
async function pause(ctx, decision, job, token) {
  const { row, state } = ctx;
  const resumeAt = decision.retryInMs ? new Date(Date.now() + decision.retryInMs) : null;
  if (resumeAt) state.retriesInARow += 1;
  const next = await runs.update({
    where: { id: row.id },
    data: {
      ...progressData(ctx), status: 'PAUSED', pauseReason: decision.reason, statusMessage: decision.message,
      errorVerseId: decision.verseId ?? null, resumeAt,
    },
  });
  service.publishRun(next);
  service.pushFeed(row.id, {
    kind: 'status', level: 'warn',
    text: resumeAt ? `${decision.message} Trying again in ${waitWords(decision.retryInMs)}.` : decision.message,
  });
  service.forgetCoverage();
  if (resumeAt) {
    await job.moveToDelayed(resumeAt.getTime(), token);
    throw new DelayedError();
  }
}

/**
 * The worker's 'failed' event: BullMQ gave up on the job itself (it stalled too many times, or the
 * database was unreachable while the run was being concluded). The run is marked so it does not sit
 * "running" forever; Resume starts it again from the first verse not saved.
 */
export async function onJobFailed(job, err) {
  const runId = job?.data?.runId;
  if (!runId) return;
  const row = await runs.findUnique({ where: { id: runId } });
  if (!row || row.jobId !== job.id || FINISHED_STATUSES.includes(row.status) || row.status === 'PAUSED') return;
  const next = await runs.update({
    where: { id: runId },
    data: { status: 'FAILED', stopReason: 'error', finishedAt: new Date(), currentVerseId: null, statusMessage: `The background job stopped unexpectedly: ${String(err?.message).slice(0, 300)}. Verses saved so far are kept; press Resume to continue.` },
  });
  service.publishRun(next);
  service.pushFeed(runId, { kind: 'status', level: 'error', text: next.statusMessage });
  service.forgetCoverage();
}
