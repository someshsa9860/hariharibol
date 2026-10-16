import { readFileSync, writeFileSync } from 'node:fs';
import { foreignRuns } from './fixdet.mjs';
const SC = '/private/tmp/claude-501/-Users-SSS-Jay-Jay-Ram-Krishna-Hari-app-hariharibol/41f46403-3e0c-4e2d-addd-e1ae01590c59/scratchpad/';
const out = {};
for (const [lang, dir] of [['ml', 'ml/orig'], ['ta', 'ta/now']]) {
  const sim = JSON.parse(readFileSync(`${SC}fix/sim-${lang}.json`, 'utf8'));
  const L = { wrongTranslation: [], wrongGloss: [], wrongPurport: [], englishTranslation: [], englishGloss: [], englishPurport: [], tr1: [], pu1: [], wm1: [], tl1: [], tooShort: { translation: [], wordMeanings: [], purport: [] }, numbers: [], brackets: { translation: 0, purport: 0, wordMeanings: 0 }, selfRated1: { translation: 0, transliteration: 0, wordMeanings: 0, purport: 0 } };
  for (let n = 1; n <= 18; n++) for (const v of JSON.parse(readFileSync(`${SC}${dir}/json/bhagavat-gita/${lang}/ch-${n}.json`, 'utf8')).verses) {
    const rows = (v.commentaries || []).filter((c) => c.translatorSlug === 'prabhupada' && c.language === lang);
    const tr = rows.find((r) => r.type === 'translation')?.text || '';
    const big = (t, minL) => foreignRuns(lang, t).filter((r) => r.kind !== 'latin' && r.letters >= minL).length > 0;
    const eng = (t) => foreignRuns(lang, t).filter((r) => r.kind === 'latin' && r.letters >= 4 && !/[āīūṛṝḷḹṅñṭḍṇśṣṁṃḥ]/i.test(r.text.normalize('NFC'))).length > 0;
    if (big(tr, 4)) L.wrongTranslation.push(v.verseId);
    if (eng(tr)) L.englishTranslation.push(v.verseId);
    if ((v.wordMeanings || []).some((w) => big(w.meaning || '', 4))) L.wrongGloss.push(v.verseId);
    if ((v.wordMeanings || []).some((w) => eng(w.meaning || ''))) L.englishGloss.push(v.verseId);
  }
  for (const [id, r] of Object.entries(sim)) {
    if (r.leftovers.some((l) => l.part === 'purport' && l.kind === 'wrong-language')) L.wrongPurport.push(id);
    if (r.leftovers.some((l) => l.part === 'purport' && l.kind === 'english-word')) L.englishPurport.push(id);
    if (r.after.scores.translation === 1) L.tr1.push(id);
    if (r.after.scores.purport === 1) L.pu1.push(id);
    if (r.after.scores.wordMeanings === 1) L.wm1.push(id);
    if (r.after.scores.transliteration === 1) L.tl1.push(id);
    for (const f of r.after.findings) {
      if (f.kind === 'too-short') L.tooShort[f.part].push(id);
      if (f.kind === 'numbers') L.numbers.push(`${id} (${f.part})`);
      if (f.kind === 'brackets') L.brackets[f.part]++;
    }
    for (const p of Object.keys(L.selfRated1)) if (r.own[p] === 1) L.selfRated1[p]++;
  }
  for (const k of ['tooShort']) for (const p of Object.keys(L[k])) L[k][p] = [...new Set(L[k][p])];
  out[lang] = L;
}
writeFileSync(`${SC}fix/lists.json`, JSON.stringify(out, null, 1));
for (const lang of ['ml', 'ta']) { const L = out[lang]; console.log(lang, JSON.stringify({ wrongTranslation: L.wrongTranslation, wrongGloss: L.wrongGloss, wrongPurport: L.wrongPurport, englishTranslation: L.englishTranslation, englishGloss: L.englishGloss, englishPurport: L.englishPurport, tr1: L.tr1.length, pu1: L.pu1.length, wm1: L.wm1.length, tl1: L.tl1.length, tooShort: Object.fromEntries(Object.entries(L.tooShort).map(([k, v]) => [k, v.length])), numbers: L.numbers, brackets: L.brackets, selfRated1: L.selfRated1 })); }
