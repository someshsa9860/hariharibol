// Walks the import of translated chapters into the database, against the real Postgres:
//
//   npm run test:translation-import
//
// It needs the database and the seeded `prabhupada` translator, nothing else — no API, no worker and no AWS.
// (The service module opens its Redis connections when it is imported, for the queue and the live events of a
// queued run; this script only calls `importLanguage`, which uses none of it. The queued run itself — the
// row, the job, the worker, cancel — is walked in `npm run test:translation`, section 12.)
// It builds its own little book (three chapters, twelve verses, one of them a compound 3–4) with a decoy
// book beside it, and a throwaway folder of chapter files laid out like the bucket
// (json/<book>/<language>/ch-N.json), so it does not depend on what has been imported, never touches the
// real Gita or the real bucket, and deletes all of it again.
//
// What it is checking is the part that fails quietly:
//   - everything in the file arrives: translation, purport, transliteration and word-by-word meanings;
//   - an import REPLACES a row in place, so a row's id and createdAt never change however often the file
//     changes — even when the database already holds the same version, even after a hand edit;
//   - the verse is found by its place in the book and the file's numbers must agree, so a mis-numbered entry
//     is reported instead of overwriting another verse, and a verse of another book is never reached;
//   - nothing else moves: other translators, other languages, the English, the verse's own columns;
//   - visibility is a decision (hidden unless `publish`, never lowered), a dry run writes nothing, importing
//     twice changes nothing, and a chapter that cannot be written changes nothing while the others carry on.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import { importLanguage, importStatus } from '../services/translation-import.js';
import { buildEntry } from './lib/claude-translate-run.js';
import { dirStore, langChapterKey } from './lib/claude-translate-store.js';

const STAMP = Date.now();
const BOOK_NUMBER = 9_000_000 + (STAMP % 900_000);
const DECOY_NUMBER = 9_900_000 + (STAMP % 90_000);
const FOLDER = `e2e-import-${STAMP}`; // json/<FOLDER>/<language>/ch-N.json — a book of its own, not the Gita's folder
const V1 = 'e2e-v1';
const V2 = 'e2e-v2';
const vid = (chapter, verse) => `${BOOK_NUMBER}.${chapter}.${verse}`;
const DECOY_VERSE_ID = `${DECOY_NUMBER}.1.1`;

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}

