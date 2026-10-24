// Reads the English Gita from the source bucket (or SOURCE_LOCAL_DIR) and turns each verse
// into a translation unit: Prabhupāda's English translation and purport, the verse's Roman
// transliteration and its word-by-word list — nothing else.
// Also: how many languages fit in one call, and what a run is expected to cost.

import { createHash } from 'node:crypto';

import { language } from './claude-translate-languages.js';
import { normalizeWordMeanings } from './word-meanings.js';
import { wordCount } from './claude-translate-validate.js';
import { PARTS, partInputWords, partOutputWords, partsOf } from './claude-translate-parts.js';

export const BOOK = 'bhagavat-gita';
export const CHAPTERS = Array.from({ length: 18 }, (_, i) => i + 1);
export const TRANSLATOR = 'prabhupada';

// The books that can be translated. A chapter is named by one integer, its `id`: the Gita's is the chapter
// number (1–18); the Bhagavatam's is canto × 100 + chapter (canto 10, chapter 47 → 1047), so it still fits the
// run's `chapters Int[]` and no id of one book can be mistaken for the other's.
const SB_CHAPTERS_PER_CANTO = [19, 10, 33, 31, 26, 19, 15, 24, 24, 90, 31, 13]; // 335 in all

export const BOOKS = {
  'bhagavat-gita': {
    id: 'bhagavat-gita',
    folder: 'bhagavat-gita',
    title: 'Bhagavad-gītā',
    bookNumber: 1,
    // The word-by-word list is in the Sanskrit chapter file (`sa/`), not the English one.
    hasSanskritFile: true,
    chapters: CHAPTERS,
  },
  'srimad-bhagavatam': {
    id: 'srimad-bhagavatam',
    folder: 'srimad-bhagavatam',
    title: 'Śrīmad-Bhāgavatam',
    bookNumber: 2,
    // One file per chapter holds everything: `en/c<canto>-ch-<n>.json`.
    hasSanskritFile: false,
    chapters: SB_CHAPTERS_PER_CANTO.flatMap((count, i) => Array.from({ length: count }, (_, c) => (i + 1) * 100 + c + 1)),
  },
};

export const BOOK_IDS = Object.keys(BOOKS);

export function bookOf(id = BOOK) {
  const book = BOOKS[id];
  if (!book) throw new Error(`Unknown book "${id}" — use ${BOOK_IDS.join(' or ')}`);
  return book;
}

/** `{ canto, chapter }` of a chapter id: the Gita has no canto (null). */
export function chapterParts(id, book = BOOK) {
  return bookOf(book).id === 'srimad-bhagavatam' ? { canto: Math.floor(id / 100), chapter: id % 100 } : { canto: null, chapter: id };
}

/** The book a verse id belongs to: the Gita's start "1.", the Bhagavatam's "2." (its book number). */
export function bookOfVerseId(verseId) {
  const number = Number(String(verseId).split('.')[0]);
  const book = Object.values(BOOKS).find((b) => b.bookNumber === number);
  if (!book) throw new Error(`"${verseId}" is not a verse of a book that can be translated`);
  return book.id;
}

/** The chapter id of a verse id: "1.2.47" → 2 (Gita), "2.10.47.3" → 1047 (Bhagavatam). */
export function chapterIdOfVerse(verseId) {
  const parts = String(verseId).split('.').map(Number);
  return bookOfVerseId(verseId) === 'srimad-bhagavatam' ? parts[1] * 100 + parts[2] : parts[1];
}

/** How people write a chapter: "2" for the Gita, "10.47" for the Bhagavatam. */
export function chapterLabel(id, book = BOOK) {
  const { canto, chapter } = chapterParts(id, book);
  return canto ? `${canto}.${chapter}` : String(chapter);
}

/** The file name of a chapter inside a language's folder: `ch-2.json`, `c10-ch-47.json`. */
export function chapterFile(id, book = BOOK) {
  const { canto, chapter } = chapterParts(id, book);
  return canto ? `c${canto}-ch-${chapter}.json` : `ch-${chapter}.json`;
}

/** Word-by-word list of a verse: [{ word, meaning }] — the word in Roman letters, the meaning in English. */
function wordMeaningsOf(saVerse) {
  return normalizeWordMeanings(saVerse?.wordMeanings)
    .filter((w) => typeof w?.meaning === 'string' && w.meaning.trim())
    .map((w) => ({ word: (w.word || '').trim(), meaning: w.meaning.trim() }));
}

/** The verse in Roman letters, one entry per line of the verse ("sañjaya uvāca ."). */
function transliterationOf(saVerse, enVerse) {
  const text = [saVerse?.transliteration, enVerse?.transliteration].find((t) => typeof t === 'string' && t.trim());
  return text ? text.split(/\n/).map((l) => l.trim()).filter(Boolean) : [];
}

/**
 * English chapter file (+ the Sanskrit chapter file, which carries the word-by-word list) → units.
 * A verse with no Prabhupāda translation is listed in `skipped`. From the Sanskrit file only the word
 * list, the Roman transliteration and the Devanagari verse are read — the Devanagari is kept in the unit for
 * the vikara tag file and is never sent to a model — and only Prabhupāda's rows are taken from the
 * commentaries (never Sivananda's or anyone else's).
 */
