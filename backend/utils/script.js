// Devanagari → another Indic script, for mantras.
//
// A mantra is Sanskrit; what differs between readers is the script they can
// read. The Indic scripts share one layout in Unicode (each block mirrors
// Devanagari's order), so most of the conversion is a code-point shift. The
// exceptions — letters a script lacks, and the Om sign — are the tables below.
//
// This is meant to give an editor a correct starting point, not to replace
// review: Tamil has no aspirated or voiced consonants, so they collapse onto
// the plain ones there, as they do in everyday Tamil writing of Sanskrit.

const BLOCK_START = {
  bn: 0x0980,
  as: 0x0980,
  pa: 0x0a00,
  gu: 0x0a80,
  or: 0x0b00,
  ta: 0x0b80,
  te: 0x0c00,
  kn: 0x0c80,
  ml: 0x0d00,
};

const OM = { bn: 'ওঁ', as: 'ওঁ', pa: 'ੴ', gu: 'ૐ', or: 'ଓଁ', ta: 'ௐ', te: 'ఓం', kn: 'ಓಂ', ml: 'ഓം' };
OM.pa = 'ਓਂ';

// Letters whose offset position is empty in the target block.
const SUBSTITUTE = {
  bn: { 'व': 'ব', 'ळ': 'ল' },
  as: { 'व': 'ৱ', 'र': 'ৰ', 'ळ': 'ল' },
  pa: { 'ष': 'ਸ਼', 'ळ': 'ਲ਼', 'ऽ': '', 'ॠ': '' },
  ta: {
    'ख': 'க', 'ग': 'க', 'घ': 'க', 'छ': 'ச', 'झ': 'ச', 'ठ': 'ட', 'ड': 'ட', 'ढ': 'ட',
    'थ': 'த', 'द': 'த', 'ध': 'த', 'फ': 'ப', 'ब': 'ப', 'भ': 'ப', 'ऽ': '', 'ँ': '', 'ं': 'ம்',
  },
};

// Vocalic ऋ has no sign in Tamil or Gurmukhi; both write it as ru / ri.
const VOCALIC_SIGN = { ta: 'ிரு', pa: '੍ਰਿ' };
const VOCALIC_LETTER = { ta: 'ரு', pa: 'ਰਿ' };

const DEVANAGARI = /[ऀ-ॿ]/;

export const SCRIPT_LANGUAGES = Object.keys(BLOCK_START);

/** Whether a language code is written in Devanagari (so it needs no conversion). */
export const isDevanagari = (code) => ['sa', 'hi', 'mr', 'ne'].includes(code);

/** Convert Devanagari text to `languageCode`'s script; other characters pass through. */
export function fromDevanagari(text, languageCode) {
  const start = BLOCK_START[languageCode];
  if (start === undefined) return text;

  const substitute = SUBSTITUTE[languageCode] ?? {};
  let out = '';

  for (const ch of text) {
    if (ch === 'ॐ') out += OM[languageCode];
    else if (ch === 'ृ' && VOCALIC_SIGN[languageCode]) out += VOCALIC_SIGN[languageCode];
    else if (ch === 'ऋ' && VOCALIC_LETTER[languageCode]) out += VOCALIC_LETTER[languageCode];
    else if (ch in substitute) out += substitute[ch];
    else if (DEVANAGARI.test(ch) && ch !== '।' && ch !== '॥') out += String.fromCodePoint(ch.codePointAt(0) - 0x0900 + start);
    else out += ch;
  }
  return out;
}
