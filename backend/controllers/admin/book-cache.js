// Run the weekly book export by hand, and see what it last produced.

import { prisma } from '../../config/database.js';
import { queues, JOBS } from '../../jobs/index.js';
import { runExport } from '../../services/book-cache.js';
import * as audit from '../../services/audit.js';
import { ok } from '../../utils/respond.js';

/**
 * POST /api/admin/book-cache/run
 * Queues the export (the worker runs it), or with `wait: true` runs it right
 * here and returns the report — the way to test a change without a worker.
 */
export const run = async (req, res) => {
  const { books, force, dryRun, wait } = req.valid.body ?? {};
  await audit.record(req, { action: 'book_cache.run', entityType: 'BookCache', after: { books, force, dryRun, wait } });

  if (wait) return ok(res, { report: await runExport({ books, force, dryRun }) });

  const job = await queues.content.add(JOBS.BOOK_CACHE_EXPORT, { books, force, dryRun });
  return ok(res, { queued: true, jobId: job.id });
};

/** GET /api/admin/book-cache — what is exported, per book. */
export const status = async (req, res) => {
  const rows = await prisma.bookCacheUnit.groupBy({
    by: ['bookId', 'unitType'],
    _count: { _all: true },
    _sum: { sizeBytes: true, compressedBytes: true, verseCount: true },
    _max: { updatedAt: true, version: true },
  });
  const books = await prisma.book.findMany({
    where: { id: { in: rows.map((r) => r.bookId) } },
    select: { id: true, slug: true, title: true },
  });
  const byId = new Map(books.map((b) => [b.id, b]));

  return ok(
    res,
    rows.map((r) => ({
      book: byId.get(r.bookId),
      unitType: r.unitType,
      units: r._count._all,
      verses: r._sum.verseCount,
      sizeBytes: r._sum.sizeBytes,
      compressedBytes: r._sum.compressedBytes,
      lastExportedAt: r._max.updatedAt,
      highestVersion: r._max.version,
    }))
  );
};
