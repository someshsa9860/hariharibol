// Read-only audit of one saved Gita language (all chapters found in <dir>).
// Usage: node census.mjs <lang> <dir holding json/bhagavat-gita/<lang>/ch-N.json> <out.json>
// Writes nothing but <out.json> (in scratch). Reads the English source from S3 once and caches it.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const BACKEND = '/Users/SSS/Jay Jay Ram Krishna Hari/app/hariharibol/backend/';
const SCRATCH = '/private/tmp/claude-501/-Users-SSS-Jay-Jay-Ram-Krishna-Hari-app-hariharibol/41f46403-3e0c-4e2d-addd-e1ae01590c59/scratchpad/audit/';
createRequire(BACKEND + 'package.json')('dotenv').config({ path: BACKEND + '.env' });
const { getJson } = await import(BACKEND + 'scripts/lib/source-s3.js');
const { loadChapter } = await import(BACKEND + 'scripts/lib/claude-translate-source.js');
const { assessLanguage } = await import(BACKEND + 'scripts/lib/claude-translate-validate.js');
const { language } = await import(BACKEND + 'scripts/lib/claude-translate-languages.js');
const { unitHasPart } = await import(BACKEND + 'scripts/lib/claude-translate-parts.js');

const [lang, dir, outFile] = process.argv.slice(2);
const L = language(lang);
const PART_LIST = ['translation', 'transliteration', 'wordMeanings', 'purport'];
mkdirSync(SCRATCH + 'en', { recursive: true });

async function unitsOf(n) {
  const cache = `${SCRATCH}en/units-${n}.json`;
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, 'utf8'));
  const { units } = await loadChapter(getJson, n);
  writeFileSync(cache, JSON.stringify(units));
  return units;
}

const rowsOf = (v) => (v.commentaries || []).filter((c) => c.translatorSlug === 'prabhupada' && c.language === lang);
const ratingsFromWarnings = (warnings = []) => {
  const rated = {};
  for (const w of warnings) {
    const m = /^(translation|transliteration|wordMeanings|purport): rated ([123]) by /.exec(w);
    if (m) rated[m[1]] = Number(m[2]);
  }
  return rated;
};
function ratingsOfVerse(v) {
  const ai = v.aiTranslation || {};
  if (ai.parts) { const all = {}; for (const s of Object.values(ai.parts)) Object.assign(all, ratingsFromWarnings(s.warnings)); return all; }
  return ratingsFromWarnings(ai.warnings);
}
function storedScores(v) {
  const ai = v.aiTranslation || {};
  if (ai.parts) return Object.fromEntries(Object.entries(ai.parts).map(([p, s]) => [p, s.correctness]));
  return ai.partScores ?? {};
}
function stampOf(v) {
  const ai = v.aiTranslation || {};
  const first = ai.parts ? Object.values(ai.parts)[0] || {} : ai;
  return { provider: first.provider ?? ai.provider ?? '(none)', model: first.model ?? ai.model ?? '(none)', effort: first.effort ?? ai.effort ?? '', version: first.version ?? ai.version ?? '', promptVersion: first.promptVersion ?? ai.promptVersion ?? '', generatedAt: first.generatedAt ?? ai.generatedAt ?? '' };
}

// letters by script
function scriptCounts(text) {
  const c = { native: 0, deva: 0, otherIndic: 0, latin: 0, other: 0 };
  for (const ch of text || '') {
    if (!/[\p{L}\p{M}]/u.test(ch)) continue;
    const cp = ch.codePointAt(0);
    if (cp >= L.block[0] && cp <= L.block[1]) c.native++;
    else if (cp >= 0x0900 && cp <= 0x097f) c.deva++;
    else if (cp >= 0x0980 && cp <= 0x0dff) c.otherIndic++;
    else if (/\p{Script=Latin}/u.test(ch)) c.latin++;
    else c.other++;
  }
  return c;
}
const total = (c) => c.native + c.deva + c.otherIndic + c.latin + c.other;
const share = (c, k) => (total(c) ? c[k] / total(c) : 0);

