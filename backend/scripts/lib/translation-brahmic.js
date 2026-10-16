// Roman IAST into the scripts of Hindi, Marathi, Bengali, Telugu and Kannada. Pure functions, no I/O.
//
// The same job translation-script.js does for Malayalam and Tamil: the English source spells the Sanskrit in IAST, and a
// translation has to carry it in the language's own script. These five scripts descend from one another and sit at the
// same offsets in Unicode (Devanagari 0x0900, Bengali 0x0980, Telugu 0x0C00, Kannada 0x0C80), so the text is written once
// in Devanagari and moved block to block; the only letters that need a rule are the two Bengali has no sign for.
//
//   iastToBrahmic(lang, iast)   Roman IAST -> the language's script, letter for letter, separators kept
//   devanagariTo(lang, text)    Devanagari from iastToDevanagari -> the language's script, with its spelling habits
//   devanagariToBlock(lang, t)  Devanagari -> the language's block, position for position and nothing else
//   BRAHMIC                     the languages this module writes, with their Unicode blocks

/** hi and mr share Devanagari; bn te kn have their own block. `lo` is the first code point of the block. */
export const BRAHMIC = {
  hi: { lo: 0x0900, hi: 0x097f },
  mr: { lo: 0x0900, hi: 0x097f },
  bn: { lo: 0x0980, hi: 0x09ff },
  te: { lo: 0x0c00, hi: 0x0c7f },
  kn: { lo: 0x0c80, hi: 0x0cff },
};

// ---------- IAST -> Devanagari ----------
const CONS = {
  k: 'क', kh: 'ख', g: 'ग', gh: 'घ', ṅ: 'ङ', c: 'च', ch: 'छ', j: 'ज', jh: 'झ', ñ: 'ञ', ṭ: 'ट', ṭh: 'ठ', ḍ: 'ड', ḍh: 'ढ', ṇ: 'ण',
  t: 'त', th: 'थ', d: 'द', dh: 'ध', n: 'न', p: 'प', ph: 'फ', b: 'ब', bh: 'भ', m: 'म', y: 'य', r: 'र', l: 'ल', v: 'व',
  ś: 'श', ṣ: 'ष', s: 'स', h: 'ह', ḷ: 'ळ',
};
const VOWEL = {
  a: ['अ', ''], ā: ['आ', 'ा'], i: ['इ', 'ि'], ī: ['ई', 'ी'], u: ['उ', 'ु'], ū: ['ऊ', 'ू'], ṛ: ['ऋ', 'ृ'], ṝ: ['ॠ', 'ॄ'],
  e: ['ए', 'े'], ai: ['ऐ', 'ै'], o: ['ओ', 'ो'], au: ['औ', 'ौ'],
};
const VIRAMA = '्';
const ASPIRABLE = new Set(['k', 'g', 'c', 'j', 'ṭ', 'ḍ', 't', 'd', 'p', 'b']);

/** One run of IAST letters (no spaces / hyphens / punctuation), lower case, into Devanagari. */
function devanagariWord(w) {
  const s = [...w.normalize('NFC')];
  const out = [];
  let pending = null; // a consonant written without its vowel yet
  const settle = () => {
    if (pending !== null) { out.push(pending + VIRAMA); pending = null; }
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const two = c + (s[i + 1] ?? '');
    if (c === '’' || c === "'" || c === 'ʼ') { settle(); out.push('ऽ'); i++; continue; }
    if (c === 'ṃ' || c === 'ṁ') { settle(); out.push('ं'); i++; continue; }
    if (c === 'ḥ') { settle(); out.push('ः'); i++; continue; }
    if (two === 'ai' || two === 'au') {
      const [independent, dependent] = VOWEL[two];
      if (pending !== null) { out.push(pending + dependent); pending = null; } else out.push(independent);
      i += 2;
      continue;
    }
    if (VOWEL[c]) {
      const [independent, dependent] = VOWEL[c];
      if (pending !== null) { out.push(pending + dependent); pending = null; } else out.push(independent);
      i++;
      continue;
    }
    let cons = null;
    let len = 1;
    if (s[i + 1] === 'h' && ASPIRABLE.has(c) && CONS[two]) { cons = CONS[two]; len = 2; }
    else if (CONS[c]) cons = CONS[c];
    if (cons === null) { settle(); out.push(c); i++; continue; } // a digit or a stray mark stays as it is
    settle();
    pending = cons;
    i += len;
  }
  settle();
  return out.join('');
}

