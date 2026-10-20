// Letter machinery for repairing the Kannada Śrīmad-Bhāgavatam transliteration lines. Pure functions: nothing here reads
// or writes a file, S3 or the database.
//
// Why this exists: the model wrote the Sanskrit line (and the headwords of the word list) in the wrong script for ~10% of
// the verses, left stray letters of other scripts inside Kannada, and slipped on single letters. The English chapter file
// carries the verse in real Devanagari (`sanskrit`), which is an oracle for which letter is meant. We never replace the
// stored line with the source (the stored line is word-separated like the English transliteration, the source is in
// sandhi): we move wrong-script letters onto the Kannada block, and mend an isolated letter only where the two clearly agree
// that the stored one is a slip.
//
// NEVER use scripts/fix-translation-script.js on the Bhagavatam: it rebuilds the Sanskrit from the English ASCII
// transliteration, which has lost ś / ṛ / ā.

const cp = (c) => c.codePointAt(0);
const isKn = (c) => { const n = cp(c); return n >= 0x0c82 && n <= 0x0cff && !(n >= 0x0ce6 && n <= 0x0cef); };

export const CONSONANT = 'ಕಖಗಘಙಚಛಜಝಞಟಠಡಢಣತಥದಧನಪಫಬಭಮಯರಲವಶಷಸಹಳ';
export const isCons = (c) => CONSONANT.includes(c);
const INDEP_VOWELS = 'ಅಆಇಈಉಊಋೠಎಏಐಒಓಔ';
const INDEP = { ಅ: '', ಆ: 'ಾ', ಇ: 'ಿ', ಈ: 'ೀ', ಉ: 'ು', ಊ: 'ೂ', ಋ: 'ೃ', ೠ: 'ೄ', ಎ: 'ೆ', ಏ: 'ೇ', ಐ: 'ೈ', ಒ: 'ೊ', ಓ: 'ೋ', ಔ: 'ೌ' };
const VIRAMA = '್';

// Blocks whose letters sit at a fixed distance from the same letter in the Kannada block (U+0C80).
const OFFSETS = [
  ['Devanagari', 0x0900, 0x097f, 0x380],
  ['Bengali', 0x0980, 0x09ff, 0x300],
  ['Gurmukhi', 0x0a00, 0x0a7f, 0x280],
  ['Gujarati', 0x0a80, 0x0aff, 0x200],
  ['Odia', 0x0b00, 0x0b7f, 0x180],
  ['Tamil', 0x0b80, 0x0bff, 0x100], // lossy: Tamil has no aspirates, so the alignment mends those afterwards
  ['Telugu', 0x0c00, 0x0c7f, 0x80],
  ['Malayalam', 0x0d00, 0x0d7f, -0x80],
];

export const scriptName = (ch) => {
  const n = cp(ch);
  if (n === 0x0964 || n === 0x0965) return null; // danda is shared by every Indic script
  for (const [name, lo, hi] of OFFSETS) if (n >= lo && n <= hi) return name;
  return null;
};

/**
 * Letters of other Indic scripts moved onto the Kannada block, position for position. `scripts` limits which scripts are
 * moved (default: all of them). ॐ becomes ಓಂ (U+0950 has no Kannada twin); a code point with no assigned Kannada
 * counterpart is left as it was, so the caller can see it is still foreign.
 */
export function toKannada(text, scripts = null) {
  let out = '';
  for (const ch of text.replace(/ॐ/g, 'ओं')) {
    const name = scriptName(ch);
    if (!name || (scripts && !scripts.includes(name))) { out += ch; continue; }
    const off = OFFSETS.find(([n]) => n === name)[3];
    const moved = String.fromCodePoint(cp(ch) + off);
    out += /\p{Script=Kannada}/u.test(moved) && /\p{Assigned}/u.test(moved) ? moved : ch;
  }
  return out;
}

/** Sanskrit has no short e or o: the model writes them for ए / ओ. For the transliteration line and the headwords only. */
export const longEO = (text) => text.replace(/ೆ/g, 'ೇ').replace(/ೊ/g, 'ೋ').replace(/ಎ/g, 'ಏ').replace(/ಒ/g, 'ಓ');

/** `॥೧.೧.೫॥`, `॥1-1-18॥`, `॥೪೫॥` … at the end of a line: the verse number, which is no part of the Sanskrit. A plain `॥` or `।` stays. */
export function stripNumberTail(text) {
  return text.replace(/\s*॥\s*[0-9०-९೦-೯]+(?:\s*[.\-–]\s*[0-9०-९೦-೯]+)*\s*॥\s*$/u, '').trimEnd();
}

