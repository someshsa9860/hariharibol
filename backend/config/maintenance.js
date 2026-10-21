// The only commands the admin panel's Maintenance page can run. Each one is a
// script already in package.json — the page never receives a command line, only
// one of these ids, so there is nothing to inject into.
//
// Add a script here on purpose, one at a time. Leave out anything that needs
// dev dependencies (the production image installs without them, so
// `prisma migrate` is not available there) or that is not safe to run twice.

export const maintenance = {
  /** A run longer than this is killed. */
  timeoutMs: 15 * 60 * 1000,
  /** Output kept for the page; the oldest lines go first. */
  maxOutputBytes: 256 * 1024,
  /** Finished runs remembered since the API started (the audit log keeps the rest). */
  keepRuns: 10,

  commands: [
    { id: 'seed', script: 'seed', title: 'Seed reference data', description: 'Roles, permissions, books and other standard rows. Safe to run again; run it after a release that adds permissions.' },
    { id: 'seed-panchang', script: 'seed:panchang', title: 'Seed the Hindu calendar', description: 'Works out and saves 2026’s days and festivals.' },
    { id: 'recount-books', script: 'recount:books', title: 'Recount book verses', description: 'Rebuilds the verse counts on books, cantos and chapters from the rows.' },
    { id: 'cache-books', script: 'cache:books', title: 'Export the offline books', description: 'Rebuilds the weekly book export the app downloads.' },
    { id: 'backfill-sampradaya', script: 'backfill:sampradaya', title: 'Backfill sampradaya', description: 'Fills the sampradaya on existing rows that lack one.' },
    { id: 'fill-status', script: 'fill:status', title: 'Show fill status', description: 'Reports how much of the Prabhupāda source text is filled. Reads only.' },
  ],
};
