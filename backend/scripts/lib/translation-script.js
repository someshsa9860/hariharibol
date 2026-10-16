// Script conversion for repairing the Malayalam and Tamil Gita translations. Pure functions, no I/O.
//
// The English source spells the Sanskrit in IAST (Roman, with marks). A translation has to carry it in the language's own
// script — the transliteration lines and the Sanskrit half of every word-by-word entry — and the model sometimes wrote it
// in Devanagari, Kannada, Roman or with a colon for the visarga instead. These functions put it right by rule, from the
// English IAST, so no model call is needed.
//
//   iastToMalayalam(iast) / iastToTamil(iast)   Roman IAST -> the language's script
//   indicToMalayalam(text)                      stray Devanagari / Bengali / Kannada ... -> Malayalam, letter by letter
//   indicToIast(text)                           the same, to IAST (so Tamil can be produced from it)
//   sanskritLine(line, lang)                    one transliteration line of the source -> the script, with its danda and verse number
//   iastKey / scriptKey(lang, text), distance   a loose "sound skeleton", used only to measure how far two spellings are apart

// ---------- IAST -> Malayalam ----------
const M_CONS = {
  k: 'ക', kh: 'ഖ', g: 'ഗ', gh: 'ഘ', ṅ: 'ങ', c: 'ച', ch: 'ഛ', j: 'ജ', jh: 'ഝ', ñ: 'ഞ', ṭ: 'ട', ṭh: 'ഠ', ḍ: 'ഡ', ḍh: 'ഢ', ṇ: 'ണ',
  t: 'ത', th: 'ഥ', d: 'ദ', dh: 'ധ', n: 'ന', p: 'പ', ph: 'ഫ', b: 'ബ', bh: 'ഭ', m: 'മ', y: 'യ', r: 'ര', l: 'ല', v: 'വ',
  ś: 'ശ', ṣ: 'ഷ', s: 'സ', h: 'ഹ', ḷ: 'ള',
};
const M_VOWEL = {
  a: ['അ', ''], ā: ['ആ', 'ാ'], i: ['ഇ', 'ി'], ī: ['ഈ', 'ീ'], u: ['ഉ', 'ു'], ū: ['ഊ', 'ൂ'], ṛ: ['ഋ', 'ൃ'], ṝ: ['ൠ', 'ൄ'],
  e: ['ഏ', 'േ'], ai: ['ഐ', 'ൈ'], o: ['ഓ', 'ോ'], au: ['ഔ', 'ൗ'],
};
const M_VIRAMA = '്';
const CHILLU_FINAL = { ന: 'ൻ', ണ: 'ൺ', ല: 'ൽ', ള: 'ൾ', ര: 'ർ' };
const ASPIRABLE = new Set(['k', 'g', 'c', 'j', 'ṭ', 'ḍ', 't', 'd', 'p', 'b']);

