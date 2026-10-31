// What importing the Bhagavatam's vikara tags decides: which names in a tag file can be linked, and how a chapter's
// line and an import's totals read. Pure functions — no database, no storage. The database side (links made once,
// verses already linked left alone) is `npm run test:translation-import`, section 13; the queued run and the routes are
// `npm run test:translation`, "Importing into the database".

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { emptyVikaraChapter, describeVikaraChapter, slugsOf, vikaraSummaryOf, vikaraTotalsOf } from '../utils/vikara-import.js';
import { issuesEntry, newIssuesFile } from '../scripts/lib/claude-translate-run.js';
import { placeProblem } from '../utils/translation-import.js';

describe('slugsOf — the vikaras a tag file names for a verse', () => {
  it('keeps the six names, once each, in the order given', () => {
    assert.deepEqual(slugsOf({ issues: ['moha', 'kama', 'moha'] }), { listed: true, slugs: ['moha', 'kama'], ignored: 1 });
    assert.deepEqual(slugsOf({ issues: ['kama', 'krodha', 'lobha', 'moha', 'mada', 'matsarya'] }).slugs.length, 6);
  });

  it('drops a name that is not one of the six, and counts it', () => {
    assert.deepEqual(slugsOf({ issues: ['pride', 'mada', 'Mada', 7, null] }), { listed: true, slugs: ['mada'], ignored: 4 });
  });

  it('treats an empty list as the usual answer, not a problem', () => {
    assert.deepEqual(slugsOf({ issues: [] }), { listed: true, slugs: [], ignored: 0 });
  });

  it('says so when the entry has no list at all', () => {
    assert.equal(slugsOf({ verseId: '2.10.1.4' }).listed, false);
    assert.equal(slugsOf({ issues: 'kama' }).listed, false);
    assert.deepEqual(slugsOf(null).slugs, []);
    assert.deepEqual(slugsOf(undefined).slugs, []);
  });
});

describe('a verse of the tag file a run writes is one the importer can place', () => {
  const unit = { verseId: '2.10.1.4', bookNumber: 2, cantoNumber: 10, chapterNumber: 1, verseNumber: 4, verseNumberEnd: null, sanskrit: 'श्रीशुक उवाच' };
  const verse = { bookNumber: 2, cantoNumber: 10, chapterNumber: 1, verseNumber: 4, verseNumberEnd: null };

  it('agrees with the database row it was made from', () => {
    assert.equal(placeProblem(issuesEntry(unit, ['kama']), verse, 1, 10), null);
  });

  it('is refused when the file puts the verse in another chapter or canto', () => {
    assert.match(placeProblem(issuesEntry(unit, []), verse, 2, 10), /chapter 2/);
    assert.match(placeProblem(issuesEntry(unit, []), verse, 1, 9), /canto 9/);
  });

  it('is refused when its numbers disagree with the row', () => {
    assert.match(placeProblem(issuesEntry({ ...unit, verseNumber: 5 }, []), verse, 1, 10), /verse is 5 in the file but 4 in the database/);
  });

  it('starts a file the importer can read: a verses list under a meta', () => {
    const file = newIssuesFile({ bookNumber: 2, bookSlug: 'srimad-bhagavatam', cantoNumber: 10, chapterNumber: 1, chapterName: 'x' }, 'srimad-bhagavatam');
    assert.deepEqual(file.verses, []);
    assert.equal(file.meta.language, 'en');
  });
});

describe('a chapter\'s line and an import\'s totals', () => {
  const a = { ...emptyVikaraChapter(1001), inStorage: 10, tagged: 3, noTags: 7, verses: 2, links: 4, alreadyLinked: 1, ignored: 1, missing: ['2.10.1.99'] };
  const b = { ...emptyVikaraChapter(1002), inStorage: 4, noTags: 4, conflicts: [{ verseId: '2.10.2.1', reason: 'x' }] };
  const c = { ...emptyVikaraChapter(1003), found: false };
  const d = { ...emptyVikaraChapter(1004), error: 'boom' };

  it('starts a line at zero and found', () => {
    assert.deepEqual(emptyVikaraChapter(1001), {
      chapter: 1001, found: true, inStorage: 0, tagged: 0, noTags: 0, verses: 0, links: 0, alreadyLinked: 0, ignored: 0, missing: [], conflicts: [], error: null,
    });
  });

  it('adds the chapters up; a chapter with no file is not "found" and one that failed still is', () => {
    assert.deepEqual(vikaraTotalsOf([a, b, c, d]), {
      chapters: 3, notFound: 1, inStorage: 14, tagged: 3, noTags: 11, verses: 2, links: 4, alreadyLinked: 1, ignored: 1, missing: 1, conflicts: 1, failedChapters: 1,
    });
  });

  it('writes one sentence for the run, naming only the problems there were', () => {
    assert.equal(vikaraSummaryOf(vikaraTotalsOf([{ ...emptyVikaraChapter(1), noTags: 5, verses: 1, links: 2 }])), '1 chapter(s): 2 link(s) on 1 verse(s), 5 verse(s) with no tag.');
    assert.equal(
      vikaraSummaryOf(vikaraTotalsOf([a, b, c, d])),
      '3 chapter(s): 4 link(s) on 2 verse(s), 11 verse(s) with no tag, 1 verse(s) already linked, 1 unknown name(s) ignored, 1 missing, 1 conflicting, 1 chapter(s) with no file, 1 chapter(s) failed.'
    );
  });

  it('writes one line for the activity feed, at the level that fits', () => {
    assert.deepEqual(describeVikaraChapter(a, '10.1'), {
      kind: 'status', level: 'info', text: 'Chapter 10.1: 4 link(s) on 2 verse(s), 7 with no tag, 1 verse(s) already linked, 1 unknown name(s) ignored, 1 missing.',
    });
    assert.equal(describeVikaraChapter(c, '10.3').level, 'warn');
    assert.match(describeVikaraChapter(c, '10.3').text, /no tag file yet/);
    assert.deepEqual(describeVikaraChapter(d, '10.4'), { kind: 'status', level: 'error', text: 'Chapter 10.4: boom' });
  });
});
