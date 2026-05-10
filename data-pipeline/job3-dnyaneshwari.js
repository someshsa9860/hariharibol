#!/usr/bin/env node
'use strict';

const https = require('https');
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION || 'ap-south-1',
});

const BUCKET = process.env.S3_BUCKET;

// Bhagavat Gita verse counts per chapter (1-indexed, index 0 unused)
const BG_VERSE_COUNTS = [0, 47, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 35, 27, 20, 24, 28, 78];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} — ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
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

function s3Head(key) {
  return s3.headObject({ Bucket: BUCKET, Key: key }).promise();
}

function devanagariToArabic(str) {
  return str.replace(/[०-९]/g, d => String.fromCharCode(d.charCodeAt(0) - 0x0966 + 48));
}

// Extract verse number from a line ending with ॥ N ॥ or ॥N॥
function extractVerseNumber(line) {
  const match = line.match(/॥\s*([०-९\d]+)\s*॥\s*$/);
  if (!match) return null;
  return parseInt(devanagariToArabic(match[1]), 10);
}

// A Sanskrit shloka final line:
//   - ends with ॥ N ॥
//   - has NO single-danda (।) inside the main text body (before the ॥)
//   - the verse number is <= the BG chapter's total verse count
function isSanskritShlokaLine(line, maxVerse) {
  const stripped = line.trim();
  const num = extractVerseNumber(stripped);
  if (num === null) return false;
  if (num < 1 || num > maxVerse) return false;

  // Find the position of the final ॥ ... ॥ marker
  const markerStart = stripped.lastIndexOf('॥');
  // Find first ॥ from end — find both dandas
  const beforeMarker = stripped.substring(0, stripped.indexOf('॥'));

  // A Marathi ovi ending with ॥ N ॥ will have internal । separators
  // A Sanskrit shloka will NOT have । in the middle of the text
  if (beforeMarker.includes('।')) return false;

  // Also check: Sanskrit shlokas tend to be on their own line (indented or not)
  // Extra check: line starts with non-breaking space (indented chapters 1-10)
  // or line has no । at all (chapters 11-18 format)
  return true;
}

// Detect a speaker/uvaca header line
function isUvachaLine(line) {
  return line.trim().includes('उवाच');
}

// Parse a chapter text into verseMappings
function parseChapter(text, chapterNum) {
  const maxVerse = BG_VERSE_COUNTS[chapterNum];
  const lines = text.split('\n');

  const verseMappings = [];
  let currentGitaVerse = null;
  let currentOvis = [];
  let currentOviStart = null;
  let lastOviNumber = 0;
  let pendingSanskritLines = []; // collect multi-line shloka

  function saveCurrentVerseMapping() {
    if (currentGitaVerse !== null && currentOvis.length > 0) {
      verseMappings.push({
        bookNumber: 1,
        chapterNumber: chapterNum,
        verseNumber: currentGitaVerse,
        verseId: `1.${chapterNum}.${currentGitaVerse}`,
        oviStart: currentOviStart,
        oviEnd: currentOvis[currentOvis.length - 1].oviNumber,
        ovis: currentOvis.slice(),
      });
    }
    currentGitaVerse = null;
    currentOvis = [];
    currentOviStart = null;
  }

  // We process line by line
  // A Sanskrit shloka block looks like:
  //   [speaker uvaca line]
  //   [shloka line 1 — no danda, no verse number]
  //   [shloka line 2 — no danda, ends with ॥ N ॥]    <- this triggers the new verse
  //
  // A Marathi ovi looks like:
  //   [ovi line 1 — has दंड separators]
  //   [ovi line 2 — has दंड separators, ends with ॥ N ॥]

  // Strategy: scan for lines ending with ॥ N ॥
  // If no internal दंड → it's a Sanskrit verse marker
  // If has internal दंड → it's a Marathi ovi

  // We also need multi-line ovis: lines without ॥ that precede an ovi-ending line
  let pendingOviText = '';

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const stripped = raw.trim();

    if (!stripped) {
      pendingOviText = '';
      continue;
    }

    // Skip uvaca headers
    if (isUvachaLine(stripped)) {
      pendingOviText = '';
      continue;
    }

    // Check if this line ends with ॥ N ॥
    const verseNum = extractVerseNumber(stripped);

    if (verseNum !== null) {
      // Determine if Sanskrit or Marathi
      const hasInternalDanda = (() => {
        const beforeMarker = stripped.substring(0, stripped.indexOf('॥'));
        return beforeMarker.includes('।');
      })();

      const isIndented = raw.startsWith('\xa0') || raw.startsWith('    ');

      if (!hasInternalDanda && (isIndented || verseNum <= maxVerse)) {
        // Sanskrit shloka — this number is a Gita verse number
        if (verseNum >= 1 && verseNum <= maxVerse) {
          saveCurrentVerseMapping();
          currentGitaVerse = verseNum;
          currentOvis = [];
          currentOviStart = null;
        }
        pendingOviText = '';
      } else {
        // Marathi ovi
        const fullText = pendingOviText
          ? (pendingOviText + ' ' + stripped).trim()
          : stripped;

        if (currentGitaVerse !== null) {
          lastOviNumber = verseNum;
          if (currentOviStart === null) currentOviStart = verseNum;
          currentOvis.push({ oviNumber: verseNum, text: fullText });
        }
        pendingOviText = '';
      }
    } else {
      // No ॥ N ॥ — could be continuation line of an ovi or Sanskrit shloka line 1
      // Accumulate for the next line that closes with ॥ N ॥
      if (pendingOviText) {
        pendingOviText = pendingOviText + ' ' + stripped;
      } else {
        pendingOviText = stripped;
      }
    }
  }

  // Save last verse
  saveCurrentVerseMapping();

  // Calculate lastOviNumber from all verse mappings
  let totalOvis = 0;
  for (const vm of verseMappings) {
    if (vm.ovis.length > 0) {
      const last = vm.ovis[vm.ovis.length - 1].oviNumber;
      if (last > totalOvis) totalOvis = last;
    }
  }

  return {
    verseMappings,
    totalOvis,
    totalGitaVerses: verseMappings.length,
  };
}