/** One run of IAST letters (no spaces / hyphens / punctuation), lower case, into Malayalam script. */
function malayalamWord(w) {
  const s = [...w.normalize('NFC')];
  const out = [];
  let pending = null; // a consonant written without its vowel yet
  let i = 0;
  const flush = (next) => {
    if (pending === null) return;
    // a final n ṇ l ḷ r is the chillu letter; r before another consonant (but not y) is the chillu r too
    if (next === null && CHILLU_FINAL[pending]) out.push(CHILLU_FINAL[pending]);
    else if (pending === 'ര' && next !== null && next !== 'യ') out.push('ർ');
    else out.push(pending + M_VIRAMA);
    pending = null;
  };
  while (i < s.length) {
    const c = s[i]; const two = c + (s[i + 1] ?? '');
    if (c === '’' || c === "'" || c === 'ʼ') { flush(null); out.push('ഽ'); i++; continue; }
    if (c === 'ṃ' || c === 'ṁ') { if (pending !== null) { out.push(pending + M_VIRAMA); pending = null; } out.push('ം'); i++; continue; }
    if (c === 'ḥ') { if (pending !== null) { out.push(pending + M_VIRAMA); pending = null; } out.push('ഃ'); i++; continue; }
    if (M_VOWEL[two] && (two === 'ai' || two === 'au')) {
      const [independent, dependent] = M_VOWEL[two];
      if (pending !== null) { out.push(pending + dependent); pending = null; } else out.push(independent);
      i += 2; continue;
    }
    if (M_VOWEL[c]) {
      const [independent, dependent] = M_VOWEL[c];
      if (pending !== null) { out.push(pending + dependent); pending = null; } else out.push(independent);
      i++; continue;
    }
    let cons = null; let len = 1;
    if (s[i + 1] === 'h' && ASPIRABLE.has(c) && M_CONS[two]) { cons = M_CONS[two]; len = 2; }
    else if (M_CONS[c]) cons = M_CONS[c];
    if (cons === null) { flush(null); out.push(c); i++; continue; } // a digit or a stray mark stays as it is
    if (c === 'm' && (s[i + 1] === 'b')) { // m before b / bh is the anusvara (saṃbandhi, aṃbhas), as the corpus writes it
      if (pending !== null) { out.push(pending + M_VIRAMA); pending = null; }
      out.push('ം'); i++; continue;
    }
    if (pending === 'ര' && cons === 'ത' && len === 1 && /^[aāiīuūeoṛṝ]/.test(s.slice(i + 1).join(''))) { // rt before a vowel is written ർത്ത (kīrti, kartā)
      out.push('ർത്'); pending = cons; i += len; continue;
    }
    if (pending !== null) flush(cons);
    pending = cons; i += len;
  }
  if (pending === 'മ') { pending = null; out.push('ം'); } // a word-final m is written as the anusvara, as the corpus does
  flush(null);
  return out.join('');
}

const SEPARATORS = /([ \-–—,;.:|?!()‘’“”"\[\]/\n]+)/;
/** The source writes the avagraha as ".a" between two letters (ko.atra = ko 'tra): the "a" is part of the code, not a vowel. */
const avagraha = (t) => t.replace(/(?<=\p{L})\.a/gu, 'ʼ').replace(/(?<=\p{L})\.(?=\p{L})/gu, 'ʼ');

/** A run of IAST: words converted, separators (spaces, hyphens, punctuation) kept. */
export function iastToMalayalam(text) {
  return avagraha(text).split(SEPARATORS).map((part, idx) => (idx % 2 === 1 || part === '' ? part : malayalamWord(part.toLowerCase()))).join('');
}

// ---------- IAST -> Tamil ----------
// Plain-letter style, the one the hand-corrected chapters use: Tamil has no letters for aspirates or voiced stops, so
// kh gh -> க, ch -> ச, jh -> ஜ, ṭh ḍ ḍh -> ட, th d dh -> த, ph b bh -> ப, with the Grantha letters ஜ ஷ ஸ ஹ ஶ and க்ஷ
// for what Tamil lacks. No superscript digits. Visarga ஃ, anusvara ம், avagraha ’ (U+2019), ṛ -> ரு.
const T_CONS = {
  k: 'க', kh: 'க', g: 'க', gh: 'க', ṅ: 'ங', c: 'ச', ch: 'ச', j: 'ஜ', jh: 'ஜ', ñ: 'ஞ', ṭ: 'ட', ṭh: 'ட', ḍ: 'ட', ḍh: 'ட', ṇ: 'ண',
  t: 'த', th: 'த', d: 'த', dh: 'த', n: 'ன', p: 'ப', ph: 'ப', b: 'ப', bh: 'ப', m: 'ம', y: 'ய', r: 'ர', l: 'ல', v: 'வ',
  ś: 'ஶ', ṣ: 'ஷ', s: 'ஸ', h: 'ஹ', ḷ: 'ள',
};
const T_VOWEL = {
  a: ['அ', ''], ā: ['ஆ', 'ா'], i: ['இ', 'ி'], ī: ['ஈ', 'ீ'], u: ['உ', 'ு'], ū: ['ஊ', 'ூ'],
  e: ['ஏ', 'ே'], ai: ['ஐ', 'ை'], o: ['ஓ', 'ோ'], au: ['ஔ', 'ௌ'],
};
const T_PULLI = '்';
const VELAR = new Set(['k', 'kh', 'g', 'gh', 'ṅ']);
const PALATAL = new Set(['c', 'ch', 'j', 'jh', 'ñ']);
// n is ந (the dental letter) where it starts a word, touches another consonant of the dental row, or follows a consonant
// (hanti, nityam, kṛṣṇa-n..., nna), and ன between vowels, at the end of a word and before the other consonants (mānyate, yena,
// bhagavān) — the way the hand-corrected chapters write it.
const DENTAL_ROW = new Set(['t', 'th', 'd', 'dh', 'n']);

/** Tokens of one run of IAST letters: { type: 'v' | 'c' | 'r' | 'x', key } */
function tamilTokens(s) {
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i]; const two = c + (s[i + 1] ?? '');
    if (two === 'ai' || two === 'au') { tokens.push({ type: 'v', key: two }); i += 2; continue; }
    if (c === 'ṛ' || c === 'ṝ') { tokens.push({ type: 'r', key: c }); i++; continue; }
    if (T_VOWEL[c]) { tokens.push({ type: 'v', key: c }); i++; continue; }
    if (s[i + 1] === 'h' && ASPIRABLE.has(c) && T_CONS[two]) { tokens.push({ type: 'c', key: two }); i += 2; continue; }
    if (T_CONS[c]) { tokens.push({ type: 'c', key: c }); i++; continue; }
    tokens.push({ type: 'x', key: c }); i++;
  }
  return tokens;
}

