// Rebuilds the verse / chapter / canto counts on books from the rows that are
// really there (services/book-counts.js). Safe to run any time: it writes only
// what is wrong, and a healthy database comes back "all counts correct".
//
//   npm run recount:books                 every book
//   npm run recount:books -- --dry-run    say what would change, write nothing
//   npm run recount:books -- bhagavad-gita srimad-bhagavatam   just these slugs
//
// For a database whose counts drifted — rows imported before the importers
// recounted, or inserted by hand. On the server:
//   docker compose exec api node scripts/recount-books.js --dry-run

import { prisma } from '../config/database.js';
import { recountBook } from '../services/book-counts.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const slugs = args.filter((arg) => !arg.startsWith('--'));
const SHOWN = 12; // corrections listed per book before "and N more"

async function run() {
  const books = await prisma.book.findMany({
    where: slugs.length > 0 ? { slug: { in: slugs } } : {},
    orderBy: { bookNumber: 'asc' },
  });

  const unknown = slugs.filter((slug) => !books.some((book) => book.slug === slug));
  if (unknown.length > 0) throw new Error(`No such book: ${unknown.join(', ')}`);

  let wrong = 0;
  for (const book of books) {
    const result = await recountBook(book.id, { dryRun });
    if (result.changes.length === 0) continue;

    wrong += 1;
    console.log(`${book.slug}: ${result.chapters} chapters, ${result.cantos} cantos${result.book ? ' and the book itself' : ''} ${dryRun ? 'are wrong' : 'corrected'}`);
    for (const line of result.changes.slice(0, SHOWN)) console.log(`  ${line}`);
    if (result.changes.length > SHOWN) console.log(`  … and ${result.changes.length - SHOWN} more`);
  }

  if (wrong === 0) console.log(`All counts correct (${books.length} books checked).`);
  else if (dryRun) console.log('\nDry run — nothing was written. Run again without --dry-run to correct them.');
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
