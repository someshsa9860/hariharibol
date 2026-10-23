// Plans the split of every group, in English and in the 7 languages. Writes plan.json (no S3, no work/ changes).
import fs from 'node:fs';
import { SP, LANGS, load, groupsOf, row, clauses, norm } from './lib.mjs';

const cuts = JSON.parse(fs.readFileSync(`${SP}/tools/cuts.json`, 'utf8'));
const overrides = fs.existsSync(`${SP}/tools/overrides.json`) ? JSON.parse(fs.readFileSync(`${SP}/tools/overrides.json`, 'utf8')) : {};
const fixes = JSON.parse(fs.readFileSync('/Users/SSS/Jay Jay Ram Krishna Hari/app/hariharibol/backend/scripts/translation-audit-2026-10-20/gita-wording/patches/all-fixes.json', 'utf8'));
const patchedTranslation = new Set(fixes.filter((f) => f.part === 'translation').map((f) => `${f.lang}:${f.verseId}`));

const STRONG = /[.?!।]\s*$/;
const tokens = (s) => (s.match(/[\p{L}\p{M}\p{N}]+/gu) || []).map((t) => [...t]);
const stemOf = (cps) => (cps.length >= 4 ? cps.slice(0, 4).join('') : cps.length === 3 ? cps.join('') : null);
const stemsOf = (s) => new Set(tokens(s).map(stemOf).filter(Boolean));

/** Char offsets (end of each segment but the last) of the English cuts. */
function englishOffsets(text, spec) {
  const cl = clauses(text);
  const ends = [];
  let at = 0;
  for (const c of cl) { at += c.length; ends.push(at); }
  return spec.map((s) => {
    if (typeof s === 'number') return ends[s - 1];
    const i = text.indexOf(s.before);
    if (i < 0 || text.indexOf(s.before, i + 1) >= 0) throw new Error(`anchor "${s.before}" not unique`);
    return i;
  });
}

function best(cl, verseStems, enFracs, enStrong, lambda = 8) {
  const m = verseStems.length;
  const n = cl.length;
  const total = cl.reduce((a, c) => a + c.text.length, 0);
  const cum = [];
  let a = 0;
  for (const c of cl) { a += c.text.length; cum.push(a / total); }
  const holders = new Map();
  for (const S of verseStems) for (const s of S) holders.set(s, (holders.get(s) || 0) + 1);
  // score[i][k]: clause i against verse k
  const score = cl.map((c) => verseStems.map((S) => { let x = 0; for (const s of c.stems) if (S.has(s)) x += 1 / holders.get(s); return x; }));
  const prefix = verseStems.map((_, k) => { const p = [0]; for (let i = 0; i < n; i++) p.push(p[i] + score[i][k]); return p; });
  const results = [];
  const rec = (k, start, chosen) => {
    if (k === m - 1) {
      const bounds = [...chosen, n]; // cut after clause index (1-based) = chosen[k]
      let s = 0, lo = 0;
      for (let v = 0; v < m; v++) { s += prefix[v][bounds[v]] - prefix[v][lo]; lo = bounds[v]; }
      for (let j = 0; j < chosen.length; j++) {
        s -= lambda * Math.abs(cum[chosen[j] - 1] - enFracs[j]);
        if (enStrong[j] && STRONG.test(cl[chosen[j] - 1].text)) s += 0.5;
      }
      results.push({ s, chosen: [...chosen] });
      return;
    }
    for (let b = start; b <= n - (m - 1 - k); b++) rec(k + 1, b + 1, [...chosen, b]);
  };
  rec(0, 1, []);
  results.sort((x, y) => y.s - x.s);
  // how much of the matching words' evidence the in-order split explains, and how far its cuts sit from the English ones
  const avail = score.reduce((a, row) => a + Math.max(...row), 0);
  const bounds = [...results[0].chosen, n];
  let got = 0, lo = 0;
  for (let v = 0; v < m; v++) { got += prefix[v][bounds[v]] - prefix[v][lo]; lo = bounds[v]; }
  const dev = Math.max(0, ...results[0].chosen.map((b, j) => Math.abs(cum[b - 1] - enFracs[j])));
  return { top: results[0], second: results[1], score, cum, q: avail ? got / avail : 1, dev };
}

