// The words the server itself says to a person — error messages and the daily
// sloka's title — in the language they asked for. Not content: verses, meanings
// and names come from the database and `utils/language.js`.
//
// Controllers keep throwing English (`notFound('Verse')`, `badRequest('…')`).
// The error middleware looks the message up here and swaps in the person's
// language, so no throw site changes when a language is added. A message with no
// entry — anything meant for a developer, or a language not translated yet —
// goes out in English.
//
//   locales/<lang>.json    id → text, `{0}` / `{1}` for values
//   RULES below            which English message is which id
//
// Adding a message: add its id to every file in `locales/` (`npm test` fails when
// one is missing), then a rule here that recognises the English text.

import { readdirSync, readFileSync } from 'node:fs';
import { DEFAULT_LANGUAGE } from '../config/constants.js';

const LOCALES_DIR = new URL('../locales/', import.meta.url);

const catalog = {};
for (const file of readdirSync(LOCALES_DIR)) {
  if (!file.endsWith('.json')) continue;
  catalog[file.slice(0, -'.json'.length)] = JSON.parse(readFileSync(new URL(file, LOCALES_DIR), 'utf8'));
}

// English message → id. A string matches exactly; a RegExp's capture groups
// become `{0}`, `{1}` in the text.
const EXACT = {
  'Something went wrong on our side.': 'serverError',
  'Something went wrong': 'serverError',
  'Too many requests. Please slow down and try again.': 'rateLimited',
  'Too many requests': 'rateLimited',
  'Bad request': 'invalidInput',
  'Authentication required': 'authRequired',
  'You do not have access to this': 'noAccess',
  'This client is not recognised': 'noAccess',
  'Attestation is unavailable': 'noAccess',
  'This feature is part of Premium': 'premiumRequired',
  'This account is banned': 'banned',
  'New accounts are closed at the moment': 'signupClosed',
  'This sign-in did not return an email address': 'noEmail',
  'Google account email is not verified': 'emailNotVerified',
  'Account no longer exists': 'sessionEnded',
  'Access token expired': 'sessionEnded',
  'Invalid access token': 'sessionEnded',
  'Wrong token type': 'sessionEnded',
  'Invalid refresh token': 'sessionEnded',
  'Refresh token expired': 'sessionEnded',
  'Session was revoked': 'sessionEnded',
  'Refresh token already used. Please sign in again.': 'sessionEnded',
  'Could not verify the Google sign-in': 'signInFailed',
  'Could not verify the Apple sign-in': 'signInFailed',
  'Google token has no subject': 'signInFailed',
  'Apple token has no subject': 'signInFailed',
  'A code was just sent. Please wait a moment before asking again.': 'codeJustSent',
  'That code has expired. Please request a new one.': 'codeExpired',
  'Too many incorrect codes. Please request a new one.': 'codeTooMany',
  'That is not your session': 'notYours',
  'That is not your task': 'notYours',
  'That comment is not yours to delete': 'notYours',
  'That order belongs to someone else': 'notYours',
  'Only the creator can pin a comment on their reel': 'notYours',
  'You cannot follow yourself': 'cannotFollowSelf',
  'That task was moved to another day. Edit the copy on that day instead.': 'taskMoved',
  'That task has already been moved': 'taskMoved',
  'That task is already done': 'taskDone',
  'A task can only be moved forward': 'taskMoveForward',
  'Expected a date as YYYY-MM-DD': 'badDate',
  'That session is already finished': 'sessionFinished',
  'The store could not confirm that purchase': 'purchaseFailed',
  'Google Play does not recognise this purchase': 'purchaseFailed',
  'Apple does not recognise this transaction': 'purchaseFailed',
  'That subscription is not active': 'purchaseFailed',
  'Payment signature did not verify': 'purchaseFailed',
  'That upload has expired — upload it again': 'uploadExpired',
};

const PATTERNS = [
  [/^(.+) not found$/, 'notFound'],
  [/^No route for /, 'noRoute'],
  [/^Invalid (?:body|query|params)$/, 'invalidInput'],
  [/^Incorrect code\. (\d+) attempts left\.$/, 'codeIncorrect'],
  [/^The smallest donation is (.+)$/, 'minDonation'],
  [/^Not a recognised timezone: (.+)$/, 'badTimezone'],
  [/^Unknown or inactive language: (.+)$/, 'badLanguage'],
  [/^(.+) cannot be used as .+$/, 'badLanguage'],
];

// Failures of something we depend on, told by code: what the person can do is
// the same whichever provider it was.
const BY_CODE = {
  PAYMENTS_UNAVAILABLE: 'serviceUnavailable',
  PAYMENT_LOOKUP_FAILED: 'serviceUnavailable',
  PAYMENT_FAILED: 'serviceUnavailable',
  AI_UNAVAILABLE: 'serviceUnavailable',
  AI_FAILED: 'serviceUnavailable',
  AI_BAD_OUTPUT: 'serviceUnavailable',
  AI_BUDGET_EXHAUSTED: 'serviceUnavailable',
  LEGACY_UNAVAILABLE: 'serviceUnavailable',
};

function idFor(message, code) {
  if (EXACT[message]) return { id: EXACT[message], params: [] };
  for (const [pattern, id] of PATTERNS) {
    const match = pattern.exec(message);
    if (match) return { id, params: match.slice(1) };
  }
  if (BY_CODE[code]) return { id: BY_CODE[code], params: [] };
  return null;
}

const fill = (text, params) => text.replace(/\{(\d+)\}/g, (_, i) => params[i] ?? '');

/** The text for an id in the first language of `chain` that has it, or null. */
function text(id, chain, params = []) {
  for (const code of chain) {
    const found = catalog[code]?.[id];
    if (found) return fill(found, params);
    if (code === DEFAULT_LANGUAGE) break; // English is the source — its text is the caller's own
  }
  return null;
}

/**
 * An error message in the person's language. Returns the English message
 * unchanged when it has no entry or the language has none yet.
 */
function translateError({ message, code }, chain) {
  const hit = idFor(message, code);
  return (hit && text(hit.id, chain, hit.params)) || message;
}

const SLOKA_TITLE = 'Your sloka for today';
const SLOKA_FALLBACK = 'A verse chosen for you.';
const SLOKA_REASON = 'Because you mentioned {0}';

/** The daily sloka's wording, in the first language of `chain` that has it. */
const slokaTitle = (chain) => text('slokaTitle', chain) || SLOKA_TITLE;
const slokaFallback = (chain) => text('slokaFallback', chain) || SLOKA_FALLBACK;
const slokaReason = (issueName, chain) =>
  text('slokaReason', chain, [issueName]) || fill(SLOKA_REASON, [issueName]);

export { translateError, text, slokaTitle, slokaFallback, slokaReason, catalog };
