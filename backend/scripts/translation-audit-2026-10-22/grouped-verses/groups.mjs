import { SP, load, groupsOf, row } from './lib.mjs';
let n = 0, vs = 0;
for (let c = 1; c <= 18; c++) {
  const en = load(`${SP}/orig`, 'en', c);
  for (const g of groupsOf(en)) { n++; vs += g.verses.length; console.log(`${c}.${g.verses.map((v) => v.verseNumber).join('+')}`); }
}
console.log('groups', n, 'verses', vs);
