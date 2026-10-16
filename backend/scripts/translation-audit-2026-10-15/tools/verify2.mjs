// Second check: odd leftovers, "too short" ratios, and how many prose changes fall in the wrong-language verses. Read-only.
import { readFileSync } from 'node:fs';
const SC = '/private/tmp/claude-501/-Users-SSS-Jay-Jay-Ram-Krishna-Hari-app-hariharibol/41f46403-3e0c-4e2d-addd-e1ae01590c59/scratchpad/';
const lists = JSON.parse(readFileSync(SC + 'fix/lists.json', 'utf8'));
const SIM = { ml: JSON.parse(readFileSync(SC + 'fix/sim-ml.json', 'utf8')), ta: JSON.parse(readFileSync(SC + 'fix/sim-ta.json', 'utf8')) };
const hr = (s) => console.log('\n#### ' + s);

hr('messages left after the pass for odd cases');
for (const [l, ids] of [['ta', ['1.10.14', '1.11.32', '1.9.4', '1.15.13', '1.18.57', '1.7.21']], ['ml', ['1.8.3', '1.18.39']]]) for (const id of ids) for (const f of SIM[l][id].after.findings) console.log(l, id, f.part, f.level, f.kind, '|', f.msg.slice(0, 230));

hr('sample "too short" messages (to read the ratio)');
for (const l of ['ml', 'ta']) for (const part of ['translation', 'wordMeanings', 'purport']) { const id = lists[l].tooShort[part][0]; const f = SIM[l][id].after.findings.find((x) => x.kind === 'too-short' && x.part === part); console.log(l, part, id, '|', f?.msg.slice(0, 260)); }

hr('too-short ratio spread (parsed from the message when it carries numbers)');
const num = (m) => { const x = /(\d+(?:\.\d+)?)\s*(?:words)?[^0-9]{0,40}?(\d+(?:\.\d+)?)\s*(?:words)?/.exec(m); return x; };
for (const l of ['ml', 'ta']) for (const part of ['translation', 'wordMeanings', 'purport']) {
  const rs = [];
  for (const id of lists[l].tooShort[part]) { const f = SIM[l][id].after.findings.find((x) => x.kind === 'too-short' && x.part === part); const m = f && /too short \((\d+(?:\.\d+)?)×/.exec(f.msg); if (m) rs.push(Number(m[1])); }
  rs.sort((a, b) => a - b);
  console.log(l, part, 'flagged', lists[l].tooShort[part].length, 'parsed', rs.length, rs.length ? `min ${rs[0]} median ${rs[Math.floor(rs.length / 2)]} max ${rs[rs.length - 1]}` : '');
}

hr('prose changes inside / outside the wrong-language verses (ml)');
{
  const wrong = new Set([...lists.ml.wrongTranslation, ...lists.ml.wrongGloss, ...lists.ml.wrongPurport]);
  const t = { inW: {}, outW: {} };
  for (const [id, r] of Object.entries(SIM.ml)) for (const c of r.changes) { if (c.part === 'transliteration' || c.how === 'word-regenerated') continue; const k = `${c.part}/${c.how}`; const side = wrong.has(id) ? 'inW' : 'outW'; t[side][k] = (t[side][k] || 0) + 1; }
  console.log('wrong-language verses (' + wrong.size + '):', JSON.stringify([...wrong]));
  console.log('changes in them (to discard):', JSON.stringify(t.inW));
  console.log('changes elsewhere (valid):  ', JSON.stringify(t.outW));
  const verses = new Set(); for (const [id, r] of Object.entries(SIM.ml)) if (!wrong.has(id) && r.changes.some((c) => c.part === 'purport' || c.how.startsWith('meaning') || c.part === 'translation')) verses.add(id);
  console.log('verses with a valid prose change:', verses.size);
}
