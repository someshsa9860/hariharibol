// Background jobs — what is queued, what failed, and running one by hand.
//
// BullMQ keeps job state in Redis, not in Postgres, so there is no QueueJob
// table to read. That is deliberate: two records of the same thing drift, and
// the queue is the one that decides what actually runs.

const { queues, QUEUE_NAMES } = require('../../jobs');
const { schedules } = require('../../config/cron');
const audit = require('../../services/audit');
const { ok } = require('../../utils/respond');
const { badRequest, notFound } = require('../../utils/errors');

/** GET /api/admin/jobs — counts per queue, and the schedule that feeds them. */
exports.overview = async (req, res) => {
  const counts = await Promise.all(
    QUEUE_NAMES.map(async (name) => ({
      queue: name,
      counts: await queues[name].getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
    }))
  );

  return ok(res, {
    queues: counts,
    schedules: schedules.map((entry) => ({
      name: entry.name,
      queue: entry.queue,
      cron: entry.cron,
      description: entry.description,
    })),
  });
};

/** GET /api/admin/jobs/:queue/failed — the failure list, with reasons. */
exports.failed = async (req, res) => {
  const { queue } = req.valid.params;
  if (!queues[queue]) throw notFound('Queue');

  const jobs = await queues[queue].getFailed(0, 50);

  return ok(
    res,
    jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      // The top of the stack is enough to tell one failure from another; the
      // whole thing is in the logs.
      stack: job.stacktrace?.[0]?.split('\n').slice(0, 3).join('\n'),
      failedAt: job.finishedOn,
    }))
  );
};

/** POST /api/admin/jobs/:queue/:jobId/retry */
exports.retry = async (req, res) => {
  const { queue, jobId } = req.valid.params;
  if (!queues[queue]) throw notFound('Queue');

  const job = await queues[queue].getJob(jobId);
  if (!job) throw notFound('Job');

  await job.retry();
  await audit.record(req, { action: 'job.retry', entityType: 'Job', entityId: jobId, after: { queue } });

  return ok(res, { retried: true });
};

/**
 * POST /api/admin/jobs/run/:name
 * Runs a scheduled job now, rather than waiting for its cron. For a schedule
 * that was missed while the worker was down, and for testing a change to one
 * without waiting a day to see it.
 */
exports.runNow = async (req, res) => {
  const { name } = req.valid.params;

  const schedule = schedules.find((entry) => entry.name === name);
  if (!schedule) throw badRequest(`Unknown scheduled job: ${name}`);

  const job = await queues[schedule.queue].add(schedule.name, {
    manual: true,
    requestedBy: req.auth.user.id,
    ...req.valid.body,
  });

  await audit.record(req, {
    action: 'job.run',
    entityType: 'Job',
    entityId: job.id,
    after: { name, queue: schedule.queue },
  });

  return ok(res, { jobId: job.id, queue: schedule.queue, queued: true });
};

/** DELETE /api/admin/jobs/:queue/failed — clear the failure list once it is dealt with. */
exports.clearFailed = async (req, res) => {
  const { queue } = req.valid.params;
  if (!queues[queue]) throw notFound('Queue');

  const cleared = await queues[queue].clean(0, 1000, 'failed');
  return ok(res, { cleared: cleared.length });
};
