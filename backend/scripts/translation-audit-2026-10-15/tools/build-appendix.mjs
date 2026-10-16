// Builds the appendix of the audit report (appendix.md) from the dry-run results, and prints a few last facts. Read-only apart from appendix.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { foreignRuns } from './fixdet.mjs';
const SC = '/private/tmp/claude-501/-Users-SSS-Jay-Jay-Ram-Krishna-Hari-app-hariharibol/41f46403-3e0c-4e2d-addd-e1ae01590c59/scratchpad/';
const lists = JSON.parse(readFileSync(SC + 'fix/lists.json', 'utf8'));
const SIM = { ml: JSON.parse(readFileSync(SC + 'fix/sim-ml.json', 'utf8')), ta: JSON.parse(readFileSync(SC + 'fix/sim-ta.json', 'utf8')) };
const idKey = (id) => id.split('.').map((x) => Number(x) || 0);
const byId = (a, b) => { const x = idKey(a), y = idKey(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const ratioOf = (msg) => { const m = /too short \((\d+(?:\.\d+)?)×/.exec(msg); return m ? Number(m[1]) : null; };
const TAG = { translation: 'tr', transliteration: 'tl', wordMeanings: 'wm', purport: 'pu' };
const details = (title, body) => `<details><summary>${title}</summary>\n\n${body}\n\n</details>\n\n`;
const NAME = { ml: 'Malayalam', ta: 'Tamil' };
let out = '';
const summary = {};

for (const l of ['ml', 'ta']) {
  const strictWrong = new Set([...lists[l].wrongTranslation, ...lists[l].wrongGloss, ...lists[l].wrongPurport]);
  const cat = { real: [], tooShortOnly: [], selfOnly: [] };
  for (const [id, r] of Object.entries(SIM[l])) {
    const sc = r.after.scores; if (Math.min(...Object.values(sc)) !== 1) continue;
    const causes = new Set();
    for (const p of Object.keys(sc)) if (sc[p] === 1) {
      for (const f of r.after.findings) if (f.part === p && f.level === 'bad') causes.add(f.kind === 'too-short' ? 'too-short' : 'real');
      if (r.own[p] === 1) causes.add('self');
    }
    if (r.leftovers.some((x) => x.kind === 'wrong-language' || x.kind === 'english-word')) causes.add('real');
    if (strictWrong.has(id)) causes.add('real');
    if (causes.has('real')) cat.real.push(id); else if (causes.has('too-short')) cat.tooShortOnly.push(id); else cat.selfOnly.push(id);
  }
  for (const k of Object.keys(cat)) cat[k].sort(byId);
  const total = cat.real.length + cat.tooShortOnly.length + cat.selfOnly.length;
  const eng = new Set([...lists[l].englishTranslation, ...lists[l].englishGloss, ...lists[l].englishPurport]);
  const engExtra = [...eng].filter((id) => !cat.real.includes(id)).sort(byId);
  summary[l] = { total, real: cat.real.length, tooShortOnly: cat.tooShortOnly.length, selfOnly: cat.selfOnly.length, engExtra };

  const ts = (part) => lists[l].tooShort[part].map((id) => { const rs = SIM[l][id].after.findings.filter((f) => f.kind === 'too-short' && f.part === part).map((f) => ratioOf(f.msg)).filter((x) => x != null); return [id, Math.min(...rs)]; }).sort((a, b) => a[1] - b[1] || byId(a[0], b[0]));
  const fmt = (arr) => arr.map(([id, r]) => `${id} (${r.toFixed(2)})`).join(', ');
  const own = (id) => Object.keys(SIM[l][id].after.scores).filter((p) => SIM[l][id].after.scores[p] === 1 && SIM[l][id].own[p] === 1).map((p) => TAG[p]).join('+');

  out += `### ${NAME[l]}: the ${total} verses still at score 1 after the script pass\n\n`;
  out += `- **Real problem — ${cat.real.length}:** ${cat.real.join(' ')}\n`;
  out += `- **Only a "too short" flag — ${cat.tooShortOnly.length}** (lists with the ratios are in C below)\n`;
  out += `- **Only the model's own doubt — ${cat.selfOnly.length}** (it rated that part 1 itself; part in brackets: tl transliteration, tr translation, wm word meanings, pu purport)\n\n`;
  out += details(`${NAME[l]}: verses where only the model's own doubt keeps the score at 1 (${cat.selfOnly.length})`, cat.selfOnly.map((id) => `${id} (${own(id)})`).join(', '));
  out += details(`${NAME[l]}: verses where only a "too short" flag keeps the score at 1 (${cat.tooShortOnly.length}), no real problem found`, cat.tooShortOnly.join(' '));
  if (engExtra.length) out += `- ${NAME[l]}: English or Roman-letter words in verses that are *not* at score 1 (the validator did not flag them): ${engExtra.join(' ')}\n\n`;
  out += `\n`;
}

out += `### C. "Too short" flags, lowest ratio first\n\nThe number is how many times the English word count the text has. The validator's line is 0.40 for Malayalam and 0.50 for Tamil. The closer to the line, the likelier a false alarm; read the lowest ones first.\n\n`;
for (const l of ['ml', 'ta']) {
  for (const [part, label] of [['translation', 'translations'], ['purport', 'purports'], ['wordMeanings', 'word-meaning lists (lowest single entry in the list)']]) {
    const arr = (() => lists[l].tooShort[part].map((id) => { const rs = SIM[l][id].after.findings.filter((f) => f.kind === 'too-short' && f.part === part).map((f) => ratioOf(f.msg)).filter((x) => x != null); return [id, Math.min(...rs)]; }).sort((a, b) => a[1] - b[1] || byId(a[0], b[0])))();
    out += details(`${NAME[l]}: ${label} flagged "too short" (${arr.length})`, arr.map(([id, r]) => `${id} (${r.toFixed(2)})`).join(', '));
  }
}
writeFileSync(SC + 'fix/appendix.md', out);
console.log(JSON.stringify(summary));
console.log('appendix.md bytes', out.length);

// last facts
const P = (lang, id) => JSON.parse(readFileSync(`${SC}${lang === 'ml' ? 'ml/orig' : 'ta/now'}/json/bhagavat-gita/${lang}/ch-${id.split('.')[1]}.json`, 'utf8')).verses.find((v) => v.verseId === id);
const puOf = (v, lang) => (v.commentaries || []).find((c) => c.type === 'purport' && c.language === lang && c.translatorSlug === 'prabhupada')?.text || '';
console.log('ta 1.11.54 purport Roman runs:', JSON.stringify(foreignRuns('ta', puOf(P('ta', '1.11.54'), 'ta')).filter((r) => r.kind === 'latin').map((r) => r.text)));
const mlp = puOf(P('ml', '1.8.3'), 'ml'); const k = mlp.indexOf('പതിനഞ്ച'); console.log('ml 1.8.3 around "fifteen":', JSON.stringify(k >= 0 ? mlp.slice(Math.max(0, k - 30), k + 90) : '(not found)'));
