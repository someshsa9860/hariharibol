// Checks every number and example in the audit report against the saved snapshots. Read-only.
import { readFileSync } from 'node:fs';
import { foreignRuns } from './fixdet.mjs';
const SC = '/private/tmp/claude-501/-Users-SSS-Jay-Jay-Ram-Krishna-Hari-app-hariharibol/41f46403-3e0c-4e2d-addd-e1ae01590c59/scratchpad/';
const lists = JSON.parse(readFileSync(SC + 'fix/lists.json', 'utf8'));
const DIRS = { ml: 'ml/orig', ta: 'ta/now' };
const load = (lang) => { const m = {}; for (let n = 1; n <= 18; n++) for (const v of JSON.parse(readFileSync(`${SC}${DIRS[lang]}/json/bhagavat-gita/${lang}/ch-${n}.json`, 'utf8')).verses) m[v.verseId] = v; return m; };
const scriptOf = (cp) => cp >= 0x900 && cp <= 0x97f ? 'Devanagari' : cp >= 0x980 && cp <= 0x9ff ? 'Bengali' : cp >= 0xa00 && cp <= 0xa7f ? 'Gurmukhi' : cp >= 0xa80 && cp <= 0xaff ? 'Gujarati' : cp >= 0xb00 && cp <= 0xb7f ? 'Odia' : cp >= 0xb80 && cp <= 0xbff ? 'Tamil' : cp >= 0xc00 && cp <= 0xc7f ? 'Telugu' : cp >= 0xc80 && cp <= 0xcff ? 'Kannada' : cp >= 0xd00 && cp <= 0xd7f ? 'Malayalam' : ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) || (cp >= 0xc0 && cp <= 0x24f) || (cp >= 0x1e00 && cp <= 0x1eff)) ? 'Latin' : null;
const mix = (t) => { const c = {}; for (const ch of t) { const s = scriptOf(ch.codePointAt(0)); if (s) c[s] = (c[s] || 0) + 1; } return JSON.stringify(c); };
const rowsOf = (v, lang) => (v.commentaries || []).filter((c) => c.translatorSlug === 'prabhupada' && c.language === lang);
const trOf = (v, lang) => rowsOf(v, lang).find((r) => r.type === 'translation')?.text || '';
const puOf = (v, lang) => rowsOf(v, lang).find((r) => r.type === 'purport')?.text || '';
const grp = (id) => { const [, c, vv] = id.split('.').map(Number); return c <= 3 ? 'ch1-3' : (c === 4 && vv <= 22) ? 'ch4.1-22' : 'ch4.23-18'; };
const hr = (s) => console.log('\n#### ' + s);

const D = { ml: load('ml'), ta: load('ta') };
const SIM = { ml: JSON.parse(readFileSync(SC + 'fix/sim-ml.json', 'utf8')), ta: JSON.parse(readFileSync(SC + 'fix/sim-ta.json', 'utf8')) };
const PAT = { ml: JSON.parse(readFileSync(SC + 'fix/sim-ml-patched.json', 'utf8')), ta: JSON.parse(readFileSync(SC + 'fix/sim-ta-patched.json', 'utf8')) };

hr('lists.json: self-rated 1, counts');
for (const l of ['ml', 'ta']) { const L = lists[l]; console.log(l, 'selfRated1', JSON.stringify(L.selfRated1), 'tooShort', JSON.stringify(Object.fromEntries(Object.entries(L.tooShort).map(([k, v]) => [k, v.length]))), 'numbers', JSON.stringify(L.numbers), 'brackets', JSON.stringify(L.brackets)); console.log('  wrongTranslation', L.wrongTranslation.join(' '), '| wrongGloss', L.wrongGloss.join(' '), '| wrongPurport', L.wrongPurport.join(' '), '| engTr', L.englishTranslation.join(' '), '| engGloss', L.englishGloss.join(' '), '| engPu', L.englishPurport.join(' ')); }

hr('ml wrong-language texts: scripts + start of text');
for (const id of lists.ml.wrongTranslation) console.log(id, 'TR', mix(trOf(D.ml[id], 'ml')), trOf(D.ml[id], 'ml').slice(0, 60).replace(/\n/g, ' '));
for (const id of lists.ml.wrongGloss) { const g = (D.ml[id].wordMeanings || []).map((w) => w.meaning || '').join(' | '); const bad = (D.ml[id].wordMeanings || []).filter((w) => foreignRuns('ml', w.meaning || '').some((r) => r.kind !== 'latin' && r.letters >= 4)); console.log(id, 'GLOSS', mix(g), `${bad.length}/${(D.ml[id].wordMeanings || []).length} entries`, (bad[0]?.meaning || '').slice(0, 40)); }
for (const id of lists.ml.wrongPurport) console.log(id, 'PU', mix(puOf(D.ml[id], 'ml')));

hr('English words left in Roman letters (the actual words)');
const engWords = (lang, t) => foreignRuns(lang, t).filter((r) => r.kind === 'latin' && r.letters >= 4 && !/[āīūṛṝḷḹṅñṭḍṇśṣṁṃḥ]/i.test(r.text.normalize('NFC'))).map((r) => r.text);
for (const l of ['ml', 'ta']) {
  for (const id of lists[l].englishTranslation) console.log(l, id, 'TR', JSON.stringify(engWords(l, trOf(D[l][id], l))));
  for (const id of lists[l].englishPurport) console.log(l, id, 'PU', JSON.stringify(engWords(l, puOf(D[l][id], l)).slice(0, 8)));
  for (const id of lists[l].englishGloss) console.log(l, id, 'GLOSS', JSON.stringify((D[l][id].wordMeanings || []).flatMap((w) => engWords(l, w.meaning || ''))));
}

