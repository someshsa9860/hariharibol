// The weekly book export, in one place: where files go, how each book is cut
// into units, and when it runs. Everything the export, the manifest endpoint and
// the download endpoint must agree on is here so they cannot drift.

import env from './env.js';

// Bumped when the JSON shape changes. It is part of the hashed body, so every
// unit is re-exported on the next run after a bump, and the app can refuse a
// file newer than it understands.
const SCHEMA_VERSION = 1;

// How a book is cut into files. Keyed by book slug. A scripture that is not
// listed is cut by whatever it has — canto if it has cantos, else chapter — so a
// new book needs no entry here unless it should be cut differently. Short works
// (no chapters) are not exported: the API already returns them in one call.
const UNIT_TYPES = {
  'bhagavad-gita': 'chapter',
  'srimad-bhagavatam': 'canto',
};

const UNIT_FILE_PREFIX = { chapter: 'chapter', canto: 'canto' };

// Trailing slash stripped, so `books/caches/` and `books/caches` mean the same.
const PREFIX = env.BOOK_CACHE_PREFIX.replace(/^\/+|\/+$/g, '');

// Uploads are staged here and copied into place, so a reader never sees a
// partial file. Deliberately NOT under PREFIX: nothing under PREFIX is ever
// deleted, and the staging copy is.
const STAGING_PREFIX = 'books/staging';

const bookCache = {
  enabled: env.BOOK_CACHE_ENABLED,
  cron: env.BOOK_CACHE_CRON,
  tz: env.BOOK_CACHE_TZ,
  prefix: PREFIX,
  stagingPrefix: STAGING_PREFIX,
  manifestKey: `${PREFIX}/manifest.json`,
  schemaVersion: SCHEMA_VERSION,
  downloadTtlSeconds: env.BOOK_CACHE_DOWNLOAD_TTL_SECONDS,
  // Units exported at once. Each holds a whole canto in memory, so keep it small.
  concurrency: 2,
  // In-process retries per unit, before the queue's own attempts take over.
  retries: 3,
  retryBaseMs: 1000,
  // A run holds this lock; it is renewed while running and expires on its own
  // if the process dies.
  lockKey: 'lock:book-cache:export',
  lockTtlMs: 10 * 60 * 1000,
};

const unitFileKey = (bookSlug, unitType, number) =>
  `${PREFIX}/${bookSlug}/${UNIT_FILE_PREFIX[unitType]}-${number}.json`;

export { bookCache, SCHEMA_VERSION, UNIT_TYPES, UNIT_FILE_PREFIX, unitFileKey };
