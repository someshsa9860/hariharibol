// Script conversion for the Malayalam / Tamil fix. Pure functions, no I/O.
//
//   iastToMalayalam(iast)      Roman IAST (what the English source uses) -> Malayalam script
//   iastToTamil(iast)          Roman IAST -> Tamil script, plain-letter style (re-export of ta/iast.mjs)
//   indicToMalayalam(text)     any other Indic script (Devanagari, Bengali, Kannada ...) -> Malayalam, letter by letter
//   indicToIast(text)          any other Indic script -> IAST (so Tamil can be produced from it)
//   sanskritLine(iastLine, lang)   one transliteration line of the source -> the language's script (danda, verse number)
//   iastKey / scriptKey(lang)  a loose "sound skeleton" used only to measure how far two spellings are from each other
import { iastToTamil } from '../ta/iast.mjs';
export { iastToTamil };

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
const VIRAMA = '്';
const CHILLU_FINAL = { ന: 'ൻ', ണ: 'ൺ', ല: 'ൽ', ള: 'ൾ', ര: 'ർ' };
const ASPIRABLE = new Set(['k', 'g', 'c', 'j', 'ṭ', 'ḍ', 't', 'd', 'p', 'b']);

/** One run of IAST letters (no spaces / hyphens / punctuation), lower case, into Malayalam script. */
function mlWord(w) {
  const s = [...w.normalize('NFC')];
  const out = [];
  let pending = null; // a consonant written without its vowel yet
  let i = 0;
  const flush = (next) => {
    if (pending === null) return;
    // a final n ṇ l ḷ r is the chillu letter; r before another consonant (but not y) is the chillu r too
    if (next === null && CHILLU_FINAL[pending]) out.push(CHILLU_FINAL[pending]);
    else if (pending === 'ര' && next !== null && next !== 'യ') out.push('ർ');
    else out.push(pending + VIRAMA);
    pending = null;
  };
  while (i < s.length) {
    const c = s[i]; const two = c + (s[i + 1] ?? '');
    if (c === '’' || c === "'" || c === 'ʼ') { flush(null); out.push('ഽ'); i++; continue; }
    if (c === 'ṃ' || c === 'ṁ' || c === 'ṁ') { if (pending !== null) { out.push(pending + VIRAMA); pending = null; } out.push('ം'); i++; continue; }
    if (c === 'ḥ') { if (pending !== null) { out.push(pending + VIRAMA); pending = null; } out.push('ഃ'); i++; continue; }
    if (M_VOWEL[two] && (two === 'ai' || two === 'au')) {
      const [ind, dep] = M_VOWEL[two];
      if (pending !== null) { out.push(pending + dep); pending = null; } else out.push(ind);
      i += 2; continue;
    }
    if (M_VOWEL[c]) {
      const [ind, dep] = M_VOWEL[c];
      if (pending !== null) { out.push(pending + dep); pending = null; } else out.push(ind);
      i++; continue;
    }
    let cons = null; let len = 1;
    if (s[i + 1] === 'h' && ASPIRABLE.has(c) && M_CONS[two]) { cons = M_CONS[two]; len = 2; }
    else if (M_CONS[c]) cons = M_CONS[c];
    if (cons === null) { flush(null); out.push(c); i++; continue; } // a digit or a stray mark stays as it is
    if (pending !== null) flush(cons);
    pending = cons; i += len;
  }
  if (pending === 'മ') { pending = null; out.push('ം'); } // a word-final m is written as the anusvara, as the corpus does
  flush(null);
  return out.join('');
}

