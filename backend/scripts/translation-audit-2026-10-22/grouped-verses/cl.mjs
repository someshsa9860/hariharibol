// node cl.mjs <key> <lang> [version]  — numbered clauses of the chosen (or given) version, with the planned cuts marked >>>
import fs from 'node:fs';
import { SP, load, clauses, row } from './lib.mjs';
const plan = JSON.parse(fs.readFileSync(`${SP}/tools/plan.json`, 'utf8'));
const [key, lang, ver] = process.argv.slice(2);
const e = plan[key];
const x = e.langs[lang];
let text = x.text;
if (ver) text = row(load(`${SP}/orig`, lang, e.chapter).verses.find((v) => v.verseId.endsWith(`.${ver}`)), 'translation').text;
const cuts = new Set(ver ? [] : x.offsets);
let at = 0;
console.log(`${key} ${lang} from ${ver || x.from}  cands ${x.cands.join(' ')}`);
clauses(text).forEach((c, i) => { at += c.length; console.log(`${cuts.has(at) ? '>>> ' : '    '}${i + 1}. ${c.trim()}`); });
