// Counts tokens locally, on the backend, before anything is sent.
//
// Used for three things: deciding when a conversation needs compacting, the
// pre-check that a user can afford a call, and an estimate for a reply that was
// cut off before the provider reported usage. What is *charged* for a finished
// call is always the provider's own count — see services/ai-wallet.js.
//
// `js-tiktoken` is pure JavaScript (no native build, no WASM), and its o200k
// encoding is OpenAI's. Gemini tokenizes differently, so for Gemini this is an
// estimate; a safety factor is applied to keep the pre-check from
// under-reading. Devanagari costs noticeably more tokens than English, which
// the encoding captures and a characters-divided-by-four rule would not.

import { Tiktoken } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';

import { IMAGE_TOKEN_ESTIMATE } from '../../config/chat.js';

// Providers other than OpenAI count a little differently; 10% over is a
// cheap way to stay on the safe side of a limit.
const SAFETY_FACTOR = 1.1;

// Per-message framing the chat formats add (role markers etc.).
const MESSAGE_OVERHEAD = 4;

let encoder = null;
function getEncoder() {
  if (!encoder) encoder = new Tiktoken(o200k_base);
  return encoder;
}

/**
 * Builds the encoder now. Its tables take a few hundred milliseconds to construct, all on the event loop, so the
 * first person to chat after a deploy would otherwise wait for them — and so would everyone else's requests.
 */
export function warmUp() {
  getEncoder().encode('warm up');
}

/** Tokens in a string, as the encoder counts them (no safety factor). */
export function countText(text) {
  if (!text) return 0;
  return getEncoder().encode(String(text)).length;
}

/** Estimated tokens for a string, rounded up with the safety factor. */
export function estimate(text) {
  return Math.ceil(countText(text) * SAFETY_FACTOR);
}

/**
 * Estimated tokens for a list of `{ role, content }` messages. A message that carries a picture (`image`, or the
 * `imageKey` it is fetched by) costs [imageTokens] more; the provider reports the true figure once it has answered.
 */
export function estimateMessages(messages, imageTokens = IMAGE_TOKEN_ESTIMATE) {
  return messages.reduce(
    (sum, m) => sum + estimate(m.content) + MESSAGE_OVERHEAD + (m.image || m.imageKey ? imageTokens : 0),
    0
  );
}

/** Cuts text to at most `maxTokens` tokens (encoder count), on a token boundary. */
export function truncateToTokens(text, maxTokens) {
  if (!text) return '';
  const enc = getEncoder();
  const ids = enc.encode(String(text));
  if (ids.length <= maxTokens) return String(text);
  return enc.decode(ids.slice(0, Math.max(0, maxTokens)));
}

export { MESSAGE_OVERHEAD, SAFETY_FACTOR };
