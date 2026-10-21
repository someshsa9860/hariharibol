// Counts what every translated chapter file in S3 holds and saves it in the TranslationProgress table, which is
// what the admin Translations page reads. Resumable: a chapter already counted under the current
// TRANSLATION_VERSION is skipped, so run it again after an interruption. `--all` counts everything again.
//
//   npm run backfill:translation-progress                   both books
//   npm run backfill:translation-progress -- --all          ignore what is counted
//   npm run backfill:translation-progress -- srimad-bhagavatam

import { prisma } from '../config/database.js';
import { BOOK_IDS, bookOf } from './lib/claude-translate-source.js';
import { LANGUAGE_CODES } from './lib/claude-translate-languages.js';
import { currentVersion, syncProgress } from '../services/translation.js';

const args = process.argv.slice(2);
const all = args.includes('--all');
const named = args.filter((a) => !a.startsWith('--'));
const books = named.length ? named : BOOK_IDS;
const unknown = books.filter((b) => !BOOK_IDS.includes(b));
if (unknown.length) throw new Error(`No such book: ${unknown.join(', ')}`);

let version = null;
try {
  version = currentVersion();
} catch {
  /* every chapter is then counted */
}

for (const book of books) {
  let chapters = bookOf(book).chapters;
  if (!all && version) {
    const have = await prisma.translationProgress.findMany({ where: { book, version }, select: { chapter: true } });
    const count = new Map();
    for (const r of have) count.set(r.chapter, (count.get(r.chapter) || 0) + 1);
    chapters = chapters.filter((n) => (count.get(n) || 0) < LANGUAGE_CODES.length);
  }
  console.log(`${book}: counting ${chapters.length} chapter(s)`);
  await syncProgress({ book, chapters, onChapter: (done, total) => done % 10 === 0 && console.log(`  ${done}/${total}`) });
}
console.log('done');
await prisma.$disconnect();
process.exit(0);
