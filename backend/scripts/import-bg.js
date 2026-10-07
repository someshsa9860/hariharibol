// Imports the Bhagavad Gita: all 18 chapters, Sanskrit, Prabhupada's
// translation and purport, three Sanskrit commentaries (Ramanuja, Madhva,
// Sridhara Swami), and Dnyaneshwari's Marathi ovis. See scripts/README.md for
// the source bucket and credentials this needs, and lib/translators.js for
// why only these commentators are imported.
//
// Idempotent and resumable — run it again any time. A re-run also corrects
// existing rows whose text differs from the source (see lib/import-verses.js).
// SOURCE_LOCAL_DIR (see lib/source-s3.js) reads a local copy instead of S3.

import { prisma } from '../config/database.js';
import { getJson } from './lib/source-s3.js';
import { SOURCE_SLUG_TO_TRANSLATOR_SLUG } from './lib/translators.js';
import { buildTranslationRows } from './lib/commentaries.js';
import { normalizeWordMeanings } from './lib/word-meanings.js';
import { writeVerses } from './lib/import-verses.js';

const BOOK_NUMBER = 1;
const CHAPTER_COUNT = 18;

async function run() {
  const book = await prisma.book.findUnique({ where: { bookNumber: BOOK_NUMBER } });
  if (!book) throw new Error('Bhagavad Gita book row not found — run the prisma seed first.');

  const translators = await prisma.translator.findMany({
    where: { slug: { in: Object.values(SOURCE_SLUG_TO_TRANSLATOR_SLUG) } },
  });
  const translatorBySlug = new Map(translators.map((t) => [t.slug, t]));
  const dnyaneshwar = translatorBySlug.get('dnyaneshwar');

  const skippedSlugs = new Map();
  let versesWritten = 0;
  let translationsWritten = 0;
  let versesUpdated = 0;
  let translationsUpdated = 0;

  for (let chapterNumber = 1; chapterNumber <= CHAPTER_COUNT; chapterNumber++) {
    const [sa, en, dnyaneshwari] = await Promise.all([
      getJson(`json/bhagavat-gita/sa/ch-${chapterNumber}.json`),
      getJson(`json/bhagavat-gita/en/ch-${chapterNumber}.json`),
      getJson(`json/dnyaneshwari/mr/ch-${chapterNumber}.json`).catch(() => null),
    ]);

    // Prisma's generated compound-unique `where` refuses a null value for
    // cantoNumber (and Postgres would not have enforced uniqueness through it
    // anyway — NULL is never equal to NULL), so BG's canto-less chapters are
    // found by a plain query and upserted by hand instead of `.upsert()`.
    // The English chapter title (from vedabase, see repair-bg-source.js) goes
    // beside the Sanskrit `title`, keeping any other language already there.
    const titleI18n = (current) => (en.meta.chapterTitleEn ? { ...(current || {}), en: en.meta.chapterTitleEn } : current ?? undefined);
    const existingChapter = await prisma.chapter.findFirst({
      where: { bookId: book.id, cantoNumber: null, number: chapterNumber },
    });
    const chapter = existingChapter
      ? await prisma.chapter.update({
          where: { id: existingChapter.id },
          data: { title: sa.meta.chapterName, titleI18n: titleI18n(existingChapter.titleI18n), totalVerses: sa.verses.length },
        })
      : await prisma.chapter.create({
          data: {
            bookId: book.id,
            cantoId: null,
            cantoNumber: null,
            number: chapterNumber,
            title: sa.meta.chapterName,
            titleI18n: titleI18n(null),
            totalVerses: sa.verses.length,
          },
        });

    const enByVerseId = new Map(en.verses.map((v) => [v.verseId, v]));
    const dnyByVerseId = new Map((dnyaneshwari?.verseMappings || []).map((m) => [m.verseId, m]));

    const verseRows = [];
    const translationsByVerseId = new Map();

    for (const v of sa.verses) {
      verseRows.push({
        verseId: v.verseId,
        bookId: book.id,
        bookNumber: BOOK_NUMBER,
        cantoNumber: null,
        chapterId: chapter.id,
        chapterNumber,
        verseNumber: v.verseNumber,
        verseNumberEnd: v.verseNumberEnd,
        sanskrit: v.sanskrit || null,
        transliteration: v.transliteration || null,
        wordMeanings: normalizeWordMeanings(v.wordMeanings),
      });

      const merged = [...(v.commentaries || []), ...(enByVerseId.get(v.verseId)?.commentaries || [])];
      const rows = buildTranslationRows(merged, translatorBySlug, skippedSlugs);

      const mapping = dnyByVerseId.get(v.verseId);
      if (mapping?.ovis?.length && dnyaneshwar) {
        rows.push({
          translatorId: dnyaneshwar.id,
          languageCode: 'mr',
          type: 'POETIC_EXPANSION',
          meaning: mapping.ovis.map((o) => o.text).join('\n'),
          purport: null,
        });
      }

      translationsByVerseId.set(v.verseId, rows);
    }

    const result = await writeVerses(verseRows, translationsByVerseId);
    versesWritten += result.versesWritten;
    translationsWritten += result.translationsWritten;
    versesUpdated += result.versesUpdated;
    translationsUpdated += result.translationsUpdated;
    console.log(`Chapter ${chapterNumber}/${CHAPTER_COUNT}: ${result.versesWritten} verses`);
  }

  const totalVerses = await prisma.verse.count({ where: { bookId: book.id } });
  await prisma.book.update({
    where: { id: book.id },
    data: { totalChapters: CHAPTER_COUNT, totalVerses, isPublished: true },
  });

  console.log(`\nDone. ${versesWritten} verses, ${translationsWritten} new translations; corrected ${versesUpdated} verses and ${translationsUpdated} translations.`);
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
