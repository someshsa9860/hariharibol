// Content jobs: the weekly book cache export, the minute-by-minute look for a book that has changed since, and a
// reader's own mantra translated into more languages.

import { JOBS } from '../index.js';
import { runExport, exportStaleBooks } from '../../services/book-cache.js';
import { translateMissing } from '../../services/user-mantra.js';

export default async function contentProcessor(job) {
  if (job.name === JOBS.BOOK_CACHE_SYNC) {
    // Nothing to do almost every minute; a failure is logged by the export and tried again after a pause,
    // so it does not fail the job (a failing repeatable job every minute is only noise).
    return exportStaleBooks();
  }
  if (job.name === JOBS.BOOK_CACHE_EXPORT) {
    const report = await runExport({
      books: job.data?.books,
      force: Boolean(job.data?.force),
      dryRun: Boolean(job.data?.dryRun),
    });
    // A unit that failed every retry fails the job so the queue's own backoff
    // tries the whole run again; units already done are skipped by their hash.
    if (report.failed > 0) {
      throw new Error(`${report.failed} unit(s) failed: ${report.failures.map((f) => f.unit).join(', ')}`);
    }
    return report;
  }
  if (job.name === JOBS.MANTRA_TRANSLATE) {
    // A reader's own mantra, written out in more languages (services/user-mantra.js). Another run holding the
    // mantra is a reason to come back, not a failure to keep: the queue's backoff tries it again.
    const report = await translateMissing(job.data.mantraId, job.data.languages);
    if (report.busy) throw new Error(`mantra ${job.data.mantraId} is being translated by another run`);
    return report;
  }
  throw new Error(`Unknown content job: ${job.name}`);
}
