// Read-only: classify the foreign-script runs in the PROSE fields by size and script.   node runs2.mjs <lang> <dir>
import { readFileSync } from 'node:fs';
const [lang, dir] = process.argv.slice(2);
const own = lang === 'ml' ? [0x0d00, 0x0d7f] : [0x0b80, 0x0bff];
const isLetter = (ch) => /[\p{L}\p{M}]/u.test(ch);
const kindOf = (ch) => {
  const cp = ch.codePointAt(0);
  if (cp >= own[0] && cp <= own[1]) return isLetter(ch) ? 'own' : 'neutral';
  if (cp === 0x964 || cp === 0x965) return 'neutral';
  if (cp >= 0x900 && cp <= 0xdff) return isLetter(ch) ? 'indic' : 'neutral';
  if (/\p{Script=Latin}/u.test(ch)) return 'latin';
  return 'neutral';
};
const scriptName = (ch) => { const cp = ch.codePointAt(0); return cp < 0x980 ? 'Devanagari' : cp < 0xa00 ? 'Bengali' : cp < 0xa80 ? 'Gurmukhi' : cp < 0xb00 ? 'Gujarati' : cp < 0xb80 ? 'Odia' : cp < 0xc00 ? 'Tamil' : cp < 0xc80 ? 'Telugu' : cp < 0xd00 ? 'Kannada' : 'Malayalam'; };
function runs(text) {
  const chars = [...text]; const kinds = chars.map(kindOf); const out = []; let i = 0;
  while (i < chars.length) {
    if (kinds[i] === 'neutral' || kinds[i] === 'own') { i++; continue; }
    const k0 = kinds[i] === 'latin' ? 'latin' : 'indic'; let j = i; let last = i;
    while (j < chars.length) {
      const k = kinds[j];
      if (k === 'neutral') { j++; continue; }
      if ((k0 === 'latin' && k === 'latin') || (k0 === 'indic' && k === 'indic')) { last = j; j++; continue; }
      break;
    }
    const seg = chars.slice(i, last + 1).join('');
    out.push({ kind: k0, text: seg, letters: [...seg].filter(isLetter).length, scripts: [...new Set([...seg].filter((c) => kindOf(c) === 'indic').map(scriptName))].join('+') });
    i = last + 1;
  }
  return out;
}
const rows = (v) => (v.commentaries || []).filter((c) => c.translatorSlug === 'prabhupada' && c.language === lang);
const bucket = {};
const big = [];
for (let n = 1; n <= 18; n++) for (const v of JSON.parse(readFileSync(`${dir}/json/bhagavat-gita/${lang}/ch-${n}.json`, 'utf8')).verses) {
  const fields = { translation: rows(v).find((r) => r.type === 'translation')?.text || '', purport: rows(v).find((r) => r.type === 'purport')?.text || '' };
  (v.wordMeanings || []).forEach((w, i) => { fields[`meaning#${i}`] = w.meaning || ''; });
  for (const [f, t] of Object.entries(fields)) for (const r of runs(t)) {
    const fk = f.startsWith('meaning') ? 'meaning' : f;
    const size = r.letters < 4 ? '1-3' : r.letters < 8 ? '4-7' : r.letters < 25 ? '8-24' : '25+';
    const key = `${fk} | ${r.kind === 'latin' ? 'latin' : r.scripts} | ${size}`;
    (bucket[key] ||= { runs: 0, verses: new Set() }); bucket[key].runs++; bucket[key].verses.add(v.verseId);
    if (r.letters >= 8) big.push({ id: v.verseId, f: fk, kind: r.kind, scripts: r.scripts, letters: r.letters, text: r.text.replace(/\n/g, ' / ').slice(0, 90) });
  }
}
console.log(lang, 'foreign runs in prose by field | script | letters');
for (const [k, b] of Object.entries(bucket).sort()) console.log(`  ${k.padEnd(44)} runs ${String(b.runs).padStart(4)}   verses ${b.verses.size}`);
if (process.env.BIG) { console.log('\nruns with 8+ letters:'); for (const b of big) console.log(`  ${b.id} ${b.f} [${b.kind === 'latin' ? 'latin' : b.scripts}] ${b.letters}L «${b.text}»`); }
