// Works one admin-queued translation import run: `translation-import.run` with `{ runId }`.
//
// The same contract as jobs/processors/translation.js: the TranslationImportRun row is the truth and the
// job is only the thing that works it, so a refreshed page or a restarted worker loses nothing. Unlike a
// translation run there is no provider to wait on and nothing that needs a person: a chapter either copies
// across or its own line in the result says why not (services/translation-import.js already isolates one
// chapter's failure from the rest), so the only outcomes are COMPLETED, FAILED (something broke before the
// per-chapter loop even started — the book or translator missing, storage unreachable) or CANCELLED. The
// queue is `attempts: 1`; onJobFailed below covers BullMQ giving up on the job itself.
//
// One run row and one queue carry two kinds of import: a language's translations (`kind` TRANSLATION, the default)
// and the Bhagavatam's vikara tags (`kind` VIKARA, services/vikara-import.js). They differ only in what is called
// per chapter and how a chapter's line is worded; progress, cancel and the live events are the same.
//
// There is no heartbeat timer: a chapter is a handful of database queries, not a long call to wait out, so
// progress, the heartbeat and the cancel check all happen together in `onChapter`, once per chapter.

import { DelayedError } from 'bullmq';

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { chapterLabel } from '../../scripts/lib/claude-translate-source.js';
import * as service from '../../services/translation-import.js';
import * as vikaras from '../../services/vikara-import.js';
import { IMPORT_KINDS, summaryOf } from '../../utils/translation-import.js';
import { describeVikaraChapter, vikaraSummaryOf } from '../../utils/vikara-import.js';
import { FINISHED_STATUSES } from '../../utils/translation-run.js';

// runId → { controller, reason, done, total }: the runs this process is working, so a shutdown or a Cancel can
// stop them. `done` and `total` are the chapter counts as of the last chapter finished.
const active = new Map();
const runs = prisma.translationImportRun;

/** Everything outside the database the processor reaches for; a test hands in a stand-in. */
export const realDeps = {
  importLanguage: service.importLanguage,
  importVikaras: vikaras.importVikaras,
};

export default function translationImportProcessor(job, token) {
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
    await finish(row, 'CANCELLED', { statusMessage: 'Cancelled before it started.' });
    return { cancelled: true };
  }

  const now = new Date();
  const claimed = await runs.updateMany({
    where: { id: runId, jobId: job.id, status: { in: ['QUEUED', 'RUNNING'] }, cancelRequested: false },
    data: { status: 'RUNNING', startedAt: row.startedAt ?? now, heartbeatAt: now, statusMessage: null },
  });
  if (!claimed.count) return { skipped: 'not claimable' };
  row = await runs.findUnique({ where: { id: runId } });
  service.publishImportRun(row);
  service.pushImportFeed(runId, { kind: 'status', level: 'info', text: 'Started.' });

  const entry = { controller: new AbortController(), reason: null, done: 0, total: 0 };
  active.set(runId, entry);

  let outcome;
  try {
    const hooks = {
      onChapter: (line, done, total) => onChapter({ row, job, entry }, line, done, total),
      shouldStop: () => entry.controller.signal.aborted,
    };
    const result = row.kind === IMPORT_KINDS.VIKARA
      ? await deps.importVikaras({ chapters: row.chapters, ...hooks })
      : await deps.importLanguage({ language: row.language, book: row.book, chapters: row.chapters, publish: row.publish, ...hooks });
    outcome = { kind: 'finished', result };
  } catch (err) {
    outcome = { kind: 'error', error: err };
  } finally {
    active.delete(runId);
  }
  return conclude(row, entry, outcome, job, token);
}

/** After each chapter: write progress, say what happened, and notice a cancel or a takeover. */
async function onChapter({ row, job, entry }, line, done, total) {
  entry.done = done;
  entry.total = total;
  const next = await runs
    .update({ where: { id: row.id }, data: { totalChapters: total, doneChapters: done, currentChapter: line.chapter, heartbeatAt: new Date() } })
    .catch((err) => {
      logger.warn({ err: err.message, runId: row.id }, 'translation import progress write failed');
      return null;
    });
  if (next) service.publishImportRun(next);
  service.pushImportFeed(row.id, row.kind === IMPORT_KINDS.VIKARA ? describeVikaraChapter(line, chapterLabel(line.chapter, row.book)) : describeChapter(line, row.book));
  if (!entry.reason && next) {
    // A row already finished (an admin cancelled a run that only looked stalled) is not this worker's to write any more.
    if (next.jobId !== job.id || FINISHED_STATUSES.includes(next.status)) entry.reason = 'lost';
    else if (next.cancelRequested) entry.reason = 'cancel';
    if (entry.reason) entry.controller.abort();
  }
}