/** One run of IAST letters (no spaces / hyphens / punctuation), lower case, into Tamil script. */
function tamilWord(w) {
  const tokens = tamilTokens([...w.normalize('NFC')]);
  const out = [];
  let pending = null; // a consonant written without its vowel yet
  const settle = () => { if (pending !== null) { out.push(pending + T_PULLI); pending = null; } };
  for (let t = 0; t < tokens.length; t++) {
    const { type, key } = tokens[t];
    if (type === 'v') {
      const [independent, dependent] = T_VOWEL[key];
      if (pending !== null) { out.push(pending + dependent); pending = null; } else out.push(independent);
    } else if (type === 'r') { // ṛ is the syllable ரு, ṝ is ரூ
      settle();
      out.push(key === 'ṛ' ? 'ரு' : 'ரூ');
    } else if (type === 'c') {
      settle();
      if (key === 'n') {
        const before = tokens[t - 1]; const after = tokens[t + 1];
        const dental = t === 0 || (before && before.type === 'c') || (after && after.type === 'c' && DENTAL_ROW.has(after.key));
        pending = dental ? 'ந' : 'ன';
      } else pending = T_CONS[key];
    } else if (key === 'ṃ' || key === 'ṁ') { // before a velar or a palatal the anusvara is written as that row's nasal, as in saṅga, sañjaya
      settle();
      const after = tokens[t + 1];
      out.push(after && after.type === 'c' && VELAR.has(after.key) ? 'ங்' : after && after.type === 'c' && PALATAL.has(after.key) ? 'ஞ்' : 'ம்');
    } else if (key === 'ḥ') { settle(); out.push('ஃ'); }
    else if (key === '’' || key === "'" || key === 'ʼ') { settle(); out.push('’'); }
    else { settle(); out.push(key); } // a digit or a stray mark stays as it is
  }
  settle();
  const text = out.join('');
  // Arjuna's name: every Pārtha of the corrected chapters is written with the doubled த
  return w.startsWith('pārth') ? text.replace('பார்த', 'பார்த்த') : text;
}

/** A run of IAST into Tamil: words converted, separators kept. */
export function iastToTamil(text) {
  return avagraha(text).split(SEPARATORS).map((part, idx) => (idx % 2 === 1 || part === '' ? part : tamilWord(part.toLowerCase()))).join('');
}

