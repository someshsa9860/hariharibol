// The decisions behind scripts/correct-sb-source.js, kept free of network and
// disk so they can be tested. fill-verse.js only ever adds what is missing; this
// goes further and corrects text that is there, using vedabase.io (Prabhupada,
// BBT) as the reference — but only in the ways that cannot lose his words:
//
//   - the page-navigation labels the scrape left on the end of a purport
//     ("Text 9 Text 11", "Chapter Three Text 6") are cut off;
//   - text the source has less of than vedabase (a dropped sentence) or spells
//     differently (an OCR slip such as "planeary", "when 1", an older edition's
//     wording) becomes vedabase's;
//   - text the source has MORE of than vedabase (a citation "(SB 7.5.31)" the
//     current edition dropped, a whole purport the page lacks) is kept.

import { plainRoman } from './vedabase.js';

/** "Text 9", "Texts 6-7", "Chapter Three", "Chapter Twenty-eight" or "CHAPTER THREE" repeated at the end of a purport. */
const UNITS = 'One|Two|Three|Four|Five|Six|Seven|Eight|Nine';
const NUMBER_WORD = `(?:Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|(?:Twenty|Thirty|Forty|Fifty|Sixty|Seventy|Eighty|Ninety)(?:-(?:${UNITS}|${UNITS.toLowerCase()}))?|${UNITS})`;
const NAV_TAIL = new RegExp(`(?:\\s*(?:Texts?\\s+\\d+(?:-\\d+)?|(?:Chapter|CHAPTER)\\s+(?:${NUMBER_WORD}|${NUMBER_WORD.toUpperCase()})))+\\s*$`);

/** The chapter's closing line vedabase prints under its last verse, and the scrape's "END OF THE FIRST CANTO". */
const FOOTER = /\s*(?:Thus end the Bhaktivedanta[\s\S]*|END OF THE [A-Z-]+ CANTO\s*)$/;

/** A text without the scrape's trailing page furniture: navigation labels and chapter footers. */
function cutTail(text) {
  let out = (text || '').trim();
  for (let again = true; again; ) {
    const next = out.replace(FOOTER, '').replace(NAV_TAIL, '').trim();
    again = next !== out;
    out = next;
  }
  return out;
}

/** Letters and digits only, lower case, no diacritics: what "the same words" means. */
const letters = (s) => plainRoman(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const words = (s) => plainRoman(s || '').toLowerCase().match(/[a-z0-9']+/g) || [];

/** 0..1 share of words two texts have in common, in order (longest common subsequence). */
function wordSimilarity(a, b) {
  const x = words(a);
  const y = words(b);
  if (!x.length || !y.length) return 0;
  let prev = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const row = new Array(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) row[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1]);
    prev = row;
  }
  return (2 * prev[y.length]) / (x.length + y.length);
}

/** Below this the two texts are not the same passage (a glued neighbour, the wrong verse) and a person should look. */
const REVIEW_BELOW = 0.85;

/** In a translation, more than this many letters beyond vedabase's is a neighbour's text glued on, not a citation. */
const EXTRA_LETTERS = 40;

/**
 * Chooses a field's text. `mine` is the source's, `theirs` vedabase's (already
 * in the canto's spelling), either may be empty. Returns { text, action, review }
 * where action is one of: same, junk, fill, longer, trimmed, reworded, kept-extra, kept.
 */
function chooseText(mine, theirs, { extraIsJunk = false } = {}) {
  const cleaned = cutTail(mine);
  const trimmed = cleaned !== (mine || '').trim();
  const a = letters(cleaned);
  theirs = cutTail(theirs);
  const b = letters(theirs);
  if (!b) return { text: cleaned, action: trimmed ? 'junk' : 'kept' };
  if (!a) return { text: theirs, action: 'fill' };
  if (a === b) return { text: cleaned, action: trimmed ? 'junk' : 'same' };
  if (b.includes(a)) return { text: theirs, action: 'longer' };
  if (a.includes(b)) return extraIsJunk && a.length - b.length > EXTRA_LETTERS ? { text: theirs, action: 'trimmed' } : { text: cleaned, action: 'kept-extra' };
  const similarity = wordSimilarity(cleaned, theirs);
  return { text: theirs, action: 'reworded', review: similarity < REVIEW_BELOW ? similarity : undefined };
}

export { NAV_TAIL, FOOTER, cutTail, chooseText, wordSimilarity, letters, REVIEW_BELOW };
