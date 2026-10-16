// The part of the Malayalam / Tamil repair that needs no AI: script. Pure functions.
//   fixVerse(lang, verse, unit) -> { verse (patched copy), changes: [...], leftovers: [...] }
// "changes" are things converted by rule; "leftovers" are things a rule must not touch (wrong-language prose,
// English words left in Roman letters) — those need a translation.
import { indicToIast, indicToMalayalam, sanskritLine, iastToMalayalam, iastToTamil, iastKey, scriptKey, distance } from './script.mjs';

export const OWN = { ml: [0x0d00, 0x0d7f], ta: [0x0b80, 0x0bff] };
const isLetter = (ch) => /[\p{L}\p{M}]/u.test(ch);
const DIACRITIC = /[āīūṛṝḷḹṅñṭḍṇśṣṁṃḥ]/i;
const SUPERS = /[²³⁴¹⁰⁵-⁹₀-₉]/;

export const kindFor = (lang) => (ch) => {
  const [lo, hi] = OWN[lang]; const cp = ch.codePointAt(0);
  if (cp >= lo && cp <= hi) return isLetter(ch) ? 'own' : 'neutral';
  if (cp === 0x964 || cp === 0x965) return 'neutral';
  if (cp >= 0x900 && cp <= 0xdff) return isLetter(ch) ? 'indic' : 'neutral';
  if (/\p{Script=Latin}/u.test(ch)) return 'latin';
  return 'neutral';
};
const scriptOf = (ch) => { const cp = ch.codePointAt(0); return cp < 0x980 ? 'Devanagari' : cp < 0xa00 ? 'Bengali' : cp < 0xa80 ? 'Gurmukhi' : cp < 0xb00 ? 'Gujarati' : cp < 0xb80 ? 'Odia' : cp < 0xc00 ? 'Tamil' : cp < 0xc80 ? 'Telugu' : cp < 0xd00 ? 'Kannada' : 'Malayalam'; };

/** Runs of letters that are not the language's own script: [{ start, end (exclusive, in UTF-16 units), kind, text, letters, scripts }] */
export function foreignRuns(lang, text) {
  const kindOf = kindFor(lang);
  const chars = [...text]; const kinds = chars.map(kindOf);
  const offs = []; let off = 0; for (const c of chars) { offs.push(off); off += c.length; }
  const out = []; let i = 0;
  while (i < chars.length) {
    if (kinds[i] === 'neutral' || kinds[i] === 'own') { i++; continue; }
    const k0 = kinds[i]; let j = i; let last = i;
    while (j < chars.length) {
      const k = kinds[j];
      if (k === 'neutral') { j++; continue; }
      if (k === k0) { last = j; j++; continue; }
      break;
    }
    const seg = chars.slice(i, last + 1).join('');
    out.push({ start: offs[i], end: offs[last] + chars[last].length, kind: k0, text: seg, letters: [...seg].filter(isLetter).length, scripts: [...new Set([...seg].filter((c) => kindOf(c) === 'indic').map(scriptOf))].join('+') });
    i = last + 1;
  }
  return out;
}

const avagraha = (t) => t.replace(/(?<=\p{L})\.a/gu, 'ʼ').replace(/(?<=\p{L})\.(?=\p{L})/gu, 'ʼ');
/** IAST (the English source's) -> the language's script. */
export function iastTo(lang, text) {
  const t = avagraha(text);
  return lang === 'ml' ? iastToMalayalam(t) : iastToTamil(t.replace(/ʼ/g, '’'));
}
/** Roman IAST as it is quoted inside English prose: a space before an avagraha joins the words (paco ’to -> pacoʼto). */
const quoted = (t) => t.replace(/\s+[’'](?=\p{L})/gu, 'ʼ').replace(/(?<=\p{L})[’'](?=\p{L})/gu, 'ʼ');
function indicTo(lang, text) { return lang === 'ml' ? indicToMalayalam(text) : iastTo('ta', indicToIast(text)); }

