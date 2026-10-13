// The seven languages the Claude translation pipeline writes, and what the validator
// needs to know about each. `block` is the Unicode block of the script; `digitZero` is
// the code point of the language's own digit 0 (their digits are folded to ASCII before
// numbers are compared); `words` is the allowed ratio of output words to English words —
// wide on purpose, it only catches a truncated answer or a runaway one. Agglutinative
// languages (Tamil, Telugu, Kannada, Malayalam) run shorter in words than English.
//
// `tokensPerWord` is a planning figure for `--dry-run` and for packing calls, not a
// measurement; a call that runs out of room is split and retried (see claude-translate-run.js).

export const LANGUAGES = [
  { code: 'hi', name: 'Hindi', endonym: 'हिन्दी', block: [0x0900, 0x097f], digitZero: 0x0966, words: [0.75, 1.8], tokensPerWord: 3.5 },
  { code: 'mr', name: 'Marathi', endonym: 'मराठी', block: [0x0900, 0x097f], digitZero: 0x0966, words: [0.6, 1.6], tokensPerWord: 4.5 },
  { code: 'bn', name: 'Bengali', endonym: 'বাংলা', block: [0x0980, 0x09ff], digitZero: 0x09e6, words: [0.6, 1.5], tokensPerWord: 5 },
  { code: 'ta', name: 'Tamil', endonym: 'தமிழ்', block: [0x0b80, 0x0bff], digitZero: 0x0be6, words: [0.5, 1.4], tokensPerWord: 8 },
  { code: 'te', name: 'Telugu', endonym: 'తెలుగు', block: [0x0c00, 0x0c7f], digitZero: 0x0c66, words: [0.45, 1.3], tokensPerWord: 7 },
  { code: 'kn', name: 'Kannada', endonym: 'ಕನ್ನಡ', block: [0x0c80, 0x0cff], digitZero: 0x0ce6, words: [0.45, 1.3], tokensPerWord: 8 },
  { code: 'ml', name: 'Malayalam', endonym: 'മലയാളം', block: [0x0d00, 0x0d7f], digitZero: 0x0d66, words: [0.4, 1.3], tokensPerWord: 9 },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]));

export function language(code) {
  const lang = byCode.get(code);
  if (!lang) throw new Error(`Unknown language "${code}" — expected one of ${LANGUAGE_CODES.join(', ')}`);
  return lang;
}
