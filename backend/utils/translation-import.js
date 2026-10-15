// What importing a translated chapter means, with no database and no storage in it: how a verse in a
// language's chapter file becomes the columns of a VerseTranslation, whether it is the verse the database
// holds, and what differs from the row already there. services/translation-import.js reads and writes;
// this decides. test/translation-import.test.js holds the cases.

import { TRANSLATOR } from '../scripts/lib/claude-translate-source.js';
import { normalizeWordMeanings } from '../scripts/lib/word-meanings.js';

// Text is stored exactly as the file has it; a blank one counts as absent.
const text = (value) => (typeof value === 'string' && value.trim() ? value : null);

const show = (value) => (value == null ? 'empty' : String(value));

/** The word-by-word list as the database keeps it — `[{ word, meaning }]` — without the entries that have no meaning. */
export function cleanWordMeanings(source) {
  return normalizeWordMeanings(source)
    .filter((w) => typeof w?.meaning === 'string' && w.meaning.trim())
    .map((w) => ({ word: text(w.word), meaning: w.meaning }));
}

/**
 * Everything one verse of a language's chapter file says, as the columns of the Prabhupāda TRANSLATION row:
 * the translation (`meaning`), the purport, the verse in this language's script (`transliteration`) and the
 * word-by-word list (`wordMeanings`, null when there is none). `translatedBy` and `version` say which run made
 * it, from the verse's `aiTranslation` (or the translation row's own stamp); both are null for a person's text.
 * Null when the verse has no translation in this language — a purport alone has nowhere to live.
 */
export function rowFromEntry(entry, language) {
  const mine = (entry?.commentaries || []).filter((c) => c.translatorSlug === TRANSLATOR && c.language === language);
  const translation = mine.find((c) => c.type === 'translation');
  const meaning = text(translation?.text);
  if (!meaning) return null;

  const words = cleanWordMeanings(entry.wordMeanings);
  const made = entry.aiTranslation ?? translation;
  return {
    meaning,
    purport: text(mine.find((c) => c.type === 'purport')?.text),
    transliteration: text(entry.transliteration),
    wordMeanings: words.length ? words : null,
    translatedBy: text(made.translatedBy),
    version: text(made.version),
  };
}

/**
 * Is the verse in the file the verse in the database? Found by `verseId`, it must also agree on the book,
 * canto, chapter, verse and last verse of a compound one, and sit in the chapter file it belongs to — so a
 * mis-numbered entry is reported and left alone instead of overwriting another verse's text.
 * → null when they are the same verse, else why not.
 */
export function placeProblem(entry, verse, chapterNumber) {
  const checks = [
    ['book', entry.bookNumber, verse.bookNumber],
    ['canto', entry.cantoNumber ?? null, verse.cantoNumber ?? null],
    ['chapter', entry.chapterNumber, verse.chapterNumber],
    ['verse', entry.verseNumber, verse.verseNumber],
    ['last verse', entry.verseNumberEnd ?? null, verse.verseNumberEnd ?? null],
  ];
  for (const [what, inFile, inDatabase] of checks) {
    if (inFile !== inDatabase) return `${what} is ${show(inFile)} in the file but ${show(inDatabase)} in the database`;
  }
  if (entry.chapterNumber !== chapterNumber) return `it is in the file for chapter ${chapterNumber} but says chapter ${show(entry.chapterNumber)}`;
  return null;
}

/**
 * Why an error stopped a chapter, as a sentence for the page. Prisma's message is the whole failed query, and
 * for a refusal from Postgres the reason is buried in a debug dump of the connector.
 */
export function reasonOf(err) {
  const message = String(err?.message ?? err ?? '').trim();
  const refused = /PostgresError \{ code: "(\w+)", message: "((?:[^"\\]|\\.)*)"/.exec(message);
  if (refused) return `The database refused it: ${refused[2].replace(/\\"/g, '"')} (${refused[1]})`;
  const lines = message.split('\n').map((l) => l.trim()).filter(Boolean);
  return (lines.at(-1) ?? 'Unknown error').slice(0, 300);
}

// jsonb does not keep the order of an object's keys, so lists are compared as pairs. Null and empty are the same.
const wordsKey = (list) => JSON.stringify((Array.isArray(list) ? list : []).map((w) => [w?.word ?? null, w?.meaning ?? '']));

/** The columns of `want` (from `rowFromEntry`) that differ from `row`, the translation row already in the database. */
export function changedColumns(row, want) {
  const changed = [];
  if (row.meaning !== want.meaning) changed.push('meaning');
  if ((row.purport ?? null) !== want.purport) changed.push('purport');
  if ((row.transliteration ?? null) !== want.transliteration) changed.push('transliteration');
  if (wordsKey(row.wordMeanings) !== wordsKey(want.wordMeanings)) changed.push('wordMeanings');
  if ((row.translatedBy ?? null) !== want.translatedBy) changed.push('translatedBy');
  if ((row.version ?? null) !== want.version) changed.push('version');
  return changed;
}

/** One chapter's line in an import's result, before anything is counted. */
export const emptyChapter = (chapter) => ({
  chapter,
  found: true, // false: there is no file for this chapter in this language
  inStorage: 0, // verses in the file that have a translation
  created: 0,
  updated: 0,
  unchanged: 0,
  replacedVisible: 0, // of `updated`, rows readers can already see
  noTranslation: 0, // verses in the file with no translation in this language
  missing: [], // verse ids the file has that the database does not
  conflicts: [], // { verseId, reason } — the file and the database disagree about the verse
  error: null,
});

/** The chapters of an import added up. `versions` counts the verses in storage by the version that made them. */
export function totalsOf(chapters, versions = {}) {
  const sum = (key) => chapters.reduce((n, c) => n + c[key], 0);
  return {
    chapters: chapters.filter((c) => c.found).length,
    inStorage: sum('inStorage'),
    created: sum('created'),
    updated: sum('updated'),
    unchanged: sum('unchanged'),
    replacedVisible: sum('replacedVisible'),
    noTranslation: sum('noTranslation'),
    missing: chapters.reduce((n, c) => n + c.missing.length, 0),
    conflicts: chapters.reduce((n, c) => n + c.conflicts.length, 0),
    failedChapters: chapters.filter((c) => c.error).length,
    versions,
  };
}
