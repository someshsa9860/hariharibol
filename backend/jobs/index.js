// The queues.
//
// Six of them rather than one, because they fail differently and should not
// block each other: an AI batch pass that takes twenty minutes must not sit in
// front of a chanting reminder, and a payment retry storm must not delay the
// morning slokas.
//
// This file only *declares* the queues. The API container adds jobs to them;
// the worker container consumes them (worker/index.js). Both require this file,
// which is what keeps the queue names from being typed twice.

import { Queue } from 'bullmq';
import { bullConnection } from '../config/redis.js';
import { defaultJobOptions } from '../config/cron.js';

const QUEUE_NAMES = ['sloka', 'notification', 'preferences', 'payment', 'ai', 'maintenance'];

const queues = Object.fromEntries(
  QUEUE_NAMES.map((name) => [
    name,
    new Queue(name, { connection: bullConnection, defaultJobOptions }),
  ])
);

// Job names, so the producer and the processor cannot disagree about a string.
const JOBS = {
  SLOKA_BUILD: 'sloka.build',
  SLOKA_DELIVER: 'sloka.deliver',
  SADHANA_REMINDER: 'sadhana.reminder',
  PREFERENCES_REBUILD: 'preferences.rebuild',
  ENTITLEMENT_SWEEP: 'entitlement.sweep',
  AUDIT_PRUNE: 'audit.prune',
  AI_ISSUE_MAP: 'issue-map',
  AI_EXPLANATIONS: 'explanations',
};

async function closeQueues() {
  await Promise.all(Object.values(queues).map((queue) => queue.close()));
}

export { queues, QUEUE_NAMES, JOBS, closeQueues };
