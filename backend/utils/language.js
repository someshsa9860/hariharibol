// A user picks three languages independently — app, mantra, reading — and any
// one of them may have no content behind it. Every content response therefore
// resolves against an ordered list of candidates rather than a single code.
//
//   mantra text     mantraLanguage → readingLanguage → appLanguage → en → sa
//   meanings, verse readingLanguage → appLanguage → en
//
// The order is the user's stated intent, so it is applied here rather than
// re-derived in each controller.

const { DEFAULT_LANGUAGE, SOURCE_LANGUAGE } = require('../config/constants');

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

module.exports = { mantraChain, readingChain, appChain, pick, localised, fromHeader };
