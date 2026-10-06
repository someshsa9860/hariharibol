// Registers the repeatable jobs declared in config/cron.js.
//
// These are BullMQ repeatable jobs rather than OS crontabs, so a machine going
// away does not take a schedule with it — the schedule lives in Redis and any
// worker can pick it up.
//
// Called by the worker on boot. Registration is idempotent: BullMQ keys a
// repeatable job by name and pattern, so restarting the worker replaces the
// entry rather than adding a second one. Schedules removed from config/cron.js
// are cleared here too, or they would keep firing forever with nothing left in
// the code that mentions them.

import { queues } from './index.js';
import { schedules } from '../config/cron.js';
import logger from '../config/logger.js';

async function registerSchedules() {
  const wanted = new Set(schedules.map((entry) => entry.name));

  for (const entry of schedules) {
    const queue = queues[entry.queue];
    if (!queue) {
      logger.error({ schedule: entry.name, queue: entry.queue }, 'schedule names an unknown queue');
      continue;
    }

    await queue.add(
      entry.name,
      { scheduled: true },
      { repeat: { pattern: entry.cron, tz: 'UTC' }, jobId: entry.name }
    );

    logger.info({ job: entry.name, cron: entry.cron, queue: entry.queue }, 'schedule registered');
  }

  // Anything still repeating that is no longer declared.
  for (const name of Object.keys(queues)) {
    const existing = await queues[name].getRepeatableJobs();
    for (const job of existing) {
      if (wanted.has(job.name)) continue;
      await queues[name].removeRepeatableByKey(job.key);
      logger.warn({ job: job.name, queue: name }, 'removed a schedule no longer in config/cron.js');
    }
  }
}

export { registerSchedules };