// ---------- any Indic script -> Devanagari (by position) -> IAST / Malayalam ----------
const BLOCK_BASE = [0x0980, 0x0a00, 0x0a80, 0x0b00, 0x0c00, 0x0c80, 0x0d00]; // Bengali Gurmukhi Gujarati Odia Telugu Kannada Malayalam
const isIndicLetterOrSign = (cp) => cp >= 0x0900 && cp <= 0x0dff && cp !== 0x0964 && cp !== 0x0965 && !(cp >= 0x0b80 && cp <= 0x0bff);
function digitOf(cp) {
  for (const base of [0x0900, ...BLOCK_BASE]) if (cp >= base + 0x66 && cp <= base + 0x6f) return String(cp - base - 0x66);
  return null;
}

// Malayalam's atomic chillu letters (ൺ ൻ ർ ൽ ൾ ൿ) have no place in the parallel blocks: a consonant with a virama each.
const CHILLU_TO_DEVANAGARI = { 0x0d7a: 'ण्', 0x0d7b: 'न्', 0x0d7c: 'र्', 0x0d7d: 'ल्', 0x0d7e: 'ळ्', 0x0d7f: 'क्' };

/** Position-for-position mapping onto Devanagari; digits become ASCII, the danda stays. Tamil is left alone (its block is not parallel). */
export function toDevanagari(text) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const digit = digitOf(cp);
    if (digit !== null) { out += digit; continue; }
    if (CHILLU_TO_DEVANAGARI[cp]) { out += CHILLU_TO_DEVANAGARI[cp]; continue; }
    if (!isIndicLetterOrSign(cp)) { out += ch; continue; }
    const base = cp >= 0x0900 && cp <= 0x097f ? 0x0900 : BLOCK_BASE.find((b) => cp >= b && cp < b + 0x80);
    out += String.fromCodePoint(cp - base + 0x0900);
  }
  return out;
}

const D_CONS = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'ṅ', च: 'c', छ: 'ch', ज: 'j', झ: 'jh', ञ: 'ñ', ट: 'ṭ', ठ: 'ṭh', ड: 'ḍ', ढ: 'ḍh', ण: 'ṇ',
  त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n', प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', व: 'v',
  श: 'ś', ष: 'ṣ', स: 's', ह: 'h', ळ: 'ḷ', ऱ: 'r', ऩ: 'n', ऴ: 'ḷ',
};
const D_VOWEL = { अ: 'a', आ: 'ā', इ: 'i', ई: 'ī', उ: 'u', ऊ: 'ū', ऋ: 'ṛ', ॠ: 'ṝ', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऍ: 'e', ऑ: 'o', ऎ: 'e', ऒ: 'o' };
const D_MATRA = { 'ा': 'ā', 'ि': 'i', 'ी': 'ī', 'ु': 'u', 'ू': 'ū', 'ृ': 'ṛ', 'ॄ': 'ṝ', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॅ': 'e', 'ॉ': 'o', 'ॆ': 'e', 'ॊ': 'o' };

/** Devanagari (after toDevanagari) to IAST. */
function devanagariToIast(text) {
  const ch = [...text.replace(/[़‌‍]/g, '')];
  let out = '';
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (D_CONS[c]) {
      out += D_CONS[c];
      const next = ch[i + 1];
      if (next === '्') i++;
      else if (D_MATRA[next]) { out += D_MATRA[next]; i++; }
      else out += 'a';
    } else if (D_VOWEL[c]) out += D_VOWEL[c];
    else if (c === 'ं' || c === 'ँ') out += 'ṃ';
    else if (c === 'ः') out += 'ḥ';
    else if (c === 'ऽ') out += '’';
    else if (c === 'ॐ') out += 'oṃ';
    else out += c;
  }
  return out;
}
export const indicToIast = (text) => devanagariToIast(toDevanagari(text));

/**
 * Letter-for-letter into Malayalam script, for stray Devanagari / Bengali / Kannada ... inside Malayalam text.
 * The Malayalam letters already there are not touched; chillu letters are used the way the rest of the corpus does
 * (a final n ṇ l ḷ r, and r before a consonant other than y), but only where the converted letters make the sequence.
 */
