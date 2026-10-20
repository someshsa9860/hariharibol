// Carrying people over from the old app's server (POST /auth/legacy) — see "Legacy users" in
// backend/CLAUDE.md. The numbers and the by-hand answers live here so neither is buried in the code.

// How many of a person's most-chanted old mantras are read from the old server's answer. (The old
// server sends five; this only guards against a longer reply.)
export const MAX_LEGACY_MANTRAS = 10;

// The old server's mantra ids → slugs of ours. Checked before any matching by name, for a mantra the
// matching (utils/legacy.js) gets wrong or cannot tell — "Maha Mantra" could be the Hare Krishna one or
// the Nrisimha one, and only someone who has seen the old `mantras` table knows. A slug that is not a
// published mantra here is ignored. Empty until then:
//
//   node scripts/legacy-match-mantras.js <the old mantras table as JSON>   → how each would match
//
//   export const MANTRA_SLUGS = { 3: 'om-namah-shivaya', 7: 'hare-krishna-mahamantra' };
export const MANTRA_SLUGS = {};

// How strictly an old mantra is matched to one of ours when it is not in the list above. Wrong
// matches cost more than missing ones — the match only picks which mantra "Chant now" opens with
// until there is chanting here — so these lean towards "no match".
export const MATCH = {
  // The same letters with a few differences count as one mantra at this similarity (1 = identical).
  minSimilarity: 0.84,
  // The best candidate must beat the next-best mantra by this much. Otherwise it is a guess.
  minMargin: 0.05,
  // A short run of letters inside a longer one proves little ("om" is in half of them), so the old
  // text must be at least this long once reduced to its consonants...
  minContainedLength: 5,
  // ...and must make up at least this share of the one it sits in.
  minContainedShare: 0.3,
  // Only this many consonants of any text are compared (a whole mantra in Sanskrit is ~200).
  maxLength: 400,
};
