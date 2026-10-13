// Reads the English Gita from the source bucket (or SOURCE_LOCAL_DIR) and turns each verse
// into a translation unit: Prabhupāda's English translation and purport, the verse's Roman
// transliteration and its word-by-word list — nothing else.
// Also: how many languages fit in one call, and what a run is expected to cost.

import { createHash } from 'node:crypto';

import { language } from './claude-translate-languages.js';
import { normalizeWordMeanings } from './word-meanings.js';
import { wordCount } from './claude-translate-validate.js';

export const BOOK = 'bhagavat-gita';
export const CHAPTERS = Array.from({ length: 18 }, (_, i) => i + 1);
export const TRANSLATOR = 'prabhupada';

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
 * list and the Roman transliteration are read — its Devanagari verse never goes into a unit — and
 * only Prabhupāda's rows are taken from the commentaries (never Sivananda's or anyone else's).
 */
export function unitsFromChapter(chapterFile, saChapterFile = null) {
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
      // Display reference: "2.47", "13.8-12" — the book number is left out.
      ref: `${verse.chapterNumber}.${verse.verseNumber}${verse.verseNumberEnd ? `-${verse.verseNumberEnd}` : ''}`,
      translation,
      purport,
      transliteration: transliterationOf(saById.get(verse.verseId), verse),
      wordMeanings: wordMeaningsOf(saById.get(verse.verseId)),
    });
  }
  return { units, skipped };
}

export function chapterKey(n) {
  return `json/${BOOK}/en/ch-${n}.json`;
}

export function saChapterKey(n) {
  return `json/${BOOK}/sa/ch-${n}.json`;
}

/**
 * Loads one chapter through `getJson(key)`. `meta` is the English file's, which a new language's
 * chapter file is started from.
 */
export async function loadChapter(getJson, n) {
  const [en, sa] = await Promise.all([getJson(chapterKey(n)), getJson(saChapterKey(n))]);
  return { ...unitsFromChapter(en, sa), meta: en.meta || {} };
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

/** Words in the word-by-word list (each entry's word and its meaning) and in the transliteration lines. */
function listWords(unit) {
  const lines = (unit.transliteration || []).reduce((n, l) => n + wordCount(l), 0);
  return (unit.wordMeanings || []).reduce((n, w) => n + wordCount(w.word) + wordCount(w.meaning), lines);
}

/** Planning estimate of the output tokens one language needs for a unit. */
export function estimateOutputTokens(unit, langCode) {
  // A transliterated word costs more tokens than a translated one, so the list is weighted up.
  // + the four ratings and the note that come with every language
  return Math.ceil((unitWords(unit) + listWords(unit) * 1.5) * language(langCode).tokensPerWord) + 60;
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
export function groupLanguages(unit, langCodes, budget) {
  const groups = [];
  let current = [];
  let used = 0;
  for (const code of langCodes) {
    const cost = estimateOutputTokens(unit, code);
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

/** Rough tokens a call's user message adds — the verse and its lists (English is ~1.5 tokens a word) and the request around them. The instructions every call carries are counted apart. */
export function estimateInputTokens(unit) {
  return Math.ceil((unitWords(unit) + listWords(unit) * 2) * 1.5) + 120;
}