const HINDI_MARATHI = /(^|[\s,.;:()\[\]“”"'\-—–])(है|हैं|के|की|का|को|में|से|और|नहीं|यह|वह|जो|पर|भी|तो|आहे|आणि|च्या|ची|चा|चे|मध्ये|हरू|हरूको|र|छ|छन्)(?=$|[\s,.;:()\[\]“”"'\-—–])/;

// ---------- Sanskrit fields (transliteration line, the Sanskrit word of a word entry) ----------
/** Does this Sanskrit text hold anything but the language's own script (and the danda, digits, hyphens ...)? */
export function sanskritFlaw(lang, text) {
  const kindOf = kindFor(lang); const flaws = [];
  const kinds = new Set([...text].map(kindOf));
  if (kinds.has('indic')) flaws.push('other-script');
  if (kinds.has('latin')) flaws.push('latin');
  const [lo, hi] = OWN[lang]; const own = `\\u${lo.toString(16).padStart(4, '0')}-\\u${hi.toString(16).padStart(4, '0')}`;
  if (new RegExp(`(?<=[${own}]):`).test(text) || /꞉/.test(text)) flaws.push('colon-as-visarga');
  if (SUPERS.test(text)) flaws.push('superscript');
  if (lang === 'ta' && /ஂ/.test(text)) flaws.push('tamil-anusvara');
  return flaws;
}

// ---------- prose ----------
/** Convert the stray / quoted Sanskrit in one prose field; report what could not be (wrong-language or English). */
export function fixProse(lang, text) {
  const changes = []; const leftovers = [];
  let out = text;
  const runs = foreignRuns(lang, text);
  for (const r of runs.slice().reverse()) {
    let repl = null; let how = '';
    if (r.kind === 'latin') {
      if (DIACRITIC.test(r.text.normalize('NFC'))) { repl = iastTo(lang, quoted(r.text.normalize('NFC'))); how = 'iast-quote'; }
      else { leftovers.push({ kind: r.letters >= 4 ? 'english-word' : 'latin-short', text: r.text, letters: r.letters, ctx: text.slice(Math.max(0, r.start - 14), r.end + 10).replace(/\n/g, ' ') }); continue; }
    } else {
      const deva = r.scripts === 'Devanagari';
      if (r.letters < 8) { repl = indicTo(lang, r.text); how = 'stray-letters'; }
      else if (deva && !HINDI_MARATHI.test(r.text)) { repl = indicTo(lang, r.text); how = 'deva-quote'; }
      else { leftovers.push({ kind: 'wrong-language', script: r.scripts, text: r.text.slice(0, 60), letters: r.letters }); continue; }
    }
    if (repl !== null && repl !== r.text) { out = out.slice(0, r.start) + repl + out.slice(r.end); changes.push({ how, from: r.text.slice(0, 50), to: repl.slice(0, 50) }); }
  }
  if (lang === 'ta') { // superscript digits after a Tamil letter are the old style; plain letters are the rest of the corpus
    const t2 = out.replace(/(?<=[஀-௿])[²³⁴¹⁰⁵-⁹₀-₉]/g, '');
    if (t2 !== out) { changes.push({ how: 'superscript', from: '', to: '' }); out = t2; }
  }
  return { text: out, changes, leftovers };
}

const rowsOf = (v, lang) => (v.commentaries || []).filter((c) => c.translatorSlug === 'prabhupada' && c.language === lang);

/** Patched copy of a saved verse, plus what changed and what is left for translation. `unit` is the English source. */
export function fixVerse(lang, verse, unit) {
  const out = JSON.parse(JSON.stringify(verse));
  const changes = []; const leftovers = [];
  // transliteration: regenerate a line from the English IAST when it has any script flaw
  if (typeof out.transliteration === 'string' && (unit.transliteration || []).length) {
    const lines = out.transliteration.split('\n'); const eng = unit.transliteration;
    if (lines.length === eng.length) {
      out.transliteration = lines.map((l, i) => {
        const flaws = sanskritFlaw(lang, l);
        if (flaws.length) { changes.push({ part: 'transliteration', how: 'line-regenerated', flaws, id: verse.verseId, line: i }); return sanskritLine(eng[i], lang); }
        const d = distance(scriptKey(lang, l), iastKey(eng[i]));
        if (d > 0.15) leftovers.push({ part: 'transliteration', kind: 'line-differs-from-english', line: i, d: Number(d.toFixed(2)), have: l, english: eng[i] });
        return l;
      }).join('\n');
    } else leftovers.push({ part: 'transliteration', kind: 'line-count', have: lines.length, english: eng.length });
  }
  // word entries
  if (Array.isArray(out.wordMeanings) && (unit.wordMeanings || []).length === out.wordMeanings.length) {
    out.wordMeanings = out.wordMeanings.map((w, i) => {
      const ew = unit.wordMeanings[i];
      let word = w.word; let meaning = w.meaning;
      const flaws = sanskritFlaw(lang, word || '');
      if (flaws.length) { word = iastTo(lang, ew.word || ''); changes.push({ part: 'wordMeanings', how: 'word-regenerated', flaws, id: verse.verseId, i }); }
      else {
        const d = distance(scriptKey(lang, word || ''), iastKey(ew.word || ''));
        if (d > 0.5) leftovers.push({ part: 'wordMeanings', kind: 'word-differs-from-english', i, d: Number(d.toFixed(2)), have: word, english: ew.word });
      }
      const m = fixProse(lang, meaning || '');
      for (const c of m.changes) changes.push({ part: 'wordMeanings', how: `meaning:${c.how}`, id: verse.verseId, i, from: c.from, to: c.to });
      for (const l of m.leftovers) leftovers.push({ part: 'wordMeanings', field: 'meaning', i, ...l });
      return { ...w, word, meaning: m.text };
    });
  } else if (Array.isArray(out.wordMeanings)) leftovers.push({ part: 'wordMeanings', kind: 'entry-count', have: out.wordMeanings.length, english: (unit.wordMeanings || []).length });
  // translation + purport rows
  out.commentaries = (out.commentaries || []).map((c) => {
    if (!(c.translatorSlug === 'prabhupada' && c.language === lang)) return c;
    const r = fixProse(lang, c.text || '');
    for (const ch of r.changes) changes.push({ part: c.type, how: ch.how, id: verse.verseId, from: ch.from, to: ch.to });
    for (const l of r.leftovers) leftovers.push({ part: c.type, ...l });
    return { ...c, text: r.text };
  });
  return { verse: out, changes, leftovers };
}
