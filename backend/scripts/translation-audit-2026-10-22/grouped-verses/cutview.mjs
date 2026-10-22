// node cutview.mjs <key,key,...> [lang,lang]  — one line per cut: text either side, and the verses the words on each side belong to.
import fs from 'node:fs';
import { SP, LANGS, load, clauses } from './lib.mjs';
const plan = JSON.parse(fs.readFileSync(`${SP}/tools/plan.json`, 'utf8'));
const keys = (process.argv[2] || Object.keys(plan).join(',')).split(',');
const langs = process.argv[3] ? process.argv[3].split(',') : LANGS;
const W = Number(process.argv[4] || 34);
const tokens = (s) => (s.match(/[\p{L}\p{M}\p{N}]+/gu) || []).map((t) => [...t]);
const stemOf = (cps) => (cps.length >= 4 ? cps.slice(0, 4).join('') : cps.length === 3 ? cps.join('') : null);
const stemsOf = (s) => new Set(tokens(s).map(stemOf).filter(Boolean));
const tailOf = (s, n) => [...s.trim()].slice(-n).join('');
const headOf = (s, n) => [...s.trim()].slice(0, n).join('');
for (const key of keys) {
  const e = plan[key];
  const en = load(`${SP}/orig`, 'en', e.chapter);
  const enText = en.verses.find((v) => v.verseId === e.verseIds[0]).commentaries.find((x) => x.translatorSlug === 'prabhupada' && x.type === 'translation').text;
  console.log(`## ${key} (${e.verseIds.length} verses)`);
  e.enOff.forEach((o, i) => console.log(`  EN${i + 1}: …${enText.slice(Math.max(0, o - 40), o).trim()} | ${enText.slice(o, o + 40).trim()}…`));
  for (const lang of langs) {
    const x = e.langs[lang];
    const f = load(`${SP}/orig`, lang, e.chapter);
    const vs = e.verseIds.map((id) => f.verses.find((v) => v.verseId === id));
    const ws = vs.map((v) => (v.wordMeanings || []).map((w) => ({ word: w.word, stems: stemsOf(w.meaning || '') })));
    const evid = (s) => { const S = stemsOf(s); return ws.map((list) => list.filter((w) => [...w.stems].some((st) => S.has(st))).length); };
    const offs = [0, ...x.offsets, x.text.length];
    const outs = [];
    x.offsets.forEach((o, i) => {
      const left = x.text.slice(offs[i], o), right = x.text.slice(o, offs[i + 2]);
      // the clause just before and just after the cut
      const lc = clauses(left).slice(-1)[0] || left, rc = clauses(right)[0] || right;
      const le = evid(lc), re = evid(rc);
      const sum = (a, f, t) => a.slice(f, t).reduce((x, y) => x + y, 0);
      const flag = (sum(le, i + 1) > sum(le, 0, i + 1)) || (sum(re, 0, i + 1) > sum(re, i + 1)) ? ' ??' : '';
      outs.push(`  ${lang}${i + 1}${flag}: …${tailOf(left, W)} | ${headOf(right, W)}…   L${le.join('/')} R${re.join('/')}`);
    });
    console.log(`  [${lang} from ${x.from.split('.').pop()} m=${x.margin ?? 'man'} n=${x.clauses}]`);
    outs.forEach((l) => console.log(l));
  }
}
