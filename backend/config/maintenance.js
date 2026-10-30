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
    { id: 'seed-etiquette', script: 'seed:etiquette', title: 'Seed the devotee etiquette', description: 'Adds the English etiquette items that are missing; items an admin has edited are left as they are. Safe to run again.' },
    { id: 'seed-prayers', script: 'seed:prayers', title: 'Seed the prayers', description: 'Adds the prayers from the seed files that are not in the database yet, as drafts: nothing is published. A prayer already there is left as it is, verses and all. Safe to run again.' },
    { id: 'recount-books', script: 'recount:books', title: 'Recount book verses', description: 'Rebuilds the verse counts on books, cantos and chapters from the rows.' },
    { id: 'translate-chapter-titles', script: 'translate:chapter-titles', title: 'Translate chapter titles', description: 'Has the translation provider write the Bhagavatam’s chapter titles in every reading language, only where a chapter has none. Needs the chapters imported and the provider key. A run is stopped after 15 minutes; run it again to carry on, then export the offline books.' },
    { id: 'cache-books', script: 'cache:books', title: 'Export the offline books', description: 'Rebuilds the weekly book export the app downloads.' },
    { id: 'backfill-sampradaya', script: 'backfill:sampradaya', title: 'Backfill sampradaya', description: 'Fills the sampradaya on existing rows that lack one.' },
    { id: 'backfill-translation-progress', script: 'backfill:translation-progress', title: 'Count translations from storage', description: 'Fills the table the Translations page reads from the translated chapter files in S3. Run it once after the release that adds the table; safe to run again, it skips chapters already counted. (The page’s Recount button does the same for one book.)' },
    { id: 'fill-status', script: 'fill:status', title: 'Show fill status', description: 'Reports how much of the Prabhupāda source text is filled. Reads only.' },
  ],
};
