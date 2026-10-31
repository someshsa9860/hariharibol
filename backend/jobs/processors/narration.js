// Works one admin-started narration run: `narration.run` with `{ runId }`.
//
// The same contract as jobs/processors/scenes.js: the NarrationRun row is the truth and the job is only the thing that
// works it, so a refreshed page or a restarted worker loses nothing. The queue is `attempts: 1` and a failure becomes a
// state of the row (classifyNarrationError): paused and retried by itself when it should pass (the engine busy, the
// network), paused until Resume when it needs a person (no billing, a bad key), failed when waiting will not mend it.
//
// A verse the engine refuses is counted and the run goes on; a target refused maxFailedInARow times in a row is stopped.
// A verse that already has a clip made from the same text is not sent again (its hash says so), so a resumed run starts
// at the first verse that is not in S3. Each voice's _index.json is rebuilt from the clip rows when an attempt ends.

import { DelayedError } from 'bullmq';

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { engines, narration } from '../../config/narration.js';
import * as service from '../../services/narration.js';
import { synthesize } from '../../services/narration-engines.js';
import { chapterLabel } from '../../scripts/lib/claude-translate-source.js';
import { createLimiter } from '../../utils/scenes.js';
import { audioSeconds, classifyNarrationError, clipStands, joinWav, splitForEngine, targetKey, textHash } from '../../utils/narration.js';
import { ConfigError, FINISHED_STATUSES } from '../../utils/translation-run.js';

// runId → { controller, reason }: the runs this process is working, so a shutdown or a Cancel can stop them.
const active = new Map();
const runs = prisma.narrationRun;

/** Everything outside the database the processor reaches for; a test hands in stand-ins. */
export const realDeps = {
  keyMissing: service.keyMissing,
  source: service.loadNarrationSource,
  existingClips: service.existingClips,
  putClip: service.putClip,
  writeIndex: service.writeIndex,
  synthesize,
  // The engine's own requests-a-minute limit. Its character price is not a limit, so no token budget applies.
  limiter: (engine) => createLimiter({ rpm: engines[engine].rpm, tpm: Infinity }),
};

export default function narrationProcessor(job, token) {
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

  // Runs go in the order they were made: an earlier one that is waiting, working, or paused to try again by itself comes
  // first, and this one looks again soon. (One paused for a person does not hold the queue up.)
  const ahead = await runs.findFirst({
    where: {
      id: { not: runId }, createdAt: { lt: row.createdAt },
      OR: [{ status: 'QUEUED' }, { status: 'RUNNING', heartbeatAt: { gt: new Date(Date.now() - narration.staleHeartbeatSeconds * 1000) } }, { status: 'PAUSED', resumeAt: { not: null } }],
    },
    select: { id: true },
  });
  if (ahead) {
    await job.moveToDelayed(Date.now() + narration.sameBookWaitMs, token);
    throw new DelayedError();
  }

  const now = new Date();
  const claimed = await runs.updateMany({
    where: { id: runId, jobId: job.id, status: { in: ['QUEUED', 'PAUSED', 'RUNNING'] }, cancelRequested: false },
    data: { status: 'RUNNING', startedAt: row.startedAt ?? now, heartbeatAt: now, attempts: { increment: 1 }, pauseReason: null, statusMessage: null, resumeAt: null, stopReason: null, errorVerse: null },
  });
  if (!claimed.count) return { skipped: 'not claimable' };
  row = await runs.findUnique({ where: { id: runId } });
  service.publishRun(row);
  service.pushFeed(runId, { kind: 'status', level: 'info', text: row.attempts > 1 ? `Continuing (attempt ${row.attempts}).` : 'Started.' });

  const ctx = makeContext(row, job);
  const entry = { controller: new AbortController(), reason: null };
  active.set(runId, entry);
  const timer = setInterval(() => ctx.tick(entry).catch((err) => logger.warn({ err: err.message, runId }, 'narration heartbeat failed')), narration.heartbeatMs);

  let outcome;
  try {
    outcome = await execute(ctx, entry, deps);
  } catch (err) {
    outcome = { kind: 'error', error: err };
  } finally {
    clearInterval(timer);
    active.delete(runId);
  }
  if (entry.reason !== 'lost') await rebuildIndexes(ctx, deps);
  await ctx.settle();
  return conclude(ctx, entry, outcome, job, token);
}

