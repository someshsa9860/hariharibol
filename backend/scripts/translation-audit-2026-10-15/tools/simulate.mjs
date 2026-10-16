// DRY RUN — nothing is written anywhere but ./sim-<lang>.json. Applies the script-only fixes to a local snapshot in
// memory and re-runs the pipeline's own validator, to see what a no-AI pass would solve and what is left.
//   node simulate.mjs <lang> <snapshot dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { fixVerse } from './fixdet.mjs';

const BACKEND = '/Users/SSS/Jay Jay Ram Krishna Hari/app/hariharibol/backend/';
const SC = '/private/tmp/claude-501/-Users-SSS-Jay-Jay-Ram-Krishna-Hari-app-hariharibol/41f46403-3e0c-4e2d-addd-e1ae01590c59/scratchpad/';
const { assessLanguage } = await import(BACKEND + 'scripts/lib/claude-translate-validate.js');
const { unitHasPart } = await import(BACKEND + 'scripts/lib/claude-translate-parts.js');
const [lang, dir] = process.argv.slice(2);
const PARTS = ['translation', 'transliteration', 'wordMeanings', 'purport'];

const rowsOf = (v) => (v.commentaries || []).filter((c) => c.translatorSlug === 'prabhupada' && c.language === lang);
const ratingsFromWarnings = (w = []) => { const r = {}; for (const x of w) { const m = /^(translation|transliteration|wordMeanings|purport): rated ([123]) by /.exec(x); if (m) r[m[1]] = Number(m[2]); } return r; };
const ratingsOf = (v) => { const ai = v.aiTranslation || {}; if (ai.parts) { const all = {}; for (const s of Object.values(ai.parts)) Object.assign(all, ratingsFromWarnings(s.warnings)); return all; } return ratingsFromWarnings(ai.warnings); };
const KINDS = [[/letters are .* script — untranslated English left in/, 'wrong-script'], [/character\(s\) of another script/, 'foreign-chars'], [/too short/, 'too-short'], [/too long/, 'too-long'], [/numbers differ/, 'numbers'], [/identical to the English/, 'identical'], [/entries, the English list has/, 'entry-count'], [/line\(s\), the source has/, 'line-count'], [/paragraph\(s\), the English has/, 'para-count'], [/parentheses|brackets|quotation/, 'brackets'], [/meta-text/, 'meta-text'], [/rated \d by/, 'self-rated']];
const kindOf = (msg) => KINDS.find(([re]) => re.test(msg))?.[1] ?? 'other';
function assess(v, unit) {
  const rows = rowsOf(v);
  const pu = rows.find((r) => r.type === 'purport')?.text ?? '';
  const answer = { translation: rows.find((r) => r.type === 'translation')?.text ?? '', purport: pu ? pu.split('\n') : [], transliteration: v.transliteration ? v.transliteration.split('\n') : [], wordMeanings: v.wordMeanings ?? [], correctness: ratingsOf(v), note: v.aiTranslation?.note ?? '' };
  const parts = PARTS.filter((p) => unitHasPart(unit, p));
  const a = assessLanguage(unit, answer, lang, parts);
  return { scores: a.scores ?? {}, findings: (a.findings || []).filter((f) => f.level !== 'note').map((f) => ({ part: f.part, level: f.level, kind: kindOf(f.msg), msg: f.msg })) };
}

const files = {}; const units = {};
for (let n = 1; n <= 18; n++) {
  for (const v of JSON.parse(readFileSync(`${dir}/json/bhagavat-gita/${lang}/ch-${n}.json`, 'utf8')).verses) files[v.verseId] = v;
  for (const u of JSON.parse(readFileSync(`${SC}audit/en/units-${n}.json`, 'utf8'))) units[u.verseId] = u;
}

const result = {}; const patched = {};
for (const [id, v] of Object.entries(files)) {
  const unit = units[id];
  const before = assess(v, unit);
  const fx = fixVerse(lang, v, unit);
  const after = assess(fx.verse, unit);
  result[id] = { before, after, changes: fx.changes, leftovers: fx.leftovers, own: ratingsOf(v) };
  patched[id] = fx.verse;
}
writeFileSync(`${SC}fix/sim-${lang}.json`, JSON.stringify(result));
writeFileSync(`${SC}fix/sim-${lang}-patched.json`, JSON.stringify(patched));

// ---------- report ----------
const ids = Object.keys(result);
const hist = (which) => Object.fromEntries(PARTS.map((p) => { const t = { 1: 0, 2: 0, 3: 0 }; for (const id of ids) { const s = result[id][which].scores[p]; if (s) t[s]++; } return [p, t]; }));
const hb = hist('before'); const ha = hist('after');
console.log(`\n${lang}: ${ids.length} verses.  SCORES  before → after the script-only pass (1 = needs a second round)`);
for (const p of PARTS) console.log(`  ${p.padEnd(16)} 1: ${String(hb[p][1]).padStart(3)} → ${String(ha[p][1]).padStart(3)}    2: ${String(hb[p][2]).padStart(3)} → ${String(ha[p][2]).padStart(3)}    3: ${String(hb[p][3]).padStart(3)} → ${String(ha[p][3]).padStart(3)}`);
const lowest = (which) => { const t = { 1: 0, 2: 0, 3: 0 }; for (const id of ids) { const m = Math.min(...Object.values(result[id][which].scores)); t[m]++; } return t; };
console.log('  verse level (lowest part): before', JSON.stringify(lowest('before')), ' after', JSON.stringify(lowest('after')));

const chg = {}; for (const id of ids) for (const c of result[id].changes) { const k = `${c.part}/${c.how}`; chg[k] = (chg[k] || 0) + 1; }
console.log('\nCHANGES made by rule:'); for (const [k, c] of Object.entries(chg).sort()) console.log(`  ${k.padEnd(40)} ${c}`);
const chv = {}; for (const id of ids) for (const c of result[id].changes) (chv[`${c.part}/${c.how}`] ||= new Set()).add(id);
console.log('  verses touched:', new Set(ids.filter((id) => result[id].changes.length)).size);

console.log('\nFINDINGS still reported after the pass (validator, bad/minor):');
const rem = {}; for (const id of ids) for (const f of result[id].after.findings) { const k = `${f.part}/${f.level}:${f.kind}`; (rem[k] ||= []).push(id); }
for (const [k, list] of Object.entries(rem).sort()) console.log(`  ${k.padEnd(40)} ${String(list.length).padStart(4)} findings in ${new Set(list).size} verses  ${[...new Set(list)].slice(0, 14).join(' ')}${new Set(list).size > 14 ? ' …' : ''}`);

console.log('\nLEFT FOR TRANSLATION / REVIEW (rules must not touch these):');
const lo = {}; for (const id of ids) for (const l of result[id].leftovers) { const k = `${l.part}/${l.kind}`; (lo[k] ||= []).push(id); }
for (const [k, list] of Object.entries(lo).sort()) console.log(`  ${k.padEnd(44)} ${String(list.length).padStart(4)} in ${new Set(list).size} verses  ${[...new Set(list)].slice(0, 16).join(' ')}${new Set(list).size > 16 ? ' …' : ''}`);
