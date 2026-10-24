// What importing a translated chapter decides: how a verse in the file becomes the columns of a translation row,
// whether it is the verse the database holds, and what differs from the row already there. Pure functions — no
// database, no storage. The database side (ids kept, rows replaced in place) is `npm run test:translation-import`.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildEntry } from '../scripts/lib/claude-translate-run.js';
import {
  IMPORT_KINDS, LIVE_IMPORT_STATUSES, changedColumns, cleanWordMeanings, emptyChapter, placeProblem, presentImportRun, reasonOf, rowFromEntry, summaryOf, totalsOf,
} from '../utils/translation-import.js';

// A verse as the pipeline saves it, so the importer is held to the real file format and not to a guess at it.
const unit = { verseId: '1.2.47', globalVerseNumber: 70, bookNumber: 1, chapterNumber: 2, verseNumber: 47, verseNumberEnd: null, cantoNumber: null };
const answer = {
  translation: 'तुम्हें अपना नियत कर्म करने का अधिकार है।',
  purport: ['पहला अनुच्छेद।', 'दूसरा अनुच्छेद।'],
  transliteration: ['कर्मण्येवाधिकारस्ते', 'मा फलेषु कदाचन'],
  wordMeanings: [{ word: 'कर्मणि', meaning: 'नियत कर्म में' }, { word: 'एव', meaning: 'निश्चय ही' }],
};
const entryFor = (over = {}, version = '1.0') =>
  buildEntry(unit, { ...answer, ...over }, 'hi', {
    model: 'claude-test', effort: 'off', version, warnings: [], generatedAt: '2026-10-14T00:00:00.000Z',
    quality: { scores: { translation: 3, purport: 2 }, correctness: 2 },
  });

const verseRow = { id: 'cuid1', verseId: '1.2.47', bookNumber: 1, cantoNumber: null, chapterNumber: 2, verseNumber: 47, verseNumberEnd: null };

describe('rowFromEntry — everything the file has for a verse', () => {
  it('takes the translation, purport, transliteration and word meanings, and who made them', () => {
    assert.deepEqual(rowFromEntry(entryFor(), 'hi'), {
      meaning: answer.translation,
      purport: 'पहला अनुच्छेद।\nदूसरा अनुच्छेद।',
      transliteration: 'कर्मण्येवाधिकारस्ते\nमा फलेषु कदाचन',
      wordMeanings: answer.wordMeanings,
      translatedBy: 'claude',
      version: '1.0',
    });
  });

  it('leaves out what the verse does not have, as null', () => {
    const row = rowFromEntry(entryFor({ purport: [], transliteration: [], wordMeanings: [] }), 'hi');
    assert.equal(row.meaning, answer.translation);
    assert.equal(row.purport, null);
    assert.equal(row.transliteration, null);
    assert.equal(row.wordMeanings, null);
  });

  it('is null for a verse with no translation — a purport alone has nowhere to live', () => {
    const entry = entryFor();
    entry.commentaries = entry.commentaries.filter((c) => c.type === 'purport');
    assert.equal(rowFromEntry(entry, 'hi'), null);
    assert.equal(rowFromEntry({ verseId: '1.2.47' }, 'hi'), null);
    assert.equal(rowFromEntry(null, 'hi'), null);
  });

  it('reads only Prabhupāda’s rows, and only in the language asked for', () => {
    const entry = entryFor();
    entry.commentaries.push(
      { translatorSlug: 'sivananda', type: 'translation', language: 'hi', text: 'someone else' },
      { translatorSlug: 'prabhupada', type: 'translation', language: 'mr', text: 'दुसरी भाषा' }
    );
    assert.equal(rowFromEntry(entry, 'hi').meaning, answer.translation);
    assert.equal(rowFromEntry(entry, 'mr').meaning, 'दुसरी भाषा');
    assert.equal(rowFromEntry(entry, 'ta'), null);
  });

  it('keeps the text as the file has it, and treats a blank part as absent', () => {
    const entry = entryFor();
    entry.commentaries.find((c) => c.type === 'purport').text = '   ';
    entry.commentaries.find((c) => c.type === 'translation').text = '  spaced  ';
    const row = rowFromEntry(entry, 'hi');
    assert.equal(row.meaning, '  spaced  ');
    assert.equal(row.purport, null);
  });

  it('has no maker for text a person wrote', () => {
    const entry = entryFor();
    delete entry.aiTranslation;
    for (const c of entry.commentaries) {
      delete c.translatedBy;
      delete c.version;
    }
    const row = rowFromEntry(entry, 'hi');
    assert.equal(row.translatedBy, null);
    assert.equal(row.version, null);
  });

  it('falls back to the translation row’s own stamp when the verse has no aiTranslation', () => {
    const entry = entryFor({}, '2.0');
    delete entry.aiTranslation;
    const row = rowFromEntry(entry, 'hi');
    assert.equal(row.translatedBy, 'claude');
    assert.equal(row.version, '2.0');
  });
});

