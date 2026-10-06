import { SOURCE_SLUG_TO_TRANSLATOR_SLUG } from './translators.js';

/** Maps a source `commentaries[]` entry's type to the schema's TranslationType. */
function rowType(sourceType) {
  return sourceType === 'sanskrit_commentary' ? 'COMMENTARY' : 'TRANSLATION';
}

/**
 * Merges a verse's source `commentaries[]` entries into VerseTranslation rows
 * keyed by translator+language+type, so a "translation" and a "purport" entry
 * — two entries in the source, one row in the schema, on separate columns —
 * land on the same row. Entries from a translator not on the approved list
 * (see translators.js) are counted into `skippedSlugs` and dropped.
 *
 * Returns rows without `verseId` — the caller attaches that once the verse
 * itself has been written and its generated id is known.
 */
function buildTranslationRows(commentaries, translatorBySlug, skippedSlugs) {
  const rowByKey = new Map();

  for (const c of commentaries) {
    const translatorSlug = SOURCE_SLUG_TO_TRANSLATOR_SLUG[c.translatorSlug];
    if (!translatorSlug) {
      skippedSlugs.set(c.translatorSlug, (skippedSlugs.get(c.translatorSlug) || 0) + 1);
      continue;
    }
    const translator = translatorBySlug.get(translatorSlug);
    if (!translator) continue; // approved slug, but not actually seeded yet

    const type = rowType(c.type);
    const key = `${translator.id}|${c.language}|${type}`;
    const row = rowByKey.get(key) || {
      translatorId: translator.id,
      languageCode: c.language,
      type,
      meaning: null,
      purport: null,
    };
    if (c.type === 'purport') row.purport = c.text;
    else row.meaning = c.text;
    rowByKey.set(key, row);
  }

  return [...rowByKey.values()];
}

export { buildTranslationRows };