export function indicToMalayalam(text) {
  const out = []; // { ch, converted }
  for (const c of text) {
    const cp = c.codePointAt(0);
    const digit = digitOf(cp);
    if (digit !== null) { out.push({ ch: digit, converted: true }); continue; }
    if (!isIndicLetterOrSign(cp) || (cp >= 0x0d00 && cp <= 0x0d7f)) { out.push({ ch: c, converted: false }); continue; }
    const deva = toDevanagari(c);
    if (deva === '़') continue; // nukta
    if (deva === 'ॐ') { out.push({ ch: 'ഓം', converted: true }); continue; }
    if (deva === 'ँ') { out.push({ ch: 'ം', converted: true }); continue; } // candrabindu
    out.push({ ch: String.fromCodePoint(deva.codePointAt(0) + 0x0400), converted: true });
  }
  // chillu: only for letters this call produced
  const isConsonant = (x) => x && x.length === 1 && x >= 'ക' && x <= 'ഹ';
  const res = [];
  for (let i = 0; i < out.length; i++) {
    const cur = out[i]; const virama = out[i + 1]; const after = out[i + 2];
    if (cur.converted && virama && virama.ch === M_VIRAMA && CHILLU_FINAL[cur.ch]) {
      const atEnd = !after || !/[\p{L}\p{M}]/u.test(after.ch);
      if (atEnd) { res.push(CHILLU_FINAL[cur.ch]); i++; continue; }
      if (cur.ch === 'ര' && isConsonant(after.ch) && after.ch !== 'യ') { res.push('ർ'); i++; continue; }
    }
    res.push(cur.ch);
  }
  return res.join('');
}

// ---------- a transliteration line of the source ----------
/** The source's danda marks: " ." at the end of a half-line and "||1-1||" at the end of the verse. */
export function sanskritLine(line, lang) {
  let t = line.trim();
  let tail = '';
  const verse = /\s*\|\|\s*([0-9]+(?:-[0-9]+)*)\s*\|\|\s*$/.exec(t);
  if (verse) { tail = ` ॥${verse[1]}॥`; t = t.slice(0, verse.index); }
  else if (/\s\.$/.test(t) || /\s*\|$/.test(t)) { tail = ' ।'; t = t.replace(/\s*[.|]$/, ''); }
  const converted = lang === 'ml' ? iastToMalayalam(t) : iastToTamil(t);
  return converted.replace(/\s+$/, '') + tail;
}

// ---------- loose sound skeletons ----------
const KEY_MAP = { ā: 'a', ī: 'i', ū: 'u', ṝ: 'ṛ', ṅ: 'n', ñ: 'n', ṇ: 'n', m: 'n', ṃ: 'n', ś: 's', ṣ: 's', ḥ: 'h', ḷ: 'l', g: 'k', j: 'c', ṭ: 't', ḍ: 't', d: 't', b: 'p' };

/** IAST (the source's, or one read back from a script) reduced to a skeleton that ignores length, voicing, aspiration and the nasal / sibilant classes. */
export function iastKey(s) {
  let t = s.normalize('NFC').toLowerCase().replace(/(?<=\p{L})\.a/gu, '').replace(/(?<=\p{L})\.(?=\p{L})/gu, '').replace(/ṁ/g, 'ṃ').replace(/m̐/g, 'ṃ');
  t = t.replace(/([kgcjṭḍtdpb])h/g, '$1');
  let out = '';
  for (const ch of t) {
    if (ch === 'ṛ') { out += 'ru'; continue; }
    if (!/[a-zāīūṛṝṅñṭḍṇśṣṃḥḷ]/.test(ch)) continue;
    out += KEY_MAP[ch] ?? ch;
  }
  return out;
}

