// The worker container.
//
// Runs its own process, in its own Docker container, with no HTTP server. That
// separation is what stops a twenty-minute AI batch pass from competing with
// request handling for the same event loop, and it means the worker can be
// scaled — or restarted — without touching the API.
//
// It also owns the schedule: on boot it registers the repeatable jobs from
// config/cron.js. The API never does, so a rolling deploy of the API cannot
// duplicate or drop a schedule.

import { Worker } from 'bullmq';
import { bullConnection } from '../config/redis.js';
import { QUEUE_NAMES } from '../jobs/index.js';
import { registerSchedules } from '../jobs/schedules.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import logger from '../config/logger.js';

import slokaProcessor from '../jobs/processors/sloka.js';
import notificationProcessor from '../jobs/processors/notification.js';
import preferencesProcessor from '../jobs/processors/preferences.js';
import paymentProcessor from '../jobs/processors/payment.js';
import aiProcessor from '../jobs/processors/ai.js';
import maintenanceProcessor from '../jobs/processors/maintenance.js';

// One processor per queue. The queue name is the key, so worker/ and jobs/
// cannot disagree about which processor runs what.
const processors = {
  sloka: slokaProcessor,
  notification: notificationProcessor,
  preferences: preferencesProcessor,
  payment: paymentProcessor,
  ai: aiProcessor,
  maintenance: maintenanceProcessor,
};

// How many jobs of each kind may run at once.
//
// AI is deliberately 1: the passes are rate-limited by the provider anyway, and
// running several in parallel only means hitting that limit and retrying. The
// notification queue gets the most, because those jobs are short and mostly
// spent waiting on Firebase.
const CONCURRENCY = {
  sloka: 1,
  notification: 5,
  preferences: 1,
  payment: 2,
  ai: 1,
  maintenance: 1,
};

const workers = [];

async function start() {
  await connectDatabase();

  for (const name of QUEUE_NAMES) {
    const worker = new Worker(name, processors[name], {
      connection: bullConnection,
      concurrency: CONCURRENCY[name] || 1,
    });

    worker.on('completed', (job, result) => {
      logger.info({ queue: name, job: job.name, id: job.id, result }, 'job completed');
    });

    worker.on('failed', (job, err) => {
      logger.error(
        { queue: name, job: job?.name, id: job?.id, attempt: job?.attemptsMade, err: err.message },
        'job failed'
      );
    });

    worker.on('error', (err) => {
      logger.error({ queue: name, err: err.message }, 'worker error');
    });

    workers.push(worker);
    logger.info({ queue: name, concurrency: CONCURRENCY[name] }, 'worker started');
  }

  await registerSchedules();
  logger.info('worker ready');
}

// Jobs in flight are allowed to finish. Killing a half-written sloka build
// leaves some users with tomorrow's verse and some without.
async function shutdown(signal) {
  logger.info({ signal }, 'worker shutting down');
  await Promise.all(workers.map((worker) => worker.close()));
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  logger.error({ err }, 'worker failed to start');
  process.exit(1);
});