export function unitsFromChapter(chapterFile, saChapterFile = null, bookId = BOOK) {
  const hasSanskritFile = bookOf(bookId).hasSanskritFile;
  const saById = new Map((saChapterFile?.verses || []).map((v) => [v.verseId, v]));
  const units = [];
  const skipped = [];
  for (const verse of chapterFile.verses || []) {
    // The Gita files also carry Sivananda's text under the same verse; never send it.
    const rows = (verse.commentaries || []).filter((c) => c.translatorSlug === TRANSLATOR && c.language === 'en');
    const translation = rows.find((c) => c.type === 'translation')?.text?.trim();
    const purportText = rows.find((c) => c.type === 'purport')?.text?.trim();
    if (!translation) {
      skipped.push({ verseId: verse.verseId, reason: 'no Prabhupāda translation in the source' });
      continue;
    }
    const purport = purportText ? purportText.split(/\n+/).map((p) => p.trim()).filter(Boolean) : [];
    units.push({
      verseId: verse.verseId,
      chapterNumber: verse.chapterNumber,
      verseNumber: verse.verseNumber,
      verseNumberEnd: verse.verseNumberEnd ?? null,
      cantoNumber: verse.cantoNumber ?? null,
      bookNumber: verse.bookNumber,
      globalVerseNumber: verse.globalVerseNumber ?? null,
      sanskrit: (saById.get(verse.verseId) ?? verse).sanskrit ?? null,
      // Display reference: "2.47", "13.8-12" — the book number is left out; the Bhagavatam's starts with the canto.
      ref: `${verse.cantoNumber && !hasSanskritFile ? `${verse.cantoNumber}.` : ''}${verse.chapterNumber}.${verse.verseNumber}${verse.verseNumberEnd ? `-${verse.verseNumberEnd}` : ''}`,
      translation,
      purport,
      // The Bhagavatam has no Sanskrit file: its verse carries the transliteration and the word list itself.
      transliteration: transliterationOf(saById.get(verse.verseId) ?? (hasSanskritFile ? undefined : verse), verse),
      wordMeanings: wordMeaningsOf(saById.get(verse.verseId) ?? (hasSanskritFile ? undefined : verse)),
    });
  }
  return { units, skipped };
}

export function chapterKey(id, book = BOOK) {
  return `json/${bookOf(book).folder}/en/${chapterFile(id, book)}`;
}

/** The Gita's Sanskrit chapter file; null for a book that has none. */
export function saChapterKey(id, book = BOOK) {
  const b = bookOf(book);
  return b.hasSanskritFile ? `json/${b.folder}/sa/${chapterFile(id, book)}` : null;
}

/**
 * Loads one chapter through `getJson(key)`. `meta` is the English file's, which a new language's
 * chapter file is started from.
 */
export async function loadChapter(getJson, id, book = BOOK) {
  const saKey = saChapterKey(id, book);
  const [en, sa] = await Promise.all([getJson(chapterKey(id, book)), saKey ? getJson(saKey) : null]);
  return { ...unitsFromChapter(en, sa, book), meta: en.meta || {} };
}

/** Stable fingerprint of what Claude is sent for a verse (not of the prompt). */
export function sourceHash(unit) {
  return createHash('sha256')
    .update(JSON.stringify({ t: unit.translation, p: unit.purport, w: unit.wordMeanings || [], s: unit.transliteration || [] }))
    .digest('hex')
    .slice(0, 16);
}

export function unitWords(unit) {
  return wordCount(unit.translation) + unit.purport.reduce((n, p) => n + wordCount(p), 0);
}

/** Planning estimate of the output tokens one language needs for a unit — for `parts` of it (all four by default). */
export function estimateOutputTokens(unit, langCode, parts = PARTS) {
  // A transliterated word costs more tokens than a translated one, so the lists are weighted up (see partOutputWords).
  // + the ratings and the note that come with every language
  const words = partsOf(unit, parts).reduce((n, part) => n + partOutputWords(unit, part), 0);
  return Math.ceil(words * language(langCode).tokensPerWord) + 60;
}

/**
 * One language per call: each language is written on its own, so none leans on the one before it
 * in the same answer and a failed call costs one language, not all. A budget above this puts a
 * verse's languages together (see `groupLanguages`); that costs about 5% less.
 */
export const DEFAULT_GROUP_BUDGET = 1;

/**
 * Splits languages into groups for calls so each call's estimated output stays under
 * `budget` tokens. With the default budget every language is a group of its own; with a larger
 * one, languages share a call for as long as they fit.
 */
export function groupLanguages(unit, langCodes, budget, parts = PARTS) {
  const groups = [];
  let current = [];
  let used = 0;
  for (const code of langCodes) {
    const cost = estimateOutputTokens(unit, code, parts);
    if (current.length && used + cost > budget) {
      groups.push(current);
      current = [];
      used = 0;
    }
    current.push(code);
    used += cost;
  }
  if (current.length) groups.push(current);
  return groups;
}

/** Rough tokens a call's user message adds for `parts` — the verse and its lists (English is ~1.5 tokens a word) and the request around them. The instructions every call carries are counted apart. */
export function estimateInputTokens(unit, parts = PARTS) {
  const words = partsOf(unit, parts).reduce((n, part) => n + partInputWords(unit, part), 0);
  return Math.ceil(words * 1.5) + 120;
}
