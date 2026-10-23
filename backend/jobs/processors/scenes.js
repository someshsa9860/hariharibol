// Works one admin-started scene prompt run: `scenes.run` with `{ runId }`.
//
// The same contract as jobs/processors/translation.js, smaller: the SceneRun row is the truth and the job is only the
// thing that works it, so a refreshed page or a restarted worker loses nothing; the queue is `attempts: 1` and a failure
// becomes a state of the row (classifyError): paused and retried by itself when it should pass (the provider busy, the
// network), paused until Resume when it needs a person (no credit, a bad key), failed when waiting will not mend it (a
// chapter the model will not storyboard, a chapter file missing). Every chapter written is in S3 and in the index, so a
// resumed run starts at the first one that is not.
//
// One request per chapter, kept under the model's free-tier limits (config/scenes.js: requests and input tokens a
// minute) by a sliding-minute limiter; every call's tokens are counted on the row and in the token calculator.

import { DelayedError } from 'bullmq';

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { scenes } from '../../config/scenes.js';
import * as service from '../../services/scenes.js';
import { createAsk, providerOf } from '../../scripts/lib/translate-providers.js';
import { chapterLabel } from '../../scripts/lib/claude-translate-source.js';
import { ConfigError, FINISHED_STATUSES, classifyError, retryDelayMs } from '../../utils/translation-run.js';
import { SCENES_SCHEMA, SYSTEM_PROMPT, buildFile, checkAnswer, createLimiter, estimateTokens, userPrompt } from '../../utils/scenes.js';

// runId → { controller, reason }: the runs this process is working, so a shutdown or a Cancel can stop them.
const active = new Map();
const runs = prisma.sceneRun;

/** The chapter's answer failed our checks every time it was asked for. Waiting will not mend it. */
export class ChapterFailedError extends Error {
  constructor(message, chapter) {
    super(message);
    this.name = 'ChapterFailedError';
    this.chapter = chapter;
  }
}

/** Everything outside the database the processor reaches for; a test hands in stand-ins. */
export const realDeps = {
  apiKey: service.apiKey,
  makeAsk: ({ provider, apiKey, model, signal, onWait }) => createAsk({ provider, apiKey, model, effort: 'off', signal, onWait }).ask,
  source: service.loadSource,
  chaptersToWrite: service.chaptersToWrite,
  save: service.saveOutput,
  addToIndex: service.addToIndex,
  // Gemini's free-tier minute applies to a Gemini run only; any other provider has no limit of ours (a 429 from it is a wait).
  limiter: (provider) => {
    const { rpm, tpm } = service.limitsFor(provider);
    return createLimiter({ rpm: rpm ?? Infinity, tpm: tpm ?? Infinity });
  },
};

