// Pure rules for AI backgrounds: the prompt that is sent, and whether a request may start. No I/O.

const MAX_PROMPT = 400;

// Added to every prompt so the picture is a background, not a poster: readable centre, and no lettering to
// misspell Sanskrit. Always English; the user's own words come first.
const SUFFIX = 'Soft, elegant composition with calm open space in the centre for text. No letters, no words, no typography, no watermark, no people\'s faces.';

/** The prompt as the image model gets it, or null when the user's text is empty after cleaning. */
export function buildPrompt(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_PROMPT);
  if (text.length < 3) return null;
  return `${text}. ${SUFFIX}`;
}

/** Can a generation start? `spendable` is tokens available now (ai-credits.spendable), `cost` what it costs. */
export function canAfford({ spendable, cost }) {
  return spendable >= cost;
}

/** What a request with this key already is: decides charge / replay / wait. */
export function planFor(existing) {
  if (!existing) return 'START';
  if (existing.status === 'DONE') return 'REPLAY';
  if (existing.status === 'FAILED') return 'RETRY'; // refunded at failure, so a retry charges once
  return 'WAIT'; // PENDING: another request with this key is in flight
}
