// Repairs the scraped Srimad Bhagavatam source JSON against vedabase.io (the
// BBT text). Reads a local copy of the S3 source, writes a corrected copy, and
// never touches S3 or the database — scripts/upload-verse-source.js and the
// importers do that, so every change can be looked at first.
//
//   node scripts/repair-verse-source.js <srcDir> <outDir> [cacheDir]
//
// <srcDir> holds json/srimad-bhagavatam/en/c<N>-ch-<M>.json as downloaded from
// the bucket. Per chapter this:
//   - adds the verse rows the scrape dropped (whole verses missing from the end
//     of a chapter, and compounds): cantos 1-9 print a compound
//     ("TEXTS 3-4") once, and the scrape glued its romanised text onto the end
//     of the previous verse's translation instead of making a verse of it.
//     Those become verses `2.<canto>.<chapter>.<a>-<b>`, the id shape cantos
//     10-12 already use, and the stray tail is cut off;
//   - fills a missing translation / transliteration / Sanskrit from vedabase;
//   - records the real chapter title in meta.chapterName.
// A report of everything it did, and everything it could not resolve, goes to
// <outDir>/repair-report.json.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chapterIndex, versePage, plainRoman } from './lib/vedabase.js';

const [srcDir, outDir, cacheArg] = process.argv.slice(2);
if (!srcDir || !outDir) {
  console.error('usage: node scripts/repair-verse-source.js <srcDir> <outDir> [cacheDir]');
  process.exit(1);
}
const cacheDir = cacheArg || join(outDir, '.vedabase-cache');
const sbDir = join(srcDir, 'json/srimad-bhagavatam/en');
const outSbDir = join(outDir, 'json/srimad-bhagavatam/en');
mkdirSync(outSbDir, { recursive: true });

const report = { chapters: 0, compoundsAdded: 0, tailsCut: 0, filled: [], unresolved: [], titles: 0 };

/** "krathasya — of Kratha ; kuntih — Kunti" in the style of the canto it goes in. */
function formatSynonyms(raw, cantoNumber) {
  if (!raw) return null;
  const clean = raw.replace(/ ;/g, ';').replace(/;(?=\S)/g, '; ').replace(/\n/g, ' ').trim();
  return cantoNumber <= 9 ? plainRoman(clean).replace(/ — /g, '—') : clean.replace(/;/g, ' ;').replace(/ ;\s+/g, ' ; ');
}

/** The texts of a vedabase page, spelled the way this canto's source spells them. */
function styled(page, cantoNumber) {
  const fix = cantoNumber <= 9 ? plainRoman : (s) => s;
  const oneLine = (s) => s && fix(s).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    sanskrit: page.devanagari ? page.devanagari.replace(/\n/g, ' ') : null,
    transliteration: oneLine(page.transliteration),
    wordMeanings: page.synonyms ? [{ raw: formatSynonyms(page.synonyms, cantoNumber) }] : null,
    translation: page.translation && fix(page.translation).replace(/\n/g, ' ').trim(),
    purport: page.purport && fix(page.purport).replace(/\n+/g, '\n').trim(),
  };
}

const norm = (s) => plainRoman(s || '').toLowerCase().replace(/[^a-z]/g, '');

