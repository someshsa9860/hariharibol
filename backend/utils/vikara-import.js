// What importing a chapter's vikara tags means, with no database and no storage in it: which of a tag
// file's verses can be linked, and how an import's lines add up. The tag file is the one a Marathi
// Bhagavatam translation run writes (issues/json/srimad-bhagavatam/c<canto>-ch-<n>.json); it is apart from
// the language files, so importing a language never touches the vikara links and this never touches a
// translation. services/vikara-import.js reads and writes; this decides. test/vikara-import.test.js holds the cases.

import { VIKARA_SLUGS } from '../scripts/lib/claude-translate-validate.js';

const KNOWN = new Set(VIKARA_SLUGS);

/**
 * The vikaras a tag file's verse names: the six known slugs, each once, in the order given.
 * `ignored` counts what was dropped (a name that is not one of the six, a repeat, something that is not text).
 * `listed` is false when the entry has no `issues` list at all — a file that was not made by a tagging run.
 */
export function slugsOf(entry) {
  const listed = Array.isArray(entry?.issues);
  const given = listed ? entry.issues : [];
  const slugs = [...new Set(given.filter((slug) => KNOWN.has(slug)))];
  return { listed, slugs, ignored: given.length - slugs.length };
}

/** One chapter's line in a vikara import's result, before anything is counted. */
export const emptyVikaraChapter = (chapter) => ({
  chapter,
  found: true, // false: there is no tag file for this chapter
  inStorage: 0, // verses in the file that are in the database and agree with it
  tagged: 0, // of those, verses with at least one vikara
  noTags: 0, // of those, verses with none (the usual answer)
  verses: 0, // verses that got links
  links: 0, // links made
  alreadyLinked: 0, // verses left alone because they already have links
  ignored: 0, // names in the file that are not one of the six vikaras, or repeats
  missing: [], // verse ids the file has that the database does not
  conflicts: [], // { verseId, reason } — the file and the database disagree about the verse
  error: null,
});

/** The chapters of a vikara import added up. */
export function vikaraTotalsOf(chapters) {
  const sum = (key) => chapters.reduce((n, c) => n + c[key], 0);
  return {
    chapters: chapters.filter((c) => c.found).length,
    notFound: chapters.filter((c) => !c.found).length,
    inStorage: sum('inStorage'),
    tagged: sum('tagged'),
    noTags: sum('noTags'),
    verses: sum('verses'),
    links: sum('links'),
    alreadyLinked: sum('alreadyLinked'),
    ignored: sum('ignored'),
    missing: chapters.reduce((n, c) => n + c.missing.length, 0),
    conflicts: chapters.reduce((n, c) => n + c.conflicts.length, 0),
    failedChapters: chapters.filter((c) => c.error).length,
  };
}

/** The extras of a line or of the totals that are worth saying: only the ones that are not zero. */
const extrasOf = (c, missing, conflicts) =>
  [
    c.alreadyLinked && `${c.alreadyLinked} verse(s) already linked`,
    c.ignored && `${c.ignored} unknown name(s) ignored`,
    missing && `${missing} missing`,
    conflicts && `${conflicts} conflicting`,
  ].filter(Boolean);

/** One line for a chapter of a vikara import, for the run's activity feed. */
export function describeVikaraChapter(line, label) {
  const name = `Chapter ${label}`;
  if (line.error) return { kind: 'status', level: 'error', text: `${name}: ${line.error}` };
  if (line.found === false) return { kind: 'status', level: 'warn', text: `${name}: no tag file yet.` };
  const extra = extrasOf(line, line.missing.length, line.conflicts.length);
  return { kind: 'status', level: 'info', text: `${name}: ${line.links} link(s) on ${line.verses} verse(s), ${line.noTags} with no tag${extra.length ? `, ${extra.join(', ')}` : ''}.` };
}

/** One line for a finished vikara import's totals — what the run's `statusMessage` and the page both say. */
export function vikaraSummaryOf(totals) {
  const extra = [...extrasOf(totals, totals.missing, totals.conflicts), totals.notFound && `${totals.notFound} chapter(s) with no file`, totals.failedChapters && `${totals.failedChapters} chapter(s) failed`].filter(Boolean);
  return `${totals.chapters} chapter(s): ${totals.links} link(s) on ${totals.verses} verse(s), ${totals.noTags} verse(s) with no tag${extra.length ? `, ${extra.join(', ')}` : ''}.`;
}
