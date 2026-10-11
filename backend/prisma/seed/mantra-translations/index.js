// The seeded mantras' name, meaning and purport in every reading language
// except two, which are deliberate gaps:
//
//   en  hand-written in ../data.js, where it is the source text the others
//       follow (and the seed keeps it in step with data.js on every run).
//   sa  Sanskrit is a mantra language only. Its row carries the original
//       `text` and no prose, because an English gloss on a Sanskrit row would
//       be shown to a reader who asked for Sanskrit.
//
// One file per language, one entry per mantra slug, with the same three
// fields as the English row: `name`, `meaning`, `purport` (null where the
// English purport is null). `text` is not here: the seed derives it from the
// Devanagari in data.js (see utils/script.js).
//
// test/mantra-translations.test.js fails when a reading language has no file,
// a file lacks a mantra or has an extra one, or a string is in the wrong
// script, so a new mantra or a new language cannot ship half translated.
//
// These are AI-drafted and have NOT been read by a native speaker. Devotional
// terms follow the glossary in app/lib/l10n/README.md. The seed fills a field
// only where the row has none, so a correction made here reaches a database
// whose row is still empty; a row that already holds text (or was edited in
// the admin panel) is left alone — fix those in the admin Mantras page.
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

export const translations = {
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
