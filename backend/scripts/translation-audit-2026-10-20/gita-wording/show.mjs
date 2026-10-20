// Prints each edit a verifier approved, beside the Sanskrit word, Prabhupāda's gloss / English and the current text. Usage: node show.mjs FILE LANG --from DIR
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadUnit } from './units.mjs';
const [file, lang] = process.argv.slice(2);
const from = resolve(process.argv[process.argv.indexOf('--from') + 1]);
const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.lang === lang);
let n = 0;
for (const r of rows) {
  const unit = loadUnit(from, r.lang, r.ids);
  for (const i of r.apply ?? []) {
    n++;
    if (i.part === 'translation') {
      const at = unit.own.indexOf(i.find);
      console.log(`#${n} ${i.verseId}${r.ids.length > 1 ? `(+${r.ids.length - 1})` : ''} TRANSLATION [${i.kind}]\n  EN: ${unit.english}\n  NOW: ${unit.own.slice(Math.max(0, at - 50), at + i.find.length + 50)}\n  EDIT: ${i.find} → ${i.replace}\n  WHY: ${i.verifierNote}`);
    } else {
      const v = unit.verses.find((x) => x.sa.verseId === i.verseId);
      const w = v.sa.wordMeanings[i.index];
      console.log(`#${n} ${i.verseId} WORD ${i.index} [${i.kind}] ${w?.word} = "${w?.meaning}"\n  NOW: ${v.mine.wordMeanings[i.index].meaning}\n  EDIT: ${i.find} → ${i.replace}\n  WHY: ${i.verifierNote}`);
    }
  }
}
