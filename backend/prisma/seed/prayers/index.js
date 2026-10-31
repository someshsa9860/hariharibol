// The prayers (stotras, aartis and prayers) from public/prayers/json, put in the database as DRAFT rows.
//
//   npm run seed:prayers
//
// Each file was copied from kksongs.org or Wikisource by scripts/fetch-prayers.js; public/prayers/PRAYERS.md says where
// each one came from and what is still wanted. Every prayer goes in as a DRAFT: nothing is shown or translated until an
// admin publishes it, because no text here has been read by someone who reads the script.
//
// Safe to run again: a prayer whose slug is already in the database is left alone, verses and all, so an admin's edits
// are never overwritten. A new file adds a prayer; a changed file changes nothing that is already there.

import fs from 'node:fs';
import path from 'node:path';
import { CATEGORY_IDS, ORIGINAL_LANGUAGES, prayer as prayerConfig } from '../../../config/prayer.js';

const JSON_DIR = path.join(import.meta.dirname, '..', '..', '..', 'public', 'prayers', 'json');

const LIMITS = { title: 200, summary: 400, reference: 200, author: 200, sourceName: 200, sourceUrl: 500 };
const HIDDEN_NAME = /prabhup/i;

/** The prayer files, in the order they are listed in the index. The index itself is not a prayer. */
export function readPrayerFiles() {
  return fs
    .readdirSync(JSON_DIR)
    .filter((file) => file.endsWith('.json') && file !== '_index.json')
    .sort()
    .map((file) => JSON.parse(fs.readFileSync(path.join(JSON_DIR, file), 'utf8')));
}

/** What is wrong with a list of prayers, as plain sentences. An empty list is a clean one. */
export function checkPrayers(prayers) {
  const problems = [];
  const seen = new Set();

  for (const prayer of prayers) {
    const at = prayer.slug || '(no slug)';
    const bad = (why) => problems.push(`${at}: ${why}`);

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(prayer.slug || '')) bad('the slug must be lower-case words joined by hyphens');
    if (seen.has(prayer.slug)) bad('the slug is used twice');
    seen.add(prayer.slug);

    if (!CATEGORY_IDS.includes(prayer.category)) bad(`unknown category "${prayer.category}"`);
    if (!ORIGINAL_LANGUAGES.includes(prayer.originalLanguage)) bad(`unknown original language "${prayer.originalLanguage}"`);
    if (typeof prayer.title !== 'string' || prayer.title.trim() === '') bad('title is empty');

    for (const [field, max] of Object.entries(LIMITS)) {
      const value = prayer[field];
      if (value == null) continue;
      if (typeof value !== 'string') bad(`${field} is not text`);
      else if (value.length > max) bad(`${field} is ${value.length} characters (at most ${max})`);
    }

    for (const field of ['title', 'summary', 'about', 'author', 'reference', 'sourceName']) {
      if (typeof prayer[field] === 'string' && HIDDEN_NAME.test(prayer[field])) {
        bad(`${field} names the author of the books we cite, whose name the app does not show yet`);
      }
    }

    if (prayer.sourceUrl != null && !/^https:\/\/\S+$/.test(prayer.sourceUrl)) bad('sourceUrl must be an https link');

    if (!Array.isArray(prayer.verses) || prayer.verses.length === 0) bad('has no verses');
    else if (prayer.verses.length > prayerConfig.maxVerses) bad(`has ${prayer.verses.length} verses (at most ${prayerConfig.maxVerses})`);
    else {
      prayer.verses.forEach((verse, index) => {
        if (verse.position !== index + 1) bad(`verse at place ${index + 1} is numbered ${verse.position}`);
        if (typeof verse.text !== 'string' || verse.text.trim() === '') bad(`verse ${index + 1} has no text`);
        if (verse.meaning != null) bad(`verse ${index + 1} has a meaning; meanings are written by a person or a run, not seeded`);
      });
    }
  }

  return problems;
}

/** The prayer row for one file. Its Roman and its Devanagari copies, where the file has them, are kept as renderings. */
function prayerData(file, seededAt) {
  return {
    slug: file.slug,
    category: file.category,
    sortOrder: file.sortOrder ?? 0,
    originalLanguage: file.originalLanguage,
    title: file.title,
    summary: file.summary ?? null,
    about: file.about ?? null,
    author: file.author ?? null,
    reference: file.reference ?? null,
    sourceName: file.sourceName ?? null,
    sourceUrl: file.sourceUrl ?? null,
    status: 'DRAFT',
    verses: {
      create: file.verses.map((verse) => verseData(verse, seededAt)),
    },
  };
}

/**
 * One verse. The original is `text`. A Roman rendering is kept as the 'en' rendering, and a Devanagari copy (a Bengali
 * song's, read beside the Bengali) as the 'hi' rendering: no rule can make either one, so they are stored. Each is
 * stamped with the seed time so it is not stale against the verse it was made with.
 */
function verseData(verse, seededAt) {
  const renderings = [];
  if (verse.roman) renderings.push({ languageCode: 'en', text: verse.roman, renderedAt: seededAt });
  if (verse.devanagari && verse.devanagari !== verse.text) renderings.push({ languageCode: 'hi', text: verse.devanagari, renderedAt: seededAt });

  return {
    position: verse.position,
    text: verse.text,
    meaning: null,
    textChangedAt: seededAt,
    translations: renderings.length > 0 ? { create: renderings } : undefined,
  };
}

/**
 * Puts the prayers in the database. A prayer whose slug is already there is counted and left as it is.
 * @returns {{ created: number, kept: number, verses: number }}
 */
export async function seedPrayers(prisma) {
  const prayers = readPrayerFiles();
  const problems = checkPrayers(prayers);
  if (problems.length) throw new Error(`The prayer seed has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);

  const result = { created: 0, kept: 0, verses: 0 };
  const seededAt = new Date();

  for (const file of prayers) {
    const existing = await prisma.prayer.findUnique({ where: { slug: file.slug }, select: { id: true } });
    if (existing) {
      result.kept += 1;
      continue;
    }
    await prisma.prayer.create({ data: prayerData(file, seededAt) });
    result.created += 1;
    result.verses += file.verses.length;
  }

  return result;
}
