import fs from 'node:fs';
export const SP = '/private/tmp/claude-501/-Users-SSS-Jay-Jay-Ram-Krishna-Hari-app-hariharibol/8a608744-f22c-4b56-ad2c-92f67a53db6d/scratchpad';
export const LANGS = ['hi', 'mr', 'bn', 'ta', 'te', 'kn', 'ml'];
export const load = (root, lang, c) => JSON.parse(fs.readFileSync(`${root}/json/bhagavat-gita/${lang}/ch-${c}.json`, 'utf8'));
// en and sa are stored minified, the seven translated languages indented by two spaces (checked byte for byte against the originals)
export const fmt = (lang, d) => (lang === 'en' || lang === 'sa' ? JSON.stringify(d) : JSON.stringify(d, null, 2));
export const save = (root, lang, c, d) => fs.writeFileSync(`${root}/json/bhagavat-gita/${lang}/ch-${c}.json`, fmt(lang, d));
export const norm = (s) => (s || '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s*[–—]\s*/g, ' - ').replace(/\s+/g, ' ').trim();
export const row = (v, type) => v.commentaries.find((x) => x.translatorSlug === 'prabhupada' && x.type === type);
/** Adjacent verses of the English file that carry the same Prabhupāda translation or purport. */
export function groupsOf(en) {
  const out = [];
  let cur = null;
  for (const v of en.verses) {
    const t = norm(row(v, 'translation')?.text), p = norm(row(v, 'purport')?.text);
    const last = cur && cur.verses[cur.verses.length - 1];
    const lt = last && norm(row(last, 'translation')?.text), lp = last && norm(row(last, 'purport')?.text);
    if (cur && ((t && t === lt) || (p && p === lp))) cur.verses.push(v);
    else { cur = { verses: [v] }; out.push(cur); }
  }
  return out.filter((g) => g.verses.length > 1);
}
/** Clauses: cut after , ; : dashes, danda and sentence ends. Delimiters stay with the clause before them. */
export function clauses(text) {
  const out = [];
  let cur = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    cur += ch;
    const next = chars[i + 1];
    const cut =
      ch === ',' || ch === ';' || ch === ':' || ch === '،' || ch === '।' ||
      ((ch === '.' || ch === '?' || ch === '!') && (next === ' ' || next === undefined)) ||
      ((ch === '–' || ch === '—') && (chars[i + 1] === ' ' || chars[i - 1] === ' ')) ;
    // a dash with spaces: the dash itself ends the clause before it
    if (cut) { out.push(cur); cur = ''; }
  }
  if (cur.trim()) out.push(cur);
  return out.filter((c) => c.trim());
}
