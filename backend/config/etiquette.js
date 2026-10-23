// How devotee etiquette behaves: the categories an item can be filed under, the daily push, and the admin panel's
// translation runs. Read by utils/etiquette.js, services/etiquette.js, jobs/processors/etiquette-deliver.js and
// jobs/processors/etiquette.js. Where this and config/translation.js overlap (the heartbeat, the retry waits) the
// values are the translation ones on purpose: a run is the same kind of long, resumable job.

import env from './env.js';
import { translation } from './translation.js';

/**
 * The categories, in the order the app lists them. `id` is what a row stores; the English `name` is what the admin
 * panel shows and what the translation runs leave alone (the app words each category itself, in its own strings).
 */
const categories = [
  { id: 'temple', name: 'In the temple' },
  { id: 'deity', name: 'Serving the Deity' },
  { id: 'prasad', name: 'Prasāda and food' },
  { id: 'holy-name', name: 'The holy name' },
  { id: 'guru-vaishnava', name: 'Guru and devotees' },
  { id: 'speech-mind', name: 'Speech and mind' },
  { id: 'daily-life', name: 'Daily life' },
  { id: 'scripture', name: 'Scripture' },
  { id: 'holy-places', name: 'Holy places and days' },
];

const CATEGORY_IDS = categories.map((c) => c.id);

/**
 * The app languages a run can translate into: every one but English, the language the text is written in. `block` is
 * the Unicode range of the language's script; an answer with almost none of it was not translated.
 */
const languages = [
  { code: 'hi', block: [0x0900, 0x097f], name: 'Hindi', endonym: 'हिन्दी' },
  { code: 'mr', block: [0x0900, 0x097f], name: 'Marathi', endonym: 'मराठी' },
  { code: 'gu', block: [0x0a80, 0x0aff], name: 'Gujarati', endonym: 'ગુજરાતી' },
  { code: 'bn', block: [0x0980, 0x09ff], name: 'Bengali', endonym: 'বাংলা' },
  { code: 'ta', block: [0x0b80, 0x0bff], name: 'Tamil', endonym: 'தமிழ்' },
  { code: 'te', block: [0x0c00, 0x0c7f], name: 'Telugu', endonym: 'తెలుగు' },
  { code: 'kn', block: [0x0c80, 0x0cff], name: 'Kannada', endonym: 'ಕನ್ನಡ' },
  { code: 'or', block: [0x0b00, 0x0b7f], name: 'Odia', endonym: 'ଓଡ଼ିଆ' },
  { code: 'pa', block: [0x0a00, 0x0a7f], name: 'Punjabi', endonym: 'ਪੰਜਾਬੀ' },
  { code: 'ml', block: [0x0d00, 0x0d7f], name: 'Malayalam', endonym: 'മലയാളം' },
  { code: 'as', block: [0x0980, 0x09ff], name: 'Assamese', endonym: 'অসমীয়া' },
];

const etiquette = {
  ...translation,

  // The daily push is looked for this often; the delivery time is a multiple of it (07:15) so that each reader
  // falls in exactly one run's window. config/cron.js reads it too.
  deliveryStepMinutes: 15,

  // The most the push says: a notification is capped at 4 KB and an Indic letter is three bytes of it.
  pushBodyChars: 220,

  // Translation runs. Items go in several to a request, and each answer is checked before it is saved.
  provider: env.TRANSLATION_PROVIDER || 'openai', // the same default as the Translations page
  batchSize: 8,
  maxTokens: 16_000,
  // Asks again for an answer that fails our checks (an item missing, a text left empty) this many times, then stops on it.
  invalidTries: 2,

  feedKey: 'etiquette:feed',
};

export { etiquette, categories, CATEGORY_IDS, languages };
