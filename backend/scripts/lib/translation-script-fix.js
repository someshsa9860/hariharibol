// The part of repairing a Gita translation that needs no AI: script. The models keep writing
// the Sanskrit lines in the wrong script (Devanagari, Kannada, Roman, a colon for a visarga, superscript digits), so those
// are rebuilt from the English IAST by rule (translation-script.js, translation-brahmic.js), and Sanskrit quoted inside prose is converted.
// A code point Unicode has not assigned (an avagraha the model wrote as U+0BC3 in Telugu) is mended in place, not rebuilt.
// Wrong-language prose and English words left in Roman letters are never touched: they need a translation, and
// are reported as leftovers.
//
// Pure functions, no I/O (`npm test` covers them). The command line is scripts/fix-translation-script.js.
//
//   fixVerse(lang, verse, unit, patches?)  →  { verse, changes, leftovers, parts, rebuilt, patchResults }
//   rescoreVerse(lang, before, after, unit, parts)  →  the verse with the repaired parts' stamps and rows re-scored
//   rescoreStored(lang, verse, unit)  →  { verse, parts, changes }: stamps brought in line with the validator as it is now
//   relabelStored(lang, verse)  →  { verse, changes }: `translatedBy` of the rows and the verse brought in line with the provider each stamp names

import { PARTS, mainStampOf, translatedByOf } from './claude-translate-parts.js';
import { TRANSLATOR } from './claude-translate-source.js';
import { assessLanguage, unassignedChars } from './claude-translate-validate.js';
import { distance, indicToBrahmic, indicToIast, indicToMalayalam, iastKey, iastTo as iastToScript, sanskritLine, scriptKey } from './translation-script.js';

/** The block of each language's own script. */
export const OWN = {
  ml: [0x0d00, 0x0d7f], ta: [0x0b80, 0x0bff],
  hi: [0x0900, 0x097f], mr: [0x0900, 0x097f], bn: [0x0980, 0x09ff], te: [0x0c00, 0x0c7f], kn: [0x0c80, 0x0cff],
};

/** A letter or a combining mark of any script. */
const isLetter = (ch) => /[\p{L}\p{M}]/u.test(ch);
/** Roman letters that only IAST uses: a Latin run with one of them is Sanskrit, not an English word. */
export const DIACRITIC = /[āīūṛṝḷḹṅñṭḍṇśṣṁṃḥ]/i;
const SUPERSCRIPTS = /[²³⁴¹⁰⁵-⁹₀-₉]/;

