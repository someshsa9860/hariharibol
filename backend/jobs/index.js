// The queues.
//
// Eight of them rather than one, because they fail differently and should not
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

const QUEUE_NAMES = ['sloka', 'notification', 'preferences', 'payment', 'ai', 'maintenance', 'content', 'translation', 'translation-import', 'scenes', 'etiquette', 'quote', 'calendar', 'prayer', 'marketing', 'devops'];

// A queue that needs different job options than the default says so here. A translation run is hours
// long and costs money, so BullMQ never retries it by itself: the processor decides what a failure
// means (jobs/processors/translation.js) and the TranslationRun row records it.
const QUEUE_JOB_OPTIONS = {
  translation: { attempts: 1 },
  'translation-import': { attempts: 1 }, // same reasoning: jobs/processors/translation-import.js decides what a failure means
  scenes: { attempts: 1 }, // same reasoning: jobs/processors/scenes.js decides what a failure means
  etiquette: { attempts: 1 }, // and jobs/processors/etiquette.js
  quote: { attempts: 1 }, // and jobs/processors/quote.js
  calendar: { attempts: 1 }, // and jobs/processors/calendar.js
  prayer: { attempts: 1 }, // and jobs/processors/prayer.js
  marketing: { attempts: 1 }, // and jobs/processors/marketing.js: a campaign is the row, a retry would be a second send
};

const queues = Object.fromEntries(
  QUEUE_NAMES.map((name) => [
    name,
    new Queue(name, { connection: bullConnection, defaultJobOptions: { ...defaultJobOptions, ...QUEUE_JOB_OPTIONS[name] } }),
  ])
);

// Job names, so the producer and the processor cannot disagree about a string.
const JOBS = {
  SLOKA_BUILD: 'sloka.build',
  SLOKA_DELIVER: 'sloka.deliver',
  SADHANA_REMINDER: 'sadhana.reminder',
  FESTIVAL_PLAN: 'festival.plan',
  FESTIVAL_NOTIFY: 'festival.notify',
  FINANCE_REMIND: 'finance.remind',
  PREFERENCES_REBUILD: 'preferences.rebuild',
  ENTITLEMENT_SWEEP: 'entitlement.sweep',
  SUBSCRIPTION_RECONCILE: 'subscription.reconcile',
  PAYMENT_FX_BACKFILL: 'payment.fx.backfill',
  AUDIT_PRUNE: 'audit.prune',
  AI_CREDITS_MAINTAIN: 'ai.credits.maintain',
  CHANT_TRANSCRIPTS_PRUNE: 'chant.transcripts.prune',
  S3_TEMP_PRUNE: 's3.temp.prune',
  BOOK_CACHE_EXPORT: 'book.cache.export',
  BOOK_CACHE_SYNC: 'book.cache.sync',
  MANTRA_TRANSLATE: 'mantra.translate',
  AI_ISSUE_MAP: 'issue-map',
  AI_EXPLANATIONS: 'explanations',
  TRANSLATION_RUN: 'translation.run',
  TRANSLATION_IMPORT_RUN: 'translation-import.run',
  SCENES_RUN: 'scenes.run',
  ETIQUETTE_RUN: 'etiquette.run',
  ETIQUETTE_DELIVER: 'etiquette.deliver',
  QUOTE_RUN: 'quote.run',
  CALENDAR_RUN: 'calendar.run',
  PRAYER_RUN: 'prayer.run',
  MARKETING_RUN: 'marketing.run',
  MARKETING_TICK: 'marketing.tick',
};

async function closeQueues() {
  await Promise.all(Object.values(queues).map((queue) => queue.close()));
}

export { queues, QUEUE_NAMES, JOBS, closeQueues };