// A Bhagavatam chapter is stored as canto × 100 + chapter; people write it "10.5".
function describeChapter(line, book) {
  const name = `Chapter ${chapterLabel(line.chapter, book)}`;
  if (line.error) return { kind: 'status', level: 'error', text: `${name}: ${line.error}` };
  if (line.found === false) return { kind: 'status', level: 'warn', text: `${name}: no file for this language yet.` };
  const extra = [
    line.missing.length && `${line.missing.length} missing`,
    line.conflicts.length && `${line.conflicts.length} conflicting`,
  ].filter(Boolean).join(', ');
  return { kind: 'status', level: 'info', text: `${name}: ${line.created} created, ${line.updated} updated, ${line.unchanged} unchanged${extra ? `, ${extra}` : ''}.` };
}

/* ---------- what the attempt came to ---------- */

async function conclude(row, entry, outcome, job, token) {
  if (entry.reason === 'lost') return { skipped: 'the run was taken over' };
  if (entry.reason === 'cancel') {
    // A chapter is its own transaction, so the ones done before the cancel stay imported; their lines are kept.
    const partial = outcome.kind === 'finished' ? outcome.result : null;
    await finish(row, 'CANCELLED', {
      statusMessage: `Cancelled after ${entry.done} of ${entry.total} chapter(s); what was imported stays.`,
      ...(partial && { result: partial }),
    });
    return { cancelled: true };
  }
  if (entry.reason === 'shutdown') {
    return requeue(row, job, token, 'The worker restarted; continuing.');
  }

  if (outcome.kind === 'finished') {
    const t = outcome.result.totals;
    await finish(row, 'COMPLETED', { statusMessage: row.kind === IMPORT_KINDS.VIKARA ? vikaraSummaryOf(t) : summaryOf(t), result: outcome.result });
    return { completed: true, totals: t };
  }

  const err = outcome.error;
  const message = err?.expected ? err.message : `Unexpected error: ${String(err?.message ?? err).slice(0, 500)}`;
  logger.warn({ runId: row.id, err: err?.message }, 'translation import run failed');
  await finish(row, 'FAILED', { statusMessage: message });
  return { failed: message };
}

async function requeue(row, job, token, message) {
  const resumeAt = Date.now() + 2_000;
  const next = await runs.update({ where: { id: row.id }, data: { currentChapter: null, status: 'QUEUED', statusMessage: message } });
  service.publishImportRun(next);
  service.pushImportFeed(row.id, { kind: 'status', level: 'warn', text: 'The worker is restarting; this run will continue by itself.' });
  await job.moveToDelayed(resumeAt, token);
  throw new DelayedError();
}

async function finish(row, status, extra) {
  const next = await runs.update({
    where: { id: row.id },
    data: { status, finishedAt: new Date(), currentChapter: null, cancelRequested: false, ...extra },
  });
  service.publishImportRun(next);
  service.pushImportFeed(row.id, { kind: 'status', level: status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'error' : 'info', text: extra.statusMessage });
  return next;
}

/** BullMQ gave up on the job itself: mark the run so it does not sit "running" forever. A fresh import supersedes it. */
export async function onJobFailed(job, err) {
  const runId = job?.data?.runId;
  if (!runId) return;
  const row = await runs.findUnique({ where: { id: runId } });
  if (!row || row.jobId !== job.id || FINISHED_STATUSES.includes(row.status)) return;
  const next = await runs.update({
    where: { id: runId },
    data: { status: 'FAILED', finishedAt: new Date(), currentChapter: null, statusMessage: `The background job stopped unexpectedly: ${String(err?.message).slice(0, 300)}. Start a new import to try again.` },
  });
  service.publishImportRun(next);
  service.pushImportFeed(runId, { kind: 'status', level: 'error', text: next.statusMessage });
}
