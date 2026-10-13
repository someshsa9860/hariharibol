import { chantPhrases } from './chant-phrases.js';

// The words auto count listens for, per mantra: the English words the phone's
// recogniser writes when the mantra is chanted. The true list can only be found
// by chanting into the app and seeing what it writes, so this is a STARTING point:
// every distinct word of the mantra's phrase spellings (chant-phrases.js). The seed and
// the migration only fill a mantra that has no words yet — an admin's list (Mantras
// page, "Allowed English words") is never overwritten.

export function wordsOf(phrases) {
  const words = new Set();
  for (const phrase of phrases) {
    for (const word of phrase.toLowerCase().split(/[^a-z]+/)) {
      if (word.length >= 2) words.add(word);
    }
  }
  return [...words];
}

export const chantWords = Object.fromEntries(
  Object.entries(chantPhrases).map(([slug, phrases]) => [slug, wordsOf(phrases)])
);
