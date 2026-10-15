// Corrects the Srimad Bhagavatam source JSON against vedabase.io (Prabhupada,
// BBT). fill-prabhupada-source.js only adds what is missing; this fixes what is
// there but wrong. Reads the filled copy, writes a corrected copy, and touches
// neither S3 nor the database — scripts/upload-verse-source.js and
// scripts/import-sb.js do that, so every change can be read first.
//
//   node scripts/correct-sb-source.js [--work <dir>] [--only 3,10:4]
//
// Reads  <work>/source/json/srimad-bhagavatam/en/  (default work: backend/.fill-work)
//        <work>/cache/                              (the parsed vedabase pages)
// Writes <work>/corrected/json/srimad-bhagavatam/en/ and <work>/correct-report.json
//
// What it does, per verse (the rules are in lib/correct-verse.js):
//   translation, purport   navigation labels cut off the end; a dropped sentence or
//                          a misspelling replaced by vedabase's text; anything the
//                          source has that vedabase lacks (citations, a whole
//                          purport) kept
//   transliteration        replaced by vedabase's where they differ
//   word-by-word           replaced by vedabase's pairs where they differ (fixes
//                          OCR slips and empty meanings)
// A verse that shares a vedabase page with others (a compound) only has its
// navigation labels cut. Cantos 1-9 stay spelled without diacritics.
// Anything not certain goes in the report under "review".

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chapterIndex, plainRoman, versePageParsed } from './lib/vedabase.js';
import { matchScore, MIN_SIMILARITY, styleMeanings, unitsOf } from './lib/fill-verse.js';
import { chooseText, cutTail, letters, wordSimilarity } from './lib/correct-verse.js';

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const work = resolve(option('work', join(dirname(fileURLToPath(import.meta.url)), '..', '.fill-work')));
const only = option('only', '').split(',').filter(Boolean);
const srcDir = join(work, 'source/json/srimad-bhagavatam/en');
const outDir = join(work, 'corrected/json/srimad-bhagavatam/en');
const cacheDir = join(work, 'cache');
mkdirSync(outDir, { recursive: true });

const oneLine = (s) => (s || '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
const isPlaceholder = (t) => /^\s*there is no purport for this verse\s*\.?\s*$/i.test(t || '');
const wordsOf = (wordMeanings) => (wordMeanings || []).map((w) => w.raw ?? `${w.word || ''}${w.meaning || ''}`).join('');

const totals = {
  chapters: 0, verses: 0,
  translation: {}, purport: {}, transliteration: 0, wordMeanings: 0, navCutSharedPage: 0,
};
const review = [];
const bump = (group, key) => { group[key] = (group[key] || 0) + 1; };

function correctChapter(data, index, pages, plain) {
  const fix = plain ? plainRoman : (s) => s;
  const units = unitsOf(index.verses, data.verses.map((v) => v.verseNumber));

  for (const v of data.verses) {
    totals.verses += 1;
    const own = v.verseNumberEnd ? `${v.verseNumber}-${v.verseNumberEnd}` : null;
    const range = own && index.verses.includes(own) ? own : [...units].find(([, members]) => members.includes(v.verseNumber))?.[0];
    const page = range && pages.get(range);
    const members = range ? (units.get(range) || []).map((n) => data.verses.find((x) => x.verseNumber === n)) : [];
    const shared = members.length > 1;
    const commentary = (type) => v.commentaries?.find((c) => c.translatorSlug === 'prabhupada' && c.type === type);
    const translationOf = (m) => m.commentaries?.find((c) => c.type === 'translation')?.text;

    let trusted = false;
    if (page) {
      const score = matchScore(members, page, translationOf);
      trusted = score !== null && score >= MIN_SIMILARITY;
      if (!trusted) review.push({ verseId: v.verseId, field: 'page', note: `vedabase ${range} not accepted as this verse (${score === null ? 'nothing to check' : score.toFixed(2)})` });
    }

    for (const type of ['translation', 'purport']) {
      const c = commentary(type);
      if (!c?.text) continue;
      if (!trusted || shared) {
        const cut = cutTail(c.text);
        if (cut !== c.text.trim()) { c.text = cut; totals.navCutSharedPage += 1; }
        if (!cut) v.commentaries = v.commentaries.filter((x) => x !== c);
        continue;
      }
      const theirs = type === 'purport' ? (isPlaceholder(page.purport) ? '' : page.purport && fix(page.purport).replace(/\n+/g, '\n').trim()) : page.translation && oneLine(fix(page.translation));
      const choice = chooseText(c.text, theirs, { extraIsJunk: type === 'translation' });
      bump(totals[type], choice.action);
      if (choice.review !== undefined) review.push({ verseId: v.verseId, field: type, note: `reworded, only ${choice.review.toFixed(2)} alike`, was: c.text.slice(0, 160), now: choice.text.slice(0, 160) });
      if (choice.action === 'kept-extra' && letters(c.text).length - letters(theirs).length > 300) review.push({ verseId: v.verseId, field: type, note: `source has ${letters(c.text).length - letters(theirs).length} more letters than vedabase` });
      c.text = choice.text;
      if (!c.text) { v.commentaries = v.commentaries.filter((x) => x !== c); bump(totals[type], 'dropped'); }
    }

    if (!trusted || shared) continue;

    if (v.transliteration && page.transliteration) {
      const theirs = oneLine(fix(page.transliteration));
      if (letters(v.transliteration) !== letters(theirs)) {
        const alike = wordSimilarity(v.transliteration, theirs);
        if (alike >= 0.8) { v.transliteration = theirs; totals.transliteration += 1; }
        else review.push({ verseId: v.verseId, field: 'transliteration', note: `differs, only ${alike.toFixed(2)} alike` });
      }
    }

    if (v.wordMeanings?.length && page.synonymPairs?.length) {
      const pairs = styleMeanings(page.synonymPairs, plain);
      if (letters(wordsOf(v.wordMeanings)) !== letters(wordsOf(pairs)) && pairs.length) {
        v.wordMeanings = pairs;
        totals.wordMeanings += 1;
      }
    }
  }
}

const files = readdirSync(srcDir).filter((f) => /^c\d+-ch-\d+\.json$/.test(f)).sort((a, b) => {
  const [ca, ha] = a.match(/\d+/g).map(Number);
  const [cb, hb] = b.match(/\d+/g).map(Number);
  return ca - cb || ha - hb;
});

for (const file of files) {
  const [canto, chapter] = file.match(/\d+/g).map(Number);
  if (only.length && !only.some((o) => o === String(canto) || o === `${canto}:${chapter}`)) continue;
  const data = JSON.parse(readFileSync(join(srcDir, file), 'utf8'));
  const index = await chapterIndex(cacheDir, 'sb', canto, chapter);
  if (!index) { review.push({ verseId: `${canto}.${chapter}`, field: 'chapter', note: 'vedabase has no such chapter' }); continue; }
  const pages = new Map();
  for (const range of index.verses) pages.set(range, await versePageParsed(cacheDir, 'sb', canto, chapter, range));
  correctChapter(data, index, pages, canto <= 9);
  writeFileSync(join(outDir, file), JSON.stringify(data));
  totals.chapters += 1;
}

writeFileSync(join(work, 'correct-report.json'), JSON.stringify({ totals, review }, null, 1));
console.log(JSON.stringify(totals, null, 1));
console.log(`${review.length} items to review — see ${join(work, 'correct-report.json')}`);
