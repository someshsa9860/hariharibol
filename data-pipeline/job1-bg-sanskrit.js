#!/usr/bin/env node
// Job 1: Bhagavat Gita Sanskrit source data → S3
// Source: vedicscriptures/bhagavad-gita (GPL-3.0)
// Output: s3://BUCKET/json/bhagavat-gita/sa/ch-{n}.json
'use strict';

const https = require('https');
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION || 'ap-south-1',
});
const BUCKET = process.env.S3_BUCKET;

const BG_CHAPTER_COUNTS = [0, 47, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 35, 27, 20, 24, 28, 78];
const BASE = 'https://raw.githubusercontent.com/vedicscriptures/bhagavad-gita/main';

// Approved Hindu devotional translators only
const TRANSLATOR_MAP = {
  prabhu:  { slug: 'prabhupada',        lang: 'en', type: 'translation' },
  siva:    { slug: 'sivananda',          lang: 'en', type: 'translation' },
  rams:    { slug: 'ramsukhdas',         lang: 'hi', type: 'translation' },
  sankar:  { slug: 'shankaracharya',     lang: 'sa', type: 'sanskrit_commentary' },
  raman:   { slug: 'ramanujacharya',     lang: 'sa', type: 'sanskrit_commentary' },
  madhav:  { slug: 'madhavacharya',      lang: 'sa', type: 'sanskrit_commentary' },
  vallabh: { slug: 'vallabhacharya',     lang: 'sa', type: 'sanskrit_commentary' },
  srid:    { slug: 'sridhara-swami',     lang: 'sa', type: 'sanskrit_commentary' },
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} — ${url}`)); return; }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
        catch (e) { reject(new Error(`JSON parse: ${e.message}`)); }
      });
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

async function processChapter(ch, globalStart) {
  const chMeta = await fetchJson(`${BASE}/chapter/bhagavadgita_chapter_${ch}.json`);
  const totalVerses = BG_CHAPTER_COUNTS[ch];
  const timestamp = new Date().toISOString();
  const verses = [];

  for (let v = 1; v <= totalVerses; v++) {
    const vData = await fetchJson(`${BASE}/slok/bhagavadgita_chapter_${ch}_slok_${v}.json`);
    const globalVerseNumber = globalStart + v - 1;

    const commentaries = [];
    for (const [key, meta] of Object.entries(TRANSLATOR_MAP)) {
      const entry = vData[key];
      if (!entry) continue;
      if (entry.et) commentaries.push({ translatorSlug: meta.slug, type: meta.type, language: meta.lang, text: entry.et });
      if (entry.sc) commentaries.push({ translatorSlug: meta.slug, type: 'sanskrit_commentary', language: 'sa', text: entry.sc });
      if (entry.ht) commentaries.push({ translatorSlug: meta.slug, type: 'translation', language: 'hi', text: entry.ht });
    }

    verses.push({
      verseId: `1.${ch}.${v}`,
      globalVerseNumber,
      bookNumber: 1,
      chapterNumber: ch,
      verseNumber: v,
      verseNumberEnd: null,
      cantoNumber: null,
      speaker: vData.speaker || null,
      sanskrit: vData.slok || '',
      transliteration: vData.transliteration || '',
      wordMeanings: [],
      commentaries,
    });

    if (v % 10 === 0) process.stdout.write('.');
  }

  return {
    meta: {
      bookNumber: 1,
      bookSlug: 'bhagavat-gita',
      language: 'sa',
      chapterNumber: ch,
      cantoNumber: null,
      chapterName: chMeta.name || '',
      chapterNameTransliterated: chMeta.name_transliterated || '',
      chapterNameMeaning: chMeta.name_meaning || '',
      chapterSummary: chMeta.chapter_summary || '',
      totalVerses,
      globalVerseStart: globalStart,
      globalVerseEnd: globalStart + totalVerses - 1,
      source: 'vedicscriptures/bhagavad-gita (GPL-3.0)',
      generatedAt: timestamp,
    },
    verses,
  };
}

async function run() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const issues = [];
  let globalVerseNumber = 1;

  console.log('=== Job 1: BG Sanskrit → S3 ===');
  console.log(`Bucket: ${BUCKET}\n`);

  for (let ch = 1; ch <= 18; ch++) {
    process.stdout.write(`ch${ch} (${BG_CHAPTER_COUNTS[ch]} verses) `);
    try {
      const chapterData = await processChapter(ch, globalVerseNumber);

      // Validate
      if (chapterData.verses.length !== BG_CHAPTER_COUNTS[ch]) {
        issues.push(`ch${ch}: expected ${BG_CHAPTER_COUNTS[ch]} verses, got ${chapterData.verses.length}`);
      }
      for (const v of chapterData.verses) {
        if (!v.sanskrit?.trim()) issues.push(`ch${ch} v${v.verseNumber}: empty sanskrit`);
        if (!v.transliteration?.trim()) issues.push(`ch${ch} v${v.verseNumber}: empty transliteration`);
      }

      await s3Put(`json/bhagavat-gita/sa/ch-${ch}.json`, chapterData);
      console.log(` OK`);
      globalVerseNumber += BG_CHAPTER_COUNTS[ch];
    } catch (e) {
      console.log(` FAIL: ${e.message}`);
      issues.push(`ch${ch}: ${e.message}`);
      globalVerseNumber += BG_CHAPTER_COUNTS[ch];
    }
  }

  // Save report
  const reportKey = `json/reports/job1-bg-sanskrit-${timestamp.replace(/[:.]/g, '-')}.json`;
  const report = {
    job: 'job1-bg-sanskrit',
    status: issues.length === 0 ? 'PASS' : 'PARTIAL',
    timestamp,
    elapsedSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
    totalVerses: 700,
    issues,
  };
  await s3Put(reportKey, report);

  console.log('\n=== Summary ===');
  console.log(`Status: ${report.status} | Issues: ${issues.length || 'none'}`);
  if (issues.length) issues.forEach(i => console.log(`  ! ${i}`));
  console.log('===============');

  if (report.status !== 'PASS') process.exit(1);
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