describe('cleanWordMeanings', () => {
  it('keeps { word, meaning } and drops entries with no meaning', () => {
    assert.deepEqual(
      cleanWordMeanings([{ word: ' a ', meaning: 'one', extra: 1 }, { word: 'b', meaning: '  ' }, { word: '', meaning: 'two' }, null]),
      [{ word: ' a ', meaning: 'one' }, { word: null, meaning: 'two' }]
    );
  });

  it('reads the scrape’s own shape too, and nothing else as a list', () => {
    assert.deepEqual(cleanWordMeanings([{ raw: 'om—O my Lord; namah—obeisances' }]), [
      { word: 'om', meaning: 'O my Lord' },
      { word: 'namah', meaning: 'obeisances' },
    ]);
    assert.deepEqual(cleanWordMeanings(undefined), []);
    assert.deepEqual(cleanWordMeanings('text'), []);
  });
});

describe('placeProblem — is it the verse the database holds', () => {
  const entry = entryFor();

  it('accepts a verse whose book, chapter and verse agree', () => {
    assert.equal(placeProblem(entry, verseRow, 2), null);
  });

  it('refuses a different book, chapter or verse number, naming which', () => {
    assert.match(placeProblem({ ...entry, bookNumber: 2 }, verseRow, 2), /^book is 2 in the file but 1 in the database/);
    assert.match(placeProblem({ ...entry, chapterNumber: 3 }, verseRow, 2), /^chapter is 3 in the file but 2 in the database/);
    assert.match(placeProblem({ ...entry, verseNumber: 48 }, verseRow, 2), /^verse is 48 in the file but 47 in the database/);
  });

  it('refuses a canto or last verse that one side has and the other does not', () => {
    assert.match(placeProblem({ ...entry, cantoNumber: 3 }, verseRow, 2), /^canto is 3 in the file but empty in the database/);
    assert.match(placeProblem({ ...entry, verseNumberEnd: 48 }, verseRow, 2), /^last verse is 48 in the file but empty/);
    assert.equal(placeProblem({ ...entry, verseNumberEnd: 48 }, { ...verseRow, verseNumberEnd: 48 }, 2), null);
  });

  it('treats a missing optional number as empty', () => {
    const { cantoNumber, verseNumberEnd, ...bare } = entry;
    assert.equal(placeProblem(bare, verseRow, 2), null);
  });

  it('refuses an entry with no book or chapter number at all', () => {
    const { bookNumber, ...noBook } = entry;
    assert.match(placeProblem(noBook, verseRow, 2), /^book is empty in the file/);
    const { chapterNumber, ...noChapter } = entry;
    assert.match(placeProblem(noChapter, verseRow, 2), /^chapter is empty in the file/);
  });

  it('refuses a verse that sits in another chapter’s file', () => {
    assert.match(placeProblem(entry, verseRow, 3), /file for chapter 3 but says chapter 2/);
  });
});

describe('changedColumns — what differs from the row already there', () => {
  const want = rowFromEntry(entryFor(), 'hi');
  const same = { id: 'x', ...want };

  it('is empty for a row that already matches', () => {
    assert.deepEqual(changedColumns(same, want), []);
  });

  it('names each column that differs', () => {
    assert.deepEqual(changedColumns({ ...same, meaning: 'old' }, want), ['meaning']);
    assert.deepEqual(changedColumns({ ...same, purport: null }, want), ['purport']);
    assert.deepEqual(changedColumns({ ...same, transliteration: 'old' }, want), ['transliteration']);
    assert.deepEqual(changedColumns({ ...same, wordMeanings: [] }, want), ['wordMeanings']);
    assert.deepEqual(changedColumns({ ...same, translatedBy: null }, want), ['translatedBy']);
    assert.deepEqual(changedColumns({ ...same, version: '0.9' }, want), ['version']);
    assert.deepEqual(changedColumns({ ...same, meaning: 'old', version: '0.9' }, want), ['meaning', 'version']);
  });

  it('treats a row from a book import (no transliteration, no word list, no maker) as different only where the file has more', () => {
    const imported = { meaning: want.meaning, purport: want.purport, transliteration: null, wordMeanings: null, translatedBy: null, version: null };
    assert.deepEqual(changedColumns(imported, want), ['transliteration', 'wordMeanings', 'translatedBy', 'version']);
  });

  it('compares word lists by content, not by the order the database returns an object’s keys', () => {
    const reordered = want.wordMeanings.map((w) => ({ meaning: w.meaning, word: w.word }));
    assert.deepEqual(changedColumns({ ...same, wordMeanings: reordered }, want), []);
  });

  it('counts a missing list and an empty one as the same', () => {
    const none = { ...want, wordMeanings: null };
    assert.deepEqual(changedColumns({ ...none, wordMeanings: [] }, none), []);
    assert.deepEqual(changedColumns({ ...none, wordMeanings: null }, none), []);
  });
});

