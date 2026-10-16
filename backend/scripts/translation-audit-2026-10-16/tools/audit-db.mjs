// Read-only audit of the Gita translations as they stand in the LOCAL DATABASE (VerseTranslation, Prabhupāda TRANSLATION rows,
// the seven languages), against the English source. Writes nothing to the database or to S3; its only output is audit-db.json.
//   cd backend && set -a && source .env && set +a && node scripts/translation-audit-2026-10-16/tools/audit-db.mjs
// Needs a read-only copy of the seven language folders beside its output, to read how each verse was made (model, scores, notes):
//   for l in bn hi kn ml mr ta te; do aws s3 sync s3://sanatan-db/json/bhagavat-gita/$l/ scripts/translation-audit-2026-10-16/output/s3now/$l/; done
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const B = resolve(import.meta.dirname, '../../..') + '/';
const SC = resolve(import.meta.dirname, '../output') + '/';
mkdirSync(SC, { recursive: true });
const imp = (p) => import(pathToFileURL(B + p).href);
const { prisma } = await imp('config/database.js');
const { getJson } = await imp('scripts/lib/source-s3.js');
const { loadChapter, CHAPTERS } = await imp('scripts/lib/claude-translate-source.js');
const { assessLanguage, wordCount } = await imp('scripts/lib/claude-translate-validate.js');
const { LANGUAGES } = await imp('scripts/lib/claude-translate-languages.js');
const { PARTS, unitHasPart } = await imp('scripts/lib/claude-translate-parts.js');
const { indicToIast, iastKey, distance, scriptKey } = await imp('scripts/lib/translation-script.js');

const CODES = LANGUAGES.map((l) => l.code);
const langOf = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]));

/* ---------- the English source units (cached) ---------- */
const unitsFile = SC + 'units.json';
let units;
if (existsSync(unitsFile)) units = JSON.parse(readFileSync(unitsFile, 'utf8'));
else {
  units = [];
  for (const n of CHAPTERS) units.push(...(await loadChapter(getJson, n)).units);
  writeFileSync(unitsFile, JSON.stringify(units));
}
const unitById = new Map(units.map((u) => [u.verseId, u]));

/* ---------- the database ---------- */
const dbRows = await prisma.verseTranslation.findMany({
  where: { type: 'TRANSLATION', translator: { slug: 'prabhupada' }, verse: { bookNumber: 1 }, languageCode: { in: [...CODES, 'en'] } },
  select: { languageCode: true, meaning: true, purport: true, transliteration: true, wordMeanings: true, translatedBy: true, version: true, isPublished: true, verse: { select: { verseId: true, transliteration: true, wordMeanings: true } } },
});
const dbVerses = await prisma.verse.findMany({ where: { bookNumber: 1 }, select: { verseId: true } });
const rowOf = {};
for (const c of [...CODES, 'en']) rowOf[c] = new Map();
for (const r of dbRows) rowOf[r.languageCode].set(r.verse.verseId, r);

