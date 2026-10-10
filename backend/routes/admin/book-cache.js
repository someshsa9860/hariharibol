import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/book-cache.js';

const router = createRouter({
  tag: 'Admin · Book cache',
  prefix: '/book-cache',
  description: 'The weekly export of book text to S3 that the app downloads for offline reading.',
});

router.post(
  '/run',
  {
    summary: 'Run the book export now',
    description:
      'Queues the export for the worker, or with `wait: true` runs it in this request and ' +
      'returns the report (units checked, created, changed, skipped, failed, bytes uploaded). ' +
      '`dryRun` reports what would change without writing; `force` re-uploads every unit. ' +
      'A run already in progress elsewhere returns `locked: true` and does nothing.',
    permission: 'job.manage',
    limit: 'write',
    body: z
      .object({
        books: z.array(z.string().min(1).max(100)).max(50).optional().describe('Book slugs; all when omitted'),
        force: z.boolean().optional(),
        dryRun: z.boolean().optional(),
        wait: z.boolean().optional(),
      })
      .optional(),
    responds: { 200: 'The queued job id, or the finished report' },
  },
  controller.run
);

router.get(
  '/',
  {
    summary: 'See what has been exported',
    permission: 'job.manage',
    limit: 'read',
    responds: { 200: 'Per book: units, verses, sizes and the newest export time' },
  },
  controller.status
);

export default router;