/* ---------- the working state of one attempt ---------- */

function makeContext(row, job) {
  const state = {
    total: row.totalVerses, done: row.doneVerses, skipped: row.skippedVerses, failed: row.failedVerses, current: row.currentVerse,
    errorVerse: null, results: row.results || [],
    characters: row.characters, audioSeconds: row.audioSeconds, calls: row.calls, activeSeconds: row.activeSeconds, retriesInARow: row.retriesInARow,
  };
  let writing = Promise.resolve();
  let lastBeat = Date.now();
  let ticking = false;

  const data = () => ({
    totalVerses: state.total, doneVerses: state.done, skippedVerses: state.skipped, failedVerses: state.failed, currentVerse: state.current,
    characters: state.characters, audioSeconds: state.audioSeconds, calls: state.calls, activeSeconds: Math.round(state.activeSeconds),
    retriesInARow: state.retriesInARow, results: state.results, heartbeatAt: new Date(),
  });

  const flush = () => {
    writing = writing
      .then(() => runs.update({ where: { id: row.id }, data: data() }))
      .then((next) => service.publishRun(next))
      .catch((err) => logger.warn({ err: err.message, runId: row.id }, 'narration progress write failed'));
    return writing;
  };

  return {
    row, job, state,
    // The voices this attempt wrote to, by target key, so each one's index is rebuilt when the attempt ends.
    touched: new Map(),
    flush, data,
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
const aborted = (entry) => entry.controller.signal.aborted;

// The voices to make: one for a narration run, one per target for a comparison.
function targetsOf(row) {
  if (row.kind === 'COMPARE') return row.targets || [];
  return [{ engine: row.engine, model: row.model, voice: row.voice }];
}

// One cell per target. The counts are this attempt's; the characters and seconds are kept from earlier attempts, since
// the cost is what was paid across all of them.
function startResults(row, targets) {
  const before = new Map((Array.isArray(row.results) ? row.results : []).map((cell) => [cell.key, cell]));
  return targets.map((target) => {
    const key = targetKey(target);
    const prev = before.get(key);
    return {
      key, engine: target.engine, model: target.model, voice: target.voice,
      done: 0, skipped: 0, failed: 0, stopped: false, error: null,
      characters: prev?.characters ?? 0, seconds: prev?.seconds ?? 0,
    };
  });
}

async function execute(ctx, entry, deps) {
  const { row, state } = ctx;
  const targets = targetsOf(row);
  const noKey = targets.find((target) => deps.keyMissing(target.engine));
  if (noKey) throw new ConfigError(`${engines[noKey.engine].keyEnv} is not set on the worker.`);

  // Every verse is read before the first clip is made, so the total is true from the start. The chapters are read again on
  // every attempt: a corrected translation should count, and the texts are small.
  const only = row.verseIds?.length ? new Set(row.verseIds) : null;
  const language = narration.languages[row.language]?.label ?? row.language;
  const sources = [];
  for (const chapterId of row.chapters) {
    const source = await deps.source(row.book, chapterId, row.language);
    const ref = chapterLabel(chapterId, row.book);
    sources.push({
      chapterId, ref, chapterName: source.chapterName,
      verses: only ? source.verses.filter((verse) => only.has(verse.verseId)) : source.verses,
    });
    if (!only && source.missing.length) ctx.say('warn', `Chapter ${ref}: ${source.missing.length} verse(s) have no ${language} text and are left out.`, { chapter: chapterId });
  }
  const verseCount = sources.reduce((n, source) => n + source.verses.length, 0);
  if (verseCount === 0) throw new service.SourceError(`No verse in the chosen chapters has ${language} text yet.`, null);

  // The counts are this attempt's: a clip made before is counted again as skipped, because it is still in S3.
  state.total = targets.length * verseCount;
  state.done = 0;
  state.skipped = 0;
  state.failed = 0;
  state.errorVerse = null;
  state.results = startResults(row, targets);
  await ctx.flush();

  const stopped = [];
  for (const target of targets) {
    const label = `${engines[target.engine].label} (${target.voice})`;
    const store = { book: row.book, language: row.language, engine: target.engine, model: target.model, voice: target.voice };
    const cell = state.results.find((r) => r.key === targetKey(target));
    ctx.touched.set(targetKey(target), store);
    const limiter = deps.limiter(target.engine);
    let units = 0;
    let streak = 0;

    targetLoop: for (const source of sources) {
      const clips = await deps.existingClips(store, source.verses.map((verse) => verse.verseId));
      for (const verse of source.verses) {
        if (aborted(entry)) return { kind: 'interrupted' };
        units += 1;
        const hash = textHash({ text: verse.text, language: row.language, engine: target.engine, model: target.model, voice: target.voice });
        if (clipStands(clips.get(verse.verseId), hash, { force: row.force, since: row.startedAt })) {
          state.skipped += 1;
          cell.skipped += 1;
          streak = 0;
          continue;
        }

        state.current = verse.verseId;
        ctx.flush();
        try {
          await makeClip(ctx, deps, { entry, row, target, store, limiter, cell, chapterId: source.chapterId, verse, hash });
          state.done += 1;
          cell.done += 1;
          streak = 0;
          state.retriesInARow = 0; // the run is moving again
        } catch (err) {
          if (aborted(entry)) return { kind: 'interrupted' };
          const decision = classifyNarrationError(err, state.retriesInARow, narration);
          if (decision.action !== 'fail') throw err; // the attempt stops; conclude() pauses or fails the run
          // The engine refused this verse. Counted, and the run goes on to the next one.
          state.failed += 1;
          cell.failed += 1;
          cell.error = decision.message;
          state.errorVerse = verse.verseId;
          streak += 1;
          ctx.say('error', `${label}, verse ${verse.ref}: ${decision.message}`, { verseId: verse.verseId });
          if (streak >= narration.maxFailedInARow) {
            const rest = verseCount - units;
            state.failed += rest;
            cell.failed += rest;
            cell.stopped = true;
            stopped.push(label);
            ctx.say('error', `${label} stopped after ${streak} verses in a row were refused; its other ${rest} verse(s) are not made.`);
            break targetLoop;
          }
        } finally {
          state.current = null;
        }
      }
    }
    ctx.flush();
  }
  return { kind: 'finished', stopped };
}

/**
 * One verse in one voice: the text is cut to what the engine takes, each piece is sent (paced by the engine's requests a
 * minute), the audio is joined and stored with its clip row. Each piece is counted as soon as the engine answers, so a clip
 * that fails after it still shows what it cost.
 */
async function makeClip(ctx, deps, { entry, row, target, store, limiter, cell, chapterId, verse, hash }) {
  const { state } = ctx;
  const parts = [];
  let characters = 0;
  for (const piece of splitForEngine(verse.text, engines[target.engine].maxBytes)) {
    const sent = await limiter.acquire(0, {
      signal: entry.controller.signal,
      onWait: (ms) => ctx.say('info', `Waiting ${words(ms)} to stay under ${engines[target.engine].label}'s requests a minute limit.`),
    });
    limiter.settle(sent, 0);
    const pieceCharacters = [...piece].length;
    parts.push(await deps.synthesize({ ...target, language: row.language }, piece, { signal: entry.controller.signal }));
    characters += pieceCharacters;
    state.calls += 1;
    state.characters += pieceCharacters;
    cell.characters += pieceCharacters;
  }

  const { ext, contentType } = parts[0];
  const audio = ext === 'wav' ? joinWav(parts.map((part) => part.audio)) : Buffer.concat(parts.map((part) => part.audio));
  const seconds = audioSeconds(audio, ext);
  await deps.putClip({
    target: store, chapterId, verseNumber: verse.verseNumber, verseId: verse.verseId, audio, contentType, ext, seconds, characters, hash, runId: row.id,
  });
  state.audioSeconds += seconds;
  cell.seconds += seconds;
  ctx.flush();
}

/** Each voice this attempt touched gets its _index.json rebuilt from the clip rows, so the index matches the clips after a pause too. */
async function rebuildIndexes(ctx, deps) {
  for (const store of ctx.touched.values()) {
    await deps.writeIndex(store).catch((err) => ctx.say('warn', `The index of a voice could not be written: ${err.message}. It is written again when the next attempt finishes.`));
  }
}

/* ---------- what the attempt came to ---------- */

async function conclude(ctx, entry, outcome, job, token) {
  const { row, state } = ctx;
  const made = `${state.done} clips made, ${state.skipped} already there, ${state.failed} not made`;

  if (entry.reason === 'lost') return { skipped: 'the run was taken over' };
  if (entry.reason === 'cancel') {
    await finish(row, 'CANCELLED', { stopReason: 'cancelled', statusMessage: `Cancelled: ${made}.` }, ctx);
    return { cancelled: true };
  }
  if (entry.reason === 'shutdown' || outcome.kind === 'interrupted') {
    return requeue(ctx, job, token, 'The worker restarted; continuing.');
  }

  if (outcome.kind === 'finished') {
    // A narration run has one voice: if that one is stopped the run has failed. A comparison goes on with its other voices.
    if (outcome.stopped.length && row.kind !== 'COMPARE') {
      await finish(row, 'FAILED', { stopReason: 'error', errorVerse: state.errorVerse, statusMessage: `Stopped: the engine refused ${narration.maxFailedInARow} verses in a row. ${made}.` }, ctx);
      return { failed: 'stopped after repeated refusals' };
    }
    const note = outcome.stopped.length ? ` ${outcome.stopped.join(', ')} stopped after repeated refusals.` : '';
    await finish(row, 'COMPLETED', { stopReason: 'finished', errorVerse: state.errorVerse, statusMessage: `${made}.${note}` }, ctx);
    return { completed: true, done: state.done };
  }

  const err = outcome.error;
  if (err instanceof service.SourceError || err?.name === 'SourceError') {
    await finish(row, 'FAILED', { stopReason: 'error', statusMessage: err.message }, ctx);
    return { failed: err.message };
  }
  const decision = classifyNarrationError(err, state.retriesInARow, narration);
  logger.warn({ runId: row.id, action: decision.action, reason: decision.reason, err: err?.message }, 'narration run stopped by an error');
  if (decision.action === 'fail') {
    await finish(row, 'FAILED', { stopReason: 'error', errorVerse: state.errorVerse, statusMessage: decision.message }, ctx);
    return { failed: decision.message };
  }
  await pause(ctx, decision, job, token);
  return { paused: decision.reason };
}

async function requeue(ctx, job, token, message) {
  const { row } = ctx;
  const resumeAt = new Date(Date.now() + 2_000);
  const next = await runs.update({ where: { id: row.id }, data: { ...ctx.data(), currentVerse: null, status: 'QUEUED', statusMessage: message, resumeAt } });
  service.publishRun(next);
  service.pushFeed(row.id, { kind: 'status', level: 'warn', text: 'The worker is restarting; this run will continue by itself.' });
  await job.moveToDelayed(resumeAt.getTime(), token);
  throw new DelayedError();
}

async function finish(row, status, extra, ctx) {
  const next = await runs.update({
    where: { id: row.id },
    data: { ...(ctx ? ctx.data() : {}), status, finishedAt: new Date(), pauseReason: null, resumeAt: null, currentVerse: null, ...extra },
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
    data: { ...ctx.data(), currentVerse: null, status: 'PAUSED', pauseReason: decision.reason, statusMessage: decision.message, resumeAt },
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
    data: { status: 'FAILED', stopReason: 'error', finishedAt: new Date(), currentVerse: null, statusMessage: `The background job stopped unexpectedly: ${String(err?.message).slice(0, 300)}. Clips made so far are kept; press Resume to continue.` },
  });
  service.publishRun(next);
  service.pushFeed(runId, { kind: 'status', level: 'error', text: next.statusMessage });
}