/* ---------- text helpers ---------- */
const BLOCKS = [[0x0900, 0x097f, 'Devanagari'], [0x0980, 0x09ff, 'Bengali'], [0x0a00, 0x0a7f, 'Gurmukhi'], [0x0a80, 0x0aff, 'Gujarati'], [0x0b00, 0x0b7f, 'Odia'], [0x0b80, 0x0bff, 'Tamil'], [0x0c00, 0x0c7f, 'Telugu'], [0x0c80, 0x0cff, 'Kannada'], [0x0d00, 0x0d7f, 'Malayalam'], [0x0d80, 0x0dff, 'Sinhala']];
const isLetter = (ch) => /[\p{L}\p{M}]/u.test(ch);
function scriptOfChar(ch) {
  const cp = ch.codePointAt(0);
  if (cp === 0x964 || cp === 0x965) return null; // danda: shared
  const b = BLOCKS.find(([lo, hi]) => cp >= lo && cp <= hi);
  if (b) return b[2];
  if (/\p{Script=Latin}/u.test(ch)) return 'Latin';
  if (/\p{Script=Cyrillic}|\p{Script=Arabic}|\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Greek}|\p{Script=Hebrew}|\p{Script=Thai}|\p{Script=Hangul}/u.test(ch)) return 'Other';
  return null;
}
const OWN_NAME = { hi: 'Devanagari', mr: 'Devanagari', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam' };
/** letters per script */
function letterCounts(text) {
  const c = {};
  for (const ch of text || '') {
    if (!isLetter(ch)) continue;
    const s = scriptOfChar(ch);
    if (s) c[s] = (c[s] || 0) + 1;
  }
  return c;
}
const DIACRITIC = /[āīūṛṝḷḹṅñṭḍṇśṣṁṃḥ]/i;
const tokensOf = (text) => (text || '').split(/[\s,;:()\[\]“”"‘’'.।॥?!–—\-/]+/).filter(Boolean);
/** the dominant script of a token (by letters) */
function tokenScript(tok) {
  const c = letterCounts(tok);
  const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return e ? e[0] : null;
}
/** runs of consecutive tokens whose script is not the language's own and not Latin: [{ script, tokens, text }] */
function foreignIndicRuns(lang, text) {
  const own = OWN_NAME[lang];
  const out = [];
  let cur = null;
  for (const tok of tokensOf(text)) {
    const s = tokenScript(tok);
    const foreign = s && s !== own && s !== 'Latin' && s !== 'Other';
    if (foreign) {
      if (cur && cur.script === s) cur.tokens.push(tok);
      else {
        cur = { script: s, tokens: [tok] };
        out.push(cur);
      }
    } else if (!s) continue;
    else cur = null;
  }
  return out.map((r) => ({ ...r, text: r.tokens.join(' ') }));
}
const MR = new Set(['आहे', 'आहेत', 'आणि', 'नाही', 'म्हणजे', 'त्याने', 'आपण', 'होते', 'होता', 'त्याला', 'त्यांना', 'त्यांच्या', 'त्याच्या', 'मध्ये', 'किंवा', 'करतो', 'करते', 'असतो', 'असते', 'करून', 'झाले', 'होय', 'केले', 'सर्व', 'जो', 'ज्याला', 'तो', 'ती', 'ते', 'हे', 'या', 'चा', 'ची', 'चे', 'च्या', 'ला', 'ना', 'मी', 'तू', 'तुम्ही', 'आम्ही', 'कारण']);
const MR_ONLY = new Set(['आहे', 'आहेत', 'आणि', 'नाही', 'म्हणजे', 'त्याने', 'आपण', 'त्याला', 'त्यांना', 'त्यांच्या', 'त्याच्या', 'मध्ये', 'किंवा', 'करतो', 'करते', 'असतो', 'असते', 'करून', 'झाले', 'केले', 'ज्याला', 'तुम्ही', 'आम्ही']);
const HI_ONLY = new Set(['है', 'हैं', 'और', 'नहीं', 'में', 'यह', 'थे', 'था', 'थी', 'को', 'के', 'की', 'का', 'से', 'पर', 'वह', 'उसे', 'उन्हें', 'उनके', 'उसके', 'करता', 'करती', 'होता', 'होती', 'हुआ', 'किया', 'जाता', 'लिए', 'क्योंकि', 'तथा', 'अथवा']);
const NE_ONLY = new Set(['छ', 'छन्', 'हुन्छ', 'गर्छ', 'भएको', 'हुनेछ', 'गर्नुहोस्', 'हरू', 'हरूले', 'हो', 'यो', 'त्यो', 'गर्न', 'भने', 'पनि']);
const count = (tokens, set) => tokens.filter((t) => set.has(t)).length;

/** cluster sanity: a vowel sign / virama that cannot stand where it does */
function brokenMarks(text) {
  const n = (text || '').normalize('NFC');
  const out = [];
  // a combining mark at the start of a word (after space/start/punctuation)
  const startRe = /(^|[\s,;:()\[\]“”"‘’'.।॥?!\-–—])(\p{M})/gu;
  let m;
  while ((m = startRe.exec(n))) if (![0x01, 0x02, 0x03].includes(m[2].codePointAt(0) & 0x7f)) out.push(`word starts with U+${m[2].codePointAt(0).toString(16)}`);
  // two vowel signs next to each other
  const vowelSign = (ch) => {
    const cp = ch.codePointAt(0);
    return BLOCKS.some(([lo, hi]) => cp >= lo && cp <= hi && (cp & 0x7f) >= 0x3e && (cp & 0x7f) <= 0x4c && (cp & 0x7f) !== 0x4d);
  };
  const ch = [...n];
  for (let i = 1; i < ch.length; i++) if (vowelSign(ch[i]) && vowelSign(ch[i - 1])) out.push(`two vowel signs ${ch[i - 1]}${ch[i]}`);
  return out;
}
/** UTF-8 read as Latin-1 / Windows-1252 ("à¦¯à¦œ…"): a lead byte letter followed by a continuation-byte symbol, over and over. */
const MOJI = /[\u00c2-\u00f4][\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/g;
const mojibake = (text) => (text.match(MOJI) || []).length;
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const KINDS = [
  [/letters are .* script — untranslated English left in/, 'wrong-script-share'],
  [/character\(s\) of another script/, 'foreign-chars'],
  [/too short/, 'too-short'],
  [/too long/, 'too-long'],
  [/numbers differ/, 'numbers'],
  [/identical to the English/, 'identical-to-English'],
  [/entries, the English list has/, 'word-count'],
  [/line\(s\), the source has/, 'line-count'],
  [/paragraph\(s\), the English has/, 'para-count'],
  [/parentheses|brackets|quotation/, 'brackets'],
  [/line break/, 'line-break'],
  [/meta-text/, 'meta-text'],
  [/reads as (Marathi|Hindi)/, 'hi-mr-mixup'],
  [/empty or not a string|missing or not an array|expected an object/, 'empty'],
];
const kindOf = (msg) => KINDS.find(([re]) => re.test(msg))?.[1] ?? 'other';
const partOf = (f) => f.part;

/* ---------- what the saved files say about how each verse was made (read-only copy of S3 in s3now/) ---------- */
const stamps = {};
for (const lang of CODES) {
  stamps[lang] = new Map();
  for (const n of CHAPTERS) {
    const f = JSON.parse(readFileSync(`${SC}s3now/${lang}/ch-${n}.json`, 'utf8'));
    for (const v of f.verses) {
      const ai = v.aiTranslation || {};
      const parts = ai.parts ? Object.fromEntries(Object.entries(ai.parts).map(([p, s]) => [p, { score: s.correctness, model: s.model, provider: s.provider, note: s.note, at: s.generatedAt }])) : null;
      stamps[lang].set(v.verseId, { model: ai.model, provider: ai.provider, at: ai.generatedAt, note: ai.note, scores: ai.partScores ?? null, correctness: ai.correctness, parts, scriptFix: Boolean(ai.scriptFix) });
    }
  }
}

/* ---------- the audit ---------- */
const sourceKeyLines = (unit) => unit.transliteration.map((l) => iastKey(l.replace(/\s*\|\|\s*[0-9-]+\s*\|\|\s*$/, '').replace(/\s*[.|]$/, '')));
function keyOf(lang, text) {
  const t = (text || '').replace(/[॥।|0-9०-९০-৯௦-௯౦-౯೦-೯൦-൯]+/g, ' ').trim();
  return lang === 'ta' ? scriptKey('ta', t) : iastKey(indicToIast(t));
}

const records = []; // one per (lang, verse)
const coverage = {};
for (const lang of CODES) {
  coverage[lang] = { rows: 0, noRow: [], translation: 0, purport: 0, purportExpected: 0, purportExtra: [], transliteration: 0, wordMeanings: 0, notPublished: 0, translatedBy: {}, versions: {} };
}
const dbEnglishProblems = [];
for (const unit of units) {
  const en = rowOf.en.get(unit.verseId);
  if (!en) dbEnglishProblems.push(`${unit.verseId}: no English row in the database`);
  else {
    if ((en.meaning || '').trim() !== unit.translation) dbEnglishProblems.push(`${unit.verseId}: database English translation differs from the S3 source`);
    const enP = (en.purport || '').split(/\n+/).map((p) => p.trim()).filter(Boolean);
    if (JSON.stringify(enP) !== JSON.stringify(unit.purport)) dbEnglishProblems.push(`${unit.verseId}: database English purport differs from the S3 source`);
  }
}
if (!dbVerses.every((v) => unitById.has(v.verseId)) || dbVerses.length !== units.length) dbEnglishProblems.push(`verse set differs: database ${dbVerses.length}, source ${units.length}`);

for (const lang of CODES) {
  const L = langOf[lang];
  for (const unit of units) {
    const row = rowOf[lang].get(unit.verseId);
    const rec = { lang, id: unit.verseId, ch: unit.chapterNumber, flags: [], findings: [] };
    records.push(rec);
    const cv = coverage[lang];
    if (!row) {
      cv.noRow.push(unit.verseId);
      rec.flags.push({ part: 'row', kind: 'no-row' });
      continue;
    }
    cv.rows++;
    if (!row.isPublished) cv.notPublished++;
    cv.translatedBy[row.translatedBy ?? 'null'] = (cv.translatedBy[row.translatedBy ?? 'null'] || 0) + 1;
    cv.versions[row.version ?? 'null'] = (cv.versions[row.version ?? 'null'] || 0) + 1;
    rec.stamp = stamps[lang].get(unit.verseId) ?? null;
    const has = Object.fromEntries(PARTS.map((p) => [p, unitHasPart(unit, p)]));
    const purportParas = (row.purport || '').split('\n').map((p) => p.trim()).filter(Boolean);
    const lines = (row.transliteration || '').split('\n').map((p) => p.trim()).filter(Boolean);
    const words = Array.isArray(row.wordMeanings) ? row.wordMeanings : [];
    if ((row.meaning || '').trim()) cv.translation++;
    if (purportParas.length) cv.purport++;
    if (lines.length) cv.transliteration++;
    if (words.length) cv.wordMeanings++;
    if (has.purport) cv.purportExpected++;
    if (!has.purport && purportParas.length) cv.purportExtra.push(unit.verseId);
    rec.n = { lines: lines.length, paras: purportParas.length, words: words.length, en: { lines: unit.transliteration.length, paras: unit.purport.length, words: unit.wordMeanings.length } };
    if (!(row.meaning || '').trim()) rec.flags.push({ part: 'translation', kind: 'part-missing' });
    if (has.purport && !purportParas.length) rec.flags.push({ part: 'purport', kind: 'part-missing' });
    if (has.transliteration && !lines.length) rec.flags.push({ part: 'transliteration', kind: 'part-missing' });
    if (has.wordMeanings && !words.length) rec.flags.push({ part: 'wordMeanings', kind: 'part-missing' });
    if (!has.purport && purportParas.length) rec.flags.push({ part: 'purport', kind: 'purport-where-english-has-none' });

    // the pipeline's own checks
    const answer = { translation: row.meaning ?? '', purport: purportParas, transliteration: lines, wordMeanings: words };
    const parts = PARTS.filter((p) => has[p]);
    const a = assessLanguage(unit, answer, lang, parts);
    if (!a.usable) rec.flags.push({ part: 'row', kind: 'unusable', msg: a.problems.join('; ') });
    else {
      rec.scores = a.scores;
      for (const f of a.findings) if (f.level !== 'note') rec.findings.push({ part: f.part, level: f.level, kind: kindOf(f.msg), msg: f.msg });
    }

    // ---- script / language per prose field
    const prose = { translation: row.meaning || '', purport: purportParas.join('\n'), meanings: words.map((w) => w.meaning || '').join(' ; ') };
    const sanskrit = { transliteration: lines.join('\n'), words: words.map((w) => w.word || '').join(' ; ') };
    for (const [field, text] of [...Object.entries(prose), ...Object.entries(sanskrit)]) {
      const lc = letterCounts(text);
      const total = Object.values(lc).reduce((x, y) => x + y, 0);
      const own = lc[OWN_NAME[lang]] || 0;
      const foreign = Object.entries(lc).filter(([s]) => s !== OWN_NAME[lang] && s !== 'Latin' && s !== 'Other');
      const latin = lc.Latin || 0;
      const other = lc.Other || 0;
      rec.script ??= {};
      rec.script[field] = { total, own, latin, other, foreign: Object.fromEntries(foreign) };
      if (!total) continue;
      const moji = mojibake(text);
      if (moji >= 3) rec.flags.push({ part: field, kind: 'mojibake', pairs: moji, sample: text.slice(0, 40) });
      const runs = foreignIndicRuns(lang, text);
      if (runs.length) {
        const longest = runs.reduce((m, r) => (r.tokens.length > m.tokens.length ? r : m), runs[0]);
        rec.flags.push({ part: field, kind: longest.tokens.length >= 3 ? 'foreign-script-run' : 'foreign-script-stray', scripts: [...new Set(runs.map((r) => r.script))].join('+'), runs: runs.length, longest: longest.text.slice(0, 120), letters: foreign.reduce((s, [, n]) => s + n, 0) });
      }
      if (other) rec.flags.push({ part: field, kind: 'other-script', letters: other });
      // Roman letters
      const toks = tokensOf(text);
      const plain = toks.filter((t) => /^[A-Za-z]{2,}$/.test(t));
      const iast = toks.filter((t) => /\p{Script=Latin}/u.test(t) && DIACRITIC.test(t.normalize('NFC')));
      if (plain.length) {
        // longest run of consecutive plain-Latin tokens
        let best = 0;
        let run = 0;
        for (const t of toks) {
          if (/^[A-Za-z]{2,}$/.test(t)) best = Math.max(best, ++run);
          else run = 0;
        }
        rec.flags.push({ part: field, kind: best >= 3 ? 'english-phrase' : 'english-word', words: plain.length, longestRun: best, sample: plain.slice(0, 8).join(' ') });
      }
      if (iast.length && (field === 'translation' || field === 'purport' || field === 'meanings')) rec.flags.push({ part: field, kind: 'iast-in-prose', words: iast.length, sample: iast.slice(0, 6).join(' ') });
      if (latin && total && latin / total > 0.15) rec.flags.push({ part: field, kind: 'mostly-roman', share: +(latin / total).toFixed(2) });
    }

    // ---- Hindi / Marathi / Nepali
    if (lang === 'hi' || lang === 'mr') {
      for (const [field, text] of Object.entries(prose)) {
        const toks = tokensOf(text);
        if (toks.length < 4) continue;
        const mr = count(toks, MR_ONLY);
        const hi = count(toks, HI_ONLY);
        const ne = count(toks, NE_ONLY);
        rec.mix ??= {};
        rec.mix[field] = { mr, hi, ne, tokens: toks.length };
        if (lang === 'hi' && mr >= 2 && mr > hi * 0.5) rec.flags.push({ part: field, kind: 'hi-reads-marathi', mr, hi, tokens: toks.length });
        if (lang === 'mr' && hi >= 2 && hi > mr * 0.5) rec.flags.push({ part: field, kind: 'mr-reads-hindi', mr, hi, tokens: toks.length });
        if (ne >= 3 && ne > hi + mr) rec.flags.push({ part: field, kind: 'reads-nepali', ne, tokens: toks.length });
      }
    }
    if (lang === 'bn' && /[ৰৱ]/.test(row.meaning + row.purport)) rec.flags.push({ part: 'translation', kind: 'assamese-letters' });

    // ---- endings (cut off?)
    const END = /[.।॥?!”"’)\]…:;]$|[0-9०-९]$/;
    const enEnds = /[.?!”"’)]$/.test(unit.translation.trim());
    if (enEnds && (row.meaning || '').trim() && !END.test(row.meaning.trim())) rec.flags.push({ part: 'translation', kind: 'no-closing-mark', tail: row.meaning.trim().slice(-30) });
    const lastEn = unit.purport.at(-1);
    if (lastEn && /[.?!”"’)]$/.test(lastEn.trim()) && purportParas.length && !END.test(purportParas.at(-1))) rec.flags.push({ part: 'purport', kind: 'no-closing-mark', tail: purportParas.at(-1).slice(-30) });

    // ---- length
    rec.len = { translation: (row.meaning || '').length / unit.translation.length, purport: unit.purport.length ? purportParas.join(' ').length / unit.purport.join(' ').length : null };

    // ---- garbage
    const all = [row.meaning, row.purport, row.transliteration, ...words.map((w) => `${w.word ?? ''} ${w.meaning ?? ''}`)].join('\n');
    const RESIDUE = /\\n|\\"|[{}]|<\/?[a-z]+>|\*\*|```|\bTODO\b|\bN\/A\b|\bnull\b|\bundefined\b/;
    if (/\uFFFD/.test(all)) rec.flags.push({ part: 'any', kind: 'replacement-char' });
    if (RESIDUE.test(all) && !RESIDUE.test(unit.translation + unit.purport.join(' '))) rec.flags.push({ part: 'any', kind: 'markup-residue', sample: (all.match(RESIDUE) || [''])[0] });
    for (const [field, text] of [...Object.entries(prose), ...Object.entries(sanskrit)]) {
      const broken = brokenMarks(text);
      if (broken.length) rec.flags.push({ part: field, kind: 'broken-marks', n: broken.length, sample: broken.slice(0, 2).join('; ') });
      if (/(\S+)(\s+\1){4,}/u.test(text)) rec.flags.push({ part: field, kind: 'word-loop', sample: (text.match(/(\S+)(\s+\1){4,}/u) || [''])[0].slice(0, 60) });
      if (/ {2,}|^\s|\s$/m.test(text) && field !== 'purport') rec.flags.push({ part: field, kind: 'stray-spaces' });
    }

    // ---- Sanskrit really the verse's Sanskrit?
    if (a.usable && lines.length === unit.transliteration.length) {
      const src = sourceKeyLines(unit);
      const d = lines.map((l, i) => distance(keyOf(lang, l), src[i]));
      rec.translitDist = Math.max(...d);
      rec.translitDistMean = d.reduce((x, y) => x + y, 0) / d.length;
    }
    if (a.usable && words.length === unit.wordMeanings.length) {
      const d = words.map((w, i) => distance(keyOf(lang, w.word || ''), iastKey(unit.wordMeanings[i].word || '')));
      rec.wordDistMax = Math.max(...d);
      rec.wordDistMean = d.reduce((x, y) => x + y, 0) / d.length;
      rec.wordsBad = d.map((x, i) => (x > 0.5 ? i + 1 : 0)).filter(Boolean);
    }
  }
}

/* ---------- cross-language ---------- */
const byVerse = new Map();
for (const r of records) (byVerse.get(r.id) ?? byVerse.set(r.id, []).get(r.id)).push(r);
const medians = {};
for (const lang of CODES) {
  medians[lang] = {
    translation: median(records.filter((r) => r.lang === lang && r.len).map((r) => r.len.translation)),
    purport: median(records.filter((r) => r.lang === lang && r.len?.purport).map((r) => r.len.purport)),
  };
}
for (const [id, recs] of byVerse) {
  for (const part of ['translation', 'purport']) {
    const rel = recs.filter((r) => r.len?.[part] != null).map((r) => ({ r, rel: r.len[part] / medians[r.lang][part] }));
    if (rel.length < 5) continue;
    const factor = median(rel.map((x) => x.rel));
    for (const { r, rel: v } of rel) {
      const adj = v / factor;
      r.lenAdj ??= {};
      r.lenAdj[part] = +adj.toFixed(2);
      r.lenAdj[part + 'Factor'] = +factor.toFixed(2);
      if (adj < 0.6) r.flags.push({ part, kind: 'much-shorter-than-peers', adj: +adj.toFixed(2), factor: +factor.toFixed(2) });
      if (adj > 1.7) r.flags.push({ part, kind: 'much-longer-than-peers', adj: +adj.toFixed(2), factor: +factor.toFixed(2) });
    }
  }
  // identical translation text across languages / equal to English
  const seen = new Map();
  for (const r of recs) {
    const row = rowOf[r.lang].get(id);
    if (!row?.meaning) continue;
    const key = row.meaning.trim().replace(/\s+/g, ' ');
    if (seen.has(key)) {
      r.flags.push({ part: 'translation', kind: 'same-text-as-other-language', other: seen.get(key) });
      byVerse.get(id).find((x) => x.lang === seen.get(key)).flags.push({ part: 'translation', kind: 'same-text-as-other-language', other: r.lang });
    } else seen.set(key, r.lang);
  }
}

/* ---------- save and summarise ---------- */
writeFileSync(SC + 'audit-db.json', JSON.stringify({ at: new Date().toISOString(), coverage, dbEnglishProblems, medians, records }, null, 0));
await prisma.$disconnect();
console.log('written', SC + 'audit-db.json', 'records', records.length);
process.exit(0);
