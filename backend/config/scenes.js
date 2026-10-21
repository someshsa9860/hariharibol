// How the admin panel's scene prompt runs behave. Read by jobs/processors/scenes.js, services/scenes.js and
// utils/scenes.js. Where this and config/translation.js overlap (the heartbeat, the retry waits) the values are the
// translation ones on purpose: a run is the same kind of long, resumable job.

import env from './env.js';
import { translation } from './translation.js';

const scenes = {
  ...translation,

  // The provider and free-tier limits a new run starts with. Google's free tier is counted per project and changes
  // by model; these are conservative and the real numbers belong in .env (SCENES_RPM / SCENES_TPM / SCENES_RPD).
  provider: env.SCENES_PROVIDER || 'gemini',
  rpm: env.SCENES_RPM ?? 10, // requests a minute
  tpm: env.SCENES_TPM ?? 250_000, // input tokens a minute (what Gemini's TPM counts)
  rpd: env.SCENES_RPD ?? 0, // requests a day of our own; 0 = none

  // A chapter is one request. The answer is a storyboard: room for ~30 scenes with dialogue.
  maxTokens: 32_000,
  // Writes again a chapter whose answer failed our checks, this many times, before the run stops on it.
  invalidTries: 2,

  // Where the output lives: json/<book folder>/scenes/ — sk-<canto>-ch-<n>.json, and the index beside them.
  folder: 'scenes',
  indexFile: '_index.json',

  feedKey: 'scenes:feed',
  statusKey: 'scenes:limits', // what the worker last saw of its own minute (shown on the page)
};

export { scenes };
