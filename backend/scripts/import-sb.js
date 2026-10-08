// Imports Srimad Bhagavatam: cantos 1-12, Prabhupada's translation. Cantos
// 1-9 have no Devanagari in the source; cantos 10-12 do. See scripts/README.md
// for the source bucket and credentials this needs.
//
// Idempotent and resumable — run it again any time. A re-run also corrects
// existing rows whose text differs from the source (see lib/import-verses.js).
// SOURCE_LOCAL_DIR (see lib/source-s3.js) reads a local copy instead of S3. Canto rows themselves are not created
// here — they are standing content structure, seeded ahead of time — this
// only fills in their chapters and verses.
//
// The verse counts on chapters, cantos and the book are not taken from the
// source files — they are rebuilt from the rows at the end (services/book-counts.js),
// so a file with a missing or wrong `meta.totalVerses` cannot put a zero on screen.

import { prisma } from '../config/database.js';
import { recountBook } from '../services/book-counts.js';
import { getJson, listKeys } from './lib/source-s3.js';
import { SOURCE_SLUG_TO_TRANSLATOR_SLUG } from './lib/translators.js';
import { buildTranslationRows } from './lib/commentaries.js';
import { normalizeWordMeanings } from './lib/word-meanings.js';
import { writeVerses } from './lib/import-verses.js';

const BOOK_NUMBER = 2;
const SOURCE_PREFIX = 'json/srimad-bhagavatam/en/';
const KEY_PATTERN = /c(\d+)-ch-(\d+)\.json$/;

async function run() {
  const book = await prisma.book.findUnique({ where: { bookNumber: BOOK_NUMBER } });
  if (!book) throw new Error('Srimad Bhagavatam book row not found — run the prisma seed first.');

  const cantos = await prisma.canto.findMany({ where: { bookId: book.id } });
  const cantoByNumber = new Map(cantos.map((c) => [c.number, c]));

  const translators = await prisma.translator.findMany({
    where: { slug: { in: Object.values(SOURCE_SLUG_TO_TRANSLATOR_SLUG) } },
  });
  const translatorBySlug = new Map(translators.map((t) => [t.slug, t]));

  const keys = (await listKeys(SOURCE_PREFIX))
    .map((key) => {
      const match = key.match(KEY_PATTERN);
      return match ? { key, canto: Number(match[1]), chapter: Number(match[2]) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.canto - b.canto || a.chapter - b.chapter);

  const skippedSlugs = new Map();
  let versesWritten = 0;
  let translationsWritten = 0;
  let versesUpdated = 0;
  let translationsUpdated = 0;
  let filesDone = 0;

  for (const { key, canto: cantoNumber, chapter: chapterNumber } of keys) {
    const canto = cantoByNumber.get(cantoNumber);
    if (!canto) {
      console.warn(`No Canto ${cantoNumber} row seeded — skipping ${key}`);
      continue;
    }

    const data = await getJson(key);
    // Titles come from vedabase via scripts/repair-verse-source.js; a source
    // without one keeps a plain positional name.
    const title = data.meta.chapterName || `Canto ${cantoNumber}, Chapter ${chapterNumber}`;

    const chapter = await prisma.chapter.upsert({
      where: {
        bookId_cantoNumber_number: { bookId: book.id, cantoNumber, number: chapterNumber },
      },
      update: { title },
      create: {
        bookId: book.id,
        cantoId: canto.id,
        cantoNumber,
        number: chapterNumber,
        title,
      },
    });

    const verseRows = [];
    const translationsByVerseId = new Map();

    for (const v of data.verses) {
      verseRows.push({
        verseId: v.verseId,
        bookId: book.id,
        bookNumber: BOOK_NUMBER,
        cantoNumber,
        chapterId: chapter.id,
        chapterNumber,
        verseNumber: v.verseNumber,
        verseNumberEnd: v.verseNumberEnd,
        sanskrit: v.sanskrit || null,
        transliteration: v.transliteration || null,
        wordMeanings: normalizeWordMeanings(v.wordMeanings),
      });

      translationsByVerseId.set(
        v.verseId,
        buildTranslationRows(v.commentaries || [], translatorBySlug, skippedSlugs)
      );
    }

    const result = await writeVerses(verseRows, translationsByVerseId);
    versesWritten += result.versesWritten;
    translationsWritten += result.translationsWritten;
    versesUpdated += result.versesUpdated;
    translationsUpdated += result.translationsUpdated;
    filesDone += 1;
    if (filesDone % 20 === 0 || filesDone === keys.length) {
      console.log(`${filesDone}/${keys.length} files — canto ${cantoNumber}, chapter ${chapterNumber}`);
    }
  }

  // Counts on every chapter, canto and the book — computed from the rows that are
  // there now, not accumulated in place.
  const recounted = await recountBook(book.id);
  await prisma.book.update({ where: { id: book.id }, data: { isPublished: true } });
  console.log(`\nCounts rebuilt: ${recounted.chapters} chapters, ${recounted.cantos} cantos${recounted.book ? ' and the book' : ''} updated.`);

  console.log(`Done. ${versesWritten} verses, ${translationsWritten} new translations; corrected ${versesUpdated} verses and ${translationsUpdated} translations.`);
  if ((await prisma.story.count({ where: { bookId: book.id } })) === 0) {
    console.log('No stories yet — run `npm run seed` again; they point at the chapters imported just now.');
  }
  if (skippedSlugs.size > 0) {
    console.log('Skipped (not on the approved Vaishnav-sampradaya list):');
    for (const [slug, count] of skippedSlugs) console.log(`  ${slug}: ${count}`);
  }
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
