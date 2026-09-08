const { createRouter, z } = require('../../utils/router');
const controller = require('../../controllers/admin/job');

const router = createRouter({
  tag: 'Admin · Jobs',
  prefix: '/jobs',
  description:
    'Background queues. Job state lives in Redis rather than in a table — two records of the ' +
    'same thing drift, and the queue is the one that decides what actually runs.',
});

const queueName = z.enum(['sloka', 'notification', 'preferences', 'payment', 'ai', 'maintenance']);

// '/run/:name' is registered before '/:queue/...' so a queue named "run" could
// not shadow it.

router.post(
  '/run/:name',
  {
    summary: 'Run a scheduled job now',
    description:
      'For a schedule missed while the worker was down, and for testing a change without ' +
      'waiting a day to see it. The job name must be one declared in config/cron.js.',
    permission: 'job.manage',
    limit: 'write',
    params: z.object({ name: z.string().min(1).max(100) }),
    body: z.object({}).passthrough().optional(),
    responds: { 200: 'The queued job id', 400: 'Unknown scheduled job' },
  },
  controller.runNow
);

router.get(
  '/',
  {
    summary: 'Get queue counts and the schedule',
    permission: 'job.manage',
    limit: 'read',
    responds: { 200: 'Counts per queue, and the cron schedule that feeds them' },
  },
  controller.overview
);

router.get(
  '/:queue/failed',
  {
    summary: 'List failed jobs',
    description: 'With the reason and the top of the stack — the rest is in the logs.',
    permission: 'job.manage',
    limit: 'read',
    params: z.object({ queue: queueName }),
    responds: { 200: 'Failed jobs', 404: 'No such queue' },
  },
  controller.failed
);

router.delete(
  '/:queue/failed',
  {
    summary: 'Clear the failed list',
    permission: 'job.manage',
    limit: 'write',
    params: z.object({ queue: queueName }),
    responds: { 200: 'How many were cleared' },
  },
  controller.clearFailed
);

router.post(
  '/:queue/:jobId/retry',
  {
    summary: 'Retry a failed job',
    permission: 'job.manage',
    limit: 'write',
    params: z.object({ queue: queueName, jobId: z.string().min(1) }),
    responds: { 200: 'Retried', 404: 'No such queue or job' },
  },
  controller.retry
);

module.exports = router;
