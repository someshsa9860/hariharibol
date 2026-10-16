// Third check: the few cases the pass leaves that I have not looked at. Read-only.
import { readFileSync } from 'node:fs';
const SC = '/private/tmp/claude-501/-Users-SSS-Jay-Jay-Ram-Krishna-Hari-app-hariharibol/41f46403-3e0c-4e2d-addd-e1ae01590c59/scratchpad/';
const PAT = { ml: JSON.parse(readFileSync(SC + 'fix/sim-ml-patched.json', 'utf8')), ta: JSON.parse(readFileSync(SC + 'fix/sim-ta-patched.json', 'utf8')) };
const ORIG = {}; for (const [l, d] of [['ml', 'ml/orig'], ['ta', 'ta/now']]) { ORIG[l] = {}; for (let n = 1; n <= 18; n++) for (const v of JSON.parse(readFileSync(`${SC}${d}/json/bhagavat-gita/${l}/ch-${n}.json`, 'utf8')).verses) ORIG[l][v.verseId] = v; }
const EN = {}; for (let n = 1; n <= 18; n++) for (const u of JSON.parse(readFileSync(`${SC}audit/en/units-${n}.json`, 'utf8'))) EN[u.verseId] = u;
const show = (t) => JSON.stringify(t);
console.log('EN unit keys:', Object.keys(EN['1.10.14']).join(','));
for (const [id, i] of [['1.10.14', 2], ['1.11.32', 10]]) console.log('ta', id, 'word', i + 1, '| EN', show(EN[id].wordMeanings?.[i]?.word), '| orig', show(ORIG.ta[id].wordMeanings[i].word), '| patched', show(PAT.ta[id].wordMeanings[i].word));
const v = PAT.ta['1.15.13']; console.log('ta 1.15.13 tl line1 patched', show(v.transliteration.split('\n')[0]), '| orig', show(ORIG.ta['1.15.13'].transliteration.split('\n')[0]), '| EN', show(EN['1.15.13'].transliteration?.[0]));
for (const i of [0, 3, 4, 12]) console.log('ta 1.15.13 word', i + 1, 'EN', show(EN['1.15.13'].wordMeanings?.[i]?.word), '| orig', show(ORIG.ta['1.15.13'].wordMeanings[i].word), '| patched', show(PAT.ta['1.15.13'].wordMeanings[i].word));
console.log('ta 1.18.57 meaning 9 EN', show(EN['1.18.57'].wordMeanings?.[8]?.meaning), '| orig', show(ORIG.ta['1.18.57'].wordMeanings[8].meaning));
const en83 = (EN['1.8.3'].purport || []).join('\n'); const i7 = [...en83.matchAll(/\b7\b/g)].map((m) => en83.slice(Math.max(0, m.index - 50), m.index + 30).replace(/\n/g, ' ')); console.log('ml 1.8.3 English around "7":', show(i7));
const mlp = (ORIG.ml['1.8.3'].commentaries || []).find((c) => c.type === 'purport' && c.language === 'ml' && c.translatorSlug === 'prabhupada')?.text || ''; console.log('ml 1.8.3 numbers in Malayalam purport:', show((mlp.match(/\d+/g) || [])));