/** The source line as Kannada letters: no verse marker, no ZW joiners, visarga colon mended, candrabindu → anusvara. */
export function sourceToKannada(s) {
  let t = s.normalize('NFC').replace(/ॐ/g, 'ओं').replace(/॥[^॥]*॥/g, ' ');
  t = t.replace(/(?<=[ऀ-ॿ]):/g, 'ः');
  return toKannada(t, ['Devanagari']).replace(/[​-‍⁠﻿]/g, '').replace(/ಁ/g, 'ಂ').replace(/಼/g, '');
}

/**
 * Tokens of a line: only Kannada letters and signs (and the avagraha), each with where it sits in the string (`idx`), which
 * separator-delimited word it is in (`word`), and whether a normalising rule made it (`syn`). The rules are applied the same
 * way to the source and to the stored line, so a spelling habit is not counted as an edit:
 *   nasal + virama before a consonant of its own row → anusvara       (ಸಙ್ಗ = ಸಂಗ)
 *   ಮ್ + consonant                                    → anusvara
 *   consonant + virama + a vowel that starts the next word → consonant + the vowel's sign
 */
export function tokens(text) {
  const t = [];
  let word = 0;
  let prevSep = true;
  let idx = 0;
  for (const ch of text) {
    if (isKn(ch) || ch === 'ಽ') { t.push({ ch, idx, word, syn: false }); prevSep = false; }
    else if (/[\s\-–—.,;:!?()[\]'"‘’“”|।॥/]/.test(ch)) { if (!prevSep) word++; prevSep = true; }
    idx += ch.length;
  }
  const ROW = { ಙ: ['ಕ', 'ಘ'], ಞ: ['ಚ', 'ಝ'], ಣ: ['ಟ', 'ಢ'], ನ: ['ತ', 'ಧ'], ಮ: ['ಪ', 'ಭ'] };
  const out = [];
  for (let i = 0; i < t.length; i++) {
    const a = t[i];
    const b = t[i + 1];
    const c = t[i + 2];
    if (ROW[a.ch] && b?.ch === VIRAMA && c && isCons(c.ch) && c.ch >= ROW[a.ch][0] && c.ch <= ROW[a.ch][1]) { out.push({ ch: 'ಂ', idx: a.idx, word: a.word, syn: true }); i++; continue; }
    if (a.ch === 'ಮ' && b?.ch === VIRAMA && c && isCons(c.ch)) { out.push({ ch: 'ಂ', idx: a.idx, word: a.word, syn: true }); i++; continue; }
    if (isCons(a.ch) && b?.ch === VIRAMA && c && INDEP_VOWELS.includes(c.ch) && c.word !== a.word) {
      out.push(a);
      if (INDEP[c.ch]) out.push({ ch: INDEP[c.ch], idx: c.idx, word: c.word, syn: true });
      i += 2;
      continue;
    }
    out.push(a);
  }
  return out;
}

/** Edit script between two token arrays (compared by `.ch`): [{ op: 'eq' | 'sub' | 'ins' | 'del', a?, b? }] in order. a = stored, b = source. */
export function align(A, B) {
  const n = A.length;
  const m = B.length;
  const D = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 0; i <= n; i++) D[i][0] = i;
  for (let j = 0; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (A[i - 1].ch === B[j - 1].ch ? 0 : 1));
  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && A[i - 1].ch === B[j - 1].ch && D[i][j] === D[i - 1][j - 1]) { ops.push({ op: 'eq', a: A[i - 1], b: B[j - 1] }); i--; j--; }
    else if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + 1) { ops.push({ op: 'sub', a: A[i - 1], b: B[j - 1] }); i--; j--; }
    else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.push({ op: 'del', a: A[i - 1] }); i--; }
    else { ops.push({ op: 'ins', b: B[j - 1] }); j--; }
  }
  return { dist: D[n][m], ops: ops.reverse() };
}

const SAME_CLASS = [['ಿ', 'ೀ'], ['ು', 'ೂ'], ['ಇ', 'ಈ'], ['ಉ', 'ಊ'], ['ಅ', 'ಆ']];
const sameClass = (x, y) => SAME_CLASS.some(([p, q]) => (x === p && y === q) || (x === q && y === p));
const MAX_OPS = 8; // a line that needs more is not a slip but a different line: left alone

