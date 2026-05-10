#!/usr/bin/env node
// Job 4b: Srimad Bhagavatam cantos 10-12 → S3
// Source: vedabase.io (Prabhupada — Bhaktivedanta VedaBase)
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

const CANTOS = { 10: 90, 11: 31, 12: 13 };

// Polite delay between requests to avoid hammering vedabase.io
const DELAY_MS = 800;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'HariHariBol-DataPipeline/1.0 (spiritual-learning-app; contact: someshsa9860@gmail.com)',
        'Accept': 'text/html',
      }
    }, (res) => {
      if (res.statusCode === 404) { resolve(null); return; }
      if (res.statusCode === 429) { reject(new Error('rate-limited')); return; }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
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
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/g, '');
}

function clean(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// Extract content from a verse page HTML
function parseVersePage(html, canto, chapter, verseEntry) {
  // verseEntry is like "1", "5-7" etc.
  const verseNum = parseInt(verseEntry.split('-')[0], 10);
  const verseNumEnd = verseEntry.includes('-') ? parseInt(verseEntry.split('-')[1], 10) : null;

  const verseId = verseNumEnd
    ? `2.${canto}.${chapter}.${verseNum}-${verseNumEnd}`
    : `2.${canto}.${chapter}.${verseNum}`;

  // Devanagari
  const devMatch = html.match(/class="[^"]*av-devanagari[^"]*">([\s\S]*?)<\/div>\s*<\/div>/);
  const devanagari = devMatch ? clean(stripTags(devMatch[1])).replace(/^Devanagari\s*/i, '').trim() : '';

  // Verse text (transliteration)
  const verseMatch = html.match(/class="[^"]*av-verse[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
  const transliteration = verseMatch ? clean(stripTags(verseMatch[1])).replace(/^Verse\s*text\s*/i, '').trim() : '';

  // Synonyms
  const synMatch = html.match(/class="[^"]*av-synonyms[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/);
  const synonymsRaw = synMatch ? clean(stripTags(synMatch[1])).replace(/^Synonyms\s*/i, '').trim() : '';

  // Translation
  const transMatch = html.match(/class="[^"]*av-translation[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
  const translation = transMatch ? clean(stripTags(transMatch[1])).replace(/^Translation\s*/i, '').trim() : '';

  // Purport — extract from within <main> tag to avoid footer noise
  let purport = '';
  const mainEnd = html.lastIndexOf('</main>');
  const mainStart = html.lastIndexOf('<main', mainEnd);
  if (mainStart >= 0 && mainEnd > mainStart) {
    const mainContent = html.substring(mainStart, mainEnd);
    const purpIdx = mainContent.indexOf('av-purport');
    if (purpIdx >= 0) {
      const purpSection = mainContent.substring(purpIdx);
      const h2End = purpSection.indexOf('</h2>');
      if (h2End >= 0) {
        const purpText = purpSection.substring(h2End + 5);
        purport = clean(stripTags(purpText));
      }
    }
  }

  const commentaries = [];
  if (translation) commentaries.push({ translatorSlug: 'prabhupada', type: 'translation', language: 'en', text: translation });
  if (purport) commentaries.push({ translatorSlug: 'prabhupada', type: 'purport', language: 'en', text: purport });

  return {
    verseId,
    bookNumber: 2,
    cantoNumber: canto,
    chapterNumber: chapter,
    verseNumber: verseNum,
    verseNumberEnd: verseNumEnd,
    sanskrit: devanagari,
    transliteration,
    wordMeanings: synonymsRaw ? [{ raw: synonymsRaw }] : [],
    commentaries,
  };
}

// Get verse entries for a chapter from its index page
async function getChapterVerseEntries(canto, chapter) {
  const url = `https://vedabase.io/en/library/sb/${canto}/${chapter}/`;
  const html = await fetchHtml(url);
  if (!html) return [];

  // Find verse links like /en/library/sb/10/1/5-7/
  const pattern = new RegExp(`/en/library/sb/${canto}/${chapter}/(\\d+(?:-\\d+)?)`, 'g');
  const entries = [];
  const seen = new Set();
  let m;
  while ((m = pattern.exec(html)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); entries.push(m[1]); }
  }
  return entries;
}

async function processChapter(canto, chapter) {
  const verseEntries = await getChapterVerseEntries(canto, chapter);
  if (verseEntries.length === 0) return [];

  const verses = [];
  for (const entry of verseEntries) {
    await sleep(DELAY_MS);
    const url = `https://vedabase.io/en/library/sb/${canto}/${chapter}/${entry}/`;
    let html;
    try {
      html = await fetchHtml(url);
    } catch (e) {
      if (e.message === 'rate-limited') {
        await sleep(5000);
        html = await fetchHtml(url);
      } else {
        throw e;
      }
    }
    if (!html) continue;
    const verse = parseVersePage(html, canto, chapter, entry);
    verses.push(verse);
  }
  return verses;
}

async function run() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const issues = [];
  const cantoResults = [];
  let grandTotal = 0;

  console.log('=== Job 4b: SB Cantos 10-12 → S3 (vedabase.io) ===');
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Delay between requests: ${DELAY_MS}ms\n`);

  for (const [cantoStr, totalChapters] of Object.entries(CANTOS)) {
    const canto = parseInt(cantoStr, 10);
    console.log(`\nCanto ${canto} (${totalChapters} chapters):`);
    let cantoVerses = 0;

    for (let ch = 1; ch <= totalChapters; ch++) {
      process.stdout.write(`  ch${ch}... `);

      let verses;
      try {
        verses = await processChapter(canto, ch);
      } catch (e) {
        console.log(`FAIL: ${e.message}`);
        issues.push(`c${canto}-ch${ch}: ${e.message}`);
        continue;
      }

      if (!verses.length) {
        console.log(`EMPTY`);
        issues.push(`c${canto}-ch${ch}: 0 verses`);
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
          cantoNumber: canto,
          chapterNumber: ch,
          totalVerseEntries: verses.length,
          translatorSlug: 'prabhupada',
          source: 'vedabase.io (Prabhupada — Bhaktivedanta VedaBase)',
          generatedAt: timestamp,
        },
        verses,
      };

      const s3Key = `json/srimad-bhagavatam/en/c${canto}-ch-${ch}.json`;
      try {
        await s3Put(s3Key, chapterJson);
        console.log(`${verses.length}v`);
        cantoVerses += verses.length;
      } catch (e) {
        console.log(`S3 FAIL: ${e.message}`);
        issues.push(`c${canto}-ch${ch}: S3 upload failed`);
      }
    }

    grandTotal += cantoVerses;
    console.log(`  Canto ${canto} total: ${cantoVerses} verse entries`);
    cantoResults.push({ canto, chapters: totalChapters, verseEntries: cantoVerses });
  }

  const reportKey = `json/reports/job4b-sb-cantos10-12-${timestamp.replace(/[:.]/g, '-')}.json`;
  const report = {
    job: 'job4b-sb-cantos10-12',
    status: issues.filter(i => !i.includes('no transliteration') && !i.includes('no commentaries')).length === 0 ? 'PASS' : 'PARTIAL',
    timestamp,
    elapsedSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
    grandTotalVerseEntries: grandTotal,
    issues: issues.slice(0, 50),
    cantoResults,
  };
  await s3Put(reportKey, report);

  console.log('\n=== Summary ===');
  console.log(`Status:       ${report.status}`);
  console.log(`Total verses: ${grandTotal}`);
  console.log(`Issues:       ${issues.length || 'none'}`);
  if (issues.length) issues.slice(0, 10).forEach(i => console.log(`  ! ${i}`));
  if (issues.length > 10) console.log(`  ... and ${issues.length - 10} more`);
  console.log('===============');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
