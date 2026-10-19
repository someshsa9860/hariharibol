// Content exports: the weekly book cache, and the minute-by-minute look for a book that has changed since.

import { JOBS } from '../index.js';
import { runExport, exportStaleBooks } from '../../services/book-cache.js';

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
  throw new Error(`Unknown content job: ${job.name}`);
}