/**
 * Mends isolated slips in `stored` (already Kannada, no number tail, long e/o) against the source line. Patches only:
 *   · one consonant for another        (ಶ↔ಸ, ಣ↔ನ …)
 *   · i/ī, u/ū (and the same three independent vowels) for one another
 *   · an ā sign missing or added
 * and only where the letter is flanked on both sides by two exact tokens and is not in the last akshara of its stored word
 * (the source is in sandhi, so word ends differ legitimately). Everything else is reported in `left`, not changed.
 * → { text, patched: [{ at, from, to }], left: [reason strings], skipped: boolean }
 */
export function mend(stored, sourceLine) {
  const T = tokens(stored);
  const S = tokens(sourceToKannada(sourceLine));
  const { dist, ops } = align(T, S);
  const result = { text: stored, patched: [], left: [], dist };
  if (!dist) return result;
  if (dist > MAX_OPS) { result.left.push(`${dist} differences: too many to mend`); return result; }

  const eqRun = (from, step) => { let k = 0; for (let q = from; q >= 0 && q < ops.length && ops[q].op === 'eq' && k < 2; q += step) k++; return k; };
  const hasLaterConsonant = (tok) => T.some((u) => u.word === tok.word && u.idx > tok.idx && isCons(u.ch));
  const isWordStart = (tok) => !T.some((u) => u.word === tok.word && u.idx < tok.idx);
  const edits = []; // { idx, del, ins, word }
  const refused = new Set(); // stored words that hold a difference we are not mending: the word is left whole, never half-mended

  ops.forEach((o, k) => {
    if (o.op === 'eq') return;
    const label = `${o.op} ${o.a?.ch ?? ''}${o.b?.ch ?? ''}`;
    const stub = o.a ?? [...ops.slice(0, k)].reverse().find((p) => p.a)?.a; // the stored token at (or just before) this place
    const refuse = (why) => { result.left.push(`${label}: ${why}`); if (stub) refused.add(stub.word); };
    if (eqRun(k - 1, -1) < 2 || eqRun(k + 1, 1) < 2) return refuse('not isolated');
    if (!stub || o.a?.syn || o.b?.syn || stub.syn) return refuse('spelling convention');
    if (o.op === 'sub') {
      const fits = (isCons(o.a.ch) && isCons(o.b.ch)) || sameClass(o.a.ch, o.b.ch);
      if (!fits) return refuse('not a letter slip');
      if (!hasLaterConsonant(o.a)) return refuse('last akshara of its word');
      // Sandhi, not a slip: a word-initial ha beside a source dha / gha / bha …, and śa beside cha (t + ś → cch), are the previous word's ending joining it.
      if ((o.a.ch === 'ಹ' && isWordStart(o.a)) || (o.a.ch === 'ಶ' && o.b.ch === 'ಛ')) return refuse('sandhi at a word start');
      edits.push({ idx: o.a.idx, del: 1, ins: o.b.ch, from: o.a.ch, to: o.b.ch, word: o.a.word });
    } else if (o.op === 'ins' && o.b.ch === 'ಾ') {
      if (!isCons(stub.ch) || !hasLaterConsonant(stub)) return refuse('ā at a word end or after a vowel');
      edits.push({ idx: stub.idx + 1, del: 0, ins: 'ಾ', from: '', to: 'ಾ', word: stub.word });
    } else if (o.op === 'del' && o.a.ch === 'ಾ') {
      if (!hasLaterConsonant(o.a)) return refuse('ā at a word end');
      edits.push({ idx: o.a.idx, del: 1, ins: '', from: 'ಾ', to: '', word: o.a.word });
    } else {
      refuse('consonant or sign added or dropped');
    }
  });
  // A word with a difference we cannot mend may be a variant reading, not a slip: leave it as the model wrote it.
  for (const e of edits.filter((e) => refused.has(e.word))) result.left.push(`${e.from || '∅'}→${e.to || '∅'}: word has other differences`);
  edits.splice(0, edits.length, ...edits.filter((e) => !refused.has(e.word)));

  let text = stored;
  for (const e of edits.sort((p, q) => q.idx - p.idx)) text = text.slice(0, e.idx) + e.ins + text.slice(e.idx + e.del);
  result.text = text;
  result.patched = edits.map((e) => ({ at: e.idx, from: e.from, to: e.to }));
  return result;
}