const section = (title) => console.log(`\n${title}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------- what a file holds ---------- */

// What Claude's answer for a verse looks like; `mark` makes each copy tell apart from the others.
const answer = (mark, over = {}) => ({
  translation: `अनुवाद ${mark}`,
  purport: [`तात्पर्य ${mark} पहला`, `तात्पर्य ${mark} दूसरा`],
  transliteration: [`लिप्यंतरण ${mark} पहली पंक्ति`, `लिप्यंतरण ${mark} दूसरी`],
  wordMeanings: [
    { word: `शब्द-${mark}-१`, meaning: `अर्थ ${mark} १` },
    { word: `शब्द-${mark}-२`, meaning: `अर्थ ${mark} २` },
  ],
  ...over,
});
const BARE = { purport: [], transliteration: [], wordMeanings: [] };

// One verse as the pipeline saves it (the real `buildEntry`, so the importer is held to the real format).
// `unit` overrides what the entry says about where the verse sits.
const entry = (chapter, verse, mark, { version = V1, end = null, language = 'hi', over = {}, unit = {} } = {}) =>
  buildEntry(
    { verseId: vid(chapter, verse), globalVerseNumber: chapter * 100 + verse, bookNumber: BOOK_NUMBER, chapterNumber: chapter, verseNumber: verse, verseNumberEnd: end, cantoNumber: null, ...unit },
    answer(mark, over),
    language,
    { model: 'claude-test', effort: 'off', version, warnings: [], generatedAt: '2026-10-14T00:00:00.000Z', quality: { scores: { translation: 3, purport: 3 }, correctness: 3 } }
  );

const dir = mkdtempSync(join(tmpdir(), 'translation-import-e2e-'));
const store = dirStore(dir);
const pathOf = (language, chapter) => join(dir, langChapterKey(language, chapter, FOLDER));

function writeChapter(language, chapter, verses) {
  mkdirSync(dirname(pathOf(language, chapter)), { recursive: true });
  writeFileSync(pathOf(language, chapter), JSON.stringify({ meta: { language, chapterNumber: chapter }, verses }, null, 2));
}
const readChapter = (language, chapter) => JSON.parse(readFileSync(pathOf(language, chapter), 'utf8')).verses;
const swap = (language, chapter, verse, next) => writeChapter(language, chapter, readChapter(language, chapter).map((e) => (e.verseNumber === verse ? next : e)));

const run = (over = {}) => importLanguage({ language: 'hi', chapters: [1, 2, 3, 4], folder: FOLDER, bookNumber: BOOK_NUMBER, store, ...over });
const lineOf = (result, chapter) => result.chapters.find((c) => c.chapter === chapter);
const show = (value) => JSON.stringify(value);

/* ---------- what the database holds ---------- */

const pairs = (list) => show((list ?? []).map((w) => [w.word, w.meaning])); // jsonb does not keep an object's key order
const joined = (parts) => (parts.length ? parts.join('\n') : null);
// Does the row hold all four parts of `a` (an `answer`)?
const hasAll = (row, a) =>
  row.meaning === a.translation && row.purport === joined(a.purport) && row.transliteration === joined(a.transliteration) && pairs(row.wordMeanings) === pairs(a.wordMeanings);

const snapshot = (rows) => new Map([...rows].map(([key, r]) => [key, { id: r.id, createdAt: r.createdAt.getTime(), updatedAt: r.updatedAt.getTime() }]));
const sameRows = (snap, rows) => [...snap].every(([key, s]) => rows.get(key)?.id === s.id && rows.get(key).createdAt.getTime() === s.createdAt);
const notWritten = (snap, rows, keys) => keys.every((key) => rows.get(key)?.updatedAt.getTime() === snap.get(key).updatedAt);

/** A database NULL — Prisma reads that and a JSON null alike as null, so this asks Postgres. */
async function isDbNull(id) {
  const [row] = await prisma.$queryRaw`SELECT "wordMeanings" IS NULL AS "isNull" FROM "VerseTranslation" WHERE id = ${id}`;
  return row.isNull;
}

async function main() {
  if (env.isProduction) {
    console.error('\nThis script writes rows; it does not run against production.\n');
    process.exit(1);
  }
  const prabhupada = await prisma.translator.findUnique({ where: { slug: 'prabhupada' } });
  if (!prabhupada) {
    console.error('\nNeed the translator "prabhupada". Run `npm run seed` first.\n');
    process.exit(1);
  }
  const seededIssues = await prisma.issue.findMany({
    where: { slug: { in: ['kama', 'krodha', 'lobha', 'mada'] } },
    select: { id: true, slug: true },
  });
  const issueBySlug = new Map(seededIssues.map((issue) => [issue.slug, issue]));
  if (issueBySlug.size !== 4) throw new Error('Need the seeded issues kama, krodha, lobha and mada. Run `npm run seed` first.');

  /** Prabhupāda's TRANSLATION rows in `language` for the book, by verse id. */
  const rowsOf = async (language = 'hi', translatorId = prabhupada.id) => {
    const rows = await prisma.verseTranslation.findMany({
      where: { translatorId, languageCode: language, type: 'TRANSLATION', verse: { bookNumber: BOOK_NUMBER } },
      include: { verse: { select: { verseId: true } } },
    });
    return new Map(rows.map((r) => [r.verse.verseId, r]));
  };
  const issueSlugsOf = async (verseId) => {
    const verse = await prisma.verse.findUnique({ where: { verseId }, select: { id: true } });
    if (!verse) return [];
    const links = await prisma.verseIssue.findMany({
      where: { verseId: verse.id },
      include: { issue: { select: { slug: true } } },
    });
    return links.map((link) => link.issue.slug).sort();
  };

  let book = null;
  let decoy = null;
  let other = null;

  try {
    /* -- the fixture --------------------------------------------------------------------------- */
    book = await prisma.book.create({ data: { bookNumber: BOOK_NUMBER, slug: `e2e-import-book-${STAMP}`, type: 'SCRIPTURE', title: 'E2E Import Book' } });
    const layout = { 1: [1, 2, 3, 4, 5, 6, 7], 2: [1, 2, 3], 3: [1, 2] }; // chapter 2's verse 3 is the compound 3–4
    for (const [chapterText, verses] of Object.entries(layout)) {
      const number = Number(chapterText);
      const chapter = await prisma.chapter.create({ data: { bookId: book.id, number, title: `Chapter ${number}` } });
      for (const n of verses) {
        await prisma.verse.create({
          data: {
            verseId: vid(number, n),
            bookId: book.id,
            bookNumber: BOOK_NUMBER,
            chapterId: chapter.id,
            chapterNumber: number,
            verseNumber: n,
            verseNumberEnd: number === 2 && n === 3 ? 4 : null,
            // The verse's own, language-neutral parts — what an import must never write to.
            sanskrit: `संस्कृत ${vid(number, n)}`,
            transliteration: `roman ${vid(number, n)}`,
            wordMeanings: [{ word: 'english', meaning: `english meaning ${n}` }],
          },
        });
      }
    }

    // A second book with a verse and a Hindi row of Prabhupāda's — the import of the first must never reach it.
    decoy = await prisma.book.create({ data: { bookNumber: DECOY_NUMBER, slug: `e2e-import-decoy-${STAMP}`, type: 'SCRIPTURE', title: 'E2E Import Decoy' } });
    const decoyChapter = await prisma.chapter.create({ data: { bookId: decoy.id, number: 1, title: 'Chapter 1' } });
    const decoyVerse = await prisma.verse.create({ data: { verseId: DECOY_VERSE_ID, bookId: decoy.id, bookNumber: DECOY_NUMBER, chapterId: decoyChapter.id, chapterNumber: 1, verseNumber: 1 } });

    // Rows that belong to nobody's import: another translator's Hindi, Prabhupāda's English, his Hindi
    // commentary, and the decoy's. Made to look like Claude's (translatedBy / version) where that is what
    // could tempt a careless query into counting or replacing them.
    other = await prisma.translator.create({ data: { slug: `e2e-import-other-${STAMP}`, name: 'E2E Other Translator' } });
    const verse11 = await prisma.verse.findUnique({ where: { verseId: vid(1, 1) } });
    const bystanders = [
      await prisma.verseTranslation.create({ data: { verseId: verse11.id, translatorId: other.id, languageCode: 'hi', type: 'TRANSLATION', meaning: 'OTHER TRANSLATOR — hindi', translatedBy: 'claude', version: V1, isPublished: true } }),
      await prisma.verseTranslation.create({ data: { verseId: verse11.id, translatorId: prabhupada.id, languageCode: 'en', type: 'TRANSLATION', meaning: 'PRABHUPADA — english', isPublished: true } }),
      await prisma.verseTranslation.create({ data: { verseId: verse11.id, translatorId: prabhupada.id, languageCode: 'hi', type: 'COMMENTARY', meaning: 'PRABHUPADA — hindi commentary', isPublished: true } }),
      await prisma.verseTranslation.create({ data: { verseId: decoyVerse.id, translatorId: prabhupada.id, languageCode: 'hi', type: 'TRANSLATION', meaning: 'DECOY — must stay as it is', translatedBy: 'claude', version: V1, isPublished: true } }),
    ];
    const readBystanders = async () =>
      (await prisma.verseTranslation.findMany({ where: { id: { in: bystanders.map((b) => b.id) } }, orderBy: { id: 'asc' } })).map((r) =>
        show([r.id, r.languageCode, r.type, r.meaning, r.purport, r.translatedBy, r.version, r.isPublished, r.updatedAt.getTime()])
      );
    const readVerses = async () =>
      (await prisma.verse.findMany({ where: { bookId: book.id }, orderBy: { verseId: 'asc' } })).map((v) =>
        show([v.id, v.verseId, v.sanskrit, v.transliteration, v.wordMeanings, v.updatedAt.getTime()])
      );
    const bystandersBefore = await readBystanders();
    const versesBefore = await readVerses();

    /* -- 1 ------------------------------------------------------------------------------------- */
    section('1. The first import — everything in the file arrives, hidden');
    writeChapter('hi', 1, [entry(1, 1, 'a1'), entry(1, 2, 'a2'), entry(1, 3, 'a3')]);
    writeChapter('hi', 2, [entry(2, 1, 'b1'), entry(2, 2, 'b2', { over: BARE }), entry(2, 3, 'b3', { end: 4 })]);
    const first = await run();
    check('it reads the two chapters that have a file and says the others have none', first.totals.chapters === 2 && lineOf(first, 3).found === false && lineOf(first, 4).found === false, show(first.totals));
    check(
      'six verses in storage, six rows created, nothing else',
      first.totals.inStorage === 6 && first.totals.created === 6 && first.totals.updated === 0 && first.totals.unchanged === 0 && first.totals.missing === 0 && first.totals.conflicts === 0 && first.totals.failedChapters === 0,
      show(first.totals)
    );
    check('the totals say which version made the verses', first.totals.versions[V1] === 6, show(first.totals.versions));

    let rows = await rowsOf();
    check('one row per verse', rows.size === 6, [...rows.keys()].join(' '));
    const a1 = rows.get(vid(1, 1));
    check('the translation (meaning) is stored', a1.meaning === answer('a1').translation);
    check('the purport is stored, its paragraphs kept', a1.purport === joined(answer('a1').purport));
    check('the transliteration — the verse in the language’s own script — is stored', a1.transliteration === joined(answer('a1').transliteration));
    check('the word-by-word meanings are stored, in order', pairs(a1.wordMeanings) === pairs(answer('a1').wordMeanings), show(a1.wordMeanings));
    check('who made it and under which version is stored', a1.translatedBy === 'claude' && a1.version === V1);
    check('a compound verse (3–4) is matched on both its numbers', rows.has(vid(2, 3)) && hasAll(rows.get(vid(2, 3)), answer('b3')));
    const b2 = rows.get(vid(2, 2));
    check('a verse with only a translation arrives with the other parts empty', hasAll(b2, answer('b2', BARE)) && b2.purport === null && b2.transliteration === null);
    check('…and its word list is a database NULL, not a JSON null', (await isDbNull(b2.id)) === true);
    check('every new row is hidden from readers', [...rows.values()].every((r) => r.isPublished === false));
    const born = snapshot(rows); // the id and createdAt each row is born with — they must survive everything below

    /* -- 2 ------------------------------------------------------------------------------------- */
    section('2. Importing the same files again changes nothing');
    const second = await run();
    check('all six are unchanged', second.totals.unchanged === 6 && second.totals.created === 0 && second.totals.updated === 0, show(second.totals));
    rows = await rowsOf();
    check('no row was written: not even updatedAt moved', sameRows(born, rows) && notWritten(born, rows, [...born.keys()]));

    /* -- 3 ------------------------------------------------------------------------------------- */
    section('3. The file changed — the row is replaced in place and its id never changes');
    await prisma.verseTranslation.update({ where: { id: a1.id }, data: { meaning: 'edited by hand in the admin' } }); // same version, different text
    swap('hi', 1, 2, entry(1, 2, 'a2-new')); // every part different, same version
    swap('hi', 1, 3, entry(1, 3, 'a3', { version: V2 })); // same text, made by a newer version
    const before3 = snapshot(await rowsOf());
    await sleep(25);
    const third = await run();
    check(
      'three rows are replaced, three are left alone, none is added',
      third.totals.updated === 3 && third.totals.unchanged === 3 && third.totals.created === 0 && third.totals.conflicts === 0,
      show(third.totals)
    );
    check('rows hidden from readers are not counted as replaced-while-visible', third.totals.replacedVisible === 0);
    rows = await rowsOf();
    check('still exactly one row per verse', rows.size === 6);
    check('every row has the id and createdAt it was born with', sameRows(born, rows));
    check('a row holding the same version, edited by hand, is replaced by what storage says', hasAll(rows.get(vid(1, 1)), answer('a1')), rows.get(vid(1, 1)).meaning);
    check('translation, purport, transliteration and word meanings all replaced; none of the old kept', hasAll(rows.get(vid(1, 2)), answer('a2-new')));
    check('a newer version is recorded on the same row', rows.get(vid(1, 3)).version === V2 && hasAll(rows.get(vid(1, 3)), answer('a3')));
    check('the rows that did not change were not written', notWritten(before3, rows, [vid(2, 1), vid(2, 2), vid(2, 3)]));
    check('the rows that changed were', [vid(1, 1), vid(1, 2), vid(1, 3)].every((key) => rows.get(key).updatedAt.getTime() > before3.get(key).updatedAt));

    /* -- 4 ------------------------------------------------------------------------------------- */
    section('4. A part the file no longer has is cleared');
    swap('hi', 1, 2, entry(1, 2, 'a2-bare', { over: BARE }));
    const fourth = await run();
    check('one row updated', fourth.totals.updated === 1 && fourth.totals.unchanged === 5, show(fourth.totals));
    rows = await rowsOf();
    const a2 = rows.get(vid(1, 2));
    check('translation kept, purport and transliteration NULL', hasAll(a2, answer('a2-bare', BARE)) && a2.purport === null && a2.transliteration === null);
    check('the word list is a database NULL (this is the update path)', (await isDbNull(a2.id)) === true);
    check('the same row', a2.id === born.get(vid(1, 2)).id);

    /* -- 5 ------------------------------------------------------------------------------------- */
    section('5. Who can see it is a decision, and is never lowered');
    const fifth = await run({ publish: true });
    rows = await rowsOf();
    check('publishing raises the visibility of rows that are already there', fifth.totals.updated === 6 && [...rows.values()].every((r) => r.isPublished), show(fifth.totals));
    check('and they are the same rows', sameRows(born, rows));
    swap('hi', 2, 1, entry(2, 1, 'b1-new'));
    const sixth = await run(); // without publish
    rows = await rowsOf();
    check('a changed row that readers can see is counted as replaced while visible', sixth.totals.updated === 1 && sixth.totals.replacedVisible === 1 && sixth.totals.unchanged === 5, show(sixth.totals));
    check('and importing without `publish` does not hide it again', rows.get(vid(2, 1)).isPublished === true && hasAll(rows.get(vid(2, 1)), answer('b1-new')));
    const seventh = await run({ publish: true });
    check('publishing what is already identical and visible writes nothing', seventh.totals.unchanged === 6 && seventh.totals.updated === 0, show(seventh.totals));

    /* -- 6 ------------------------------------------------------------------------------------- */
    section('6. A dry run says what would happen and writes nothing');
    swap('hi', 2, 2, entry(2, 2, 'b2-new'));
    const beforeDry = snapshot(await rowsOf());
    const dry = await run({ dryRun: true });
    rows = await rowsOf();
    check('it reports the one row an import would replace', dry.dryRun === true && dry.totals.updated === 1 && dry.totals.unchanged === 5, show(dry.totals));
    check('and the database is as it was', hasAll(rows.get(vid(2, 2)), answer('b2', BARE)) && notWritten(beforeDry, rows, [...beforeDry.keys()]));

    writeChapter('mr', 1, [entry(1, 1, 'm1', { language: 'mr' }), entry(1, 2, 'm2', { language: 'mr' })]);
    const dryNew = await run({ language: 'mr', dryRun: true });
    check('a dry run of a language never imported reports what it would create', dryNew.totals.created === 2, show(dryNew.totals));
    check('and creates nothing', (await rowsOf('mr')).size === 0);

    const marathi = await run({ language: 'mr', publish: true });
    const marathiRows = await rowsOf('mr');
    check('importing it for real creates the rows — visible, because `publish` was asked for', marathi.totals.created === 2 && marathiRows.size === 2 && [...marathiRows.values()].every((r) => r.isPublished), show(marathi.totals));
    check('Marathi sits beside the Hindi: the Hindi rows were not touched', notWritten(beforeDry, await rowsOf(), [...beforeDry.keys()]));

    const eighth = await run();
    rows = await rowsOf();
    check('the real import then applies the change', eighth.totals.updated === 1 && hasAll(rows.get(vid(2, 2)), answer('b2-new')), show(eighth.totals));
    check('to the same row', rows.get(vid(2, 2)).id === born.get(vid(2, 2)).id);

    /* -- 7 ------------------------------------------------------------------------------------- */
    section('7. An entry that is not the verse the database holds is reported and left alone');
    const purportOnly = entry(1, 5, 'x5');
    purportOnly.commentaries = purportOnly.commentaries.filter((c) => c.type === 'purport');
    const good1 = readChapter('hi', 1);
    writeChapter('hi', 1, [
      ...good1,
      entry(1, 4, 'x4', { unit: { chapterNumber: 2 } }), // says the wrong chapter
      entry(1, 6, 'x6', { unit: { verseNumber: 7 } }), // says the wrong verse
      entry(1, 7, 'x7', { unit: { bookNumber: 1 } }), // says the wrong book
      entry(1, 2, 'dup'), // the same verse twice
      purportOnly, // no translation, a purport alone has nowhere to live
      entry(1, 99, 'x99'), // a verse the book does not have
      { ...entry(1, 1, 'decoy'), verseId: DECOY_VERSE_ID, bookNumber: DECOY_NUMBER }, // a verse of another book
      entry(2, 3, 'x23', { end: 4 }), // chapter 2's verse in chapter 1's file
    ]);
    const good2 = readChapter('hi', 2);
    writeChapter('hi', 2, [good2[0], good2[1], entry(2, 3, 'x23', { end: null })]); // a compound verse that forgets its last number
    const beforeBad = snapshot(await rowsOf());
    const bad = await run();
    const l1 = lineOf(bad, 1);
    const l2 = lineOf(bad, 2);
    const why = (line, id) => line.conflicts.find((c) => c.verseId === id)?.reason ?? '';
    check('chapter 1: the three good verses are still handled, as unchanged', l1.unchanged === 3 && l1.created === 0 && l1.updated === 0, show({ unchanged: l1.unchanged, created: l1.created, updated: l1.updated }));
    check('a wrong chapter number is a conflict that says so', /chapter is 2 in the file but 1 in the database/.test(why(l1, vid(1, 4))), why(l1, vid(1, 4)));
    check('a wrong verse number is a conflict that says so', /verse is 7 in the file but 6 in the database/.test(why(l1, vid(1, 6))), why(l1, vid(1, 6)));
    check('a wrong book number is a conflict that says so', new RegExp(`book is 1 in the file but ${BOOK_NUMBER} in the database`).test(why(l1, vid(1, 7))), why(l1, vid(1, 7)));
    check('a verse that appears twice is a conflict, and the first copy is the one used', /twice/.test(why(l1, vid(1, 2))));
    check('a verse in another chapter’s file is a conflict', /file for chapter 1 but says chapter 2/.test(why(l1, vid(2, 3))), why(l1, vid(2, 3)));
    check('five conflicts in chapter 1', l1.conflicts.length === 5, l1.conflicts.map((c) => c.verseId).join(' '));
    check('a verse the book does not have, and another book’s verse, are missing — not written anywhere', l1.missing.length === 2 && l1.missing.includes(vid(1, 99)) && l1.missing.includes(DECOY_VERSE_ID), l1.missing.join(' '));
    check('a purport with no translation is counted as such', l1.noTranslation === 1);
    check('chapter 2: a compound verse that forgets its last number is a conflict', l2.conflicts.length === 1 && /last verse is empty in the file but 4 in the database/.test(why(l2, vid(2, 3))), why(l2, vid(2, 3)));
    check('and the others in the chapter are unchanged', l2.unchanged === 2);
    rows = await rowsOf();
    check('no row appeared for any of the refused verses', rows.size === 6 && [4, 5, 6, 7, 99].every((n) => !rows.has(vid(1, n))));
    check('the first copy of the repeated verse kept its text', hasAll(rows.get(vid(1, 2)), answer('a2-bare', BARE)));
    check('the compound verse kept its text', hasAll(rows.get(vid(2, 3)), answer('b3')));
    check('nothing was written at all', notWritten(beforeBad, rows, [...beforeBad.keys()]));

    /* -- 8 ------------------------------------------------------------------------------------- */
    section('8. A chapter that cannot be written changes nothing, and the others carry on');
    writeChapter('hi', 1, [entry(1, 1, 'a1'), entry(1, 2, 'a2-bare', { over: BARE }), entry(1, 3, 'a3', { version: V2 })]);
    writeChapter('hi', 2, [entry(2, 1, 'b1-new'), entry(2, 2, 'b2-new'), entry(2, 3, 'b3', { end: 4 })]);
    writeChapter('hi', 3, [entry(3, 1, 'c1'), entry(3, 2, 'c2')]);
    const chapter3 = await run({ chapters: [3] });
    check('chapter 3 is imported', chapter3.totals.created === 2, show(chapter3.totals));
    rows = await rowsOf();
    const c1Id = rows.get(vid(3, 1)).id;

    swap('hi', 1, 3, entry(1, 3, 'a3-new', { version: V2 })); // a real change in chapter 1
    swap('hi', 3, 1, entry(3, 1, 'c1-new')); // a real change in chapter 3…
    swap('hi', 3, 2, entry(3, 2, 'c2-new', { over: { translation: 'अनुवाद \u0000 NUL' } })); // …beside one Postgres refuses to store
    mkdirSync(dirname(pathOf('hi', 4)), { recursive: true });
    writeFileSync(pathOf('hi', 4), '{ this is not json');
    const broken = await run();
    const broken3 = lineOf(broken, 3);
    const broken4 = lineOf(broken, 4);
    check('chapter 1 was imported anyway', lineOf(broken, 1).updated === 1 && !lineOf(broken, 1).error, show(lineOf(broken, 1)));
    check('chapter 2 was checked anyway', lineOf(broken, 2).unchanged === 3 && !lineOf(broken, 2).error);
    check('chapter 3 failed and says why, in a sentence', /^The database refused it: .*0x00/.test(broken3.error ?? ''), String(broken3.error).slice(0, 160));
    check('and says it wrote nothing', broken3.created === 0 && broken3.updated === 0 && broken3.replacedVisible === 0, show({ created: broken3.created, updated: broken3.updated }));
    check('a file that is not JSON fails its chapter, not the import, and names the file', new RegExp(`^Could not read json/${FOLDER}/hi/ch-4\\.json: `).test(broken4.error ?? ''), String(broken4.error).slice(0, 160));
    check('the totals count both failures and only what was written', broken.totals.failedChapters === 2 && broken.totals.updated === 1 && broken.totals.created === 0, show(broken.totals));
    rows = await rowsOf();
    check('chapter 1’s change is in the database', hasAll(rows.get(vid(1, 3)), answer('a3-new')));
    check('chapter 3 is as it was: the good verse was rolled back with the bad one', hasAll(rows.get(vid(3, 1)), answer('c1')) && hasAll(rows.get(vid(3, 2)), answer('c2')));
    check('and it is still the same row', rows.get(vid(3, 1)).id === c1Id);

    /* -- 9 ------------------------------------------------------------------------------------- */
    section('9. Two imports at once make each row once');
    writeChapter('ta', 1, [entry(1, 1, 't1', { language: 'ta' }), entry(1, 2, 't2', { language: 'ta' }), entry(1, 3, 't3', { language: 'ta' })]);
    writeChapter('ta', 2, [entry(2, 1, 't4', { language: 'ta' }), entry(2, 2, 't5', { language: 'ta' })]);
    const [x, y] = await Promise.all([run({ language: 'ta' }), run({ language: 'ta' })]);
    check('neither fails', ![...x.chapters, ...y.chapters].some((c) => c.error), [...x.chapters, ...y.chapters].map((c) => c.error).filter(Boolean).join(' | '));
    check('between them they created five rows, and there are five', x.totals.created + y.totals.created === 5 && (await rowsOf('ta')).size === 5, `${x.totals.created} + ${y.totals.created}`);

    /* -- 10 ------------------------------------------------------------------------------------ */
    section('10. What the page shows about the database');
    const status = await importStatus({ version: V2, bookNumber: BOOK_NUMBER });
    const hindi = [...(await rowsOf('hi')).values()];
    const hi = status.languages.find((l) => l.code === 'hi');
    check('it lists the languages that hold Claude’s rows for this book', ['hi', 'mr', 'ta'].every((code) => status.languages.some((l) => l.code === code)) && status.languages.length === 3, status.languages.map((l) => l.code).join(' '));
    check('it counts the rows — not another translator’s, not the English, not the decoy book’s', hi.rows === hindi.length, `${hi.rows} vs ${hindi.length}`);
    check('it counts those made under the version asked about', hi.current === hindi.filter((r) => r.version === V2).length, `${hi.current}`);
    check('and those readers can see', hi.published === hindi.filter((r) => r.isPublished).length, `${hi.published}`);
    check('and says when one last changed', hi.updatedAt === new Date(Math.max(...hindi.map((r) => r.updatedAt.getTime()))).toISOString(), hi.updatedAt);

    const missingBook = await importLanguage({ language: 'hi', chapters: [1], folder: FOLDER, bookNumber: 8_999_999, store }).then(() => null, (err) => err);
    check('importing into a book that is not in the database is refused with a clear 422', missingBook?.status === 422 && /not in the database/.test(missingBook.message), missingBook?.message);

    /* -- 11 ------------------------------------------------------------------------------------ */
    section('11. Nothing else moved');
    check('another translator’s Hindi, Prabhupāda’s English, his Hindi commentary and the decoy book’s row are exactly as they were', show(await readBystanders()) === show(bystandersBefore));
    check('no verse was added, removed or edited — ids, text, transliteration, word meanings and updatedAt as they were', show(await readVerses()) === show(versesBefore));
    rows = await rowsOf();
    check('every row born in step 1 still has the id and createdAt it was born with', sameRows(born, rows));
    check('and the book still holds one row per verse that was ever imported: eight', rows.size === 8, `${rows.size}`);

    /* -- issues -------------------------------------------------------------------------------- */
    section('12. Marathi Bhagavatam issue links are imported only when a verse has none');
    const prelinkedVerse = await prisma.verse.findUnique({ where: { verseId: vid(1, 1) }, select: { id: true } });
    await prisma.verseIssue.create({
      data: { verseId: prelinkedVerse.id, issueId: issueBySlug.get('krodha').id, weight: 17 },
    });
    writeChapter('mr', 1, [
      entry(1, 1, 'mr1', { language: 'mr', over: { issues: ['kama', 'krodha'] } }),
      entry(1, 2, 'mr2', { language: 'mr', over: { issues: ['lobha', 'unknown'] } }),
      entry(1, 3, 'mr3', { language: 'mr', over: { issues: ['unknown'] } }),
    ]);
    const marathiBhagavatam = await run({ language: 'mr', book: 'srimad-bhagavatam', chapters: [1] });
    check('the Marathi Bhagavatam file imports without a chapter error', !lineOf(marathiBhagavatam, 1).error, lineOf(marathiBhagavatam, 1).error);
    check('the report counts one new issue link and one verse skipped', marathiBhagavatam.totals.issueLinksCreated === 1 && marathiBhagavatam.totals.issueVersesSkipped === 1, show(marathiBhagavatam.totals));
    check('a verse that already had any issue link is left exactly as it was', show(await issueSlugsOf(vid(1, 1))) === show(['krodha']), show(await issueSlugsOf(vid(1, 1))));
    check('a previously unlinked verse receives its known issue and ignores an unknown slug', show(await issueSlugsOf(vid(1, 2))) === show(['lobha']), show(await issueSlugsOf(vid(1, 2))));
    check('unknown issue slugs alone do not create links', (await issueSlugsOf(vid(1, 3))).length === 0);

    writeChapter('hi', 1, [entry(1, 3, 'hi3', { over: { issues: ['mada'] } })]);
    await run({ language: 'hi', book: 'srimad-bhagavatam', chapters: [1] });
    check('Hindi imports never create issue links', (await issueSlugsOf(vid(1, 3))).length === 0);

    writeChapter('mr', 1, [entry(1, 3, 'gita-mr3', { language: 'mr', over: { issues: ['mada'] } })]);
    await run({ language: 'mr', chapters: [1] });
    check('Marathi Gita imports never create issue links', (await issueSlugsOf(vid(1, 3))).length === 0);

    writeChapter('mr', 3, [
      entry(3, 1, 'mr-good', { language: 'mr', over: { issues: ['mada'] } }),
      entry(3, 2, 'mr-bad', { language: 'mr', over: { issues: ['kama'], translation: 'अनुवाद \u0000 NUL' } }),
    ]);
    const failedMarathiChapter = await run({ language: 'mr', book: 'srimad-bhagavatam', chapters: [3] });
    check('a failed Marathi chapter reports its database error', /^The database refused it:/.test(lineOf(failedMarathiChapter, 3).error ?? ''));
    check('a failed Marathi chapter rolls back every new issue link', (await issueSlugsOf(vid(3, 1))).length === 0 && (await issueSlugsOf(vid(3, 2))).length === 0);
    check('the failed chapter reports no links written or skips', failedMarathiChapter.totals.issueLinksCreated === 0 && failedMarathiChapter.totals.issueVersesSkipped === 0);
    const marathiRowsAfterFailure = await rowsOf('mr');
    check('the same failure also rolls back its translation rows', !marathiRowsAfterFailure.has(vid(3, 1)) && !marathiRowsAfterFailure.has(vid(3, 2)));
  } finally {
    // Cascades take the chapters, verses and their translations with them.
    if (book) await prisma.book.delete({ where: { id: book.id } });
    if (decoy) await prisma.book.delete({ where: { id: decoy.id } });
    if (other) await prisma.translator.delete({ where: { id: other.id } });
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  rmSync(dir, { recursive: true, force: true });
  await prisma.$disconnect();
  process.exit(1);
});
