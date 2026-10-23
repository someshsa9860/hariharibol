// Compares work/ with orig/ verse by verse and says exactly what differs.
import fs from 'node:fs';
import { SP, LANGS, load } from './lib.mjs';
const changed = JSON.parse(fs.readFileSync(`${SP}/tools/changed.json`, 'utf8'));
const plan = JSON.parse(fs.readFileSync(`${SP}/tools/plan.json`, 'utf8'));
const lastIds = new Set(Object.values(plan).map((p) => p.verseIds.at(-1)));
const groupIds = new Set(Object.values(plan).flatMap((p) => p.verseIds));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const problems = [];
const stats = {};
const bump = (k, n = 1) => (stats[k] = (stats[k] || 0) + n);
let untouchedFiles = 0, touchedFiles = 0;
for (const lang of ['en', 'sa', ...LANGS]) {
  for (let c = 1; c <= 18; c++) {
    const pa = `${SP}/orig/json/bhagavat-gita/${lang}/ch-${c}.json`, pb = `${SP}/work/json/bhagavat-gita/${lang}/ch-${c}.json`;
    const a = fs.readFileSync(pa, 'utf8'), b = fs.readFileSync(pb, 'utf8');
    if (a === b) { untouchedFiles++; continue; }
    touchedFiles++;
    const A = JSON.parse(a), B = JSON.parse(b);
    const { verses: va, ...ra } = A, { verses: vb, ...rb } = B;
    if (!eq(ra, rb)) problems.push(`${lang} ch${c}: file-level fields changed`);
    if (va.length !== vb.length) { problems.push(`${lang} ch${c}: verse count ${va.length} -> ${vb.length}`); continue; }
    for (let i = 0; i < va.length; i++) {
      const x = va[i], y = vb[i];
      if (x.verseId !== y.verseId) { problems.push(`${lang} ${x.verseId}: order changed`); continue; }
      if (eq(x, y)) continue;
      if (!groupIds.has(x.verseId)) { problems.push(`${lang} ${x.verseId}: changed but not in a group`); continue; }
      const { commentaries: cx, aiTranslation: ax, ...restx } = x, { commentaries: cy, aiTranslation: ay, ...resty } = y;
      if (!eq(restx, resty)) problems.push(`${lang} ${x.verseId}: fields other than commentaries/aiTranslation changed`);
      const isLast = lastIds.has(x.verseId);
      // every row other than Prabhupāda's translation/purport must be identical and in the same order
      const other = (list) => list.filter((r) => !(r.translatorSlug === 'prabhupada' && (r.type === 'translation' || r.type === 'purport') && (lang === 'en' || r.language === lang)));
      if (!eq(other(cx), other(cy))) problems.push(`${lang} ${x.verseId}: another translator's row changed`);
      const pick = (list, type) => list.filter((r) => r.translatorSlug === 'prabhupada' && r.type === type && (lang === 'en' || r.language === lang));
      const trx = pick(cx, 'translation'), try_ = pick(cy, 'translation'), px = pick(cx, 'purport'), py = pick(cy, 'purport');
      if (trx.length !== 1 || try_.length !== 1) problems.push(`${lang} ${x.verseId}: translation row count ${trx.length} -> ${try_.length}`);
      else {
        const { text: _t1, correctness: _c1, translatedBy: _b1, version: _v1, ...ox } = trx[0], { text: _t2, correctness: _c2, translatedBy: _b2, version: _v2, ...oy } = try_[0];
        if (!eq(ox, oy)) problems.push(`${lang} ${x.verseId}: translation row other fields changed`);
        bump(`${lang}: translation rows changed`);
      }
      if (isLast) { if (!eq(px, py) && lang === 'en') problems.push(`${lang} ${x.verseId}: last verse's purport changed`); if (px.length !== py.length) problems.push(`${lang} ${x.verseId}: last verse lost its purport`); else bump(`${lang}: purport kept`); }
      else { if (py.length !== 0) problems.push(`${lang} ${x.verseId}: non-last verse still has a purport`); else if (px.length) bump(`${lang}: purport rows removed`); else bump(`${lang}: non-last had no purport`); }
      if (lang !== 'en' && !ay) problems.push(`${lang} ${x.verseId}: aiTranslation lost`);
      if (lang === 'en' && !eq(ax, ay)) problems.push(`en ${x.verseId}: aiTranslation changed`);
    }
  }
}
console.log('files identical', untouchedFiles, 'files changed', touchedFiles);
console.log(stats);
console.log('problems', problems.length); console.log(problems.slice(0, 40).join('\n'));
