// How prayers behave: the categories one can be filed under, which script a reader gets a verse in and how it is made,
// and the admin panel's transliteration and translation runs. Read by utils/prayer.js, services/prayer.js and
// jobs/processors/prayer.js. Where this and config/translation.js overlap (the heartbeat, the retry waits) the values
// are the translation ones on purpose: a run is the same kind of long, resumable job.
//
// "Prayer" here is a stotra, an aarti or a prayer a reader reads in their own script. It is not a mantra's opening
// prayer (`Mantra.prayerMantraId`), which is unrelated and untouched.

import env from './env.js';
import { translation } from './translation.js';
import { languages as appLanguages } from './etiquette.js';

/**
 * The categories, in the order the app lists them. `id` is what a row stores; the English `name` is what the admin
 * panel shows and what the API sends as a fallback (the app words each category itself, in its own strings). A
 * starter set the owner may revise before content is entered.
 */
const categories = [
  { id: 'morning', name: 'Morning prayers' },
  { id: 'evening', name: 'Evening prayers' },
  { id: 'meals', name: 'Before and after meals' },
  { id: 'guru', name: 'Guru and the lineage' },
  { id: 'deity', name: 'Prayers to a deity' },
  { id: 'aarti', name: 'Aartis' },
  { id: 'peace', name: 'Peace and protection' },
  { id: 'other', name: 'Other' },
];

const CATEGORY_IDS = categories.map((c) => c.id);

/** The languages (so scripts) a prayer's verses can be written in. */
const ORIGINAL_LANGUAGES = ['sa', 'hi', 'mr', 'bn', 'as', 'gu', 'ta', 'te', 'kn', 'ml', 'or', 'pa'];

/** The script each language is written in. Two languages in one script need no conversion between them. */
const SCRIPT_OF = {
  sa: 'deva', hi: 'deva', mr: 'deva',
  bn: 'beng', as: 'beng',
  gu: 'gujr', ta: 'taml', te: 'telu', kn: 'knda', ml: 'mlym', or: 'orya', pa: 'guru',
  en: 'latn',
};

/**
 * The scripts `fromDevanagari` (utils/script.js, and the app's copy) writes well from Devanagari. Tamil is left out on
 * purpose — it has one letter for ka / kha / ga / gha, so the rule would merge them — and so is Roman, which is not a
 * code-point shift at all; both come from the model.
 */
const RULE_TARGETS = ['bn', 'as', 'gu', 'te', 'kn', 'or', 'pa', 'ml'];

/**
 * How a verse written in `originalLanguage` reaches a reader of `targetLanguage`:
 *   'same'  — the reader's script is the original's, nothing to make;
 *   'rule'  — the original is Devanagari and the target is one `fromDevanagari` does well: converted at read time;
 *   'model' — anything else: written by a run and stored.
 * The server sends the answer to the app, so the app never derives it.
 */
function howText(originalLanguage, targetLanguage) {
  const from = SCRIPT_OF[originalLanguage];
  const to = SCRIPT_OF[targetLanguage];
  if (!from || !to) return 'model';
  if (from === to) return 'same';
  if (from === 'deva' && RULE_TARGETS.includes(targetLanguage)) return 'rule';
  return 'model';
}

/**
 * The languages a run can write into: Roman letters first (`en` — only the Roman rendering of the verses, since English
 * is what the title and meanings are written in), then the 11 app languages. `ranges` are the Unicode ranges of the
 * language's script; an answer with almost none of it was not written in it. Roman takes the Latin letters and the
 * Latin Extended Additional block, where IAST's ṛ ṭ ḍ ṣ ṅ ṇ ḥ ṃ live.
 */
const languages = [
  { code: 'en', ranges: [[0x41, 0x24f], [0x1e00, 0x1eff]], name: 'English', endonym: 'English' },
  ...appLanguages.map((l) => ({ ...l, ranges: [l.block] })),
];

const prayer = {
  ...translation,

  // Translation runs. A prayer is a header request (title, summary, about) and then slices of its verses, each answer
  // checked before it is saved.
  provider: env.TRANSLATION_PROVIDER || 'openai', // the same default as the Translations page
  sliceVerses: 12,
  maxTokens: 16_000,
  // Asks again for an answer that fails our checks (a verse missing, a piece left empty, a line lost) this many times,
  // then stops on it.
  invalidTries: 2,
  // The most verses a prayer may have (Gita's longest stotras are well under this).
  maxVerses: 400,

  feedKey: 'prayer:feed',
};

export { prayer, categories, CATEGORY_IDS, ORIGINAL_LANGUAGES, SCRIPT_OF, RULE_TARGETS, howText, languages };