const SEP = /([ \-–—,;.:|?!()‘’“”"\[\]/\n]+)/;
/** The source writes the avagraha as ".a" between two letters (ko.atra = ko 'tra): the "a" is part of the code, not a vowel. */
const avagraha = (t) => t.replace(/(?<=\p{L})\.a/gu, 'ʼ').replace(/(?<=\p{L})\.(?=\p{L})/gu, 'ʼ');
/** A run of IAST: words converted, separators (spaces, hyphens, punctuation) kept. */
export function iastToMalayalam(text) {
  return avagraha(text).split(SEP).map((part, idx) => (idx % 2 === 1 || part === '' ? part : mlWord(part.toLowerCase()))).join('');
}

// ---------- any Indic script -> Devanagari (by position) -> IAST / Malayalam ----------
const BLOCK_BASE = [0x0980, 0x0a00, 0x0a80, 0x0b00, 0x0c00, 0x0c80, 0x0d00]; // Bengali Gurmukhi Gujarati Odia Telugu Kannada Malayalam
const isIndicLetterOrSign = (cp) => cp >= 0x0900 && cp <= 0x0dff && cp !== 0x0964 && cp !== 0x0965 && !(cp >= 0x0b80 && cp <= 0x0bff);
function digitOf(cp) {
  for (const base of [0x0900, ...BLOCK_BASE]) if (cp >= base + 0x66 && cp <= base + 0x6f) return String(cp - base - 0x66);
  return null;
}
/** Position-for-position mapping onto Devanagari; digits become ASCII, danda stays. */
export function toDeva(text) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const d = digitOf(cp);
    if (d !== null) { out += d; continue; }
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
/** Devanagari (after toDeva) to IAST. */
export function devaToIast(text) {
  const ch = [...text.replace(/[़‌‍]/g, '')];
  let out = '';
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (D_CONS[c]) {
      out += D_CONS[c];
      const n = ch[i + 1];
      if (n === '्') i++;
      else if (D_MATRA[n]) { out += D_MATRA[n]; i++; }
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
export const indicToIast = (text) => devaToIast(toDeva(text));

/**
 * Letter-for-letter into Malayalam script, for stray Devanagari / Bengali / Kannada ... inside Malayalam text.
 * The Malayalam letters already there are not touched; chillu letters are used the way the rest of the corpus does
 * (a final n ṇ l ḷ r, and r before a consonant other than y), but only where the converted letters make the sequence.
 */
export function indicToMalayalam(text) {
  const chars = [...text];
  const out = []; // { ch, conv }
  for (const c of chars) {
    const cp = c.codePointAt(0);
    const d = digitOf(cp);
    if (d !== null) { out.push({ ch: d, conv: true }); continue; }
    if (!isIndicLetterOrSign(cp) || (cp >= 0x0d00 && cp <= 0x0d7f)) { out.push({ ch: c, conv: false }); continue; }
    const dv = toDeva(c);
    if (dv === '़') continue; // nukta
    if (dv === 'ॐ') { out.push({ ch: 'ഓം', conv: true }); continue; }
    if (dv === 'ँ') { out.push({ ch: 'ം', conv: true }); continue; } // candrabindu
    const mapped = String.fromCodePoint(dv.codePointAt(0) + 0x0400);
    out.push({ ch: mapped, conv: true });
  }
  // chillu: only for letters this call produced
  const isCons = (x) => x && x.length === 1 && x >= 'ക' && x <= 'ഹ';
  const res = [];
  for (let i = 0; i < out.length; i++) {
    const cur = out[i]; const virama = out[i + 1]; const after = out[i + 2];
    if (cur.conv && virama && virama.ch === VIRAMA && CHILLU_FINAL[cur.ch]) {
      const atEnd = !after || !/[\p{L}\p{M}]/u.test(after.ch);
      if (atEnd) { res.push(CHILLU_FINAL[cur.ch]); i++; continue; }
      if (cur.ch === 'ര' && isCons(after.ch) && after.ch !== 'യ') { res.push('ർ'); i++; continue; }
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
  const m = /\s*\|\|\s*([0-9]+(?:-[0-9]+)*)\s*\|\|\s*$/.exec(t);
  if (m) { tail = ` ॥${m[1]}॥`; t = t.slice(0, m.index); }
  else if (/\s\.$/.test(t) || /\s*\|$/.test(t)) { tail = ' ।'; t = t.replace(/\s*[.|]$/, ''); }
  const conv = lang === 'ml' ? iastToMalayalam(t) : iastToTamil(avagraha(t).replace(/ʼ/g, '’'));
  return conv.replace(/\s+$/, '') + tail;
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

// Malayalam -> IAST (read back), for the key only
const ML_CONS = { ക: 'k', ഖ: 'kh', ഗ: 'g', ഘ: 'gh', ങ: 'ṅ', ച: 'c', ഛ: 'ch', ജ: 'j', ഝ: 'jh', ഞ: 'ñ', ട: 'ṭ', ഠ: 'ṭh', ഡ: 'ḍ', ഢ: 'ḍh', ണ: 'ṇ', ത: 't', ഥ: 'th', ദ: 'd', ധ: 'dh', ന: 'n', പ: 'p', ഫ: 'ph', ബ: 'b', ഭ: 'bh', മ: 'm', യ: 'y', ര: 'r', ല: 'l', വ: 'v', ശ: 'ś', ഷ: 'ṣ', സ: 's', ഹ: 'h', ള: 'ḷ', ഴ: 'ḷ', റ: 'r' };
const ML_VOWEL = { അ: 'a', ആ: 'ā', ഇ: 'i', ഈ: 'ī', ഉ: 'u', ഊ: 'ū', ഋ: 'ṛ', ൠ: 'ṝ', എ: 'e', ഏ: 'e', ഐ: 'ai', ഒ: 'o', ഓ: 'o', ഔ: 'au' };
const ML_MATRA = { 'ാ': 'ā', 'ി': 'i', 'ീ': 'ī', 'ു': 'u', 'ൂ': 'ū', 'ൃ': 'ṛ', 'െ': 'e', 'േ': 'e', 'ൈ': 'ai', 'ൊ': 'o', 'ോ': 'o', 'ൗ': 'au', 'ൌ': 'au' };
const ML_CHILLU = { 'ൻ': 'n', 'ർ': 'r', 'ൽ': 'l', 'ൾ': 'ḷ', 'ൺ': 'ṇ', 'ൿ': 'k' };
export function malayalamToIast(text) {
  const ch = [...text];
  let out = '';
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (ML_CONS[c]) {
      out += ML_CONS[c];
      const n = ch[i + 1];
      if (n === VIRAMA) i++;
      else if (ML_MATRA[n]) { out += ML_MATRA[n]; i++; }
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
const T_CONS = { க: 'k', ங: 'n', ச: 'c', ஞ: 'n', ட: 't', ண: 'n', த: 't', ந: 'n', ப: 'p', ம: 'n', ய: 'y', ர: 'r', ல: 'l', வ: 'v', ழ: 'l', ள: 'l', ற: 'r', ன: 'n', ஜ: 'c', ஷ: 's', ஸ: 's', ஹ: 'h', ஶ: 's' };
const T_VOWEL = { அ: 'a', ஆ: 'a', இ: 'i', ஈ: 'i', உ: 'u', ஊ: 'u', எ: 'e', ஏ: 'e', ஐ: 'ai', ஒ: 'o', ஓ: 'o', ஔ: 'au' };
const T_MATRA = { 'ா': 'a', 'ி': 'i', 'ீ': 'i', 'ு': 'u', 'ூ': 'u', 'ெ': 'e', 'ே': 'e', 'ை': 'ai', 'ொ': 'o', 'ோ': 'o', 'ௌ': 'au' };
export function tamilKey(text) {
  const ch = [...text];
  let out = '';
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i];
    if (T_CONS[c]) {
      out += T_CONS[c];
      const n = ch[i + 1];
      if (n === '்') i++;
      else if (T_MATRA[n]) { out += T_MATRA[n]; i++; }
      else out += 'a';
    } else if (T_VOWEL[c]) out += T_VOWEL[c];
    else if (c === 'ஃ') out += 'h';
  }
  return out;
}

/** The key of a script text in the language: both languages end up in the same alphabet as iastKey of the source. */
export function scriptKey(lang, text) {
  return lang === 'ml' ? iastKey(malayalamToIast(text)) : tamilKey(text);
}

/** Levenshtein distance between two strings (two-row version). */
export function lev(a, b) {
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
export const distance = (a, b) => (Math.max(a.length, b.length) === 0 ? 0 : lev(a, b) / Math.max(a.length, b.length));
