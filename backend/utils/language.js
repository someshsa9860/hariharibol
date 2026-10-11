// A user picks three languages independently — app, mantra, reading — and any
// one of them may have no content behind it. Every content response therefore
// resolves against an ordered list of candidates rather than a single code.
//
//   mantra text     mantraLanguage → readingLanguage → appLanguage → en → sa
//   meanings, verse readingLanguage → appLanguage → en
//
// The order is the user's stated intent, so it is applied here rather than
// re-derived in each controller.

import { DEFAULT_LANGUAGE, SOURCE_LANGUAGE } from '../config/constants.js';

const dedupe = (codes) => [...new Set(codes.filter(Boolean))];

// What script a mantra should be shown in.
function mantraChain(user) {
  if (!user) return dedupe([SOURCE_LANGUAGE, DEFAULT_LANGUAGE]);
  return dedupe([
    user.mantraLanguage,
    user.readingLanguage,
    user.appLanguage,
    DEFAULT_LANGUAGE,
    SOURCE_LANGUAGE,
  ]);
}

// What language prose should be read in — meanings, purports, translations,
// explanations, narrations.
function readingChain(user) {
  if (!user) return dedupe([DEFAULT_LANGUAGE]);
  return dedupe([user.readingLanguage, user.appLanguage, DEFAULT_LANGUAGE]);
}

// UI chrome the server renders — emails, deeplink pages.
function appChain(user) {
  if (!user) return dedupe([DEFAULT_LANGUAGE]);
  return dedupe([user.appLanguage, DEFAULT_LANGUAGE]);
}

// First row whose languageCode appears earliest in the chain. Returns null when
// nothing matches, so the caller can decide whether that is an error or a
// fallback to the Sanskrit source.
function pick(rows, chain, field = 'languageCode') {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  for (const code of chain) {
    const match = rows.find((row) => row[field] === code);
    if (match) return match;
  }
  return null;
}

// A name from translation rows: the first language in the chain that has one.
// Not `pick`, which returns the first row whatever it holds — a mantra's Sanskrit
// row carries the text and no name. English is the row's own base column, passed
// as `fallback`, so a chain that reaches it stops there: someone who reads English
// with the app in Marathi has asked for English, not for a gap to fill in Marathi.
function pickName(rows, chain, fallback) {
  for (const code of chain) {
    const name = Array.isArray(rows) ? rows.find((row) => row.languageCode === code)?.name : null;
    if (name) return name;
    if (code === DEFAULT_LANGUAGE) break;
  }
  return fallback;
}

// The search side of `pickName`: clauses for an `OR` that match a mantra whose name
// contains `q` — the English one (the base column) or one in a language the chain
// reads. Those are the names a reader can be shown, so typing the title they see
// finds it.
function mantraNameClauses(q, chain) {
  const contains = { contains: q, mode: 'insensitive' };
  return [
    { name: contains },
    { translations: { some: { isPublished: true, languageCode: { in: chain }, name: contains } } },
  ];
}

// The rendering a verse opens with. A poetic expansion (Dnyaneshwari's Marathi
// ovis on the Gita) retells a verse rather than translating it, so it is never
// the default while a translation exists anywhere in the chain: a Marathi reader
// gets the standard translation first and finds the ovi under "Compare
// translations". Only when it is all there is does it stand in.
//
// The app applies the same rule to what it holds offline — keep the two together
// (BookRepository.pickTranslation).
function pickTranslation(rows, chain) {
  if (!Array.isArray(rows)) return null;
  const standard = rows.filter((row) => row.type !== 'POETIC_EXPANSION');
  return pick(standard, chain) ?? pick(rows, chain);
}

// Localised JSON columns (`titleI18n`, `nameI18n`) fall back to the plain
// column when the chain misses.
function localised(row, baseField, i18nField, chain) {
  const map = row?.[i18nField];
  if (map && typeof map === 'object') {
    for (const code of chain) {
      if (map[code]) return map[code];
    }
  }
  return row?.[baseField] ?? null;
}

// Accept-Language for unauthenticated callers: "hi-IN,hi;q=0.9,en;q=0.8" → hi.
function fromHeader(header) {
  if (!header) return null;
  const first = String(header).split(',')[0]?.trim();
  if (!first) return null;
  return first.split('-')[0].toLowerCase();
}

export {
  mantraChain,
  readingChain,
  appChain,
  pick,
  pickName,
  mantraNameClauses,
  pickTranslation,
  localised,
  fromHeader,
};
