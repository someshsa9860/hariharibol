// What the app is told when a reply fails after it has started streaming.
//
// The app writes its own words for every `code`, in the reader's language, and shows nothing the server
// wrote (ChatProblemNotice). `message` is a last resort for a client that does not know the code.
//
// Why a table: an error from the provider or from our own code is developer text — "Gemini is not
// configured", "The monthly AI budget is spent", a provider's response body, a database message. Those are
// logged for whoever runs the server and never sent. The only errors passed through as written are the chat's
// own, which are written for the reader.

import { AppError } from './errors.js';

// Thrown by the chat itself (controllers/app/chat.js), in words meant for the reader.
const OWN_CODES = new Set([
  'CREDITS_EXHAUSTED',
  'CHAT_NOT_AVAILABLE',
  'CONVERSATION_LIMIT',
  'MESSAGE_TOO_LONG',
  'NOTHING_TO_REGENERATE',
]);

const BUSY = { code: 'AI_BUSY', message: 'Sakha is busy right now. Please try again in a moment.', retryable: true };
const UNAVAILABLE = {
  code: 'AI_UNAVAILABLE',
  message: 'Sakha is not available right now. Please try again a little later.',
  retryable: true,
};
const FAILED = { code: 'AI_FAILED', message: 'Sakha could not finish that reply. Please try again.', retryable: true };
const BROKEN = { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.', retryable: true };

// By the code services/ai/ gives its failures. Several collapse into one: the reader can do nothing different
// about a missing key, a wrong provider name or a spent monthly budget.
const BY_CODE = {
  AI_BUSY: BUSY,
  AI_UNAVAILABLE: UNAVAILABLE,
  AI_MISCONFIGURED: UNAVAILABLE,
  // Nothing recovers this until the budget is raised or the month turns, so no "Try again".
  AI_BUDGET_EXHAUSTED: { ...UNAVAILABLE, retryable: false },
  AI_FAILED: FAILED,
  AI_BAD_OUTPUT: FAILED,
};

/**
 * The `error` event for a failure: `{ code, message, retryable }`, plus `details` for the chat's own errors
 * (the credits card needs them). Anything that is not an AppError is a bug, and is reported as one.
 */
function forReader(error) {
  if (error instanceof AppError) {
    if (OWN_CODES.has(error.code)) {
      return { code: error.code, message: error.message, retryable: error.status >= 500, details: error.details };
    }
    return { ...(BY_CODE[error.code] || BROKEN) };
  }
  return { ...BROKEN };
}

export { forReader };
