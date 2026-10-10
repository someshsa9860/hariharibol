// Runs the weekly book export by hand — the same code the cron job runs.
//
//   npm run cache:books                          # export what changed
//   npm run cache:books -- --dry-run             # report only, write nothing
//   npm run cache:books -- --book bhagavad-gita  # one book (repeatable)
//   npm run cache:books -- --force               # re-upload everything, bump versions
//
// With no AWS keys in development the files land in backend/storage/.

import { runExport } from '../services/book-cache.js';
import { disconnectDatabase } from '../config/database.js';
import { redis, publisher } from '../config/redis.js';

const args = process.argv.slice(2);
const books = args.flatMap((a, i) => (a === '--book' ? [args[i + 1]] : []));

try {
  const report = await runExport({ books, dryRun: args.includes('--dry-run'), force: args.includes('--force') });
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.failed > 0 ? 1 : 0;
} finally {
  await disconnectDatabase();
  redis.disconnect();
  publisher.disconnect();
}
