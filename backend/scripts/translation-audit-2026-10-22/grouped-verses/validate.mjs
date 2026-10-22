// verifyEntry (the pipeline's own checker) over every changed verse, before (orig vs old English) and after (work vs new English).
import fs from 'node:fs';
import { SP, LANGS, load } from './lib.mjs';
const REPO = '/Users/SSS/Jay Jay Ram Krishna Hari/app/hariharibol/backend/scripts/lib';
const { unitsFromChapter } = await import(`${REPO}/claude-translate-source.js`);
const { verifyEntry } = await import(`${REPO}/claude-translate-run.js`);
const changed = JSON.parse(fs.readFileSync(`${SP}/tools/changed.json`, 'utf8'));
const out = { before: {}, after: {} };
const tally = { before: 0, after: 0 };
let verses = 0;
for (const [k, ids] of Object.entries(changed)) {
  const [lang, c] = k.split(':');
  for (const side of ['before', 'after']) {
    const root = side === 'before' ? 'orig' : 'work';
    const en = load(`${SP}/${root}`, 'en', +c), sa = load(`${SP}/orig`, 'sa', +c), f = load(`${SP}/${root}`, lang, +c);
    const units = new Map(unitsFromChapter(en, sa).units.map((u) => [u.verseId, u]));
    const byId = new Map(f.verses.map((v) => [v.verseId, v]));
    for (const id of ids) {
      const probs = verifyEntry(byId.get(id), units.get(id), lang);
      if (probs.length) { (out[side][`${lang}:${id}`] = probs); tally[side]++; }
    }
  }
  verses += ids.length;
}
fs.writeFileSync(`${SP}/tools/validate.json`, JSON.stringify(out, null, 1));
console.log('verses checked', verses, 'problems before', tally.before, 'after', tally.after);
const newOnes = Object.entries(out.after).filter(([k]) => !out.before[k]);
console.log('verses with problems only after:', newOnes.length);
for (const [k, p] of newOnes.slice(0, 60)) console.log(k, p.join(' | ').slice(0, 300));
console.log('verses with the same problems before and after:', Object.keys(out.after).filter((k) => out.before[k]).length);