for (const file of readdirSync(sbDir).sort()) {
  const data = JSON.parse(readFileSync(join(sbDir, file), 'utf8'));
  const { cantoNumber, chapterNumber } = data.meta;
  const where = `${cantoNumber}.${chapterNumber}`;
  const index = await chapterIndex(cacheDir, 'sb', cantoNumber, chapterNumber);
  if (!index) {
    report.unresolved.push(`${where}: no vedabase chapter page`);
    writeFileSync(join(outSbDir, file), JSON.stringify(data));
    continue;
  }
  report.chapters += 1;

  const have = new Map(data.verses.map((v) => [v.verseNumber, v]));
  const verseIdFor = (a, b) => `2.${cantoNumber}.${chapterNumber}.${b ? `${a}-${b}` : a}`;

  // Which compounds vedabase has that the source does not.
  const missing = [];
  for (const range of index.verses) {
    const [a, b] = range.split('-').map(Number);
    if (!b) {
      // Whole verses the scrape left out (e.g. the end of 2.7 and 2.9).
      if (!have.has(a)) missing.push({ range, a, b: null });
    } else if (!have.has(a) && cantoNumber <= 9) {
      missing.push({ range, a, b });
    } else if (have.has(a) && !have.get(a).verseNumberEnd && cantoNumber <= 9) {
      report.unresolved.push(`${where}.${range}: compound on vedabase, single verse in the source`);
    }
  }

  // Cut each missing compound's stray tail off whatever it was glued to.
  const tails = new Map();
  for (const { range, b } of missing) {
    if (!b) continue;
    const marker = new RegExp(`\\s${cantoNumber}\\.${chapterNumber}\\.${range}\\s`);
    for (const v of data.verses) {
      for (const c of v.commentaries || []) {
        const m = c.text.match(marker);
        if (!m) continue;
        const rest = c.text.slice(m.index);
        c.text = c.text.slice(0, m.index).trimEnd();
        tails.set(range, rest);
        report.tailsCut += 1;
      }
    }
  }
  // Nothing of this chapter's own "<canto>.<chapter>.<verse>" form may be left.
  const stray = new RegExp(`\\s${cantoNumber}\\.${chapterNumber}\\.\\d+(?:-\\d+)?\\s`);
  for (const v of data.verses) {
    for (const c of v.commentaries || []) {
      if (stray.test(c.text)) report.unresolved.push(`${where}: leftover verse reference in ${v.verseId}`);
    }
  }

  for (const { range, a, b } of missing) {
    const page = await versePage(cacheDir, 'sb', cantoNumber, chapterNumber, range);
    if (!page || !page.translation) {
      report.unresolved.push(`${where}.${range}: vedabase page has no translation`);
      continue;
    }
    const s = styled(page, cantoNumber);
    const tail = tails.get(range);
    if (!tail && b) report.unresolved.push(`${where}.${range}: no stray tail was found in the source (built from vedabase only)`);
    else if (tail && !norm(tail).includes(norm(s.transliteration).slice(0, 40))) {
      report.unresolved.push(`${where}.${range}: transliteration differs from the source tail — check`);
    }
    const commentaries = [{ translatorSlug: 'prabhupada', type: 'translation', language: 'en', text: s.translation }];
    if (s.purport) commentaries.push({ translatorSlug: 'prabhupada', type: 'purport', language: 'en', text: s.purport });
    data.verses.push({
      verseId: verseIdFor(a, b),
      bookNumber: 2,
      cantoNumber,
      chapterNumber,
      verseNumber: a,
      verseNumberEnd: b,
      ...(cantoNumber >= 10 && s.sanskrit ? { sanskrit: s.sanskrit } : {}),
      transliteration: s.transliteration,
      wordMeanings: s.wordMeanings || [],
      commentaries,
    });
    report.compoundsAdded += 1;
  }

  // Fill what a verse is simply missing.
  for (const v of data.verses) {
    const tr = (v.commentaries || []).find((c) => c.type === 'translation');
    const lacks = [];
    if (!tr || !tr.text) lacks.push('translation');
    if (!v.transliteration) lacks.push('transliteration');
    if (cantoNumber >= 10 && !v.sanskrit) lacks.push('sanskrit');
    if (lacks.length === 0) continue;
    const range = v.verseNumberEnd ? `${v.verseNumber}-${v.verseNumberEnd}` : String(v.verseNumber);
    const page = await versePage(cacheDir, 'sb', cantoNumber, chapterNumber, range);
    if (!page) {
      report.unresolved.push(`${v.verseId}: lacks ${lacks.join(', ')}, vedabase has no page`);
      continue;
    }
    const s = styled(page, cantoNumber);
    if (lacks.includes('translation')) {
      if (!s.translation) { report.unresolved.push(`${v.verseId}: vedabase has no translation either`); continue; }
      const existing = (v.commentaries || []).find((c) => c.type === 'translation');
      if (existing) existing.text = s.translation;
      else v.commentaries = [{ translatorSlug: 'prabhupada', type: 'translation', language: 'en', text: s.translation }, ...(v.commentaries || [])];
    }
    if (lacks.includes('transliteration') && s.transliteration) v.transliteration = s.transliteration;
    if (lacks.includes('sanskrit') && s.sanskrit) v.sanskrit = s.sanskrit;
    report.filled.push(`${v.verseId}: ${lacks.join(', ')}`);
  }

  data.verses.sort((x, y) => x.verseNumber - y.verseNumber);
  data.meta.totalVerses = data.verses.length;
  delete data.meta.totalVerseEntries;
  if (index.title) { data.meta.chapterName = index.title; report.titles += 1; }
  writeFileSync(join(outSbDir, file), JSON.stringify(data));
  if (report.chapters % 25 === 0) console.log(`${report.chapters} chapters…`);
}

writeFileSync(join(outDir, 'repair-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, filled: report.filled.length, unresolved: report.unresolved.length }));
