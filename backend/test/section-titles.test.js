// The seeded titles of the books, cantos and Gita chapters
// (prisma/seed/section-titles/): every reading language is covered, every list
// is as long as the book it names, and each string is written in its own
// language's script. No database — it reads the seed data.
//
//   npm test
//
// This stops the mechanical failures: a language left out, a canto list one
// short, Latin text pasted into a Tamil title, Bengali র in an Assamese file.
// It cannot say whether a title is *good* — they are AI-drafted and not yet read
// by a native speaker (see section-titles/index.js).

import test from 'node:test';
import assert from 'node:assert/strict';

import { languages, books, cantos } from '../prisma/seed/data.js';
import {
  sectionTitles,
  bookTitles,
  cantoTitles,
  chapterTitles,
  booksWithChapterTitles,
  fillMissing,
} from '../prisma/seed/section-titles/index.js';

// The Unicode block each language is written in (the same table as
// mantra-translations.test.js — a new reading language needs a line in both).
const BLOCKS = {
  hi: [0x0900, 0x097f],
  mr: [0x0900, 0x097f],
  gu: [0x0a80, 0x0aff],
  bn: [0x0980, 0x09ff],
  as: [0x0980, 0x09ff],
  ta: [0x0b80, 0x0bff],
  te: [0x0c00, 0x0c7f],
  kn: [0x0c80, 0x0cff],
  or: [0x0b00, 0x0b7f],
  pa: [0x0a00, 0x0a7f],
  ml: [0x0d00, 0x0d7f],
};

