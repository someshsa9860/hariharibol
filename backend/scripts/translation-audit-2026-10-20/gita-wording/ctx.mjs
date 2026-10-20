// Full context of one unit: node ctx.mjs LANG VERSEID[,VERSEID..] --from DIR
import { resolve } from 'node:path';
import { loadUnit, unitPrompt } from './units.mjs';
const [lang, ids] = process.argv.slice(2);
const from = resolve(process.argv[process.argv.indexOf('--from') + 1]);
console.log(unitPrompt(lang, loadUnit(from, lang, ids.split(','))));
