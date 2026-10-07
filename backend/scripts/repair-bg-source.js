// Repairs the scraped Bhagavad Gita English source JSON against vedabase.io
// (the BBT text). Same contract as repair-verse-source.js: reads a local copy
// of the S3 source, writes a corrected copy, touches nothing else.
//
//   node scripts/repair-bg-source.js <srcDir> <outDir> [cacheDir]
//
// What it fixes in json/bhagavat-gita/en/ch-N.json:
//   - Prabhupada's translation where it does not match the BBT text. The BBT
//     prints some verses as a group ("TEXTS 3-4") with one translation; the
//     scrape split those into pieces, reworded some and put another group's
//     text on others (12.3, 12.4, 12.13, 12.14, 16.11-16.15 ...). Every verse
//     of a group now carries the group's full translation, as vedabase shows it.
//   - Chapter 1 from verse 37 on: the BBT merges two verses into one earlier
//     in the chapter, so its numbers run one behind the Sanskrit's; the scrape
//     put each BBT text one verse early and left 1.47 with none.
//   - The placeholder "There is no purport for this verse", which is removed
//     (a verse with no purport has no purport entry).
//   - meta.chapterTitleEn, the English chapter title.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chapterIndex, versePage } from './lib/vedabase.js';

const [srcDir, outDir, cacheArg] = process.argv.slice(2);
if (!srcDir || !outDir) {
  console.error('usage: node scripts/repair-bg-source.js <srcDir> <outDir> [cacheDir]');
  process.exit(1);
}
const cacheDir = cacheArg || join(outDir, '.vedabase-cache');
const outEnDir = join(outDir, 'json/bhagavat-gita/en');
mkdirSync(outEnDir, { recursive: true });

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const isPlaceholder = (t) => /^\s*there is no purport for this verse\s*\.?\s*$/i.test(t || '');
const prabhupada = (type) => (c) => c.translatorSlug === 'prabhupada' && c.type === type;

const report = { translationsReplaced: [], purportsRemoved: 0, purportsReplaced: [], added: [], titles: 0 };

for (let chapter = 1; chapter <= 18; chapter++) {
  const file = `ch-${chapter}.json`;
  const data = JSON.parse(readFileSync(join(srcDir, 'json/bhagavat-gita/en', file), 'utf8'));
  const index = await chapterIndex(cacheDir, 'bg', null, chapter);

  const unitOf = new Map();
  for (const range of index.verses) {
    const [a, b] = range.split('-').map(Number);
    for (let n = a; n <= (b || a); n++) unitOf.set(n, range);
  }
  const pages = new Map();
  for (const range of index.verses) pages.set(range, await versePage(cacheDir, 'bg', null, chapter, range));

  for (const verse of data.verses) {
    const n = verse.verseNumber;
    // Chapter 1: Sanskrit verses 37-47 against the BBT's 36, 37-38, 39-46.
    const range = chapter === 1 && n >= 37 ? (n === 37 ? '36' : n === 38 || n === 39 ? '37-38' : String(n - 1)) : unitOf.get(n);
    const page = range && pages.get(range);
    if (!page) {
      console.warn(`${verse.verseId}: no vedabase text`);
      continue;
    }
    verse.commentaries = verse.commentaries || [];
    let tr = verse.commentaries.find(prabhupada('translation'));
    let pu = verse.commentaries.find(prabhupada('purport'));

    if (!tr) {
      tr = { translatorSlug: 'prabhupada', type: 'translation', language: 'en', displayOrder: 1, text: '' };
      verse.commentaries.unshift(tr);
      report.added.push(verse.verseId);
    }
    if (norm(tr.text) !== norm(page.translation)) {
      report.translationsReplaced.push({ verseId: verse.verseId, before: tr.text, after: page.translation });
      tr.text = page.translation;
    }

    const wanted = page.purport;
    if (pu && isPlaceholder(pu.text)) {
      verse.commentaries.splice(verse.commentaries.indexOf(pu), 1);
      report.purportsRemoved += 1;
      pu = null;
    }
    const mustReplace = (chapter === 1 && n >= 37) || (chapter === 10 && (n === 4 || n === 5));
    if (mustReplace) {
      if (pu && norm(pu.text) !== norm(wanted)) {
        report.purportsReplaced.push(verse.verseId);
        if (wanted) pu.text = wanted;
        else verse.commentaries.splice(verse.commentaries.indexOf(pu), 1);
      } else if (!pu && wanted) {
        verse.commentaries.splice(verse.commentaries.indexOf(tr) + 1, 0, {
          translatorSlug: 'prabhupada', type: 'purport', language: 'en', displayOrder: 2, text: wanted,
        });
        report.purportsReplaced.push(verse.verseId);
      }
    }
  }

  data.meta.chapterTitleEn = index.title;
  report.titles += 1;
  writeFileSync(join(outEnDir, file), JSON.stringify(data));
}

writeFileSync(join(outDir, 'repair-bg-report.json'), JSON.stringify(report, null, 2));
console.log({ ...report, translationsReplaced: report.translationsReplaced.length });
