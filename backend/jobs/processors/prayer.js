// Works one admin-started prayer run: `prayer.run` with `{ runId }`.
//
// The same contract as jobs/processors/calendar.js and etiquette.js: the PrayerRun row is the truth and the job is only
// the thing that works it, so a refreshed page or a restarted worker loses nothing; the queue is `attempts: 1` and a
// failure becomes a state of the row (classifyError): paused and retried by itself when it should pass (the provider
// busy, the network), paused until Resume when it needs a person (no credit, a bad key), failed when waiting will not
// mend it (the model keeps giving answers that fail our checks). Everything saved is a PrayerTranslation or
// PrayerVerseTranslation row, so a resumed run starts at the first piece that has none.
//
// A run is for one language. For each prayer that has something to do there it sends a header request (title, summary
// and about; never for English) and then the verses in slices of `prayer.sliceVerses`, each slice carrying only the
// pieces its verses need — the Roman or Tamil-script rendering, the translated meaning, or both. Each answer is checked
// (utils/prayer.js `checkHeader`, `checkAnswer`), the pieces that pass are saved at once and only the rest are asked for
// again, so a resumed run restarts at the first incomplete slice. The app offers a stored script only when every verse
// has it, so a half-done prayer never shows a half-done script. `doneItems` counts finished prayers.

import { DelayedError } from 'bullmq';

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { prayer as cfg } from '../../config/prayer.js';
import * as service from '../../services/prayer.js';
import { createAsk, providerOf } from '../../scripts/lib/translate-providers.js';
import { ConfigError, FINISHED_STATUSES, classifyError } from '../../utils/translation-run.js';
import { HEADER_SCHEMA, SYSTEM_PROMPT, VERSES_SCHEMA, checkAnswer, checkHeader, languageInfo, userPrompt } from '../../utils/prayer.js';

// runId → { controller, reason }: the runs this process is working, so a shutdown or a Cancel can stop them.
const active = new Map();
const runs = prisma.prayerRun;

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
  prayersForRun: service.prayersForRun,
  saveHeader: service.saveHeader,
  saveVerses: service.saveVerses,
};

export default function prayerProcessor(job, token) {
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
      OR: [{ status: 'QUEUED' }, { status: 'RUNNING', heartbeatAt: { gt: new Date(Date.now() - cfg.staleHeartbeatSeconds * 1000) } }, { status: 'PAUSED', resumeAt: { not: null } }],
    },
    select: { id: true },
  });
  if (ahead) {
    await job.moveToDelayed(Date.now() + cfg.sameBookWaitMs, token);
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
  const timer = setInterval(() => ctx.tick(entry).catch((err) => logger.warn({ err: err.message, runId }, 'prayer heartbeat failed')), cfg.heartbeatMs);

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
      .catch((err) => logger.warn({ err: err.message, runId: row.id }, 'prayer progress write failed'));
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
  if (!info) throw new ConfigError(`"${row.language}" is not a language prayers are translated into.`);
  const key = deps.apiKey(row.provider);
  if (!key) throw new ConfigError(`${providerOf(row.provider).keyEnv} is not set on the worker.`);
  const ask = deps.makeAsk({
    provider: row.provider, apiKey: key, model: row.model, signal: entry.controller.signal,
    onWait: (message) => service.pushFeed(row.id, { kind: 'wait', level: 'warn', text: message }),
  });

  // What is left: the total is fixed when the run first starts (so the bar is true after a pause); after that, the
  // prayers that still have something to do.
  const todo = await deps.prayersForRun(row);
  if (state.total === 0) {
    state.total = todo.length;
    await ctx.flush();
  }
  if (todo.length === 0) return { kind: 'finished' };

  for (const { prayer, needs } of todo) {
    if (entry.controller.signal.aborted) return { kind: 'interrupted' };
    state.current = prayer.slug;
    ctx.flush();

    if (needs.header) await writeHeader(ctx, entry, deps, ask, info, prayer, needs.header);
    if (entry.controller.signal.aborted) return { kind: 'interrupted' };
    for (const slice of chunk(needs.verses, cfg.sliceVerses)) {
      if (entry.controller.signal.aborted) return { kind: 'interrupted' };
      await writeVerses(ctx, deps, ask, info, prayer, slice);
    }

    state.done += 1;
    state.retriesInARow = 0; // the run is moving again
    ctx.say('success', `${prayer.title} is done (${state.done} of ${state.total}).`);
    ctx.flush();
  }
  state.current = null;
  return { kind: 'finished' };
}

/**
 * The header: title, and summary and about when the English has them. All or nothing — a header is saved only when every
 * piece asked for passed, so a prayer is never left with a title and no summary (which nothing would ask for again).
 */
async function writeHeader(ctx, entry, deps, ask, info, prayer, wanted) {
  const { row } = ctx;
  const fields = ['title', ...(wanted.summary ? ['summary'] : []), ...(wanted.about ? ['about'] : [])];
  const items = { title: prayer.title, ...(wanted.summary && { summary: prayer.summary }), ...(wanted.about && { about: prayer.about }), ask: fields };
  const user = userPrompt({ kind: 'header', code: row.language, languageName: info.name, endonym: info.endonym, originalLanguage: prayer.originalLanguage, items });
  let problems = [];

  for (let attempt = 1; attempt <= cfg.invalidTries; attempt++) {
    const result = await send(ctx, ask, HEADER_SCHEMA, attempt === 1 ? user : `${user}\n\nYour last answer had these problems; fix them: ${problems.join('; ')}.`);
    const checked = checkHeader(result.data, wanted, row.language);
    if (checked.ok) {
      await deps.saveHeader({ prayerId: prayer.id, language: row.language, header: checked.header, provider: row.provider, runId: row.id });
      ctx.state.retriesInARow = 0;
      ctx.say('success', `${shorten(prayer.title, 60)}: ${fields.join(', ')} written.`);
      ctx.flush();
      return;
    }
    problems = checked.problems;
    ctx.say('warn', `The heading of ${shorten(prayer.title, 60)} did not pass (${problems.slice(0, 2).join('; ')}).${attempt < cfg.invalidTries ? ' Asking again.' : ''}`);
  }
  throw new ItemsFailedError(
    `The heading of "${prayer.title}" could not be written in ${info.name} after ${cfg.invalidTries} tries: ${problems.slice(0, 3).join('; ')}.`,
    [prayer.slug]
  );
}

