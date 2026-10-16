// Read-only: how close are the transliteration lines and word entries to the English IAST, and does the converter
// reproduce the model's own good lines?   node sanskrit.mjs <lang> <dir>
import { readFileSync } from 'node:fs';
import { iastKey, scriptKey, indicToIast, sanskritLine, iastToMalayalam, iastToTamil, distance } from './script.mjs';
const [lang, dir] = process.argv.slice(2);
const SC = '/private/tmp/claude-501/-Users-SSS-Jay-Jay-Ram-Krishna-Hari-app-hariharibol/41f46403-3e0c-4e2d-addd-e1ae01590c59/scratchpad/';
const own = lang === 'ml' ? [0x0d00, 0x0d7f] : [0x0b80, 0x0bff];
const kindOf = (ch) => {
  const cp = ch.codePointAt(0);
  if (!/[\p{L}\p{M}]/u.test(ch)) return 'neutral';
  if (cp >= own[0] && cp <= own[1]) return 'own';
  if (cp >= 0x900 && cp <= 0xdff) return 'indic';
  if (/\p{Script=Latin}/u.test(ch)) return 'latin';
  return 'neutral';
};
export function keyOfMixed(text) {
  let out = ''; let run = ''; let k = null;
  const flush = () => { if (!run) return; out += k === 'own' ? scriptKey(lang, run) : k === 'indic' ? iastKey(indicToIast(run)) : k === 'latin' ? iastKey(run) : ''; run = ''; };
  for (const ch of text) {
    const kk = kindOf(ch);
    if (kk === 'neutral') { run += ch; continue; }       // marks and spaces ride along with the current run
    if (k !== null && kk !== k) { flush(); }
    k = kk; run += ch;
  }
  flush();
  return out;
}
export const foreignShare = (text) => { let f = 0; let t = 0; for (const ch of text) { const kk = kindOf(ch); if (kk === 'neutral') continue; t++; if (kk !== 'own') f++; } return t ? f / t : 0; };

const files = {};
for (let n = 1; n <= 18; n++) for (const v of JSON.parse(readFileSync(`${dir}/json/bhagavat-gita/${lang}/ch-${n}.json`, 'utf8')).verses) files[v.verseId] = v;
const units = {};
for (let n = 1; n <= 18; n++) for (const u of JSON.parse(readFileSync(`${SC}audit/en/units-${n}.json`, 'utf8'))) units[u.verseId] = u;

const rows = [];
for (const [id, v] of Object.entries(files)) {
  const u = units[id]; if (!u) continue;
  const enLines = u.transliteration || [];
  const enKey = iastKey(enLines.join(' '));
  const t = v.transliteration || '';
  rows.push({ id, kind: 'translit', foreign: foreignShare(t), dist: distance(keyOfMixed(t), enKey), model: t, eng: enLines.join('\n'), conv: enLines.map((l) => sanskritLine(l, lang)).join('\n') });
  const wm = v.wordMeanings || []; const uw = u.wordMeanings || [];
  if (wm.length === uw.length) wm.forEach((w, i) => {
    const txt = w.word || '';
    rows.push({ id: `${id}#${i}`, kind: 'word', foreign: foreignShare(txt), dist: distance(keyOfMixed(txt), iastKey(uw[i].word || '')), model: txt, eng: uw[i].word, conv: (lang === 'ml' ? iastToMalayalam : iastToTamil)(uw[i].word || '') });
  });
  else rows.push({ id, kind: 'wordcount', foreign: 0, dist: 1, model: `${wm.length}`, eng: `${uw.length}`, conv: '' });
}
const bucket = (d) => (d < 0.02 ? '<2%' : d < 0.05 ? '2-5%' : d < 0.10 ? '5-10%' : d < 0.20 ? '10-20%' : d < 0.35 ? '20-35%' : '>=35%');
for (const kind of ['translit', 'word']) {
  const tally = { own: {}, foreign: {} };
  for (const r of rows.filter((r) => r.kind === kind)) { const g = r.foreign > 0.05 ? 'foreign' : 'own'; tally[g][bucket(r.dist)] = (tally[g][bucket(r.dist)] || 0) + 1; }
  console.log(`\n${kind}: distance to the English skeleton`, JSON.stringify(tally));
}
console.log('word-count mismatches:', rows.filter((r) => r.kind === 'wordcount').map((r) => `${r.id}(${r.model}/${r.eng})`).join(' ') || 'none');
// exact reproduction by the converter, for model lines that are clean and close
for (const kind of ['translit', 'word']) {
  const good = rows.filter((r) => r.kind === kind && r.foreign <= 0.05 && r.dist < 0.05);
  const same = good.filter((r) => r.model.trim() === r.conv.trim());
  console.log(`\n${kind}: model line is clean and close: ${good.length}; the converter reproduces it exactly: ${same.length}`);
  const diffs = good.filter((r) => r.model.trim() !== r.conv.trim());
  for (const r of diffs.slice(0, Number(process.env.SHOW || 12))) console.log(`  ${r.id}\n    model: ${r.model.replace(/\n/g, ' / ')}\n    conv : ${r.conv.replace(/\n/g, ' / ')}\n    eng  : ${r.eng.replace(/\n/g, ' / ')}`);
}
if (process.env.WORST) {
  console.log('\nWORST clean-script lines:');
  for (const r of rows.filter((r) => r.kind === process.env.WORST && r.foreign <= 0.05).sort((a, b) => b.dist - a.dist).slice(0, 25)) console.log(`  ${r.id} d=${r.dist.toFixed(2)}\n    model: ${r.model.replace(/\n/g, ' / ')}\n    eng  : ${r.eng.replace(/\n/g, ' / ')}`);
}