const plan = {};
for (let c = 1; c <= 18; c++) {
  const en = load(`${SP}/orig`, 'en', c);
  const sa = load(`${SP}/orig`, 'sa', c);
  const files = Object.fromEntries(LANGS.map((l) => [l, load(`${SP}/orig`, l, c)]));
  for (const g of groupsOf(en)) {
    const key = `${c}.${g.verses[0].verseNumber}`;
    const spec = cuts[key];
    const enText = row(g.verses[0], 'translation').text;
    const enOff = englishOffsets(enText, spec);
    const enFracs = enOff.map((o) => o / enText.length);
    const enCl = clauses(enText);
    const enStrong = enOff.map((o) => { let a = 0; for (const x of enCl) { a += x.length; if (a >= o) return STRONG.test(x); } return false; });
    const entry = { key, chapter: c, verseIds: g.verses.map((v) => v.verseId), enOff, enFracs, langs: {} };
    for (const lang of LANGS) {
      const ov = overrides[`${key}:${lang}`] || {};
      const byId = new Map(files[lang].verses.map((v) => [v.verseId, v]));
      const vs = g.verses.map((v) => byId.get(v.verseId));
      const stems = vs.map((v) => { const S = new Set(); for (const w of v.wordMeanings || []) for (const s of stemsOf(w.meaning || '')) S.add(s); return S; });
      // choose the version
      const cands = vs.map((v, k) => {
        const r = row(v, 'translation');
        const ai = v.aiTranslation || {};
        const sc = ai.partScores?.translation ?? ai.parts?.translation?.correctness ?? 0;
        return { k, verseId: v.verseId, text: r?.text, score: sc, patched: patchedTranslation.has(`${lang}:${v.verseId}`), n: r ? clauses(r.text).length : 0 };
      }).filter((x) => x.text);
      const enN = enCl.length;
      for (const cd of cands) {
        const cl0 = clauses(cd.text).map((t) => ({ text: t, stems: stemsOf(t) }));
        const r0 = best(cl0, stems, enFracs, enStrong);
        cd.q = +r0.q.toFixed(2); cd.dev = +r0.dev.toFixed(2); cd.rank = r0.q - 2 * r0.dev;
      }
      cands.sort((x, y) => (y.patched - x.patched) || (y.rank - x.rank) || (y.score - x.score) || (x.k - y.k));
      const pick = ov.version != null ? cands.find((x) => x.verseId.endsWith(`.${ov.version}`)) : cands[0];
      const text = pick.text;
      const cl = clauses(text).map((t) => ({ text: t, stems: stemsOf(t) }));
      let offsets, info;
      if (ov.cuts) {
        offsets = ov.cuts.map((s) => {
          if (typeof s === 'number') { let a = 0; for (let i = 0; i < s; i++) a += cl[i].text.length; return a; }
          const i = text.indexOf(s.before);
          if (i < 0 || text.indexOf(s.before, i + 1) >= 0) throw new Error(`${key}:${lang} anchor "${s.before}" not unique/found`);
          return i;
        });
        info = { manual: true };
      } else {
        const r = best(cl, stems, enFracs, enStrong);
        let a = 0; const ends = cl.map((x) => (a += x.text.length));
        offsets = r.top.chosen.map((b) => ends[b - 1]);
        info = { score: +r.top.s.toFixed(2), margin: r.second ? +(r.top.s - r.second.s).toFixed(2) : null, fracs: r.top.chosen.map((b) => +r.cum[b - 1].toFixed(2)), clauses: cl.length };
      }
      entry.langs[lang] = { from: pick.verseId, fromScore: pick.score, patched: pick.patched, q: pick.q, dev: pick.dev, cands: cands.map((x) => `${x.verseId.split('.').pop()}:q${x.q}/d${x.dev}/s${x.score}`), offsets, text, ...info };
    }
    plan[key] = entry;
  }
}
fs.writeFileSync(`${SP}/tools/plan.json`, JSON.stringify(plan, null, 1));
let low = 0, tot = 0;
for (const e of Object.values(plan)) for (const [l, x] of Object.entries(e.langs)) { tot++; if (!x.manual && x.margin < 1) low++; }
console.log('groups', Object.keys(plan).length, 'splits', tot, 'margin<1:', low);