const KINDS = [
  [/letters are .* script — untranslated English left in/, 'wrong-script'],
  [/character\(s\) of another script/, 'foreign-chars'],
  [/too short/, 'too-short'],
  [/too long/, 'too-long'],
  [/numbers differ/, 'numbers'],
  [/identical to the English/, 'identical'],
  [/entries, the English list has/, 'entry-count'],
  [/line\(s\), the source has/, 'line-count'],
  [/paragraph\(s\), the English has/, 'para-count'],
  [/parentheses|brackets|quotation/, 'brackets'],
  [/line break/, 'line-break'],
  [/meta-text/, 'meta-text'],
  [/rated \d by/, 'self-rated'],
  [/came back empty|missing|not an array|empty or not a string|not an object/, 'missing'],
];
const kindOf = (msg) => KINDS.find(([re]) => re.test(msg))?.[1] ?? 'other';

const records = [];
const chaptersSeen = [];
const missingChapterFiles = [];
const extraVerses = [];
const notTranslated = [];
for (let n = 1; n <= 18; n++) {
  const path = `${dir}/json/bhagavat-gita/${lang}/ch-${n}.json`;
  if (!existsSync(path)) { missingChapterFiles.push(n); continue; }
  const units = await unitsOf(n);
  const file = JSON.parse(readFileSync(path, 'utf8'));
  chaptersSeen.push({ n, inFile: file.verses.length, english: units.length });
  const seen = new Set();
  for (const v of file.verses) {
    seen.add(v.verseId);
    const unit = units.find((u) => u.verseId === v.verseId);
    if (!unit) { extraVerses.push(v.verseId); continue; }
    const rows = rowsOf(v);
    const tr = rows.find((r) => r.type === 'translation')?.text ?? '';
    const pu = rows.find((r) => r.type === 'purport')?.text ?? '';
    const answer = {
      translation: tr, purport: pu ? pu.split('\n') : [],
      transliteration: v.transliteration ? v.transliteration.split('\n') : [],
      wordMeanings: v.wordMeanings ?? [],
      correctness: ratingsOfVerse(v),
    };
    const parts = PART_LIST.filter((p) => unitHasPart(unit, p));
    const a = assessLanguage(unit, answer, lang, parts);
    const words = v.wordMeanings ?? [];
    const rec = {
      id: v.verseId, ch: n,
      stamp: stampOf(v),
      stored: storedScores(v), now: a.scores ?? {},
      note: v.aiTranslation?.note ?? '',
      findings: (a.findings || []).filter((f) => f.level !== 'note').map((f) => ({ part: f.part, level: f.level, kind: kindOf(f.msg), msg: f.msg })),
      english: { parts, words: unit.wordMeanings.length, lines: unit.transliteration.length, paras: unit.purport.length },
      got: { translation: Boolean(tr.trim()), transliteration: Boolean((v.transliteration || '').trim()), wordMeanings: words.length > 0, purport: Boolean(pu.trim()) },
      counts: { words: words.length, lines: answer.transliteration.length, paras: answer.purport.length },
      script: {
        transliteration: scriptCounts(v.transliteration),
        word: scriptCounts(words.map((w) => w.word || '').join(' ')),
        meaning: scriptCounts(words.map((w) => w.meaning || '').join(' ')),
        translation: scriptCounts(tr),
        purport: scriptCounts(pu),
      },
      sanskritColon: /[ഀ-ൿ஀-௿²³⁴]:/.test([v.transliteration || '', ...words.map((w) => w.word || '')].join('\n')),
    };
    records.push(rec);
  }
  for (const u of units) if (!seen.has(u.verseId)) notTranslated.push(u.verseId);
}
writeFileSync(outFile, JSON.stringify({ lang, records, chaptersSeen, missingChapterFiles, extraVerses, notTranslated }, null, 1));

// ---------- report ----------
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '-');
const N = records.length;
console.log(`\n===== ${L.name} (${lang}) — ${N} verses in ${chaptersSeen.length} chapter files =====`);
console.log('chapters (file / English):', chaptersSeen.map((c) => `${c.n}:${c.inFile}/${c.english}`).join(' '));
console.log('missing chapter files:', missingChapterFiles.join(',') || 'none', '| English verses with no entry:', notTranslated.length ? notTranslated.join(' ') : 'none', '| verses with no English unit:', extraVerses.join(' ') || 'none');

const by = (f) => { const m = {}; for (const r of records) { const k = f(r); m[k] = (m[k] || 0) + 1; } return m; };
console.log('\nSTAMPS provider/model/effort/prompt/version:'); for (const [k, c] of Object.entries(by((r) => `${r.stamp.provider} / ${r.stamp.model} / ${r.stamp.effort} / prompt ${r.stamp.promptVersion} / ${r.stamp.version}`))) console.log(`  ${c}\t${k}`);