export default function scenesProcessor(job, token) {
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
      OR: [{ status: 'QUEUED' }, { status: 'RUNNING', heartbeatAt: { gt: new Date(Date.now() - scenes.staleHeartbeatSeconds * 1000) } }, { status: 'PAUSED', resumeAt: { not: null } }],
    },
    select: { id: true },
  });
  if (ahead) {
    await job.moveToDelayed(Date.now() + scenes.sameBookWaitMs, token);
    throw new DelayedError();
  }

  const now = new Date();
  const claimed = await runs.updateMany({
    where: { id: runId, jobId: job.id, status: { in: ['QUEUED', 'PAUSED', 'RUNNING'] }, cancelRequested: false },
    data: { status: 'RUNNING', startedAt: row.startedAt ?? now, heartbeatAt: now, attempts: { increment: 1 }, pauseReason: null, statusMessage: null, resumeAt: null, stopReason: null, errorChapter: null },
  });
  if (!claimed.count) return { skipped: 'not claimable' };
  row = await runs.findUnique({ where: { id: runId } });
  service.publishRun(row);
  service.pushFeed(runId, { kind: 'status', level: 'info', text: row.attempts > 1 ? `Continuing (attempt ${row.attempts}).` : 'Started.' });

  const ctx = makeContext(row, job);
  const entry = { controller: new AbortController(), reason: null };
  active.set(runId, entry);
  const timer = setInterval(() => ctx.tick(entry).catch((err) => logger.warn({ err: err.message, runId }, 'scenes heartbeat failed')), scenes.heartbeatMs);

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
    total: row.totalChapters, done: row.doneChapters, skipped: row.skippedChapters, current: row.currentChapter,
    inputTokens: row.inputTokens, outputTokens: row.outputTokens, calls: row.calls, activeSeconds: row.activeSeconds, retriesInARow: row.retriesInARow,
  };
  let writing = Promise.resolve();
  let lastBeat = Date.now();
  let ticking = false;

  const data = () => ({
    totalChapters: state.total, doneChapters: state.done, skippedChapters: state.skipped, currentChapter: state.current,
    inputTokens: state.inputTokens, outputTokens: state.outputTokens, calls: state.calls, activeSeconds: Math.round(state.activeSeconds),
    retriesInARow: state.retriesInARow, heartbeatAt: new Date(),
  });

  const flush = () => {
    writing = writing
      .then(() => runs.update({ where: { id: row.id }, data: data() }))
      .then((next) => service.publishRun(next))
      .catch((err) => logger.warn({ err: err.message, runId: row.id }, 'scenes progress write failed'));
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

async function execute(ctx, entry, deps) {
  const { row, state } = ctx;
  const key = deps.apiKey(row.provider);
  if (!key) throw new ConfigError(`${providerOf(row.provider).keyEnv} is not set on the worker.`);
  const ask = deps.makeAsk({
    provider: row.provider, apiKey: key, model: row.model, signal: entry.controller.signal,
    onWait: (message) => service.pushFeed(row.id, { kind: 'wait', level: 'warn', text: message }),
  });

  // What is left: fixed when the run first starts (so the bar is true after a pause), the chapters not yet in the index after that.
  const todo = await deps.chaptersToWrite(row.book, row.chapters, row.force && state.done + state.skipped === 0);
  if (state.total === 0) {
    state.total = todo.length;
    await ctx.flush();
  }
  if (todo.length === 0) return { kind: 'finished' };

  const limiter = deps.limiter(row.provider);
  const aborted = () => entry.controller.signal.aborted;

  for (const chapterId of todo) {
    if (aborted()) return { kind: 'interrupted' };
    const ref = chapterLabel(chapterId, row.book);
    state.current = chapterId;
    ctx.flush();

    const source = await deps.source(row.book, chapterId);
    if (source.verses.length === 0) {
      state.skipped += 1;
      state.current = null;
      ctx.say('warn', `Chapter ${ref} skipped: no Hindi meanings yet (run the Hindi translation first).`, { chapter: chapterId });
      ctx.flush();
      continue;
    }
    if (source.missingHindi.length) ctx.say('warn', `Chapter ${ref}: ${source.missingHindi.length} verse(s) have no Hindi meaning and are left out.`, { chapter: chapterId });

    const user = userPrompt({ bookTitle: service.books().find((b) => b.id === row.book).title, chapterRef: ref, chapterName: source.chapterName, verses: source.verses });
    const verseRefs = source.verses.map((v) => v.ref);
    let checked = null;
    let problems = [];
    let usage = { inputTokens: 0, outputTokens: 0 };

    for (let attempt = 1; attempt <= scenes.invalidTries && !checked?.ok; attempt++) {
      const sent = await limiter.acquire(estimateTokens(SYSTEM_PROMPT, user), {
        signal: entry.controller.signal,
        onWait: (ms, why) => {
          ctx.say('info', `Waiting ${words(ms)} to stay under the model's ${why === 'tokens' ? 'tokens' : 'requests'} a minute limit.`);
          service.rememberMinute(limiter.usage(), row);
        },
      });
      service.rememberMinute(limiter.usage(), row);

      let result;
      try {
        result = await ask({ system: SYSTEM_PROMPT, user: attempt === 1 ? user : `${user}\n\nYour last answer had these problems; fix them: ${problems.join('; ')}.`, schema: SCENES_SCHEMA, maxTokens: scenes.maxTokens });
      } catch (err) {
        if (err?.usage) await count(ctx, row, err.usage, sent, limiter); // a call that was paid for and gave nothing used the tokens too
        throw err;
      }
      const used = await count(ctx, row, result.usage, sent, limiter);
      usage = { inputTokens: usage.inputTokens + used.inputTokens, outputTokens: usage.outputTokens + used.outputTokens };
      service.rememberMinute(limiter.usage(), row);

      checked = checkAnswer(result.data, verseRefs);
      if (!checked.ok) {
        problems = checked.problems;
        ctx.say('warn', `Chapter ${ref}: the answer did not pass (${problems.slice(0, 2).join('; ')}).${attempt < scenes.invalidTries ? ' Asking again.' : ''}`, { chapter: chapterId });
      }
    }
    if (!checked.ok) throw new ChapterFailedError(`Chapter ${ref} could not be storyboarded after ${scenes.invalidTries} tries: ${problems.slice(0, 3).join('; ')}.`, chapterId);

    const file = buildFile({
      book: row.book, chapterId, chapterName: source.chapterName, verses: source.verses, missingHindi: source.missingHindi,
      value: checked.value, provider: row.provider, model: row.model, usage, runId: row.id,
    });
    await deps.save(row.book, chapterId, file);
    await deps.addToIndex(row.book, {
      chapterId, file: file.meta.file, title: file.chapterTitle, scenes: file.meta.sceneCount, seconds: file.meta.totalSeconds, provider: row.provider, model: row.model,
      generatedAt: file.meta.generatedAt, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
    });

    state.done += 1;
    state.current = null;
    state.retriesInARow = 0; // the run is moving again
    ctx.say('success', `Chapter ${ref}: ${file.meta.sceneCount} scenes, ${file.meta.totalSeconds}s (${usage.inputTokens.toLocaleString('en-IN')} in, ${usage.outputTokens.toLocaleString('en-IN')} out).`, { chapter: chapterId });
    ctx.flush();
  }
  return { kind: 'finished' };
}

/** One call's tokens: on the row, in the token calculator, and in the limiter's minute (the provider's count replaces our estimate). */
async function count(ctx, row, usage, sent, limiter) {
  const inputTokens = (usage?.inputTokens ?? 0) + (usage?.cacheReadTokens ?? 0) + (usage?.cacheWriteTokens ?? 0);
  const outputTokens = usage?.outputTokens ?? 0;
  ctx.state.calls += 1;
  ctx.state.inputTokens += inputTokens;
  ctx.state.outputTokens += outputTokens;
  limiter.settle(sent, inputTokens);
  await service.countTokens({ provider: row.provider, model: row.model, inputTokens, outputTokens });
  ctx.flush();
  return { inputTokens, outputTokens };
}

/* ---------- what the attempt came to ---------- */

async function conclude(ctx, entry, outcome, job, token) {
  const { row, state } = ctx;
  const progress = `${state.done} of ${state.total} chapters`;

  if (entry.reason === 'lost') return { skipped: 'the run was taken over' };
  if (entry.reason === 'cancel') {
    await finish(row, 'CANCELLED', { stopReason: 'cancelled', statusMessage: `Cancelled with ${progress} written.` }, ctx);
    return { cancelled: true };
  }
  if (entry.reason === 'shutdown' || outcome.kind === 'interrupted') {
    return requeue(ctx, job, token, 'The worker restarted; continuing.');
  }

  if (outcome.kind === 'finished') {
    const skipped = state.skipped ? ` ${state.skipped} skipped for lack of Hindi meanings.` : '';
    await finish(row, 'COMPLETED', { stopReason: 'finished', statusMessage: `${state.done} chapters written.${skipped}` }, ctx);
    return { completed: true, chapters: state.done };
  }

  const err = outcome.error;
  if (err instanceof ChapterFailedError || err?.name === 'SourceError') {
    await finish(row, 'FAILED', { stopReason: 'error', statusMessage: err.message, errorChapter: err.chapter ?? null }, ctx);
    return { failed: err.message };
  }
  if (err && typeof err === 'object') err.provider ??= row.provider; // classifyError names the company and the key setting from it
  const decision = err?.status === 429 ? rateLimited(err, state.retriesInARow, row.provider) : classifyError(err, state.retriesInARow, scenes);
  logger.warn({ runId: row.id, action: decision.action, reason: decision.reason, err: err?.message }, 'scenes run stopped by an error');
  if (decision.action === 'fail') {
    await finish(row, 'FAILED', { stopReason: 'error', statusMessage: decision.message }, ctx);
    return { failed: decision.message };
  }
  await pause(ctx, decision, job, token);
  return { paused: decision.reason };
}

/**
 * A 429 from a free tier is the limit of the minute or of the day, not a bill: it passes by itself. (classifyError reads
 * "quota" in the message as lost credit, which for a paid API is right and for this one is not.) The limiter keeps a
 * run under the minute's limits, so this is mostly the day's quota: wait, doubling up to an hour, and ask again.
 */
function rateLimited(err, retriesInARow, provider) {
  const company = providerOf(provider).company;
  const message = `${company} says the limit was reached (requests or tokens a minute, or the day's quota). ${String(err.message).slice(0, 160)}`;
  return retriesInARow < scenes.maxAutoRetries
    ? { action: 'pause', reason: 'rate_limit', message, retryInMs: retryDelayMs(retriesInARow, scenes) }
    : { action: 'pause', reason: 'rate_limit', message: `${message} It has been retried ${retriesInARow} times without writing a chapter; press Resume when the quota is back.` };
}

async function requeue(ctx, job, token, message) {
  const { row } = ctx;
  const resumeAt = new Date(Date.now() + 2_000);
  const next = await runs.update({ where: { id: row.id }, data: { ...ctx.data(), currentChapter: null, status: 'QUEUED', statusMessage: message, resumeAt } });
  service.publishRun(next);
  service.pushFeed(row.id, { kind: 'status', level: 'warn', text: 'The worker is restarting; this run will continue by itself.' });
  await job.moveToDelayed(resumeAt.getTime(), token);
  throw new DelayedError();
}

async function finish(row, status, extra, ctx) {
  const next = await runs.update({
    where: { id: row.id },
    data: { ...(ctx ? ctx.data() : {}), status, finishedAt: new Date(), pauseReason: null, resumeAt: null, currentChapter: null, ...extra },
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
    data: { ...ctx.data(), currentChapter: null, status: 'PAUSED', pauseReason: decision.reason, statusMessage: decision.message, resumeAt },
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
    data: { status: 'FAILED', stopReason: 'error', finishedAt: new Date(), currentChapter: null, statusMessage: `The background job stopped unexpectedly: ${String(err?.message).slice(0, 300)}. Chapters written so far are kept; press Resume to continue.` },
  });
  service.publishRun(next);
  service.pushFeed(runId, { kind: 'status', level: 'error', text: next.statusMessage });
}