/** Indic prose of this kind is Hindi or Marathi (or Nepali), not Sanskrit: a quote of Sanskrit has none of these words. */
const HINDI_MARATHI = /(^|[\s,.;:()\[\]“”"'\-—–])(है|हैं|के|की|का|को|में|से|और|नहीं|यह|वह|जो|पर|भी|तो|आहे|आणि|च्या|ची|चा|चे|मध्ये|हरू|हरूको|र|छ|छन्)(?=$|[\s,.;:()\[\]“”"'\-—–])/;

/** Letters of another script in a translation or a word meaning: this many in a row is a wrong-language text. */
export const WRONG_LANGUAGE_LETTERS = 4;
/** In a purport, a run shorter than this is stray letters (a Telugu vowel sign inside a Tamil word); longer, a quote. */
const STRAY_LETTERS = 8;

/** 'own' for the language's script, 'indic' for another Indic script, 'latin' for Roman, 'neutral' for the rest (digits, space, danda …). */
export const kindFor = (lang) => (ch) => {
  const [lo, hi] = OWN[lang];
  const cp = ch.codePointAt(0);
  if (cp >= lo && cp <= hi) return isLetter(ch) ? 'own' : 'neutral';
  if (cp === 0x964 || cp === 0x965) return 'neutral';
  if (cp >= 0x900 && cp <= 0xdff) return isLetter(ch) ? 'indic' : 'neutral';
  if (/\p{Script=Latin}/u.test(ch)) return 'latin';
  return 'neutral';
};

const scriptOf = (ch) => {
  const cp = ch.codePointAt(0);
  if (cp < 0x980) return 'Devanagari';
  if (cp < 0xa00) return 'Bengali';
  if (cp < 0xa80) return 'Gurmukhi';
  if (cp < 0xb00) return 'Gujarati';
  if (cp < 0xb80) return 'Odia';
  if (cp < 0xc00) return 'Tamil';
  if (cp < 0xc80) return 'Telugu';
  if (cp < 0xd00) return 'Kannada';
  return 'Malayalam';
};

/**
 * Runs of letters that are not the language's own script: [{ start, end (UTF-16 offsets, end exclusive), kind,
 * text, letters, scripts }]. Spaces, digits and punctuation inside a run do not end it.
 */
export function foreignRuns(lang, text) {
  const kindOf = kindFor(lang);
  const chars = [...text];
  const kinds = chars.map(kindOf);
  const offsets = [];
  let offset = 0;
  for (const c of chars) {
    offsets.push(offset);
    offset += c.length;
  }
  const runs = [];
  let i = 0;
  while (i < chars.length) {
    if (kinds[i] === 'neutral' || kinds[i] === 'own') {
      i++;
      continue;
    }
    const first = kinds[i];
    let j = i;
    let last = i;
    while (j < chars.length) {
      const k = kinds[j];
      if (k === 'neutral') {
        j++;
        continue;
      }
      if (k === first) {
        last = j;
        j++;
        continue;
      }
      break;
    }
    const seg = chars.slice(i, last + 1).join('');
    runs.push({
      start: offsets[i],
      end: offsets[last] + chars[last].length,
      kind: first,
      text: seg,
      letters: [...seg].filter(isLetter).length,
      scripts: [...new Set([...seg].filter((c) => kindOf(c) === 'indic').map(scriptOf))].join('+'),
    });
    i = last + 1;
  }
  return runs;
}

/** Does the text begin with a combining vowel sign (not a candrabindu, anusvara or visarga, the first three marks of an Indic block)? */
const startsWithVowelSign = (text) => /^\p{M}/u.test(text) && ![0x01, 0x02, 0x03].includes(text.codePointAt(0) & 0x7f);

/** IAST as the English source writes it, into the language's script (an avagraha written ".a" or "." included). */
export const iastTo = (lang, text) => iastToScript(lang, text);

/** Roman IAST as it is quoted inside prose: a space before an avagraha joins the words (paco ’to → pacoʼto). */
const quoted = (t) => t.replace(/\s+[’'](?=\p{L})/gu, 'ʼ').replace(/(?<=\p{L})[’'](?=\p{L})/gu, 'ʼ');

/** Any other Indic script into this language's script (Tamil goes through IAST: its block is not parallel to the others). */
const indicTo = (lang, text) => {
  if (lang === 'ml') return indicToMalayalam(text);
  if (lang === 'ta') return iastToScript('ta', indicToIast(text));
  return indicToBrahmic(lang, text);
};

/* ---------- Sanskrit fields: a transliteration line, the Sanskrit word of a word entry ---------- */

/** What is wrong with a Sanskrit text: 'other-script', 'latin', 'colon-as-visarga', 'superscript', 'tamil-anusvara', 'modifier-apostrophe', 'digits', 'assamese-letters', 'broken-marks'. [] when nothing. */
export function sanskritFlaw(lang, text) {
  const kindOf = kindFor(lang);
  const flaws = [];
  const kinds = new Set([...text].map(kindOf));
  if (kinds.has('indic')) flaws.push('other-script');
  if (kinds.has('latin')) flaws.push('latin');
  const [lo, hi] = OWN[lang];
  const own = `\\u${lo.toString(16).padStart(4, '0')}-\\u${hi.toString(16).padStart(4, '0')}`;
  if (new RegExp(`(?<=[${own}]):`).test(text) || /꞉/.test(text)) flaws.push('colon-as-visarga');
  if (SUPERSCRIPTS.test(text)) flaws.push('superscript');
  if (lang === 'ta' && /ஂ/.test(text)) flaws.push('tamil-anusvara');
  if (/(?<=[\p{L}\p{M}])\.(?=[\p{L}\p{M}])/u.test(text)) flaws.push('dot-avagraha'); // te.द्य: the source's ".a" for an avagraha, left as a full stop
  if (/ʼ/.test(text)) flaws.push('modifier-apostrophe'); // U+02BC is a letter to the validator, and neither language writes the avagraha with it
  if (/(?<=[\p{L}\p{M}])\p{Nd}/u.test(text)) flaws.push('digits'); // "க3": a digit (of any script: bn "২", te "౭") standing for a voiced or aspirated stop or an avagraha; the verse number after ॥ is not one
  if (lang === 'bn' && /[ৰৱ]/.test(text)) flaws.push('assamese-letters'); // Bengali writes ra and va as র and ব
  if (BRAHMIC_SIGNS.has(lang) && brokenMarks(lang, text)) flaws.push('broken-marks');
  if (unassignedChars(text).length) flaws.push('unassigned'); // a code point Unicode has not assigned (an avagraha written U+0BC3 in Telugu): no font draws it
  return flaws;
}

/** The languages whose script is a parallel Brahmic block (consonants, vowel signs and the virama at the same offsets as Devanagari). */
const BRAHMIC_SIGNS = new Set(['hi', 'mr', 'bn', 'te', 'kn']);

/**
 * A vowel sign with no consonant to stand on, or two vowel signs on one consonant (hi "इमाॉल्लोकान्न", bn "পিতৃৃনথ").
 * Read on the composed (NFC) text, where a split vowel sign such as ো is already one sign.
 */
function brokenMarks(lang, text) {
  const [lo] = OWN[lang];
  const sign = (o) => (o >= 0x3e && o <= 0x4c) || o === 0x62 || o === 0x63;
  const base = (o) => (o >= 0x15 && o <= 0x39) || (o >= 0x58 && o <= 0x5f) || o === 0x70 || o === 0x71 || o === 0x3c; // consonants, those with a nukta, Assamese ra and va, a nukta
  let prev = -1;
  for (const ch of text.normalize('NFC')) {
    const o = ch.codePointAt(0) - lo;
    const inBlock = o >= 0 && o <= 0x7f;
    if (inBlock && sign(o) && !base(prev)) return true;
    prev = inBlock ? o : -1;
  }
  return false;
}

/* ---------- prose ---------- */

/**
 * Two Sanskrit names the Tamil texts spell with a vowel sign of another script on a Tamil letter (கൃഷ്ണ, நृஸிம்ஹ).
 * Tamil has no sign for ṛ, so no rule can convert them; these are spelled the way the rest of the corpus spells them
 * (கிருஷ்ண 3,000 times, நரசிம்மர் in the corpus).
 */
const TAMIL_NAMES = [['கൃഷ്ണ', 'கிருஷ்ண'], ['நृஸிம்ஹ', 'நரசிம்ம']];

/**
 * A Sanskrit word quoted in prose with a full stop where its avagraha belongs: ते.हं, एको.अपि, एको.ऽपि for तेऽहं, एकोऽपि.
 * After e or o the next word's short a is dropped and an avagraha written instead, so a full stop between the vowel
 * sign and the next letter (or before an avagraha already there) is that avagraha. Only the Brahmic languages.
 * @returns {{ text: string, changes: { how: string, from: string, to: string }[] }}
 */
function dotAvagraha(lang, text) {
  const changes = [];
  if (!BRAHMIC_SIGNS.has(lang)) return { text, changes };
  const [lo, hi] = OWN[lang];
  const ch = (offset) => String.fromCodePoint(lo + offset);
  const hex = (cp) => `\\u${cp.toString(16).padStart(4, '0')}`;
  const eo = `[${ch(0x47)}${ch(0x4b)}]`;
  const own = `[${hex(lo)}-${hex(hi)}]`;
  const avagraha = ch(0x3d);
  const swap = (to) => (match, pos, whole) => {
    changes.push({ how: 'dot-avagraha', from: whole.slice(Math.max(0, pos - 6), pos + match.length + 4), to });
    return to;
  };
  const out = text
    .replace(new RegExp(`(?<=[\\p{L}\\p{M}])\\.(?=${avagraha})`, 'gu'), swap(''))
    .replace(new RegExp(`(?<=${eo})\\.${ch(0x05)}`, 'gu'), swap(avagraha))
    .replace(new RegExp(`(?<=${eo})\\.(?=${own})`, 'gu'), swap(avagraha));
  return { text: out, changes };
}

/**
 * An avagraha written with a code point Unicode has not assigned (te "శాశ్వతో\u0bc3యం" for శాశ్వతోఽయం). Where one stands
 * between an e or o vowel sign and a letter, which is where Sanskrit puts an avagraha, it becomes the language's own; where
 * the avagraha is already there after it (bn "সে\u09b3ঽশ"), it is only dropped. Any other unassigned code point is not guessed
 * at: it is returned in `left` for the caller to rebuild or report. Only the Brahmic languages.
 * @returns {{ text: string, changes: { how: string, from: string, to: string }[], left: string[] }}
 */
function unassignedAvagraha(lang, text) {
  const changes = [];
  if (!BRAHMIC_SIGNS.has(lang)) return { text, changes, left: unassignedChars(text) };
  const [lo] = OWN[lang];
  const ch = (offset) => String.fromCodePoint(lo + offset);
  const avagraha = ch(0x3d);
  const swap = (how, to) => (match, pos, whole) => {
    changes.push({ how, from: whole.slice(Math.max(0, pos - 6), pos + 5), to });
    return to;
  };
  const out = text
    .replace(new RegExp(`\\p{Cn}(?=${avagraha})`, 'gu'), swap('unassigned-dropped', ''))
    .replace(new RegExp(`(?<=[${ch(0x47)}${ch(0x4b)}])\\p{Cn}(?=\\p{L})`, 'gu'), swap('unassigned-avagraha', avagraha));
  return { text: out, changes, left: unassignedChars(out) };
}

/**
 * Converts the stray or quoted Sanskrit in one prose field; says what could not be converted.
 *
 * `field` decides how strict it is. Only a **purport** may hold a Sanskrit quote in another script, so there a
 * Devanagari run that is not Hindi or Marathi is converted. In a **translation** or a **word meaning** a run of
 * `WRONG_LANGUAGE_LETTERS` or more letters of another Indic script is a text in the wrong language and is left
 * for a translation: converted letter by letter it would be nonsense in the right script.
 *
 * Roman letters with a diacritic are IAST, converted everywhere. Roman letters without one, four or more, are
 * an English word and are left for a translation.
 * @param {'translation' | 'purport' | 'meaning'} field
 * @returns {{ text: string, changes: object[], leftovers: object[] }}
 */
export function fixProse(lang, text, field = 'purport') {
  const changes = [];
  const leftovers = [];
  let out = text;
  if (lang === 'ta') {
    for (const [from, to] of TAMIL_NAMES) {
      if (out.includes(from)) {
        out = out.replaceAll(from, to);
        changes.push({ how: 'known-name', from, to });
      }
    }
    text = out;
  }
  const quotesAllowed = field === 'purport';
  for (const r of foreignRuns(lang, text).slice().reverse()) {
    let repl = null;
    let how = '';
    if (r.kind === 'latin') {
      if (DIACRITIC.test(r.text.normalize('NFC'))) {
        repl = iastTo(lang, quoted(r.text.normalize('NFC')));
        how = 'iast-quote';
      } else {
        leftovers.push({ kind: r.letters >= 4 ? 'english-word' : 'latin-short', text: r.text, letters: r.letters, context: text.slice(Math.max(0, r.start - 14), r.end + 10).replace(/\n/g, ' ') });
        continue;
      }
    } else if (lang === 'ta' && startsWithVowelSign(r.text)) {
      // A vowel sign of another script standing on a Tamil letter (க + ൃ): Tamil has no sign for it, so by rule it cannot be converted alone.
      // (A visarga or an anusvara can: they become ஃ and ம்.)
      leftovers.push({ kind: 'orphan-sign', text: r.text.slice(0, 20), letters: r.letters, context: text.slice(Math.max(0, r.start - 6), r.end + 6).replace(/\n/g, ' ') });
      continue;
    } else if (lang !== 'ta' && r.scripts.includes('Tamil')) {
      // Tamil's block is not parallel to the others, so a Tamil letter cannot be moved to this script by position.
      leftovers.push({ kind: 'tamil-letters', text: r.text.slice(0, 20), letters: r.letters, context: text.slice(Math.max(0, r.start - 10), r.end + 10).replace(/\n/g, ' ') });
      continue;
    } else if (!quotesAllowed && r.letters >= WRONG_LANGUAGE_LETTERS) {
      leftovers.push({ kind: 'wrong-language', script: r.scripts, text: r.text.slice(0, 60), letters: r.letters });
      continue;
    } else if (r.letters < STRAY_LETTERS) {
      repl = indicTo(lang, r.text);
      how = 'stray-letters';
    } else if (r.scripts === 'Devanagari' && !HINDI_MARATHI.test(r.text)) {
      repl = indicTo(lang, r.text);
      how = 'deva-quote';
    } else {
      leftovers.push({ kind: 'wrong-language', script: r.scripts, text: r.text.slice(0, 60), letters: r.letters });
      continue;
    }
    if (repl !== null && repl !== r.text) {
      out = out.slice(0, r.start) + repl + out.slice(r.end);
      changes.push({ how, from: r.text.slice(0, 50), to: repl.slice(0, 50) });
    }
  }
  // Last, so that an avagraha of another script converted just above is one this rule can see.
  const dotted = dotAvagraha(lang, out);
  if (dotted.changes.length) {
    out = dotted.text;
    changes.push(...dotted.changes);
  }
  const mended = unassignedAvagraha(lang, out);
  if (mended.changes.length) {
    out = mended.text;
    changes.push(...mended.changes);
  }
  for (const c of mended.left) {
    const at = out.indexOf(c);
    leftovers.push({ kind: 'unassigned', text: `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`, letters: 1, context: out.slice(Math.max(0, at - 14), at + 10).replace(/\n/g, ' ') });
  }
  if (lang === 'ta') {
    // The chapters corrected by hand write plain letters; superscript digits after a Tamil letter are the older style.
    const plain = out.replace(/(?<=[஀-௿])[²³⁴¹⁰⁵-⁹₀-₉]/g, '');
    if (plain !== out) {
      changes.push({ how: 'superscript', from: '', to: '' });
      out = plain;
    }
  }
  return { text: out, changes, leftovers };
}

/* ---------- one saved verse ---------- */

const ownRows = (verse, lang) => (verse.commentaries || []).filter((c) => c.translatorSlug === TRANSLATOR && c.language === lang);

/** A Sanskrit line further than this from the English (in sound skeletons) is reported, not trusted. */
const LINE_DISTANCE = 0.15;
const WORD_DISTANCE = 0.5;

/**
 * A patched copy of a saved verse, what was changed (each change names its part) and what is left for a
 * translation or a look. `unit` is the English source. `parts` lists the parts whose text actually changed.
 * Only Prabhupāda's rows in `lang` are touched, and nothing is invented: a line is rebuilt from the English
 * only when the saved one has a script flaw.
 */
/**
 * A transliteration line with a flaw, rebuilt from the English. Where the line and the English split into the same words only
 * the words with a flaw are rebuilt, so the spelling the model chose for the rest of the line stays; otherwise the whole line is.
 */
function repairLine(lang, line, english) {
  const whole = () => sanskritLine(english, lang);
  const have = line.trim().split(/\s+/);
  const want = english.trim().split(/\s+/);
  if (have.length !== want.length) return whole();
  const mark = (t) => {
    if (t === '.' || t === '|') return '।';
    const verseEnd = /^\|\|\s*([0-9]+(?:-[0-9]+)*)\s*\|\|$/.exec(t);
    return verseEnd ? `॥${verseEnd[1]}॥` : null;
  };
  const rebuilt = have.map((token, i) => mark(want[i]) ?? (sanskritFlaw(lang, token).length ? sanskritLine(want[i], lang) : token)).join(' ');
  return sanskritFlaw(lang, rebuilt).length ? whole() : rebuilt;
}

/* ---------- hand patches ---------- */

/** What a patch may name. */
const PATCH_PARTS = ['translation', 'purport', 'wordMeanings'];

/**
 * Checks a list of patches read from a file: `{ lang, verseId, part, i?, find, replace, why? }`.
 * `part` is translation, purport or wordMeanings (with `i`, the entry's index, whose meaning is patched).
 * @returns {object[]} the same list
 */
export function checkPatches(patches) {
  if (!Array.isArray(patches)) throw new Error('patches: expected a list');
  patches.forEach((p, k) => {
    const bad = (why) => { throw new Error(`patches[${k}] (${p?.lang} ${p?.verseId}): ${why}`); };
    if (!p || typeof p !== 'object') bad('not an object');
    if (!OWN[p.lang]) bad(`"${p.lang}" is not a language handled here`);
    if (!/^\d+\.\d+\.\d+$/.test(p.verseId || '')) bad('verseId should look like 1.2.47');
    if (!PATCH_PARTS.includes(p.part)) bad(`part should be one of ${PATCH_PARTS.join(', ')}`);
    if (p.part === 'wordMeanings' && !Number.isInteger(p.i)) bad('wordMeanings needs i, the index of the entry');
    if (typeof p.find !== 'string' || !p.find) bad('find should be a non-empty string');
    if (typeof p.replace !== 'string' || !p.replace) bad('replace should be a non-empty string (a deletion replaces a longer text with a shorter one around it, so a second run can tell it was done)');
    if (p.find === p.replace) bad('find and replace are the same');
  });
  return patches;
}

/**
 * Hand-written replacements, each naming one place: the text to find (it must occur exactly once there) and what it becomes.
 * A patch whose `find` is gone and whose `replace` is already there was applied by an earlier run and is skipped.
 * Only Prabhupāda's rows in `lang` are touched.
 * @returns {{ verse: object, changes: object[], results: { patch: object, status: 'applied' | 'already' | 'not-found' | 'ambiguous' | 'missing' }[] }}
 */
export function applyPatches(lang, verse, patches) {
  const out = JSON.parse(JSON.stringify(verse));
  const changes = [];
  const results = [];
  for (const patch of patches) {
    const holder = patch.part === 'wordMeanings' ? out.wordMeanings?.[patch.i] : ownRows(out, lang).find((r) => r.type === patch.part);
    const field = patch.part === 'wordMeanings' ? 'meaning' : 'text';
    const text = holder?.[field];
    if (typeof text !== 'string') {
      results.push({ patch, status: 'missing' });
      continue;
    }
    const times = text.split(patch.find).length - 1;
    if (times === 1) {
      holder[field] = text.replace(patch.find, () => patch.replace);
      changes.push({ part: patch.part, how: 'patch', ...(patch.part === 'wordMeanings' ? { i: patch.i } : {}), from: patch.find.slice(0, 50), to: patch.replace.slice(0, 50) });
      results.push({ patch, status: 'applied' });
    } else if (times === 0) results.push({ patch, status: text.includes(patch.replace) ? 'already' : 'not-found' });
    else results.push({ patch, status: 'ambiguous' });
  }
  return { verse: out, changes, results };
}

/** The tail of the English line: "||3-12||". */
const ENGLISH_TAIL = /\|\|\s*([0-9]+(?:-[0-9]+)*)\s*\|\|\s*$/;
/** The tail a saved line ends with, whatever it is written in: "॥३-१२॥", "||3-12||", "॥ 8-20॥", "॥16.20॥". */
const SAVED_TAIL = /\s*[॥|]{1,2}\s*[^\s॥|]*\s*[॥|]{1,2}\s*$/u;

/**
 * The verse number at the end of a line as the corpus writes it: ॥3-12॥, danda signs and ASCII digits, a space before it.
 * The numbers come from the English line, which has them right; a tail already written so is left alone.
 */
export function fixTail(line, english) {
  const want = ENGLISH_TAIL.exec(english);
  const have = SAVED_TAIL.exec(line);
  if (!want || !have) return line;
  const tail = `॥${want[1]}॥`;
  return have[0].trim() === tail ? line : `${line.slice(0, have.index).trimEnd()} ${tail}`;
}

export function fixVerse(lang, verse, unit, patches = []) {
  const out = JSON.parse(JSON.stringify(verse));
  const changes = [];
  const leftovers = [];

  if (typeof out.transliteration === 'string' && (unit.transliteration || []).length) {
    const lines = out.transliteration.split('\n');
    const english = unit.transliteration;
    if (lines.length === english.length) {
      out.transliteration = lines
        .map((original, i) => {
          const mended = unassignedAvagraha(lang, original);
          for (const c of mended.changes) changes.push({ part: 'transliteration', how: c.how, line: i, from: c.from, to: c.to });
          const line = mended.text;
          const flaws = sanskritFlaw(lang, line);
          let next = line;
          if (flaws.length) {
            changes.push({ part: 'transliteration', how: 'line-regenerated', flaws, line: i });
            next = repairLine(lang, line, english[i]);
          } else {
            const d = distance(scriptKey(lang, line), iastKey(english[i]));
            if (d > LINE_DISTANCE) leftovers.push({ part: 'transliteration', kind: 'line-differs-from-english', line: i, distance: Number(d.toFixed(2)), have: line, english: english[i] });
          }
          if (i === lines.length - 1) {
            const tailed = fixTail(next, english[i]);
            if (tailed !== next) {
              changes.push({ part: 'transliteration', how: 'tail-normalised', line: i, from: next.slice(-14), to: tailed.slice(-14) });
              next = tailed;
            }
          }
          return next;
        })
        .join('\n');
    } else {
      leftovers.push({ part: 'transliteration', kind: 'line-count', have: lines.length, english: english.length });
      const tailed = fixTail(lines[lines.length - 1], english[english.length - 1]);
      if (tailed !== lines[lines.length - 1]) {
        changes.push({ part: 'transliteration', how: 'tail-normalised', line: lines.length - 1, from: lines[lines.length - 1].slice(-14), to: tailed.slice(-14) });
        out.transliteration = [...lines.slice(0, -1), tailed].join('\n');
      }
    }
  }

  if (Array.isArray(out.wordMeanings) && (unit.wordMeanings || []).length === out.wordMeanings.length) {
    out.wordMeanings = out.wordMeanings.map((entry, i) => {
      const source = unit.wordMeanings[i];
      const mended = unassignedAvagraha(lang, entry.word || '');
      for (const c of mended.changes) changes.push({ part: 'wordMeanings', how: c.how, i, from: c.from, to: c.to });
      let word = entry.word == null ? entry.word : mended.text;
      const flaws = sanskritFlaw(lang, word || '');
      if (flaws.length) {
        word = iastTo(lang, source.word || '');
        changes.push({ part: 'wordMeanings', how: 'word-regenerated', flaws, i });
      } else {
        const d = distance(scriptKey(lang, word || ''), iastKey(source.word || ''));
        if (d > WORD_DISTANCE) leftovers.push({ part: 'wordMeanings', kind: 'word-differs-from-english', i, distance: Number(d.toFixed(2)), have: word, english: source.word });
      }
      const meaning = fixProse(lang, entry.meaning || '', 'meaning');
      for (const c of meaning.changes) changes.push({ part: 'wordMeanings', how: `meaning:${c.how}`, i, from: c.from, to: c.to });
      for (const l of meaning.leftovers) leftovers.push({ part: 'wordMeanings', field: 'meaning', i, ...l });
      return { ...entry, word, meaning: meaning.text };
    });
  } else if (Array.isArray(out.wordMeanings)) {
    leftovers.push({ part: 'wordMeanings', kind: 'entry-count', have: out.wordMeanings.length, english: (unit.wordMeanings || []).length });
  }

  out.commentaries = (out.commentaries || []).map((row) => {
    if (!(row.translatorSlug === TRANSLATOR && row.language === lang)) return row;
    const fixed = fixProse(lang, row.text || '', row.type === 'purport' ? 'purport' : 'translation');
    for (const c of fixed.changes) changes.push({ part: row.type, how: c.how, from: c.from, to: c.to });
    for (const l of fixed.leftovers) leftovers.push({ part: row.type, ...l });
    return { ...row, text: fixed.text };
  });

  let patched = out;
  let patchResults = [];
  if (patches.length) {
    const applied = applyPatches(lang, out, patches);
    patched = applied.verse;
    patchResults = applied.results;
    changes.push(...applied.changes);
  }

  const parts = PARTS.filter((p) => changes.some((c) => c.part === p));
  const rebuilt = parts.filter((p) => changes.some((c) => c.part === p && /-regenerated$/.test(c.how)));
  return { verse: patched, changes, leftovers, parts, rebuilt, patchResults };
}

/* ---------- scores ---------- */

/** "wordMeanings: rated 2 by Claude" → { wordMeanings: 2 }: what the model thought of its own work. */
export function selfRatings(warnings = []) {
  const ratings = {};
  for (const w of warnings) {
    const m = /^(translation|transliteration|wordMeanings|purport): rated ([123]) by /.exec(w);
    if (m) ratings[m[1]] = Number(m[2]);
  }
  return ratings;
}

/** The self-ratings a verse's stamps hold, whether it was stamped per part or as a whole. */
export function savedRatings(verse) {
  const ai = verse.aiTranslation || {};
  if (!ai.parts) return selfRatings(ai.warnings);
  return Object.assign({}, ...Object.values(ai.parts).map((stamp) => selfRatings(stamp.warnings)));
}

/** Which part a validator message is about: "word 3 meaning: …", "transliteration line 1: …", "purport ¶2: …", "translation: …". */
export function partOfMessage(msg) {
  if (/^word \d+/.test(msg)) return 'wordMeanings';
  if (/^transliteration/.test(msg)) return 'transliteration';
  if (/^purport/.test(msg)) return 'purport';
  if (/^translation/.test(msg)) return 'translation';
  if (/^wordMeanings/.test(msg)) return 'wordMeanings';
  return null;
}

/** The saved verse laid out as the model's answer was, which is what the validator reads. */
export function answerOf(verse, lang, ratings = {}) {
  const rows = ownRows(verse, lang);
  const purport = rows.find((r) => r.type === 'purport')?.text ?? '';
  return {
    translation: rows.find((r) => r.type === 'translation')?.text ?? '',
    purport: purport ? purport.split('\n') : [],
    transliteration: verse.transliteration ? verse.transliteration.split('\n') : [],
    wordMeanings: verse.wordMeanings ?? [],
    correctness: ratings,
    note: '',
  };
}

/** The parts of this verse that the English has and the saved verse holds. */
export function partsHeld(verse, lang, unit) {
  const rows = ownRows(verse, lang);
  return PARTS.filter((part) => {
    if (part === 'translation' || part === 'purport') return Boolean(unit[part]?.length) && rows.some((r) => r.type === part);
    if (part === 'transliteration') return (unit.transliteration || []).length > 0 && Boolean(verse.transliteration);
    return (unit.wordMeanings || []).length > 0 && (verse.wordMeanings || []).length > 0;
  });
}

/**
 * What the validator says about a saved verse today, for `parts` (default: every part it holds).
 * `ratings` are the model's own, which cap a score: pass none to score by the validator alone.
 * → { scores, findings } (findings with level 'bad' or 'minor' or 'note'; each carries its part)
 */
export function assessVerse(lang, verse, unit, { parts, ratings = {} } = {}) {
  const held = parts ?? partsHeld(verse, lang, unit);
  const a = assessLanguage(unit, answerOf(verse, lang, ratings), lang, held);
  if (!a.usable) return { scores: {}, findings: [], problems: a.problems };
  return { scores: a.scores, findings: a.findings, problems: [] };
}

/**
 * `after` is `before` with `parts` repaired by `fixVerse`. Their stamps are re-scored from the validator and
 * the model's own rating for the part, and written into the stamp and into the translation / purport rows;
 * stamps of the parts nobody touched are left exactly as they were.
 *
 * The model's rating is **dropped for the transliteration** when a line of it was rebuilt by rule (`rebuilt`, default `parts`; a
 * verse-number tail set right is not a rebuild): it described
 * text that is no longer there, and the stale rating is why a rebuilt part would otherwise stay at 1.
 *
 * A verse stamped per part (`aiTranslation.parts`) gets its repaired parts' `correctness` and `warnings` and a
 * `scriptFix` mark in each; one stamped as a whole gets the same in `partScores` / `warnings` and one
 * `scriptFix` mark. Either way `correctness` is the lowest part.
 * @param {{ keepTransliterationRating?: boolean, mark?: boolean }} [options]  `keepTransliterationRating`: keep the model's rating (to compare with a dry run that did); `mark: false`: no `scriptFix` stamp (a re-score is not a repair)
 */
export function rescoreVerse(lang, before, after, unit, parts, { fixedAt = new Date().toISOString(), keepTransliterationRating = false, rebuilt = parts, mark = true } = {}) {
  if (!parts.length) return after;
  const out = JSON.parse(JSON.stringify(after));
  const ai = out.aiTranslation;
  if (!ai) return out;

  const ratings = savedRatings(before);
  if (!keepTransliterationRating && rebuilt.includes('transliteration')) delete ratings.transliteration;
  const { scores, findings } = assessVerse(lang, out, unit, { parts: partsHeld(out, lang, unit), ratings });

  const messagesOf = (part) => findings.filter((f) => f.part === part).map((f) => f.msg);
  for (const row of ownRows(out, lang)) {
    if (parts.includes(row.type) && scores[row.type] != null) row.correctness = scores[row.type];
  }

  if (ai.parts) {
    for (const part of parts) {
      const stamp = ai.parts[part];
      if (!stamp || scores[part] == null) continue;
      stamp.correctness = scores[part];
      stamp.warnings = messagesOf(part);
      if (mark) stamp.scriptFix = fixedAt;
    }
    const names = PARTS.filter((p) => ai.parts[p]);
    ai.correctness = Math.min(...names.map((p) => ai.parts[p].correctness ?? 3));
    ai.partScores = Object.fromEntries(names.map((p) => [p, ai.parts[p].correctness]));
    ai.warnings = names.flatMap((p) => ai.parts[p].warnings || []);
  } else {
    const partScores = { ...(ai.partScores || {}) };
    for (const part of parts) if (scores[part] != null) partScores[part] = scores[part];
    ai.partScores = partScores;
    ai.correctness = Math.min(...Object.values(partScores));
    // The old messages about the repaired parts go; the rest are kept as the run wrote them.
    ai.warnings = [...(ai.warnings || []).filter((w) => !parts.includes(partOfMessage(w))), ...parts.flatMap(messagesOf)];
    if (mark) ai.scriptFix = { at: fixedAt, parts: [...new Set([...(ai.scriptFix?.parts || []), ...parts])] };
  }
  return out;
}

/** The score and warnings a verse's stamps hold for one part, whether it was stamped per part or as a whole. */
function stampOf(verse, part) {
  const ai = verse.aiTranslation || {};
  if (ai.parts) return { score: ai.parts[part]?.correctness, warnings: ai.parts[part]?.warnings || [] };
  return { score: ai.partScores?.[part], warnings: (ai.warnings || []).filter((w) => partOfMessage(w) === part) };
}

/**
 * The verse's stamps brought in line with what the validator says today, for the parts where they differ (score or
 * warnings) — after a rule of the validator changed. The model's own ratings are kept, the text is not touched, and no
 * `scriptFix` mark is added: a re-score is no repair.
 * → { verse, parts, changes: [{ part, from, to, dropped, added }] }  (`verse` is the argument itself when nothing differs)
 */
export function rescoreStored(lang, verse, unit) {
  if (!verse.aiTranslation) return { verse, parts: [], changes: [] };
  const { scores, findings } = assessVerse(lang, verse, unit, { parts: partsHeld(verse, lang, unit), ratings: savedRatings(verse) });
  const changes = [];
  for (const part of Object.keys(scores)) {
    const now = stampOf(verse, part);
    const messages = findings.filter((f) => f.part === part).map((f) => f.msg);
    if (now.score === scores[part] && [...now.warnings].sort().join('\n') === [...messages].sort().join('\n')) continue;
    changes.push({ part, from: now.score, to: scores[part], dropped: now.warnings.filter((w) => !messages.includes(w)), added: messages.filter((m) => !now.warnings.includes(m)) });
  }
  if (!changes.length) return { verse, parts: [], changes };
  const parts = changes.map((c) => c.part);
  return { verse: rescoreVerse(lang, verse, verse, unit, parts, { mark: false, rebuilt: [] }), parts, changes };
}

/**
 * The `translatedBy` of each of the verse's rows and of the verse itself brought in line with the provider its stamp
 * names — "gpt" for text GPT wrote, where the pipeline once wrote "claude" whoever the provider was. Nothing but the label
 * changes. A verse a person wrote (no `aiTranslation`) is left alone.
 * → { verse, changes: [{ what, from, to }] }  (`verse` is the argument itself when every label is right)
 */
export function relabelStored(lang, verse) {
  const ai = verse.aiTranslation;
  if (!ai) return { verse, changes: [] };
  const changes = [];
  const label = (what, from, provider) => {
    const to = translatedByOf(provider);
    if (from === to) return from;
    changes.push({ what, from: from ?? null, to });
    return to;
  };
  const commentaries = (verse.commentaries || []).map((c) => {
    if (c.translatorSlug !== TRANSLATOR || c.language !== lang) return c;
    const stamp = ai.parts ? ai.parts[c.type] : ai;
    if (!stamp) return c;
    const to = label(`${c.type} row`, c.translatedBy, stamp.provider);
    return to === c.translatedBy ? c : { ...c, translatedBy: to };
  });
  const main = ai.parts ? mainStampOf(ai.parts) : ai;
  const whole = main ? label('verse', ai.translatedBy, main.provider) : ai.translatedBy;
  if (!changes.length) return { verse, changes };
  return { verse: { ...verse, commentaries, aiTranslation: { ...ai, translatedBy: whole } }, changes };
}

/** A verse's lowest part score, the number the report counts as "needs a second round" when it is 1. */
export function verseScore(verse) {
  const ai = verse.aiTranslation || {};
  if (ai.parts) return Math.min(...Object.values(ai.parts).map((s) => s.correctness ?? 3));
  return ai.correctness ?? Math.min(...Object.values(ai.partScores || { x: 3 }));
}
