// A user picks languages independently — app, reading, and the older mantra
// language — and any one of them may have no content behind it. Every content
// response therefore resolves against an ordered list of candidates rather than
// a single code.
//
//   mantra text     readingLanguage → mantraLanguage → appLanguage → en → sa
//   meanings, verse readingLanguage → appLanguage → en
//   reel narration  mantraLanguage → readingLanguage → appLanguage → en → sa
//
// The order is the user's stated intent, so it is applied here rather than
// re-derived in each controller.

import { DEFAULT_LANGUAGE, SOURCE_LANGUAGE } from '../config/constants.js';
import { SCRIPT_LANGUAGES, fromDevanagari } from './script.js';

const dedupe = (codes) => [...new Set(codes.filter(Boolean))];

// What script a mantra's text is shown in: the reading language's own, so a
// reader who reads Kannada sees Kannada letters under a Kannada title. The
// app has no control for the mantra language any more (the account's stays at
// its "sa" default), so it is only the next choice, for a reading language
// with no row of the mantra's text.
function mantraTextChain(user) {
  if (!user) return mantraChain(user);
  return dedupe([
    user.readingLanguage,
    user.mantraLanguage,
    user.appLanguage,
    DEFAULT_LANGUAGE,
    SOURCE_LANGUAGE,
  ]);
}

// Which language of a mantra's recording or narration to play.
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

// The languages a phone names on a book call (`?languages=mr,en`), as a list of codes.
// A phone changes its own reading language at once and tells the account a moment
// later, so on the call made in between the account still holds the old one; naming
// the languages on the call itself keeps the text from running one change behind.
// Nothing, or nothing usable, is an empty list and the account's languages stand.
function fromQuery(value) {
  if (typeof value !== 'string') return [];
  return dedupe(value.split(',').map((code) => code.trim().toLowerCase())).slice(0, 3);
}

// `user` with its reading languages replaced by `codes` (first the reading language,
// then the app's), for a call that named them. Works for a signed-out caller too,
// who has no user to copy: the result only ever carries the two language fields,
// which is all `readingChain` and `present.verse` / `present.section` read.
function withReadingLanguages(user, codes) {
  if (!codes?.length) return user;
  return { ...user, readingLanguage: codes[0], appLanguage: codes[1] ?? null };
}

// UI chrome the server renders — emails, deeplink pages.
function appChain(user) {
  if (!user) return dedupe([DEFAULT_LANGUAGE]);
  return dedupe([user.appLanguage, DEFAULT_LANGUAGE]);
}

// The language a response to this request should speak when it is the server's
// own words (errors): the signed-in user's app language, else what the client
// said in Accept-Language, else English.
function requestChain(req) {
  return dedupe([req.auth?.user?.appLanguage, req.acceptLanguage, DEFAULT_LANGUAGE]);
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

// A verse's transliteration in the reader's own language: walking the chain, a
// language's stored transliteration wins (Marathi in Devanagari, Tamil in Tamil
// script — the Claude translation import fills it, see VerseTranslation); failing
// that, a language with its own script (Kannada, Bengali ...) gets the verse's
// Devanagari carried across into it (`fromDevanagari`, the same conversion mantras
// use), so a reader never sees Roman letters just because nothing was imported.
// It is the *reading* language that decides, whichever rendering the verse opens
// with, and any row of a language counts (a Marathi reader's ovi row has none, the
// translation beside it does). `fallback` is the verse's own Roman (IAST) text, for
// a reader whose languages are Roman or Devanagari and have nothing stored.
// `sanskrit` is the verse's Devanagari; leave it out to skip the conversion.
//
// The app applies the same rule to what it holds offline — keep the two together
// (BookRepository.pickTransliteration, core/format/indic_script.dart).
function pickTransliteration(rows, chain, fallback = null, sanskrit = null) {
  const source = typeof sanskrit === 'string' && sanskrit.trim() ? sanskrit : null;
  for (const code of chain) {
    if (Array.isArray(rows)) {
      const row = rows.find((r) => r.languageCode === code && r.transliteration?.trim());
      if (row) return row.transliteration;
    }
    if (source && SCRIPT_LANGUAGES.includes(code)) return fromDevanagari(source, code);
  }
  return fallback;
}

// Localised JSON columns (`titleI18n`, `nameI18n`) fall back to the plain
// column when the chain misses.
function localised(row, baseField, i18nField, chain) {
  const map = row?.[i18nField];
  if (map && typeof map === 'object') {
    for (const code of chain) {
      if (map[code]) return map[code];
      // The plain column is the English one. A chain that reaches English stops
      // there, as `pickName` does: someone who reads English with the app in
      // Hindi has asked for English.
      if (code === DEFAULT_LANGUAGE) break;
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
  mantraTextChain,
  readingChain,
  fromQuery,
  withReadingLanguages,
  appChain,
  requestChain,
  pick,
  pickName,
  mantraNameClauses,
  pickTranslation,
  pickTransliteration,
  localised,
  fromHeader,
};
