// Groups the audit's findings into the categories of REPORT.md and writes findings.json beside the report.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const OUT = resolve(import.meta.dirname, '../output') + '/';
const d = JSON.parse(readFileSync(OUT + 'audit-db.json', 'utf8'));
const corrupt = new Set(['bn 1.3.11', 'bn 1.9.11', 'bn 1.10.37', 'bn 1.11.25', 'te 1.3.9', 'te 1.11.46']);
const cats = {
  corrupt: {}, romanLeft: {}, stray: {}, avagraha: {}, untranslatedWord: {}, identical: {},
  structure: {}, brokenMarks: {}, iast: {}, numbers: {}, trunc: {},
};
const add = (c, lang, id, note) => { ((cats[c][lang] ??= {})[id] ??= []).push(note); };
for (const r of d.records) {
  const key = r.lang + ' ' + r.id;
  if (corrupt.has(key)) { add('corrupt', r.lang, r.id, 'all parts'); continue; }
  for (const f of r.findings) {
    const tag = f.part + ':' + f.kind;
    if (f.kind === 'wrong-script-share' && f.part === 'wordMeanings') add('untranslatedWord', r.lang, r.id, f.msg.slice(0, 40));
    else if (f.kind === 'wrong-script-share') add('romanLeft', r.lang, r.id, tag);
    else if (f.kind === 'foreign-chars') {
      if (/\(ऽ\)/.test(f.msg)) add('avagraha', r.lang, r.id, f.part);
      else add('stray', r.lang, r.id, f.part + ' ' + (f.msg.match(/\(([^)]*)\)/) || [])[1]);
    }
    else if (f.kind === 'identical-to-English') add('identical', r.lang, r.id, f.part);
    else if (['line-count', 'para-count', 'word-count'].includes(f.kind)) add('structure', r.lang, r.id, tag);
    else if (f.kind === 'numbers') add('numbers', r.lang, r.id, tag);
  }
  for (const f of r.flags) {
    if (f.kind === 'broken-marks') add('brokenMarks', r.lang, r.id, f.part);
    if (f.kind === 'iast-in-prose' && !corrupt.has(key)) add('iast', r.lang, r.id, f.part + ' ' + (f.sample || ''));
    if (f.kind === 'foreign-script-run' || f.kind === 'foreign-script-stray') add('stray', r.lang, r.id, f.part + ' ' + f.scripts);
    if (f.kind === 'english-word' && f.part !== 'meanings') add('untranslatedWord', r.lang, r.id, f.part + ': ' + f.sample);
    if (f.kind === 'english-phrase') add('romanLeft', r.lang, r.id, f.part);
  }
}
const out = {};
for (const [c, byLang] of Object.entries(cats)) {
  out[c] = {};
  for (const [l, ids] of Object.entries(byLang)) out[c][l] = Object.keys(ids);
}
writeFileSync(resolve(import.meta.dirname, '../findings.json'), JSON.stringify(out, null, 1));
for (const [c, byLang] of Object.entries(out)) {
  console.log('##', c);
  for (const [l, ids] of Object.entries(byLang)) console.log('  ', l, ids.length, ids.join(' '));
}
const all = new Set();
for (const [c, byLang] of Object.entries(out)) if (!['avagraha', 'numbers'].includes(c)) for (const [l, ids] of Object.entries(byLang)) for (const i of ids) all.add(l + ' ' + i);
const per = {}; for (const k of all) { const l = k.split(' ')[0]; per[l] = (per[l] || 0) + 1; }
console.log('distinct verses with a real finding (excl avagraha, numbers):', all.size, JSON.stringify(per));
