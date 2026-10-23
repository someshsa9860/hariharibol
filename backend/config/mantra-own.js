// Limits for the mantras a reader adds themselves (Jap tab → Add your mantra). Fixed in code on purpose: they are
// the guard rails around the only place a reader's words reach an AI provider outside the chat, so changing one is
// a reviewed change, not a setting. See "Readers' own mantras" in backend/CLAUDE.md.

// What the reader typed or said, after cleaning. Long enough for a full verse, short enough that it is plainly
// a mantra and not an essay.
export const INPUT_MIN_CHARS = 2;
export const INPUT_MAX_CHARS = 200;

// How many related mantras the AI is asked for, and how many of them a reader may take at once.
export const MAX_SUGGESTIONS = 8;
export const MAX_PICKS = 5;

// The suggestions are kept on the server between the two steps. The reader sends back only which ones they chose,
// never the text, so nothing but what the AI itself suggested can ever be saved.
export const SUGGESTION_TTL_SECONDS = 3600;

// Per reader, per day (UTC). A suggestion is one AI call, a creation is one more.
export const SUGGESTS_PER_DAY = 20;
export const CREATES_PER_DAY = 10;

// A reader's own mantras (private ones they hold access to), so the list cannot grow without end.
export const MAX_OWN_MANTRAS = 50;

// Readers who can open a private mantra before it becomes the catalogue's own. "11 or more".
export const PUBLIC_AFTER_READERS = 11;

// Where a mantra sits in the Jap list: a reader's own first, a promoted one after the curated catalogue.
export const PRIVATE_DISPLAY_ORDER = -1;
export const PROMOTED_DISPLAY_ORDER = 1000;

// A picture the reader uploads in place of the one we found.
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_MAX_EDGE = 1024;

// Finding a public picture. The search is Wikimedia Commons' own, and only files marked public domain or CC0 are
// taken; anything slower than this is as good as no picture, and the reader can add one.
export const IMAGE_SEARCH_TIMEOUT_MS = 6000;
export const IMAGE_SEARCH_URL = 'https://commons.wikimedia.org/w/api.php';

// One recitation of a mantra with no recording, in milliseconds, worked out from its length: the counter needs a
// pace before the reader has chanted it once. A syllable takes about 0.4 s; never under 1.5 s or over 30 s.
export const MS_PER_SYLLABLE = 400;
export const MIN_DURATION_MS = 1500;
export const MAX_DURATION_MS = 30_000;

// Everything counted in 108s unless the mantra says otherwise.
export const DEFAULT_STANDARD_COUNT = 108;

// The AI answers in JSON; this much room is enough for five mantras in the longest scripts.
export const SUGGEST_MAX_TOKENS = 1500;
export const DETAILS_MAX_TOKENS = 4000;
export const TRANSLATE_MAX_TOKENS = 4000;
