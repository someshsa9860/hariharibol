#!/usr/bin/env node
// Job 4: Srimad Bhagavatam (Prabhupada) — cantos 1-9 → S3
// Source: srimad-bhagavatam/srimad-bhagavatam.github.io (no explicit license — 1977 Prabhupada edition)
// Content: transliteration (Roman), synonyms, translation, purport
// Output: s3://BUCKET/json/srimad-bhagavatam/en/c{canto}-ch-{chapter}.json
'use strict';

const https = require('https');
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION || 'ap-south-1',
});
const BUCKET = process.env.S3_BUCKET;

// Available cantos and their chapter counts in the source repo
const CANTO_CHAPTERS = {
  1: 19, 2: 10, 3: 33, 4: 31, 5: 26,
  6: 19, 7: 15, 8: 24, 9: 24,
};

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 404) { resolve(null); return; }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    }).on('error', reject);
  });
}

function s3Put(key, body) {
  return s3.putObject({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(body, null, 2),
    ContentType: 'application/json',
  }).promise();
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// Parse one chapter HTML into verse objects
function parseChapter(html, canto, chapter) {
  const verses = [];

  // Split content into verse blocks — each starts with <p><strong>C.CH.V</strong></p>
  const blocks = html.split(/(?=<p><strong>\d+\.\d+\.\d+<\/strong><\/p>)/);

  for (const block of blocks) {
    const idMatch = block.match(/<p><strong>(\d+)\.(\d+)\.(\d+)<\/strong><\/p>/);
    if (!idMatch) continue;

    const [, c, ch, v] = idMatch.map(Number);
    if (c !== canto || ch !== chapter) continue;

    const verseId = `2.${canto}.${chapter}.${v}`;

    // Extract sections by splitting on <strong>SECTION</strong> markers
    const sections = block.split(/<p><strong>(SYNONYMS|TRANSLATION|PURPORT)<\/strong><\/p>/);

    // sections[0] = preamble (verse ID + transliteration)
    // sections[1] = 'SYNONYMS', sections[2] = synonyms text
    // sections[3] = 'TRANSLATION', sections[4] = translation text
    // sections[5] = 'PURPORT', sections[6] = purport text (may be absent)

    // Extract transliteration from preamble (between verse ID and SYNONYMS)
    const preamble = sections[0] || '';
    // Remove the verse ID line
    const preambleClean = preamble.replace(/<p><strong>\d+\.\d+\.\d+<\/strong><\/p>/, '');
    const transliteration = stripTags(preambleClean)
      .replace(/^[\s\n]+/, '')
      .trim();

    // Synonyms
    const synonymsIdx = sections.indexOf('SYNONYMS');
    const synonyms = synonymsIdx >= 0 ? stripTags(sections[synonymsIdx + 1] || '').trim() : '';

    // Translation
    const translationIdx = sections.indexOf('TRANSLATION');
    const translation = translationIdx >= 0 ? stripTags(sections[translationIdx + 1] || '').trim() : '';

    // Purport
    const purportIdx = sections.indexOf('PURPORT');
    const purport = purportIdx >= 0 ? stripTags(sections[purportIdx + 1] || '').trim() : '';

    const commentaries = [];
    if (translation) {
      commentaries.push({
        translatorSlug: 'prabhupada',
        type: 'translation',
        language: 'en',
        text: translation,
      });
    }
    if (purport) {
      commentaries.push({
        translatorSlug: 'prabhupada',
        type: 'purport',
        language: 'en',
        text: purport,
      });
    }

    verses.push({
      verseId,
      bookNumber: 2,
      cantoNumber: canto,
      chapterNumber: chapter,
      verseNumber: v,
      verseNumberEnd: null,
      transliteration,
      wordMeanings: synonyms ? [{ raw: synonyms }] : [],
      commentaries,
    });
  }

  return verses;
}

async function processChapter(canto, chapter) {
  const url = `https://raw.githubusercontent.com/srimad-bhagavatam/srimad-bhagavatam.github.io/master/canto${canto}/${chapter}/index.html`;
  const html = await fetchHtml(url);
  if (!html) return [];
  return parseChapter(html, canto, chapter);
}

async function run() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const issues = [];
  const cantoResults = [];

  console.log('=== Job 4: Srimad Bhagavatam → S3 ===');
  console.log(`Source: srimad-bhagavatam.github.io (Prabhupada 1977)`);
  console.log(`Bucket: ${BUCKET}\n`);

  let grandTotalVerses = 0;

  for (const [canto, totalChapters] of Object.entries(CANTO_CHAPTERS)) {
    const cantoNum = parseInt(canto, 10);
    console.log(`\nCanto ${cantoNum} (${totalChapters} chapters):`);
    let cantoVerses = 0;

    for (let ch = 1; ch <= totalChapters; ch++) {
      process.stdout.write(`  ch${ch}... `);

      let verses;
      try {
        verses = await processChapter(cantoNum, ch);
      } catch (e) {
        console.log(`FAIL: ${e.message}`);
        issues.push(`c${cantoNum}-ch${ch}: fetch failed — ${e.message}`);
        continue;
      }

      if (verses.length === 0) {
        console.log(`EMPTY`);
        issues.push(`c${cantoNum}-ch${ch}: 0 verses parsed`);
        continue;
      }

      // Validate
      for (const v of verses) {
        if (!v.transliteration?.trim()) issues.push(`${v.verseId}: no transliteration`);
        if (!v.commentaries.length) issues.push(`${v.verseId}: no commentaries`);
      }

      const chapterJson = {
        meta: {
          bookNumber: 2,
          bookSlug: 'srimad-bhagavatam',
          language: 'en',
          cantoNumber: cantoNum,
          chapterNumber: ch,
          totalVerses: verses.length,
          translatorSlug: 'prabhupada',
          source: 'srimad-bhagavatam/srimad-bhagavatam.github.io (Prabhupada 1977)',
          generatedAt: timestamp,
        },
        verses,
      };

      const s3Key = `json/srimad-bhagavatam/en/c${cantoNum}-ch-${ch}.json`;
      try {
        await s3Put(s3Key, chapterJson);
        console.log(`${verses.length}v`);
        cantoVerses += verses.length;
      } catch (e) {
        console.log(`S3 FAIL: ${e.message}`);
        issues.push(`c${cantoNum}-ch${ch}: S3 upload failed`);
      }
    }

    grandTotalVerses += cantoVerses;
    console.log(`  Canto ${cantoNum} total: ${cantoVerses} verses`);
    cantoResults.push({ canto: cantoNum, chapters: totalChapters, verses: cantoVerses });
  }

  // Save report
  const reportKey = `json/reports/job4-sb-en-${timestamp.replace(/[:.]/g, '-')}.json`;
  const report = {
    job: 'job4-sb-en',
    status: issues.filter(i => !i.includes('no transliteration')).length === 0 ? 'PASS' : 'PARTIAL',
    timestamp,
    elapsedSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
    cantosProcessed: Object.keys(CANTO_CHAPTERS).length,
    cantosAvailable: '1-9 (cantos 10-12 not in source)',
    grandTotalVerses,
    issues: issues.slice(0, 50), // cap report size
    cantoResults,
  };

  await s3Put(reportKey, report);

  console.log('\n=== Summary ===');
  console.log(`Status:         ${report.status}`);
  console.log(`Cantos:         1-9 (of 12 total)`);
  console.log(`Total verses:   ${grandTotalVerses}`);
  console.log(`Issues:         ${issues.length || 'none'}`);
  if (issues.length > 0) issues.slice(0, 10).forEach(i => console.log(`  ! ${i}`));
  if (issues.length > 10) console.log(`  ... and ${issues.length - 10} more`);
  console.log('===============');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