const ML_CONS = { ക: 'k', ഖ: 'kh', ഗ: 'g', ഘ: 'gh', ങ: 'ṅ', ച: 'c', ഛ: 'ch', ജ: 'j', ഝ: 'jh', ഞ: 'ñ', ട: 'ṭ', ഠ: 'ṭh', ഡ: 'ḍ', ഢ: 'ḍh', ണ: 'ṇ', ത: 't', ഥ: 'th', ദ: 'd', ധ: 'dh', ന: 'n', പ: 'p', ഫ: 'ph', ബ: 'b', ഭ: 'bh', മ: 'm', യ: 'y', ര: 'r', ല: 'l', വ: 'v', ശ: 'ś', ഷ: 'ṣ', സ: 's', ഹ: 'h', ള: 'ḷ', ഴ: 'ḷ', റ: 'r' };
const ML_VOWEL = { അ: 'a', ആ: 'ā', ഇ: 'i', ഈ: 'ī', ഉ: 'u', ഊ: 'ū', ഋ: 'ṛ', ൠ: 'ṝ', എ: 'e', ഏ: 'e', ഐ: 'ai', ഒ: 'o', ഓ: 'o', ഔ: 'au' };
const ML_MATRA = { 'ാ': 'ā', 'ി': 'i', 'ീ': 'ī', 'ു': 'u', 'ൂ': 'ū', 'ൃ': 'ṛ', 'െ': 'e', 'േ': 'e', 'ൈ': 'ai', 'ൊ': 'o', 'ോ': 'o', 'ൗ': 'au', 'ൌ': 'au' };
const ML_CHILLU = { 'ൻ': 'n', 'ർ': 'r', 'ൽ': 'l', 'ൾ': 'ḷ', 'ൺ': 'ṇ', 'ൿ': 'k' };

/** Malayalam read back as IAST — for the sound skeleton only. */
function malayalamToIast(text) {
  const ch = [...text];
  let out = '';
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (ML_CONS[c]) {
      out += ML_CONS[c];
      const next = ch[i + 1];
      if (next === M_VIRAMA) i++;
      else if (ML_MATRA[next]) { out += ML_MATRA[next]; i++; }
      else out += 'a';
    } else if (ML_VOWEL[c]) out += ML_VOWEL[c];
    else if (ML_CHILLU[c]) out += ML_CHILLU[c];
    else if (c === 'ം') out += 'ṃ';
    else if (c === 'ഃ') out += 'ḥ';
    else if (c === 'ഽ') out += '’';
    else if (c === '‌' || c === '‍') continue;
    else out += c;
  }
  return out;
}

// Tamil -> a key directly (Tamil script already merges most of what the key merges)
const TK_CONS = { க: 'k', ங: 'n', ச: 'c', ஞ: 'n', ட: 't', ண: 'n', த: 't', ந: 'n', ப: 'p', ம: 'n', ய: 'y', ர: 'r', ல: 'l', வ: 'v', ழ: 'l', ள: 'l', ற: 'r', ன: 'n', ஜ: 'c', ஷ: 's', ஸ: 's', ஹ: 'h', ஶ: 's' };
const TK_VOWEL = { அ: 'a', ஆ: 'a', இ: 'i', ஈ: 'i', உ: 'u', ஊ: 'u', எ: 'e', ஏ: 'e', ஐ: 'ai', ஒ: 'o', ஓ: 'o', ஔ: 'au' };
const TK_MATRA = { 'ா': 'a', 'ி': 'i', 'ீ': 'i', 'ு': 'u', 'ூ': 'u', 'ெ': 'e', 'ே': 'e', 'ை': 'ai', 'ொ': 'o', 'ோ': 'o', 'ௌ': 'au' };

function tamilKey(text) {
  const ch = [...text];
  let out = '';
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (TK_CONS[c]) {
      out += TK_CONS[c];
      const next = ch[i + 1];
      if (next === T_PULLI) i++;
      else if (TK_MATRA[next]) { out += TK_MATRA[next]; i++; }
      else out += 'a';
    } else if (TK_VOWEL[c]) out += TK_VOWEL[c];
    else if (c === 'ஃ') out += 'h';
  }
  return out;
}

/** The key of a script text in the language: both languages end up in the same alphabet as iastKey of the source. */
export function scriptKey(lang, text) {
  return lang === 'ml' ? iastKey(malayalamToIast(text)) : tamilKey(text);
}

/** Levenshtein distance between two strings (two-row version). */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** 0 = identical skeleton, 1 = nothing in common. */
export const distance = (a, b) => (Math.max(a.length, b.length) === 0 ? 0 : levenshtein(a, b) / Math.max(a.length, b.length));

/** The Sanskrit of an IAST text in the language's script. */
export const iastTo = (lang, text) => (lang === 'ml' ? iastToMalayalam(text) : iastToTamil(text));
