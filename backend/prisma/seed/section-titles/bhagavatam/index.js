// The 335 chapter headings of Śrīmad-Bhāgavatam in every reading language except English
// (English is `en.js`, from vedabase.io, and is what the other files were translated from).
//
// One file per language: `{ <canto number>: [heading of chapter 1, chapter 2, …] }`. They are kept apart
// from the files one folder up because a Bhagavatam chapter number repeats in every canto, so a chapter
// is found by canto and number. AI-drafted, NOT read by a native speaker; devotional terms follow the
// glossary in app/lib/l10n/README.md. The seed fills a language only where the chapter has none
// (`fillMissing`), so an admin's edit is kept; fix a wrong heading on the admin Books page → Titles.
import english from './en.js';
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

export { english as bhagavatamEnglish };

export const bhagavatamChapters = {
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

/** `{ code: heading }` of chapter `number` of canto `canto` of the Bhagavatam, for each language that has one. */
export function bhagavatamChapterTitles(canto, number) {
  const found = {};
  for (const [code, file] of Object.entries(bhagavatamChapters)) {
    const title = file[canto]?.[number - 1];
    if (title) found[code] = title;
  }
  return found;
}
