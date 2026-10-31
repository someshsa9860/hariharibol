// How the admin panel's narration runs behave: which text-to-speech engines, voices and languages there are, what each
// one costs and allows, and where the audio goes. Read by utils/narration.js, services/narration*.js,
// jobs/processors/narration.js and controllers/admin/narration.js. The run plumbing (heartbeat, retries, the limits)
// is the translation one on purpose: a narration run is the same kind of long, resumable job.

import env from './env.js';
import { translation } from './translation.js';

// The thirty voices both Google engines share. A voice name is only a choice here: whether a given voice speaks a given
// language is checked by the engine, and a refusal shows in the compare cell or the run's error.
const SHARED_VOICES = [
  'Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Aoede', 'Autonoe', 'Callirrhoe', 'Charon', 'Despina',
  'Enceladus', 'Erinome', 'Fenrir', 'Gacrux', 'Iapetus', 'Kore', 'Laomedeia', 'Leda', 'Orus', 'Puck',
  'Pulcherrima', 'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Sulafat', 'Umbriel', 'Vindemiatrix', 'Zephyr',
  'Zubenelgenubi',
];

// Gemini TTS models named in Google's audio-generation docs. The setting, when given, is the default one.
const GEMINI_TTS_MODELS = [
  'gemini-3.8-flash-tts',
  'gemini-3.8-flash-lite-tts',
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts',
];

// Prices are NOT verified. The Chirp figure is from third-party price summaries; Google's Gemini TTS price is not
// known here, so it is null and the admin page says the cost cannot be shown. Each price carries `verified: false`
// until someone has checked it against Google's own price list.
const engines = {
  'google-chirp': {
    label: 'Google Chirp 3 HD',
    company: 'Google',
    keyEnv: 'GOOGLE_TTS_API_KEY',
    models: ['chirp-3-hd'],
    voices: SHARED_VOICES,
    format: { ext: 'mp3', contentType: 'audio/mpeg' },
    // Cloud Text-to-Speech takes at most 5,000 bytes of text in one request; a verse is split under this.
    maxBytes: 4_500,
    rpm: 200, // requests a minute
    price: { usdPerMillionChars: 30, verified: false, source: 'third-party price summaries; not checked against Google' },
  },
  'gemini-tts': {
    label: 'Gemini TTS',
    company: 'Google',
    keyEnv: 'GEMINI_API_KEY',
    models: env.NARRATION_GEMINI_TTS_MODEL
      ? [env.NARRATION_GEMINI_TTS_MODEL, ...GEMINI_TTS_MODELS.filter((m) => m !== env.NARRATION_GEMINI_TTS_MODEL)]
      : GEMINI_TTS_MODELS,
    voices: SHARED_VOICES,
    // Gemini TTS answers with WAV (24 kHz, mono, 16-bit) unless asked otherwise; WAV is stored as it comes.
    format: { ext: 'wav', contentType: 'audio/wav' },
    // The docs give no input limit for this model; kept low until one is measured.
    maxBytes: 2_000,
    rpm: 10, // a conservative default until the free tier's limits are known
    price: { usdPerMillionChars: null, verified: false, source: null },
  },
};

// The languages a verse can be narrated in, and the code each engine is asked for. English is the Prabhupāda
// commentary's English meaning; Hindi is the Hindi meaning (see services/narration.js for where each is read from).
const languages = {
  en: { label: 'English', code: 'en-US' },
  hi: { label: 'Hindi', code: 'hi-IN' },
};

const narration = {
  ...translation,

  engines,
  languages,
  defaults: { engine: 'google-chirp', model: 'chirp-3-hd', voice: 'Kore', language: 'en' },

  // Bumped when the text sent to an engine, or how a clip is made, changes in a way that should remake every clip.
  // It is part of every text hash, so a bump makes the next run remake clips rather than skip them.
  pipelineVersion: 'narration-1',

  // Where the audio lives in S3: narration/api/<book>/<lang>/<engine>/<model>/<voice>/[<canto>/]<chapter>/<verse>.<ext>,
  // with an _index.json beside each voice's folder. "narration/api" keeps it apart from the narration tool's own
  // narration/<book>/... layout and from the guru narrations under narrations/audio.
  folder: 'narration/api',
  indexFile: '_index.json',

  feedKey: 'narration:feed',

  // How many targets one voice comparison may ask for at once.
  maxTargets: 6,

  // How many clips a target may fail in a row, one after another, before the run stops using that target.
  maxFailedInARow: 5,

  // One request to a text-to-speech engine. A verse is cut into a few of these, so this is per piece, not per verse.
  requestTimeoutMs: 120_000,
};

export { narration, engines, languages, SHARED_VOICES };
