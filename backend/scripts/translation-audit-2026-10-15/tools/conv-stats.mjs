import { readFileSync } from 'node:fs';
let all = ''; const lines = [];
for (let n = 1; n <= 18; n++) { const j = JSON.parse(readFileSync(`../ml/orig/json/bhagavat-gita/ml/ch-${n}.json`, 'utf8')); for (const v of j.verses) { all += v.transliteration + '\n' + (v.wordMeanings || []).map((w) => w.word).join('\n') + '\n'; lines.push(v.transliteration); } }
const c = (re) => (all.match(re) || []).length;
console.log('au sign U+0D57:', c(/ൗ/g), ' U+0D4C:', c(/ൌ/g));
console.log('chillu-r + C + virama + C (geminate):', c(/ർ[ക-ഹ]്[ക-ഹ]/g), ' chillu-r + C + vowel/other:', c(/ർ[ക-ഹ](?!്)/g));
console.log('r+virama:', c(/ര്/g), ' chillu-r:', c(/ർ/g));
console.log('chillu-n:', c(/ൻ/g), ' n+virama (not before C):', c(/ന്(?![ക-ഹ])/g));
console.log('ZWJ:', c(/‍/g), ' ZWNJ:', c(/‌/g));
console.log('avagraha U+0D3D:', c(/ഽ/g), ' apostrophes:', c(/[’']/g));
console.log('anusvara:', c(/ം/g), ' visarga:', c(/ഃ/g), ' danda:', c(/।/g), ' double:', c(/॥/g), ' ascii digits:', c(/[0-9]/g), ' ml digits:', c(/[൦-൯]/g));
console.log(lines[200]); console.log(lines[201]); console.log(lines[330]);