// Spaces, ASCII digits and punctuation, and the danda every one of these scripts shares.
const NEUTRAL = /^[0-9 ,;:.!?()'"\-—‘’“”।]$/u;

const GITA = 'bhagavad-gita';
const BHAGAVATAM = 'srimad-bhagavatam';
const GITA_CHAPTERS = 18;

/** Every character of `text` that does not belong in a `code` string. */
function strays(text, code) {
  const [from, to] = BLOCKS[code];
  return [...text].filter((ch) => {
    const point = ch.codePointAt(0);
    if (point >= from && point <= to) return /\p{Nd}/u.test(ch);
    return !NEUTRAL.test(ch);
  });
}

/** Every title in a language file, with where it is, so a failure names the culprit. */
function titlesOf(file) {
  return [
    ...Object.entries(file.books).map(([slug, title]) => [`books.${slug}`, title]),
    ...Object.entries(file.cantos).flatMap(([slug, list]) => list.map((title, i) => [`cantos.${slug}[${i + 1}]`, title])),
    ...Object.entries(file.chapters).flatMap(([slug, list]) => list.map((title, i) => [`chapters.${slug}[${i + 1}]`, title])),
  ];
}

test('every reading language except English has a file, and no other does', () => {
  const wanted = languages
    .filter((l) => l.isReadingLanguage !== false && l.code !== 'en')
    .map((l) => l.code)
    .sort();

  assert.deepEqual(Object.keys(sectionTitles).sort(), wanted, 'section-titles/index.js must export exactly the reading languages other than en');
  assert.deepEqual(Object.keys(BLOCKS).sort(), wanted, 'BLOCKS in this test is missing a language');
});

test('the books named in the files are real books, and the lists are as long as the books are', () => {
  const slugs = new Set(books.map((b) => b.slug));
  assert.ok(slugs.has(GITA) && slugs.has(BHAGAVATAM));

  for (const [code, file] of Object.entries(sectionTitles)) {
    assert.deepEqual(Object.keys(file).sort(), ['books', 'cantos', 'chapters'], `${code}: top-level keys`);
    assert.deepEqual(Object.keys(file.books).sort(), [BHAGAVATAM, GITA].sort(), `${code}: books`);
    assert.deepEqual(Object.keys(file.cantos), [BHAGAVATAM], `${code}: cantos are the Bhagavatam's`);
    assert.deepEqual(Object.keys(file.chapters), [GITA], `${code}: chapters are the Gita's`);
    assert.equal(file.cantos[BHAGAVATAM].length, cantos.length, `${code}: canto count`);
    assert.equal(file.chapters[GITA].length, GITA_CHAPTERS, `${code}: Gita chapter count`);
  }
});

for (const [code, file] of Object.entries(sectionTitles)) {
  test(`${code}: every title is written, in the language's own script`, () => {
    for (const [where, title] of titlesOf(file)) {
      assert.equal(typeof title, 'string', where);
      assert.ok(title.trim(), `${where} is empty`);
      assert.equal(title, title.trim(), `${where} has stray spaces around it`);
      assert.deepEqual(strays(title, code), [], `${where} has characters from another script`);
    }
  });

  test(`${code}: titles within a list are all different`, () => {
    for (const list of [...Object.values(file.cantos), ...Object.values(file.chapters)]) {
      assert.equal(new Set(list).size, list.length);
    }
  });
}

test('Assamese uses ৰ and ৱ, never Bengali র', () => {
  for (const [where, title] of titlesOf(sectionTitles.as)) {
    assert.ok(!title.includes('র'), `as ${where} has Bengali র (U+09B0)`);
  }
});

test('Bengali has no Assamese ৰ or ৱ', () => {
  for (const [where, title] of titlesOf(sectionTitles.bn)) {
    assert.ok(!/[ৰৱ]/u.test(title), `bn ${where} has an Assamese letter`);
  }
});

test('lookups return the right title for each language', () => {
  assert.equal(bookTitles(GITA).hi, 'भगवद्गीता');
  assert.equal(Object.keys(bookTitles(GITA)).length, 11);
  assert.equal(cantoTitles(BHAGAVATAM, 1).hi, 'सृष्टि');
  assert.equal(cantoTitles(BHAGAVATAM, 12).hi, 'पतन का युग');
  assert.equal(chapterTitles(GITA, 1).hi, 'अर्जुनविषादयोग');
  assert.equal(chapterTitles(GITA, 18).hi, 'मोक्षसंन्यासयोग');
  assert.equal(chapterTitles(GITA, 19).hi, undefined, 'there is no chapter 19');
  assert.deepEqual(cantoTitles(BHAGAVATAM, 13), {});
  assert.deepEqual(chapterTitles('srimad-bhagavatam', 1), {}, 'the Bhagavatam chapters are seeded by canto, in bhagavatam/');
  assert.deepEqual(booksWithChapterTitles(), [GITA]);
});

test('fillMissing adds only the languages a title lacks', () => {
  const wanted = { hi: 'हि', mr: 'म', ta: 'த' };

  assert.deepEqual(fillMissing(null, wanted), wanted, 'null becomes the seed');
  assert.deepEqual(fillMissing({}, wanted), wanted);
  assert.deepEqual(fillMissing({ en: 'Karma-yoga' }, wanted), { en: 'Karma-yoga', ...wanted }, 'English is kept');
  assert.deepEqual(
    fillMissing({ hi: 'edited by an admin' }, wanted),
    { hi: 'edited by an admin', mr: 'म', ta: 'த' },
    'an existing title is never replaced',
  );
  assert.deepEqual(fillMissing({ hi: '   ' }, { hi: 'हि' }), { hi: 'हि' }, 'a blank one counts as missing');
  assert.equal(fillMissing({ hi: 'x', mr: 'y', ta: 'z' }, wanted), null, 'nothing to add, nothing to write');
  assert.equal(fillMissing({ hi: 'x' }, {}), null);
});

test('fillMissing copes with a title column that is not an object', () => {
  assert.deepEqual(fillMissing([], { hi: 'हि' }), { hi: 'हि' });
  assert.deepEqual(fillMissing('oops', { hi: 'हि' }), { hi: 'हि' });
});
