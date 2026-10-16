// Read-only: which conventions/marks the saved Tamil text uses, by chapter group.   node marks.mjs <dir>
import { readFileSync } from 'node:fs';
const dir = process.argv[2];
const files = {};
for (let n = 1; n <= 18; n++) for (const v of JSON.parse(readFileSync(`${dir}/json/bhagavat-gita/ta/ch-${n}.json`, 'utf8')).verses) files[v.verseId] = v;
const rows = (v) => (v.commentaries || []).filter((c) => c.translatorSlug === 'prabhupada' && c.language === 'ta');
const group = (id) => { const [, ch, vs] = id.split('.').map(Number); return ch <= 3 || (ch === 4 && vs <= 22) ? 'corrected(1-3,4.1-22)' : 'luna(4.23-18)'; };
const CLASSES = {
  'devanagari avagraha ऽ': /ऽ/, 'other avagraha': /[ঽઽଽఽಽഽ]/,
  'superscript ²³⁴': /[²³⁴]/, 'other sup/sub digits': /[¹⁰⁵-⁹₀-₉]/,
  'colon in Sanskrit': /(?<=[஀-௿]):/, 'modifier colon ꞉': /꞉/, 'Tamil anusvara ஂ U+0B82': /ஂ/,
  'devanagari visarga ः': /ः/, 'devanagari letters (not ऽ ः)': /[ऀ-ंऄ-़ा-ॿ]/,
  'gujarati': /[઀-૿]/, 'bengali': /[ঀ-৿]/, 'kannada': /[ಀ-೿]/, 'telugu': /[ఀ-౿]/, 'malayalam': /[ഀ-ൿ]/,
  'latin letters': /\p{Script=Latin}/u, 'ꟷ (U+A7F7)': /ꟷ/,
};
const FIELDS = { translit: (v) => v.transliteration || '', word: (v) => (v.wordMeanings || []).map((w) => w.word).join('\n'), meaning: (v) => (v.wordMeanings || []).map((w) => w.meaning).join('\n'), translation: (v) => rows(v).find((r) => r.type === 'translation')?.text || '', purport: (v) => rows(v).find((r) => r.type === 'purport')?.text || '' };
const out = {};
for (const [id, v] of Object.entries(files)) for (const [f, get] of Object.entries(FIELDS)) {
  const t = get(v);
  for (const [name, re] of Object.entries(CLASSES)) if (re.test(t)) { const k = `${group(id)} | ${name}`; (out[k] ||= {}); out[k][f] = (out[k][f] || 0) + 1; }
}
const total = { 'corrected(1-3,4.1-22)': 0, 'luna(4.23-18)': 0 }; for (const id of Object.keys(files)) total[group(id)]++;
console.log('verses:', JSON.stringify(total));
for (const k of Object.keys(out).sort()) console.log(k.padEnd(62), JSON.stringify(out[k]));
