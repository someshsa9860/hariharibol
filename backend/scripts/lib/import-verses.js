import { prisma } from '../../config/database.js';

/**
 * Writes one chapter's verses and their translations in a handful of batched
 * calls rather than one round trip per verse — the difference between a few
 * seconds and several minutes at Srimad Bhagavatam's scale (~7,300 verses).
 * `skipDuplicates` is what makes re-running after a kill safe: rows already
 * written are left alone rather than erroring or duplicating.
 *
 * @param {object[]} verses - Verse.createMany rows (verseId, bookId,
 *   bookNumber, cantoNumber, chapterId, chapterNumber, verseNumber,
 *   verseNumberEnd, sanskrit, transliteration, wordMeanings, tags).
 * @param {Map<string, object[]>} translationsByVerseId - source verseId →
 *   VerseTranslation rows minus `verseId` (translatorId, languageCode, type,
 *   meaning, purport). Built by the caller, since merging commentaries across
 *   source files differs between books.
 */
async function writeVerses(verses, translationsByVerseId) {
  if (verses.length === 0) return { versesWritten: 0, translationsWritten: 0 };

  await prisma.verse.createMany({
    data: verses.map((v) => ({ type: 'SHLOKA', ...v })),
    skipDuplicates: true,
  });

  // createMany does not return the created rows, and the translations need
  // the generated cuid, not the human verseId — one lookup for the whole
  // chapter rather than one per verse.
  const rows = await prisma.verse.findMany({
    where: { verseId: { in: verses.map((v) => v.verseId) } },
    select: { id: true, verseId: true },
  });
  const idByVerseId = new Map(rows.map((r) => [r.verseId, r.id]));

  const translationRows = [];
  for (const [verseId, translations] of translationsByVerseId) {
    const id = idByVerseId.get(verseId);
    if (!id) continue; // the verse itself did not resolve — nothing to attach to
    for (const t of translations) {
      if (!t.meaning) continue; // a purport with no translation has nowhere to live
      translationRows.push({ verseId: id, isPublished: true, ...t });
    }
  }

  if (translationRows.length > 0) {
    await prisma.verseTranslation.createMany({ data: translationRows, skipDuplicates: true });
  }

  return { versesWritten: rows.length, translationsWritten: translationRows.length };
}

export { writeVerses };