const SEPARATORS = /([ \-–—,;.:|?!()‘’“”"\[\]/\n]+)/;
/**
 * The source writes the avagraha as ".a" between two letters (ko.atra = ko 'tra): the "a" is part of the code, not a vowel.
 * ".N" is the candrabindu before l (śraddhāvā.Nllabhate = śraddhāvāँl labhate, three times in the Gita), kept as ँ.
 */
const avagraha = (t) => t.replace(/(?<=\p{L})\.N/gu, 'ँ').replace(/(?<=\p{L})\.a/gu, 'ʼ').replace(/(?<=\p{L})\.(?=\p{L})/gu, 'ʼ');

/** A run of IAST into Devanagari: words converted, separators (spaces, hyphens, punctuation) kept. */
export function iastToDevanagari(text) {
  return avagraha(text).split(SEPARATORS).map((part, idx) => (idx % 2 === 1 || part === '' ? part : devanagariWord(part.toLowerCase()))).join('');
}

// ---------- Devanagari -> the other blocks, by position ----------
const BLOCK_OFFSET = { hi: 0, mr: 0, bn: 0x80, te: 0x300, kn: 0x380 };
// Bengali has no letter for va (it writes ব, as Bengali does) or for ḷ (it writes ল).
const BENGALI_EXCEPTIONS = { 'व': 'ব', 'ळ': 'ল' };

const isDevaConsonant = (c) => (c >= 'क' && c <= 'ह') || c === 'ळ';
const isDevaVowelOrSign = (c) => (c >= 'अ' && c <= 'औ') || (c >= 'ा' && c <= 'ौ');
// a nasal and the consonants of its own row: the nasal before one of them is the anusvara in Telugu and Kannada
const NASAL_ROW = { 'न': 'त-ध', 'म': 'प-भ' };

/**
 * Two habits of the existing translations, applied to the Devanagari text before it moves to its block, so that a rebuilt line
 * reads like the lines around it.
 *  - Bengali: य and ड ढ between vowels carry a nukta (সঞ্জয়, ব্যূঢ়ম্; 86–100 % of the occurrences after every vowel but u, where it
 *    is half: যুযুৎসবঃ), and a त that ends a word or stands before क খ প ফ স is the khanda ta (অব্রবীৎ, যুযুৎসবঃ, শশ্বৎকালে; the corpus has ৎক 43, ৎপ 42, ৎস 99 times and the conjunct ত্ক / ত্প never).
 *  - Telugu and Kannada: n and m before a consonant of their own row are the anusvara (కుంతి, ಕುಂತಿ), where Devanagari spells
 *    the nasal (कुन्ति). The existing texts do this for most such n and m (Kannada 82 % of the n, Telugu half), and spell ṅ ñ ṇ
 *    out (ಶಙ್ಖ, పాణ్డవ) most of the time, so those stay. A nasal before any other consonant (janma, anna) stays as it is.
 */
function conventions(lang, text) {
  const a = [...text];
  const out = [];
  for (let i = 0; i < a.length; i++) {
    const c = a[i];
    const prev = a[i - 1];
    const next = a[i + 1];
    if (lang === 'bn') {
      if ('यडढ'.includes(c) && prev !== undefined && prev !== 'ु' && (isDevaConsonant(prev) || isDevaVowelOrSign(prev)) && next !== '्') { out.push(c, '़'); continue; }
      if (c === 'त' && next === '्' && (a[i + 2] === undefined || 'कखपफस'.includes(a[i + 2]) || !/[\p{L}\p{M}]/u.test(a[i + 2]))) { out.push('ৎ'); i++; continue; }
    }
    if ((lang === 'te' || lang === 'kn') && NASAL_ROW[c] && next === '्' && a[i + 2] !== undefined) {
      const [lo, hi] = NASAL_ROW[c].split('-');
      if (a[i + 2] >= lo && a[i + 2] <= hi) { out.push('ं'); i++; continue; }
    }
    out.push(c);
  }
  return out.join('');
}

/**
 * Devanagari letters and signs moved onto the language's block, position for position. Everything outside U+0900–097F (digits,
 * danda, Latin, spaces) stays. This is what stray letters of one script inside another's text need.
 */
export function devanagariToBlock(lang, text) {
  const offset = BLOCK_OFFSET[lang];
  if (offset === undefined) throw new Error(`devanagariToBlock: "${lang}" is not one of ${Object.keys(BLOCK_OFFSET).join(', ')}`);
  if (offset === 0) return text;
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (lang === 'bn' && BENGALI_EXCEPTIONS[ch]) out += BENGALI_EXCEPTIONS[ch];
    else if (cp >= 0x0900 && cp <= 0x097f && cp !== 0x0964 && cp !== 0x0965) out += String.fromCodePoint(cp + offset);
    else out += ch;
  }
  return out;
}

/** Devanagari written by `iastToDevanagari`, in the language's script and in its habits (see `conventions`). */
export const devanagariTo = (lang, text) => devanagariToBlock(lang, conventions(lang, text));

/** IAST as the English source writes it, into the language's script. */
export function iastToBrahmic(lang, text) {
  return devanagariTo(lang, iastToDevanagari(text));
}
