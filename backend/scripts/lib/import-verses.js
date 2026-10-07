import { prisma } from '../../config/database.js';

const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Writes one chapter's verses and their translations in a handful of batched
 * calls rather than one round trip per verse — the difference between a few
 * seconds and several minutes at Srimad Bhagavatam's scale (~13,000 verses).
 *
 * Safe to re-run, and a re-run *corrects* what is already there: new rows are
 * created, and an existing verse or translation whose text differs from the
 * source is updated, so a repaired source file reaches rows imported from the
 * old one. Only what the source has is written — a source with no Sanskrit for
 * a verse never blanks Sanskrit already stored. The one deliberate exception
 * is a translation's purport, which is set to null when the source has none
 * (that is how the "There is no purport for this verse" placeholder goes).
 *
 * @param {object[]} verses - Verse rows (verseId, bookId, bookNumber,
 *   cantoNumber, chapterId, chapterNumber, verseNumber, verseNumberEnd,
 *   sanskrit, transliteration, wordMeanings, tags).
 * @param {Map<string, object[]>} translationsByVerseId - source verseId →
 *   VerseTranslation rows minus `verseId` (translatorId, languageCode, type,
 *   meaning, purport). Built by the caller, since merging commentaries across
 *   source files differs between books.
 */
async function writeVerses(verses, translationsByVerseId) {
  if (verses.length === 0) return { versesWritten: 0, translationsWritten: 0, versesUpdated: 0, translationsUpdated: 0 };

  await prisma.verse.createMany({
    data: verses.map((v) => ({ type: 'SHLOKA', ...v })),
    skipDuplicates: true,
  });

  // createMany does not return the created rows, and the translations need
  // the generated cuid, not the human verseId — one lookup for the whole
  // chapter rather than one per verse.
  const rows = await prisma.verse.findMany({
    where: { verseId: { in: verses.map((v) => v.verseId) } },
    select: { id: true, verseId: true, sanskrit: true, transliteration: true, wordMeanings: true, verseNumberEnd: true },
  });
  const existingByVerseId = new Map(rows.map((r) => [r.verseId, r]));

  let versesUpdated = 0;
  for (const v of verses) {
    const row = existingByVerseId.get(v.verseId);
    if (!row) continue;
    const data = {};
    if (v.sanskrit && v.sanskrit !== row.sanskrit) data.sanskrit = v.sanskrit;
    if (v.transliteration && v.transliteration !== row.transliteration) data.transliteration = v.transliteration;
    if (v.wordMeanings && !sameJson(v.wordMeanings, row.wordMeanings)) data.wordMeanings = v.wordMeanings;
    if (Object.keys(data).length > 0) {
      await prisma.verse.update({ where: { id: row.id }, data });
      versesUpdated += 1;
    }
  }

  const existingTranslations = await prisma.verseTranslation.findMany({
    where: { verseId: { in: rows.map((r) => r.id) } },
    select: { id: true, verseId: true, translatorId: true, languageCode: true, type: true, meaning: true, purport: true },
  });
  const keyOf = (t) => `${t.verseId}|${t.translatorId}|${t.languageCode}|${t.type}`;
  const existingByKey = new Map(existingTranslations.map((t) => [keyOf(t), t]));

  const toCreate = [];
  let translationsUpdated = 0;
  for (const [verseId, translations] of translationsByVerseId) {
    const id = existingByVerseId.get(verseId)?.id;
    if (!id) continue; // the verse itself did not resolve — nothing to attach to
    for (const t of translations) {
      if (!t.meaning) continue; // a purport with no translation has nowhere to live
      const found = existingByKey.get(keyOf({ verseId: id, ...t }));
      if (!found) {
        toCreate.push({ verseId: id, isPublished: true, ...t });
      } else if (found.meaning !== t.meaning || (found.purport ?? null) !== (t.purport ?? null)) {
        await prisma.verseTranslation.update({
          where: { id: found.id },
          data: { meaning: t.meaning, purport: t.purport ?? null },
        });
        translationsUpdated += 1;
      }
    }
  }

  if (toCreate.length > 0) {
    await prisma.verseTranslation.createMany({ data: toCreate, skipDuplicates: true });
  }

  return { versesWritten: rows.length, translationsWritten: toCreate.length, versesUpdated, translationsUpdated };
}

export { writeVerses };