describe('reasonOf — why a chapter stopped, as a sentence', () => {
  it('pulls the refusal out of Prisma’s dump of the failed query', () => {
    const dump = [
      '',
      'Invalid `prisma.verseTranslation.update()` invocation:',
      '',
      '',
      'Error in batch request 1: Error occurred during query execution:',
      'ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "22021", message: "invalid byte sequence for encoding \\"UTF8\\": 0x00", severity: "ERROR", detail: None, column: None, hint: None }), transient: false })',
    ].join('\n');
    assert.equal(reasonOf(new Error(dump)), 'The database refused it: invalid byte sequence for encoding "UTF8": 0x00 (22021)');
  });

  it('otherwise takes the last line of the message', () => {
    assert.equal(reasonOf(new Error('\nInvalid `prisma.x()` invocation:\n\nThe provided value for the column is too long. Column: version')), 'The provided value for the column is too long. Column: version');
    assert.equal(reasonOf(new SyntaxError("Expected property name or '}' in JSON at position 2")), "Expected property name or '}' in JSON at position 2");
  });

  it('never answers with nothing, and never with a screenful', () => {
    assert.equal(reasonOf(new Error('')), 'Unknown error');
    assert.equal(reasonOf(undefined), 'Unknown error');
    assert.equal(reasonOf('plain text'), 'plain text');
    assert.equal(reasonOf(new Error('x'.repeat(1000))).length, 300);
  });
});

describe('totalsOf', () => {
  it('adds the chapters up and counts what was found, missing and in conflict', () => {
    const a = { ...emptyChapter(1), inStorage: 3, created: 2, updated: 1, replacedVisible: 1, missing: ['1.1.9'] };
    const b = { ...emptyChapter(2), inStorage: 2, unchanged: 2, conflicts: [{ verseId: '1.2.1', reason: 'x' }], noTranslation: 1 };
    const c = { ...emptyChapter(3), found: false };
    const d = { ...emptyChapter(4), error: 'boom' };
    assert.deepEqual(totalsOf([a, b, c, d], { '1.0': 5 }), {
      chapters: 3,
      inStorage: 5,
      created: 2,
      updated: 1,
      unchanged: 2,
      replacedVisible: 1,
      noTranslation: 1,
      missing: 1,
      conflicts: 1,
      failedChapters: 1,
      versions: { '1.0': 5 },
    });
  });
});

describe('summaryOf — the one line a finished import is reported with', () => {
  const totals = { chapters: 3, created: 6, updated: 2, unchanged: 4, missing: 0, conflicts: 0, failedChapters: 0 };

  it('says how many chapters and what happened to their verses', () => {
    assert.equal(summaryOf(totals), '3 chapter(s): 6 created, 2 updated, 4 unchanged.');
  });

  it('adds only the problems there were', () => {
    assert.equal(summaryOf({ ...totals, missing: 1 }), '3 chapter(s): 6 created, 2 updated, 4 unchanged, 1 missing.');
    assert.equal(
      summaryOf({ ...totals, missing: 2, conflicts: 1, failedChapters: 1 }),
      '3 chapter(s): 6 created, 2 updated, 4 unchanged, 2 missing, 1 conflicting, 1 chapter(s) failed.'
    );
  });

  it('says nothing about vikara links: a language import never makes them', () => {
    assert.ok(!('issueLinksCreated' in totalsOf([emptyChapter(1)])));
    assert.ok(!('issueLinksCreated' in emptyChapter(1)));
    assert.ok(!/issue|already linked/.test(summaryOf({ ...totals, issueLinksCreated: 4, issueVersesSkipped: 2 })), 'the old counters are not read any more');
  });

  it('reads the totals totalsOf makes — a chapter that failed to write was still found, so it is counted', () => {
    const chapters = [{ ...emptyChapter(1), created: 2 }, { ...emptyChapter(2), error: 'boom' }, { ...emptyChapter(3), found: false }];
    assert.equal(summaryOf(totalsOf(chapters)), '2 chapter(s): 2 created, 0 updated, 0 unchanged, 1 chapter(s) failed.');
  });
});

