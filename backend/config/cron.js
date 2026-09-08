// Every scheduled job in the system, declared in one list.
//
// These are BullMQ repeatable jobs, not OS crontabs — the worker container adds
// them on boot (see jobs/schedules.js) so a machine going away does not take a
// schedule with it. Times are UTC; jobs that must respect a user's own clock
// read `User.timezone` themselves rather than being scheduled per zone.

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
    // Hourly: each run pushes to the users whose local delivery hour it now is.
    cron: '0 * * * *',
    description: 'Push the day’s sloka to users whose local delivery hour has arrived.',
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

module.exports = { schedules, retention, defaultJobOptions };
