// Content exports. Today that is one job: the weekly book cache.

import { JOBS } from '../index.js';
import { runExport } from '../../services/book-cache.js';

export default async function contentProcessor(job) {
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