describe('LIVE_IMPORT_STATUSES', () => {
  it('is the two states with work left — an import is never paused', () => {
    assert.deepEqual(LIVE_IMPORT_STATUSES, ['QUEUED', 'RUNNING']);
  });
});

describe('presentImportRun — an import run as the admin panel receives it', () => {
  const now = new Date('2026-10-24T10:00:00.000Z');
  const row = {
    id: 'run1', language: 'mr', book: 'bhagavat-gita', publish: false, chapters: [1, 2, 3, 4],
    status: 'RUNNING', statusMessage: null, cancelRequested: false,
    totalChapters: 4, doneChapters: 1, currentChapter: 1, result: null,
    requestedById: 'u1', requestedByName: 'Anna',
    createdAt: new Date('2026-10-24T09:59:00.000Z'), startedAt: new Date('2026-10-24T09:59:05.000Z'), finishedAt: null,
    heartbeatAt: new Date('2026-10-24T09:59:58.000Z'),
  };

  it('puts the counts under progress and works out the percentage', () => {
    const run = presentImportRun(row, now);
    assert.deepEqual(run.progress, { total: 4, done: 1, percent: 25, currentChapter: 1 });
    assert.equal(run.id, 'run1');
    assert.equal(run.language, 'mr');
    assert.deepEqual(run.chapters, [1, 2, 3, 4]);
    assert.equal(run.publish, false);
  });

  it('says what kind of import it is: a translation unless the row says it is the vikara tags', () => {
    assert.equal(presentImportRun(row, now).kind, 'TRANSLATION');
    assert.equal(presentImportRun({ ...row, kind: 'VIKARA' }, now).kind, IMPORT_KINDS.VIKARA);
  });

  it('has no percentage before the worker has counted the chapters, and never goes over 100', () => {
    assert.equal(presentImportRun({ ...row, totalChapters: 0, doneChapters: 0, currentChapter: null }, now).progress.percent, 0);
    assert.equal(presentImportRun({ ...row, doneChapters: 9 }, now).progress.percent, 100);
  });

  it('names who asked, or nobody when that admin has since been deleted', () => {
    assert.deepEqual(presentImportRun(row, now).requestedBy, { id: 'u1', name: 'Anna' });
    assert.equal(presentImportRun({ ...row, requestedById: null, requestedByName: 'Anna' }, now).requestedBy, null);
  });

  it('gives back the result of a finished import, and null while there is none', () => {
    assert.equal(presentImportRun(row, now).result, null);
    assert.equal(presentImportRun({ ...row, result: undefined }, now).result, null);
    const result = { language: 'mr', totals: { chapters: 4 }, chapters: [] };
    assert.equal(presentImportRun({ ...row, status: 'COMPLETED', result }, now).result, result);
  });

  it('is stalled only while RUNNING and quiet for longer than the heartbeat allows', () => {
    assert.equal(presentImportRun(row, now).stalled, false);
    assert.equal(presentImportRun({ ...row, heartbeatAt: new Date('2026-10-24T09:58:20.000Z') }, now).stalled, true);
    assert.equal(presentImportRun({ ...row, heartbeatAt: null }, now).stalled, true);
  });

  it('is never stalled when it is not running — a queued import has simply not been picked up, a finished one is over', () => {
    const quiet = new Date('2026-10-24T08:00:00.000Z');
    for (const status of ['QUEUED', 'COMPLETED', 'FAILED', 'CANCELLED']) {
      assert.equal(presentImportRun({ ...row, status, heartbeatAt: quiet }, now).stalled, false, status);
    }
  });

  it('passes the cancel request and the message through', () => {
    const run = presentImportRun({ ...row, cancelRequested: true, statusMessage: 'Cancelling after the chapter in progress…' }, now);
    assert.equal(run.cancelRequested, true);
    assert.equal(run.statusMessage, 'Cancelling after the chapter in progress…');
  });
});
