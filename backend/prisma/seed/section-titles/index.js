// The titles of the two scriptures, their cantos and their chapters in every
// reading language except English, which is the source:
//
//   en  the book's `title`, the canto's `title` and the chapter's
//       `titleI18n.en` (Prabhupāda's own headings, written by the importers).
//   sa  Sanskrit is a verse language only; there is no UI or reading text in it.
//
// One file per language, in one shape:
//
//   books:    { <book slug>: title }
//   cantos:   { <book slug>: [title of canto 1, canto 2, …] }
//   chapters: { <book slug>: [title of chapter 1, chapter 2, …] }
//
// Only chapters that carry no canto are here (the Gita's eighteen). The
// Bhagavatam's 335 chapters are not: there is no title list to follow and a
// wrong one is worse than the English heading a reader sees until the admin
// Books page (Titles) or a later seed fills it.
//
// The Gita's chapter titles are the traditional names — Arjuna-viṣāda-yoga,
// Sāṅkhya-yoga … — written in the reader's own script, the way a printed Gita
// in that language names them. The English headings are descriptions Prabhupāda
// wrote; the cantos, which have no traditional name beyond their number, are
// translations of those descriptions.
//
// test/section-titles.test.js fails when a reading language has no file, a
// file's lists are the wrong length, or a string is in the wrong script.
//
// These are AI-drafted and have NOT been read by a native speaker. Devotional
// terms follow the glossary in app/lib/l10n/README.md. The seed fills a
// language only where the row has none (`fillMissing`), so a correction made
// here reaches a database whose row is still empty; a title that is already
// there (or was edited in the admin panel) is left alone — fix those on the
// admin Books page.
import hindi from './hi.js';
import marathi from './mr.js';
import gujarati from './gu.js';
import bengali from './bn.js';
import tamil from './ta.js';
import telugu from './te.js';
import kannada from './kn.js';
import odia from './or.js';
import punjabi from './pa.js';
import malayalam from './ml.js';
import assamese from './as.js';

export const sectionTitles = {
  hi: hindi,
  mr: marathi,
  gu: gujarati,
  bn: bengali,
  ta: tamil,
  te: telugu,
  kn: kannada,
  or: odia,
  pa: punjabi,
  ml: malayalam,
  as: assamese,
};

/** `{ code: title }` for each language that has one, from `pick(file)`. */
function collect(pick) {
  const found = {};
  for (const [code, file] of Object.entries(sectionTitles)) {
    const title = pick(file);
    if (title) found[code] = title;
  }
  return found;
}

/** The seeded titles of a book, by language. */
export const bookTitles = (slug) => collect((file) => file.books?.[slug]);

/** The seeded titles of canto `number` (1-based) of a book, by language. */
export const cantoTitles = (slug, number) => collect((file) => file.cantos?.[slug]?.[number - 1]);

/** The seeded titles of chapter `number` (1-based) of a book without cantos, by language. */
export const chapterTitles = (slug, number) => collect((file) => file.chapters?.[slug]?.[number - 1]);

/** Slugs of the books that have seeded chapter titles (those without cantos). */
export const booksWithChapterTitles = () => [
  ...new Set(Object.values(sectionTitles).flatMap((file) => Object.keys(file.chapters ?? {}))),
];

/**
 * `current` (a `titleI18n` value, which may be null) with `wanted` added for
 * every language it does not already have a non-empty title for. Returns null
 * when there is nothing to add, so the caller skips the write.
 */
export function fillMissing(current, wanted) {
  const have = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  const additions = {};

  for (const [code, title] of Object.entries(wanted)) {
    const existing = have[code];
    if (typeof existing === 'string' && existing.trim()) continue;
    additions[code] = title;
  }

  return Object.keys(additions).length === 0 ? null : { ...have, ...additions };
}
