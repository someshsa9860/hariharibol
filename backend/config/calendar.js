// How the Hindu calendar's translation runs behave (admin → Hindu calendar → Translate). Read by
// utils/calendar-translation.js, services/calendar-translation.js and jobs/processors/calendar.js. Where this and
// config/translation.js overlap (the heartbeat, the retry waits) the values are the translation ones on purpose: a run
// is the same kind of long, resumable job. The languages are etiquette's — the 11 app languages other than English.

import env from './env.js';
import { translation } from './translation.js';
import { languages } from './etiquette.js';

const calendar = {
  ...translation,

  // Translation runs. The items are short (a festival name, a tithi), so many go in one request; each answer is
  // checked before it is saved. Descriptions are longer and go in the same way.
  provider: env.TRANSLATION_PROVIDER || 'openai', // the same default as the Translations page
  batchSize: 40,
  maxTokens: 16_000,
  // Asks again for an answer that fails our checks (an item missing, left in English) this many times, then stops on it.
  invalidTries: 2,

  feedKey: 'calendar:feed',
};

/**
 * What a translated item is: a festival's `NAME`, a festival's `DESCRIPTION`, or a panchang `TERM`. The kind is part of
 * the key, so "Purnima" the festival and "Purnima" the tithi are two translations.
 */
const KINDS = ['NAME', 'DESCRIPTION', 'TERM'];

/** The panchang fields whose words are translated, with what the prompt calls each (`PanchangDay` column → group). */
const TERM_FIELDS = {
  tithiName: 'tithi',
  nakshatra: 'nakshatra',
  yoga: 'yoga',
  karana: 'karana',
  monthAmanta: 'lunar month',
  monthPurnimanta: 'lunar month',
  sunSign: 'zodiac sign (rashi)',
  moonSign: 'zodiac sign (rashi)',
};

export { calendar, languages, KINDS, TERM_FIELDS };