/**
 * One slice of a prayer's verses. `slice` is `needsOf`'s `[{ verse, rendering, meaning }]`; each verse's `n` is its place
 * in the slice, the same on every ask, so a second ask names the same verses. A piece that passes is saved at once and
 * the verse is not asked for it again; a verse whose rendering passed but whose meaning did not is asked for the meaning only.
 */
async function writeVerses(ctx, deps, ask, info, prayer, slice) {
  const { row } = ctx;
  let pending = slice.map((entry, i) => ({ ...entry, n: i + 1 }));
  let problems = [];

  for (let attempt = 1; attempt <= cfg.invalidTries && pending.length > 0; attempt++) {
    const items = pending.map((p) => ({
      n: p.n,
      ...(p.rendering && { text: p.verse.text }),
      ...(p.meaning && { meaning: p.verse.meaning }),
      ask: [...(p.rendering ? ['rendering'] : []), ...(p.meaning ? ['meaning'] : [])],
    }));
    const user = userPrompt({ kind: 'verses', code: row.language, languageName: info.name, endonym: info.endonym, originalLanguage: prayer.originalLanguage, items });
    const sentAt = new Date(); // a rendering is as old as the moment the words went out, so an edit made meanwhile makes it stale
    const result = await send(ctx, ask, VERSES_SCHEMA, attempt === 1 ? user : `${user}\n\nYour last answer had these problems; fix them: ${problems.join('; ')}.`);

    const checked = checkAnswer(result.data, pending, row.language);
    if (checked.items.length) {
      const byN = new Map(pending.map((p) => [p.n, p]));
      const saved = await deps.saveVerses({
        prayerId: prayer.id, language: row.language, provider: row.provider, runId: row.id, sentAt,
        items: checked.items.map((i) => ({ verseId: byN.get(i.n).verse.id, rendering: i.rendering, meaning: i.meaning })),
      });
      for (const piece of checked.items) {
        const p = byN.get(piece.n);
        if (piece.rendering !== undefined) p.rendering = false;
        if (piece.meaning !== undefined) p.meaning = false;
      }
      pending = pending.filter((p) => p.rendering || p.meaning);
      ctx.state.retriesInARow = 0;
      ctx.say('success', `${shorten(prayer.title, 60)}: ${checked.items.length} verse(s) written (${saved} saved).`);
      ctx.flush();
    }
    if (!checked.ok) {
      problems = checked.problems;
      ctx.say('warn', `The answer did not pass for ${pending.length} verse(s) of ${shorten(prayer.title, 60)} (${problems.slice(0, 2).join('; ')}).${attempt < cfg.invalidTries ? ' Asking again.' : ''}`);
    }
  }
  if (pending.length > 0) {
    throw new ItemsFailedError(
      `${pending.length} verse(s) of "${prayer.title}" could not be written in ${info.name} after ${cfg.invalidTries} tries: ${problems.slice(0, 3).join('; ')}.`,
      [prayer.slug]
    );
  }
}

/** One request to the model, with its tokens counted whether it answered or not. */
async function send(ctx, ask, schema, user) {
  let result;
  try {
    result = await ask({ system: SYSTEM_PROMPT, user, schema, maxTokens: cfg.maxTokens });
  } catch (err) {
    if (err?.usage) await count(ctx, ctx.row, err.usage); // a call that was paid for and gave nothing used the tokens too
    throw err;
  }
  await count(ctx, ctx.row, result.usage);
  return result;
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
  const progress = `${state.done} of ${state.total} prayers`;

  if (entry.reason === 'lost') return { skipped: 'the run was taken over' };
  if (entry.reason === 'cancel') {
    await finish(row, 'CANCELLED', { stopReason: 'cancelled', statusMessage: `Cancelled with ${progress} done.` }, ctx);
    return { cancelled: true };
  }
  if (entry.reason === 'shutdown' || outcome.kind === 'interrupted') {
    return requeue(ctx, job, token, 'The worker restarted; continuing.');
  }

  if (outcome.kind === 'finished') {
    await finish(row, 'COMPLETED', { stopReason: 'finished', statusMessage: `${state.done} prayers done.` }, ctx);
    return { completed: true, items: state.done };
  }

  const err = outcome.error;
  if (err instanceof ItemsFailedError) {
    await finish(row, 'FAILED', { stopReason: 'error', statusMessage: err.message }, ctx);
    return { failed: err.message };
  }
  if (err && typeof err === 'object') err.provider ??= row.provider; // classifyError names the company and the key setting from it
  const decision = classifyError(err, state.retriesInARow, cfg);
  logger.warn({ runId: row.id, action: decision.action, reason: decision.reason, err: err?.message }, 'prayer run stopped by an error');
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
    data: { status: 'FAILED', stopReason: 'error', finishedAt: new Date(), currentSlug: null, statusMessage: `The background job stopped unexpectedly: ${String(err?.message).slice(0, 300)}. What was written so far is kept; press Resume to continue.` },
  });
  service.publishRun(next);
  service.pushFeed(runId, { kind: 'status', level: 'error', text: next.statusMessage });
}
