import { bookCache } from './book-cache.js';

// Every scheduled job in the system, declared in one list.
//
// These are BullMQ repeatable jobs, not OS crontabs — the worker container adds
// them on boot (see jobs/schedules.js) so a machine going away does not take a
// schedule with it. Times are UTC; jobs that must respect a user's own clock
// read `User.timezone` themselves rather than being scheduled per zone.

// How often the sloka push looks for readers whose delivery time has come. The
// delivery time is a half-hour mark (04:30), so this has to divide the hour; the
// job reads it too, to know how wide "now" is.
const SLOKA_DELIVERY_STEP_MINUTES = 30;

const schedules = [
  {
    name: 'sloka.build',
    queue: 'sloka',
    // 18:00 UTC = 23:30 IST — the next day's slokas are picked before anyone in
    // the main audience wakes up.
    cron: '0 18 * * *',
    description: 'Pick tomorrow’s global sloka and every user’s personal sloka.',
  },
  {
    name: 'sloka.deliver',
    queue: 'sloka',
    // Every half hour: each run pushes to the users whose local delivery time
    // (default 04:30) fell in the last half hour.
    cron: `*/${SLOKA_DELIVERY_STEP_MINUTES} * * * *`,
    description: 'Push the day’s sloka to users whose local delivery time has arrived.',
  },
  {
    name: 'sadhana.reminder',
    queue: 'notification',
    cron: '*/15 * * * *',
    description: 'Send chanting reminders due in the next quarter hour.',
  },
  {
    name: 'preferences.rebuild',
    queue: 'preferences',
    // Monday 20:00 UTC, after the week has closed everywhere.
    cron: '0 20 * * 1',
    description: 'Rebuild UserPreferenceProfile from the last 8 weeks of activity.',
  },
  {
    name: 'entitlement.sweep',
    queue: 'payment',
    cron: '30 0 * * *',
    description: 'Expire lapsed subscriptions and rebuild the isPremium cache.',
  },
  {
    name: 'chant.transcripts.prune',
    queue: 'maintenance',
    cron: '15 2 * * *',
    description: 'Delete chant speech transcripts past their 7-day expiry.',
  },
  {
    name: 's3.temp.prune',
    queue: 'maintenance',
    // 1st of the month, 04:00 UTC.
    cron: '0 4 1 * *',
    description: 'Delete uploads left in temp/ for over a month — files nobody ever saved.',
  },
  // Optional `tz` (default UTC). Off with BOOK_CACHE_ENABLED=false.
  ...(bookCache.enabled
    ? [
        {
          name: 'book.cache.export',
          queue: 'content',
          cron: bookCache.cron,
          tz: bookCache.tz,
          description:
            'Export every book to books/caches/ on S3 as one JSON per chapter or canto — only the ones that changed.',
        },
        {
          name: 'book.cache.sync',
          queue: 'content',
          cron: bookCache.syncCron,
          description:
            'Export any book whose text changed since its last export (Book.contentVersion ahead of exportedVersion) ' +
            'once its writes have gone quiet — so an import reaches phones in minutes, not at the next weekly run.',
        },
      ]
    : []),
  {
    name: 'ai.credits.maintain',
    queue: 'maintenance',
    cron: '15 * * * *',
    description:
      'Renew Ask Sakha credit wallets whose period has ended and drop old daily-usage rows. (The daily cap ' +
      'itself resets at each user’s local midnight by date, with no job.)',
  },
  {
    name: 'audit.prune',
    queue: 'maintenance',
    cron: '0 3 * * 0',
    description: 'Drop audit rows and AI usage logs older than the retention window.',
  },
];

// How long finished jobs stay inspectable in Redis.
const retention = {
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  ...retention,
};

export { schedules, retention, defaultJobOptions, SLOKA_DELIVERY_STEP_MINUTES };
