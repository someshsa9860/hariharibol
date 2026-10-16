// Read-only: the runs of foreign-script / Roman letters inside the PROSE fields (translation, glosses, purport).
import { readFileSync } from 'node:fs';
const [lang, dir] = process.argv.slice(2);
const own = lang === 'ml' ? [0x0d00, 0x0d7f] : [0x0b80, 0x0bff];
const kindOf = (ch) => {
  const cp = ch.codePointAt(0);
  if (cp >= own[0] && cp <= own[1]) return /[\p{L}\p{M}]/u.test(ch) ? 'own' : 'neutral';
  if (cp === 0x964 || cp === 0x965) return 'neutral';
  if (cp >= 0x900 && cp <= 0xdff) return /[\p{L}\p{M}]/u.test(ch) ? 'indic' : 'neutral';
  if (/\p{Script=Latin}/u.test(ch)) return 'latin';
  return 'neutral';
};
const files = {};
for (let n = 1; n <= 18; n++) for (const v of JSON.parse(readFileSync(`${dir}/json/bhagavat-gita/${lang}/ch-${n}.json`, 'utf8')).verses) files[v.verseId] = v;
const rows = (v) => (v.commentaries || []).filter((c) => c.translatorSlug === 'prabhupada' && c.language === lang);
export const proseOf = (v) => ({ translation: rows(v).find((r) => r.type === 'translation')?.text || '', ...Object.fromEntries((v.wordMeanings || []).map((w, i) => [`meaning#${i}`, w.meaning || ''])), purport: rows(v).find((r) => r.type === 'purport')?.text || '' });

/** foreign runs: maximal stretches of foreign letters (other Indic or Latin), neutral characters between them included */
export function foreignRuns(text) {
  const chars = [...text]; const kinds = chars.map(kindOf);
  const runs = []; let i = 0; let off = 0; const offs = chars.map((c) => { const o = off; off += c.length; return o; });
  while (i < chars.length) {
    if (kinds[i] !== 'indic' && kinds[i] !== 'latin') { i++; continue; }
    let j = i; let last = i;
    while (j < chars.length) {
      if (kinds[j] === 'indic' || kinds[j] === 'latin') { last = j; j++; continue; }
      if (kinds[j] === 'neutral') { j++; continue; }
      break; // an own-script letter ends the run
    }
    const seg = chars.slice(i, last + 1).join('');
    runs.push({ start: offs[i], text: seg, kinds: [...new Set(chars.slice(i, last + 1).map((_, k) => kinds[i + k]).filter((k) => k !== 'neutral'))].join('+') });
    i = last + 1;
  }
  return runs;
}

if (process.argv[1].endsWith('runs.mjs')) {
  const out = [];
  for (const [id, v] of Object.entries(files)) for (const [f, t] of Object.entries(proseOf(v))) for (const r of foreignRuns(t)) {
    out.push({ id, f: f.startsWith('meaning') ? 'meaning' : f, kinds: r.kinds, run: r.text, ctx: t.slice(Math.max(0, r.start - 16), r.start + r.text.length + 12).replace(/\n/g, ' ') });
  }
  const tally = {}; const verses = {};
  for (const o of out) { const k = `${o.f}/${o.kinds}`; tally[k] = (tally[k] || 0) + 1; (verses[k] ||= new Set()).add(o.id); }
  console.log(lang, 'runs:', out.length, JSON.stringify(tally), '\nverses:', JSON.stringify(Object.fromEntries(Object.entries(verses).map(([k, s]) => [k, s.size]))));
  const limit = Number(process.env.LIMIT || 400); const filter = process.env.ONLY;
  for (const o of out.filter((o) => !filter || `${o.f}/${o.kinds}`.includes(filter)).slice(0, limit)) console.log(`${o.id} ${o.f} [${o.kinds}] «${o.run.slice(0, 100)}»  …${o.ctx}…`);
}