console.log('\nSTORED SCORES (what the run saved):');
for (const p of PART_LIST) {
  const t = { 1: 0, 2: 0, 3: 0, none: 0 };
  for (const r of records) { if (!r.english.parts.includes(p)) continue; const s = r.stored[p]; t[s ?? 'none']++; }
  const n = t[1] + t[2] + t[3] + t.none;
  console.log(`  ${p.padEnd(16)} of ${String(n).padStart(3)}:  1 → ${String(t[1]).padStart(3)} (${pct(t[1], n)})   2 → ${String(t[2]).padStart(3)}   3 → ${String(t[3]).padStart(3)}${t.none ? `   none → ${t.none}` : ''}`);
}
const lowest = { 1: 0, 2: 0, 3: 0 }; for (const r of records) { const v = Math.min(...Object.values(r.stored).filter(Number.isInteger)); if (lowest[v] !== undefined) lowest[v]++; }
console.log(`  verse level (lowest part): 1 → ${lowest[1]}  2 → ${lowest[2]}  3 → ${lowest[3]}`);

console.log('\nCOMPLETENESS: parts the English has but the entry lacks:');
for (const p of PART_LIST) { const miss = records.filter((r) => r.english.parts.includes(p) && !r.got[p]); console.log(`  ${p.padEnd(16)} ${miss.length}${miss.length ? '  ' + miss.slice(0, 15).map((r) => r.id).join(' ') : ''}`); }
const cnt = (name, f) => { const x = records.filter(f); console.log(`  ${name}: ${x.length}${x.length ? '  ' + x.slice(0, 15).map((r) => r.id).join(' ') : ''}`); };
cnt('word-list length differs from English', (r) => r.english.words && r.counts.words !== r.english.words);
cnt('transliteration line count differs', (r) => r.english.lines && r.counts.lines !== r.english.lines);
cnt('purport paragraph count differs', (r) => r.english.paras && r.counts.paras !== r.english.paras);

console.log('\nSCRIPT CENSUS (verses where the field has ANY letter of that script / is MOSTLY that script ≥50%):');
const FIELDS = ['transliteration', 'word', 'meaning', 'translation', 'purport'];
for (const f of FIELDS) {
  const present = records.filter((r) => total(r.script[f]) > 0);
  const row = (k) => { const any = present.filter((r) => r.script[f][k] > 0).length; const most = present.filter((r) => share(r.script[f], k) >= 0.5).length; return `${k}: any ${any} / mostly ${most}`; };
  console.log(`  ${f.padEnd(16)} of ${String(present.length).padStart(3)}   ${['deva', 'otherIndic', 'latin', 'other'].map(row).join('   ')}   | native-only: ${present.filter((r) => share(r.script[f], 'native') === 1).length}`);
}
console.log(`  colon used as a visarga in the Sanskrit fields: ${records.filter((r) => r.sanskritColon).length} verses`);

console.log('\nVALIDATOR RE-RUN (bad/minor findings, counts of findings by part and kind):');
const kinds = {}; for (const r of records) for (const f of r.findings) ((kinds[f.part] ||= {})[`${f.level}:${f.kind}`] = (kinds[f.part][`${f.level}:${f.kind}`] || 0) + 1);
for (const p of PART_LIST) console.log(`  ${p.padEnd(16)} ` + Object.entries(kinds[p] || {}).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k}=${c}`).join('  '));
const nowT = {}; for (const p of PART_LIST) nowT[p] = { 1: 0, 2: 0, 3: 0 };
for (const r of records) for (const [p, s] of Object.entries(r.now)) nowT[p][s]++;
console.log('SCORES NOW (validator + the model\'s own rating):'); for (const p of PART_LIST) console.log(`  ${p.padEnd(16)} 1:${nowT[p][1]}  2:${nowT[p][2]}  3:${nowT[p][3]}`);

console.log('\nMODEL NOTES (most common):');
const notes = by((r) => r.note.replace(/\d+/g, '#').slice(0, 130) || '(none)');
for (const [k, c] of Object.entries(notes).sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  ${String(c).padStart(4)}  ${k}`);