async function processChapter(chapterNum) {
  const url = `https://raw.githubusercontent.com/cltk/marathi_text_wikisource/master/datasets/dnyaneshwari/adhyay${chapterNum}.txt`;
  const text = await fetchText(url);
  return parseChapter(text, chapterNum);
}

async function run() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const issues = [];
  const chapterResults = [];

  console.log('=== Job 3: Dnyaneshwari → S3 ===');
  console.log(`Timestamp: ${timestamp}`);
  console.log(`Bucket: ${BUCKET}\n`);

  let totalOvisAll = 0;

  for (let ch = 1; ch <= 18; ch++) {
    const bgExpected = BG_VERSE_COUNTS[ch];
    process.stdout.write(`ch${ch} (expect ${bgExpected} BG verses)... `);

    let result;
    try {
      result = await processChapter(ch);
    } catch (e) {
      console.log(`FETCH FAIL: ${e.message}`);
      issues.push(`ch${ch}: fetch failed — ${e.message}`);
      continue;
    }

    const { verseMappings, totalOvis, totalGitaVerses } = result;
    totalOvisAll += totalOvis;

    // Chapter 1 is Mangalacharana — validate lightly
    const isInvocation = ch === 1;

    if (!isInvocation) {
      if (totalGitaVerses === 0) {
        issues.push(`ch${ch}: no BG verse mappings found`);
      } else if (bgExpected && totalGitaVerses < bgExpected * 0.8) {
        issues.push(`ch${ch}: only ${totalGitaVerses}/${bgExpected} BG verses mapped (< 80%)`);
      }
      for (const vm of verseMappings) {
        if (vm.ovis.length === 0) {
          issues.push(`ch${ch}: verse ${vm.verseNumber} has no ovis`);
        }
      }
    }

    const chapterJson = {
      meta: {
        bookNumber: 1,
        bookSlug: 'bhagavat-gita',
        sourceText: 'dnyaneshwari',
        translatorSlug: 'dnyaneshwar',
        commentaryType: 'poetic_expansion',
        language: 'mr',
        chapterNumber: ch,
        totalOvis,
        totalGitaVerses,
        isInvocation,
        source: 'cltk/marathi_text_wikisource (CC0)',
        generatedAt: timestamp,
      },
      verseMappings: isInvocation ? [] : verseMappings,
    };

    const s3Key = `json/dnyaneshwari/mr/ch-${ch}.json`;
    try {
      await s3Put(s3Key, chapterJson);
      console.log(`OK | ovis:${totalOvis} | mapped:${totalGitaVerses}/${bgExpected}`);
    } catch (e) {
      console.log(`S3 FAIL: ${e.message}`);
      issues.push(`ch${ch}: S3 upload failed — ${e.message}`);
    }

    chapterResults.push({
      chapterNumber: ch,
      totalOvis,
      totalGitaVerses,
      expectedGitaVerses: bgExpected,
      isInvocation,
    });
  }

  // Verify sample
  process.stdout.write('\nVerifying s3://sanatan-db/json/dnyaneshwari/mr/ch-2.json ... ');
  try {
    const head = await s3Head('json/dnyaneshwari/mr/ch-2.json');
    console.log(`OK (${head.ContentLength} bytes)`);
  } catch (e) {
    console.log(`FAIL: ${e.message}`);
    issues.push(`verify ch-2: ${e.message}`);
  }

  // Save report
  const reportKey = `json/reports/job3-dnyaneshwari-${timestamp.replace(/[:.]/g, '-')}.json`;
  const report = {
    job: 'job3-dnyaneshwari',
    status: issues.length === 0 ? 'PASS' : 'PARTIAL',
    timestamp,
    elapsedSeconds: ((Date.now() - startTime) / 1000).toFixed(2),
    totalOvisAll,
    issues,
    chapterResults,
  };

  await s3Put(reportKey, report);
  console.log(`Report: ${reportKey}`);

  console.log('\n=== Summary ===');
  console.log(`Status:     ${report.status}`);
  console.log(`Total ovis: ${totalOvisAll}`);
  console.log(`Issues:     ${issues.length || 'none'}`);
  if (issues.length > 0) issues.forEach(i => console.log(`  ! ${i}`));
  console.log('===============');
}

run().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