hr('ta: what the pass leaves (patched text)');
for (const id of ['1.7.21', '1.11.46', '1.15.7']) console.log(id, 'PU runs', JSON.stringify(foreignRuns('ta', puOf(PAT.ta[id], 'ta')).map((r) => `${r.kind}:${r.text.slice(0, 30)}`).slice(0, 8)));
for (const id of ['1.10.14', '1.11.32', '1.9.4']) console.log(id, 'GLOSS runs', JSON.stringify((PAT.ta[id].wordMeanings || []).flatMap((w) => foreignRuns('ta', w.meaning || '').map((r) => `${r.kind}:${r.text.slice(0, 30)}`)).slice(0, 8)));

hr('which chapters need script work (verses touched by the rule)');
for (const l of ['ml', 'ta']) {
  const t = {}; const add = (k, id) => { (t[k] ||= new Set()).add(id); };
  for (const [id, r] of Object.entries(SIM[l])) for (const c of r.changes) { const k = `${c.part}/${c.how}`; add(k, id); add('ANY transliteration', id); }
  const anyTl = {}; const anyWord = {}; const anyPu = {}; const anyAny = {};
  for (const [id, r] of Object.entries(SIM[l])) {
    const g = grp(id);
    if (r.changes.some((c) => c.part === 'transliteration')) anyTl[g] = (anyTl[g] || 0) + 1;
    if (r.changes.some((c) => c.how === 'word-regenerated')) anyWord[g] = (anyWord[g] || 0) + 1;
    if (r.changes.some((c) => c.part === 'purport')) anyPu[g] = (anyPu[g] || 0) + 1;
    if (r.changes.length) anyAny[g] = (anyAny[g] || 0) + 1;
  }
  const tot = {}; for (const id of Object.keys(SIM[l])) tot[grp(id)] = (tot[grp(id)] || 0) + 1;
  console.log(l, 'verses by group', JSON.stringify(tot), '\n   transliteration lines regenerated, verses:', JSON.stringify(anyTl), Object.values(anyTl).reduce((a, b) => a + b, 0), '\n   word column regenerated, verses:', JSON.stringify(anyWord), Object.values(anyWord).reduce((a, b) => a + b, 0), '\n   purport runs changed, verses:', JSON.stringify(anyPu), Object.values(anyPu).reduce((a, b) => a + b, 0), '\n   any change, verses:', JSON.stringify(anyAny), Object.values(anyAny).reduce((a, b) => a + b, 0));
}

hr('ta: superscripts ²³⁴ in the original Sanskrit fields, by group');
{
  const s = {}; let n = 0;
  for (const [id, v] of Object.entries(D.ta)) { const hit = /[²³⁴]/.test(v.transliteration || '') || (v.wordMeanings || []).some((w) => /[²³⁴]/.test(w.word || '')); if (hit) { n++; s[grp(id)] = (s[grp(id)] || 0) + 1; } }
  console.log('verses with superscripts in transliteration/words:', n, JSON.stringify(s));
  let np = 0; for (const [id, v] of Object.entries(D.ta)) if (/[²³⁴]/.test(puOf(v, 'ta'))) np++; console.log('verses with superscripts in purport:', np);
}

hr('still at score 1 after the pass: why');
for (const l of ['ml', 'ta']) {
  const cat = { real: [], tooShortOnly: [], selfOnly: [] };
  for (const [id, r] of Object.entries(SIM[l])) {
    const sc = r.after.scores; if (Math.min(...Object.values(sc)) !== 1) continue;
    const causes = new Set();
    for (const p of Object.keys(sc)) if (sc[p] === 1) {
      for (const f of r.after.findings) if (f.part === p && f.level === 'bad') causes.add(f.kind === 'too-short' ? 'too-short' : 'real');
      if (r.own[p] === 1) causes.add('self');
    }
    if (r.leftovers.some((x) => x.kind === 'wrong-language' || x.kind === 'english-word')) causes.add('real');
    if (causes.has('real')) cat.real.push(id); else if (causes.has('too-short')) cat.tooShortOnly.push(id); else cat.selfOnly.push(id);
  }
  console.log(l, 'at 1:', cat.real.length + cat.tooShortOnly.length + cat.selfOnly.length, '| real problem:', cat.real.length, '| only "too short":', cat.tooShortOnly.length, '| only the model\'s own doubt:', cat.selfOnly.length);
  console.log('   real:', cat.real.join(' '));
  console.log('   selfOnly:', cat.selfOnly.join(' '));
}

hr('shape of changes + the quote conversions to eyeball');
for (const l of ['ml', 'ta']) {
  const seen = new Set();
  for (const [id, r] of Object.entries(SIM[l])) for (const c of r.changes) { const k = `${c.part}/${c.how}`; if (!seen.has(k)) { seen.add(k); console.log(l, id, k, JSON.stringify(c).slice(0, 200)); } }
}
for (const l of ['ml', 'ta']) { let k = 0; for (const [id, r] of Object.entries(SIM[l])) for (const c of r.changes) if (c.part === 'purport' && c.how === 'deva-quote') console.log(l, id, 'PU deva-quote', JSON.stringify(c).slice(0, 220), ++k); }
