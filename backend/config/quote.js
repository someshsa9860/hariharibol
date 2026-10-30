// How the quotes shown on the chanting page behave: the languages a translation run can write and how a run is paced.
// Read by utils/quote.js, services/quote.js and jobs/processors/quote.js. The run settings are the translation ones on
// purpose (the heartbeat, the retry waits): a run is the same kind of long, resumable job as etiquette's.

import env from './env.js';
import { translation } from './translation.js';
import { languages } from './etiquette.js';

const quote = {
  ...translation,

  // Translation runs. Quotes are short, so many go in a request, and each answer is checked before it is saved.
  provider: env.TRANSLATION_PROVIDER || 'openai',
  batchSize: 20,
  maxTokens: 16_000,
  invalidTries: 2,

  feedKey: 'quote:feed',
};

export { quote, languages };
