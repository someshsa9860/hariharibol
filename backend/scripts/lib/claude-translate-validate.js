// Free, deterministic checks on what Claude returned. Pure functions, no I/O.
//
// Every usable answer is saved. What these checks do is say how far each part of it can be trusted:
// a finding is 'bad' (something is missing or wrong enough that the part should be done again →
// score 1), 'minor' (probably fine, worth a look → 2) or a 'note' (information only, no effect on
// the score). The run keeps the findings as warnings on the saved verse. They catch structure,
// completeness and script — not reverence or fine accuracy of meaning, which only a native reader
// can judge (see scripts/README.md, "Translating the Gita with Claude").

import { language } from './claude-translate-languages.js';
import { VIKARA_SLUGS } from './claude-translate-prompt.js';

const MIN_SCRIPT_RATIO = 0.85;
const MIN_WORDS_MEASURED = 15;
const LONG_TEXT_WORDS = 150;
const SHORT_TEXT_FLOOR = 0.7;
// Meta-text a model adds when it forgets it is producing data.
const META_PATTERNS = [/```/, /\*\*/, /\bNote\s*:/i, /\bTranslator'?s?\b/i, /\bAs an AI\b/i, /\bHere is\b/i, /\bHere's\b/i, /<\/?(translation|purport|paragraph)\b/i];
// Whole-word markers: enough of the other language's function words means the model wrote
// Hindi for Marathi or the reverse (they share a script, so the script check cannot tell).
const MARATHI_MARKERS = new Set(['आहे', 'आहेत', 'आणि', 'नाही', 'होता', 'होते', 'तर', 'म्हणजे', 'त्याने', 'आपण']);
const HINDI_MARKERS = new Set(['है', 'हैं', 'और', 'नहीं', 'था', 'थे', 'में', 'तथा', 'होता', 'यह']);
const HINDI_ONLY = new Set(['है', 'हैं', 'और', 'नहीं', 'में', 'यह', 'थे', 'था']);
const MARATHI_ONLY = new Set(['आहे', 'आहेत', 'आणि', 'नाही', 'म्हणजे', 'त्याने', 'आपण']);

/** Words in a text, as the length check counts them. */
export function wordCount(text) {
  return (text.match(/\S+/g) || []).length;
}

/** Folds a language's own digits to ASCII so numbers can be compared with the English. */
export function foldDigits(text, digitZero) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    out += cp >= digitZero && cp <= digitZero + 9 ? String(cp - digitZero) : ch;
  }
  return out;
}

/** Every run of digits, sorted — "Bg. 7.14, 2 and 2" gives ['14','2','2','7']. */
export function numbersIn(text) {
  return (text.match(/\d+/g) || []).sort();
}

function countChars(text, chars) {
  let n = 0;
  for (const ch of text) if (chars.includes(ch)) n++;
  return n;
}

function scriptRatio(text, [lo, hi]) {
  let letters = 0;
  let native = 0;
  for (const ch of text) {
    if (!/[\p{L}\p{M}]/u.test(ch)) continue;
    letters++;
    const cp = ch.codePointAt(0);
    if (cp >= lo && cp <= hi) native++;
  }
  return letters === 0 ? 1 : native / letters;
}

// The Indic blocks (Devanagari to Malayalam, Sinhala): a letter or sign in one that is not the language's own
// is a model slipping into another script — a Devanagari visarga in Tamil, a Gujarati one in Kannada. The
// danda and double danda are shared by every Indic script and are fine anywhere.
const INDIC = [0x0900, 0x0dff];
const SHARED = new Set([0x0964, 0x0965]);

/** The distinct characters of `text` that belong to an Indic script other than the language's own. */
export function foreignScriptChars(text, [lo, hi]) {
  const found = new Set();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= INDIC[0] && cp <= INDIC[1] && !(cp >= lo && cp <= hi) && !SHARED.has(cp) && /[\p{L}\p{M}\p{N}\p{S}]/u.test(ch)) found.add(ch);
  }
  return [...found];
}

/**
 * The distinct code points of `text` inside the Indic blocks that Unicode has not assigned: a letter or sign the model
 * made up, usually an avagraha written with a neighbouring code point (Telugu "శాశ్వతో௃యం"). No font draws it, and a
 * script check by block misses it, because it is not a letter. Judged by the Unicode the running Node knows (16 in Node 20).
 */
export function unassignedChars(text) {
  const found = new Set();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= INDIC[0] && cp <= INDIC[1] && /\p{Cn}/u.test(ch)) found.add(ch);
  }
  return [...found];
}

function sentenceCount(text) {
  return (text.match(/[.।?!](?=\s|$|["”’)\]])/g) || []).length;
}

function tokensOf(text) {
  return text.split(/[\s,;:()“”"‘’'.।?!–—-]+/).filter(Boolean);
}

const BAD = 'bad';
const MINOR = 'minor';
const NOTE = 'note';
const LEVEL_SCORE = { [BAD]: 1, [MINOR]: 2, [NOTE]: 3 };

/** Findings about one translated text against its English source: [{ level, msg }]. */
export function checkText(source, output, langCode, label) {
  const lang = language(langCode);
  const found = [];
  const add = (level, msg) => found.push({ level, msg: `${label}: ${msg}` });

  if (typeof output !== 'string' || !output.trim()) {
    add(BAD, 'empty or not a string');
    return found;
  }
  if (output.trim() === source.trim()) add(BAD, 'identical to the English');
  // Paragraphs are separate array items; a line break inside one would change the paragraph count when saved.
  if (/\n/.test(output.trim())) add(MINOR, 'contains a line break — one paragraph must be one string');

  for (const pattern of META_PATTERNS) {
    if (pattern.test(output) && !pattern.test(source)) add(MINOR, `contains added meta-text (${pattern})`);
  }

  const ratio = scriptRatio(output, lang.block);
  if (ratio < MIN_SCRIPT_RATIO) {
    add(BAD, `only ${(ratio * 100).toFixed(0)}% of its letters are ${lang.name} script — untranslated English left in`);
  }

  const foreign = foreignScriptChars(output, lang.block);
  if (foreign.length) {
    add(BAD, `contains ${foreign.length} character(s) of another script (${foreign.slice(0, 6).join(' ')}) — write only ${lang.name} script`);
  }

  const unassigned = unassignedChars(output);
  if (unassigned.length) {
    add(BAD, `contains ${unassigned.length} character(s) that do not exist in Unicode (${unassigned.slice(0, 6).map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ')}) — an avagraha or letter written with the wrong code point`);
  }

  const want = numbersIn(source);
  const got = numbersIn(foldDigits(output, lang.digitZero));
  if (want.join(',') !== got.join(',')) {
    add(BAD, `numbers differ — English has [${want.join(' ')}], translation has [${got.join(' ')}]`);
  }

  for (const [open, close, name] of [['(', ')', 'parentheses'], ['[', ']', 'brackets']]) {
    if (countChars(source, open) !== countChars(output, open) || countChars(source, close) !== countChars(output, close)) {
      add(MINOR, `${name} do not match the English`);
    }
  }
  const quotes = '“”"';
  if (countChars(source, quotes) !== countChars(output, quotes)) add(MINOR, 'double quotation marks do not match the English');

  // Word counts only say something about a text long enough for them to average out. A gloss of 6–14 words
  // ("one who is not disturbed by happiness or distress") is routinely half that in a language that joins
  // words, so a shorter text is not measured. Under 150 words the floor is lowered by 30%: measured on the
  // 701 Gita verses in all seven languages, translations and short purport paragraphs fall that far below the
  // language's usual ratio with nothing missing, while paragraphs of 150+ words hold to within the bounds in
  // the language table — and the two real truncations found (a Telugu paragraph at 0.09×, a Marathi one at
  // 0.37×) are far below either floor.
  const sourceWords = wordCount(source);
  if (sourceWords >= MIN_WORDS_MEASURED) {
    const r = wordCount(output) / sourceWords;
    const floor = lang.words[0] * (sourceWords >= LONG_TEXT_WORDS ? 1 : SHORT_TEXT_FLOOR);
    if (r < floor) add(BAD, `too short (${r.toFixed(2)}× the English words) — something was dropped`);
    else if (r > lang.words[1]) add(MINOR, `too long (${r.toFixed(2)}× the English words) — something was added`);
  }

  // Hindi vs Marathi: same script, so look at function words, on texts long enough to show them.
  if ((langCode === 'hi' || langCode === 'mr') && wordCount(output) >= 12) {
    const tokens = tokensOf(output);
    const wrong = tokens.filter((t) => (langCode === 'hi' ? MARATHI_ONLY : HINDI_ONLY).has(t)).length;
    const right = tokens.filter((t) => (langCode === 'hi' ? HINDI_MARKERS : MARATHI_MARKERS).has(t)).length;
    if (wrong >= 3 && wrong > right) add(BAD, `reads as ${langCode === 'hi' ? 'Marathi' : 'Hindi'}, not ${lang.name}`);
  }

  const sSource = sentenceCount(source);
  const sOut = sentenceCount(output);
  if (sSource >= 4 && Math.abs(sOut - sSource) / sSource > 0.3) add(NOTE, `sentence count ${sOut} vs ${sSource} in the English`);
  return found;
}

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * The word-by-word list against the English one: same number of entries, in the same order; each word
 * in the language's script and each meaning translated. → { findings, list }, `list` being what is saved
 * (whatever count came back; an entry that is not a { word, meaning } pair of strings is saved empty).
 */
function checkWordMeanings(source, answer, langCode) {
  const findings = [];
  const add = (level, msg) => findings.push({ level, msg });
  if (!Array.isArray(answer)) {
    add(BAD, 'wordMeanings is missing or not an array');
    return { findings, list: null };
  }
  const list = answer.map((w) => ({ word: text(w?.word), meaning: text(w?.meaning) }));
  if (answer.length !== source.length) {
    add(BAD, `wordMeanings has ${answer.length} entries, the English list has ${source.length}`);
    return { findings, list };
  }
  source.forEach((src, i) => {
    const out = answer[i];
    const label = `word ${i + 1}`;
    if (!out || typeof out !== 'object' || typeof out.word !== 'string' || typeof out.meaning !== 'string') {
      add(BAD, `${label}: expected an object with word and meaning`);
      return;
    }
    for (const field of ['word', 'meaning']) {
      if (/\n/.test(out[field].trim())) add(MINOR, `${label}: ${field} contains a line break`);
      if (!src[field]) continue; // the English has nothing to compare with (a word-less entry)
      findings.push(...checkText(src[field], out[field], langCode, `${label} ${field}`));
    }
  });
  return { findings, list };
}

/**
 * The verse in the language's script: one string per source line, in order. A change of script, so the
 * same checks as any text apply (script share, numbers, brackets), line by line. → { findings, lines }.
 */
function checkTransliteration(source, answer, langCode) {
  const findings = [];
  if (!Array.isArray(answer)) {
    findings.push({ level: BAD, msg: 'transliteration is missing or not an array of strings' });
    return { findings, lines: null };
  }
  const lines = answer.map(text);
  if (answer.some((l) => typeof l !== 'string')) findings.push({ level: BAD, msg: 'transliteration is not an array of strings' });
  if (answer.length !== source.length) {
    findings.push({ level: BAD, msg: `transliteration has ${answer.length} line(s), the source has ${source.length}` });
    return { findings, lines };
  }
  source.forEach((src, i) => findings.push(...checkText(src, answer[i], langCode, `transliteration line ${i + 1}`)));
  return { findings, lines };
}

/** The purport: one string per English paragraph. → { findings, paragraphs }. */
function checkPurport(source, answer, langCode) {
  const findings = [];
  if (!Array.isArray(answer)) {
    findings.push({ level: BAD, msg: 'purport is missing or not an array of strings' });
    return { findings, paragraphs: [] };
  }
  const paragraphs = answer.map(text);
  if (answer.some((p) => typeof p !== 'string')) findings.push({ level: BAD, msg: 'purport is not an array of strings' });
  if (answer.length !== source.length) {
    findings.push({ level: BAD, msg: `purport has ${answer.length} paragraph(s), the English has ${source.length}` });
  }
  source.forEach((src, i) => {
    if (i < answer.length) findings.push(...checkText(src, answer[i], langCode, `purport ¶${i + 1}`));
  });
  return { findings, paragraphs };
}

const PARTS = ['translation', 'transliteration', 'wordMeanings', 'purport'];

/** Is there nothing of this part in the answer — not a list, an empty one, or only blank entries? */
function isAbsent(value, field) {
  if (!Array.isArray(value)) return true;
  return value.every((item) => (field ? !text(item?.word) && !text(item?.meaning) : !text(item)));
}

/**
 * How far one language's answer for one verse can be trusted, and what of it can be saved.
 *
 * It is "usable" unless there is nothing to save: the answer is not an object, or its translation is
 * empty. Anything else — a missing purport paragraph, a short list, English left in — is returned as a
 * finding and lowers that part's score; the answer is still saved.
 *
 * Each part the English has (translation, transliteration, wordMeanings, purport) is scored 1 to 3:
 * 3 perfect, 2 good, 1 needs a second round. The score is the lower of two things: Claude's own rating
 * of the part (`answer.correctness.<part>`, 3 when it gave none) and what the checks above found
 * (a 'bad' finding caps it at 1, a 'minor' one at 2). `correctness` is the lowest part.
 *
 * `missing` names the parts the English has that came back with nothing at all (no list, an empty one,
 * blank entries). That is the one kind of incompleteness worth asking again for rather than only
 * flagging: the run re-asks, and saves the answer with the part left out only if every try left it out.
 *
 * @param {{ translation: string, purport: string[], wordMeanings?: object[], transliteration?: string[] }} source   the English
 * @param {unknown} answer   what the model returned for this language
 */
export function assessLanguage(source, answer, langCode, parts = PARTS) {
  const unusable = (problem) => ({ usable: false, problems: [problem], findings: [], warnings: [], missing: [], scores: null, correctness: null, note: '', value: null });
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return unusable('answer is missing or not an object');
  const asked = (part) => parts.includes(part);
  if (asked('translation') && (typeof answer.translation !== 'string' || !answer.translation.trim())) return unusable('translation is empty or not a string');

  const has = {
    translation: asked('translation'),
    transliteration: asked('transliteration') && (source.transliteration || []).length > 0,
    wordMeanings: asked('wordMeanings') && (source.wordMeanings || []).length > 0,
    purport: asked('purport') && source.purport.length > 0,
  };
  const found = []; // { part, level, msg }
  const add = (part, list) => found.push(...list.map((f) => ({ part, ...f })));

  const value = { purport: [] };
  if (has.translation) {
    add('translation', checkText(source.translation, answer.translation, langCode, 'translation'));
    value.translation = answer.translation.trim();
  }

  if (has.purport) {
    const r = checkPurport(source.purport, answer.purport, langCode);
    add('purport', r.findings);
    value.purport = r.paragraphs;
  } else if (asked('purport') && Array.isArray(answer.purport) && answer.purport.length) {
    add('purport', [{ level: NOTE, msg: 'the English has no purport — the paragraphs returned were left out' }]);
  }
  if (has.transliteration) {
    const r = checkTransliteration(source.transliteration, answer.transliteration, langCode);
    add('transliteration', r.findings);
    if (r.lines?.length) value.transliteration = r.lines;
  }
  if (has.wordMeanings) {
    const r = checkWordMeanings(source.wordMeanings, answer.wordMeanings, langCode);
    add('wordMeanings', r.findings);
    if (r.list?.length) value.wordMeanings = r.list;
  }

  // The vikara tags, when the call asked for them: only the six names, each once.
  if (Array.isArray(answer.issues)) value.issues = [...new Set(answer.issues.filter((s) => VIKARA_SLUGS.includes(s)))];

  const missing = [];
  if (has.transliteration && isAbsent(answer.transliteration)) missing.push('transliteration');
  if (has.wordMeanings && isAbsent(answer.wordMeanings, true)) missing.push('wordMeanings');
  if (has.purport && isAbsent(answer.purport)) missing.push('purport');

  // A lane without the translation has nothing to save when every part it was asked for came back empty.
  if (!has.translation && has.purport + has.transliteration + has.wordMeanings > 0 && missing.length === has.purport + has.transliteration + has.wordMeanings) {
    return unusable(`${missing.join(', ')} came back empty`);
  }

  const own = answer.correctness && typeof answer.correctness === 'object' ? answer.correctness : {};
  const scores = {};
  for (const part of PARTS.filter((p) => has[p])) {
    const checks = Math.min(3, ...found.filter((f) => f.part === part).map((f) => LEVEL_SCORE[f.level]));
    const rated = Number.isInteger(own[part]) && own[part] >= 1 && own[part] <= 3 ? own[part] : 3;
    if (rated < 3) found.push({ part, level: NOTE, msg: `${part}: rated ${rated} by Claude` });
    scores[part] = Math.min(checks, rated);
  }
  return {
    usable: true,
    problems: [],
    findings: found,
    warnings: found.map((f) => f.msg),
    missing,
    scores,
    correctness: Object.values(scores).length ? Math.min(...Object.values(scores)) : 3,
    note: text(answer.note),
    value,
  };
}

/**
 * The strict view, for re-checking what is already saved (`--status --verify`): any 'bad' or 'minor'
 * finding is an error, notes stay warnings.
 */
export function validateLanguage(source, answer, langCode, parts = PARTS) {
  const a = assessLanguage(source, answer, langCode, parts);
  if (!a.usable) return { ok: false, errors: a.problems, warnings: [], value: null };
  const errors = a.findings.filter((f) => f.level !== NOTE).map((f) => f.msg);
  const warnings = a.findings.filter((f) => f.level === NOTE).map((f) => f.msg);
  return { ok: errors.length === 0, errors, warnings, value: errors.length ? null : a.value };
}
