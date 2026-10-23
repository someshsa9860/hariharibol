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
  'This sign-in is no longer valid': 'sessionEnded',
  'This account does not have developer access': 'noAccess',
  'That purchase is for a different product': 'purchaseFailed',
  'That subscription could not be applied': 'purchaseFailed',
  'That order was not created here': 'purchaseFailed',
  'That purchase belongs to another account': 'notYours',
  'Ask Sakha is not part of your plan yet.': 'premiumRequired',
  'Pictures are not available right now.': 'serviceUnavailable',
  'Backgrounds are not available right now': 'serviceUnavailable',
  'Please wait for the current reply to finish': 'waitForReply',
  'No file was sent': 'noFile',
  'No picture was sent': 'noFile',
  'That is not a usable picture': 'badPicture',
  'That picture cannot be used': 'badPicture',
  'That is not an uploaded picture': 'badPicture',
  'That is not a usable music file': 'badMusic',
  'That file is too large': 'fileTooLarge',
  'That picture is too large': 'fileTooLarge',
  'You cannot post reels': 'cannotPostReels',
  'You have made a lot of reels today. Please try again tomorrow.': 'tryTomorrow',
  'You have written in a lot today — please try again tomorrow': 'tryTomorrow',
  'Feedback needs a rating': 'feedbackNeedsRating',
  'Tell us what happened': 'tellWhatHappened',
  'Describe the background in a few words': 'describeBackground',
  'This link is not available': 'linkUnavailable',
  'No longer available': 'gone',
  'Could not process the request': 'invalidInput',
  'Malformed query': 'invalidInput',
  'That is not a valid id for this kind of content': 'invalidInput',
  'Related record is missing or still in use': 'inUse',
  'That change would break a required relation': 'inUse',
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
  [/^Already exists(?:: .*)?$/, 'alreadyExists'],
  [/^An account already exists for this email\. Please sign in with (.+)\.$/, 'accountExistsWith'],
  [/^An account already exists for this email\. Please sign in another way\.$/, 'accountExistsOther'],
  [/^This account now signs in with (.+)\. Please sign in that way\.$/, 'signsInWith'],
  [/^Please keep a message under (\d+) characters\.$/, 'messageTooLong'],
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

// The English of every notification wording, and the greeting. English is the source
// (there is no locales/en.json), so it is kept here; each id must also be in every
// file in `locales/`. A body that follows the greeting starts in lower case in English
// ("Hari Bol Somesh, your chanting time is here.") — the other scripts have no case.
const NOTICES = {
  hariBol: 'Hari Bol',
  slokaTitle: 'Your sloka for today',
  slokaFallback: 'A verse chosen for you.',
  slokaReason: 'Because you mentioned {0}',
  etiquetteTitle: 'Devotee etiquette',
  chantTitle: 'Time to chant',
  chantRoundLeft: '1 round left today.',
  chantRoundsLeft: '{0} rounds left today.',
  chantNow: 'your chanting time is here.',
  festivalToday: '{0} today',
  festivalTomorrow: '{0} tomorrow',
  festivalInDays: '{0} in {1} days',
  festivalVaishnava: 'Vaishnavas keep it on {0}.',
  paranaTitle: 'Fast-breaking time: {0} to {1}',
  paranaBody: 'Break your {0} fast today, between {1} and {2} ({3} time).',
  paranaBodyIfYesterday: 'If you kept the {0} fast yesterday, break it today, between {1} and {2} ({3} time).',
  paranaFastToday: 'Keeping the fast today instead? Break it tomorrow.',
  pakshaShukla: 'Shukla paksha',
  pakshaKrishna: 'Krishna paksha',
  thanksTitle: 'Thank you',
  thanksDonation: 'your donation keeps HariHariBol running. Premium is yours, permanently.',
  subTrialTitle: 'Your {0} free trial has begun',
  subTrialBody: 'enjoy {0} free until {1}. Cancel any time in {2}.',
  subSubscribedTitle: 'Plan upgraded to {0}',
  subSubscribedBody: 'thank you! {0} is active until {1}. Ask Sakha is ready for more.',
  subChangedTitle: 'Your plan is now {0}',
  subChangedBody: '{0} is active until {1}.',
  subDowngradeTitle: 'Your plan will change to {0}',
  subDowngradeBody: 'you keep your current plan until {1}, then move to {0}.',
  subRenewedTitle: 'Subscription renewed',
  subRenewedBody: '{0} renewed. Active until {1}. Thank you for your support!',
  subCancelledTitle: 'Subscription cancelled',
  subCancelledBody: '{0} will not renew. You keep it until {1}.',
  subResumedTitle: 'Auto-renew is back on',
  subResumedBody: '{0} will renew on {1}.',
  subGraceTitle: 'We could not renew your plan',
  subGraceBody: '{2} could not take the payment. Please update your payment method to keep {0}.',
  subExpiredTitle: 'Your subscription has ended',
  subExpiredBody: '{0} has ended. You can come back any time from Plans.',
  subRefundedTitle: 'Your payment was refunded',
  subRefundedBody: '{0} has ended with the refund.',
  referralTitle: 'A month of {0} is yours',
  referralBody: 'someone you invited has begun chanting. {0} is active until {1}.',
  supportReplyTitle: 'Reply from HariHariBol support',
  devReplyTitle: 'Message from the developer',
  reelCommentTitle: '{0} commented on your reel',
  reelReplyTitle: '{0} replied to you',
  someone: 'Someone',
};

/** The wording `id` in the first language of `chain` that has it; English when none does. */
const notice = (id, chain, params = []) => text(id, chain, params) || fill(NOTICES[id], params);

/** "Hari Bol Somesh" in the reader's script; "Hari Bol" alone when there is no usable name. */
const hariBol = (name, chain) => [notice('hariBol', chain), name].filter(Boolean).join(' ');

/** A sentence that opens with the greeting: "Hari Bol Somesh, 3 rounds left today." */
const greeted = (name, chain, sentence) => `${hariBol(name, chain)}, ${sentence}`;

/** A title that opens with the greeting: "Hari Bol Somesh — Your sloka for today". */
const greetedTitle = (name, chain, title) => `${hariBol(name, chain)} — ${title}`;

// The daily sloka's wording, kept as its own names for the callers that have always used them.
const slokaTitle = (chain) => notice('slokaTitle', chain);
const etiquetteTitle = (chain) => notice('etiquetteTitle', chain);
const slokaFallback = (chain) => notice('slokaFallback', chain);
const slokaReason = (issueName, chain) => notice('slokaReason', chain, [issueName]);

export {
  translateError,
  text,
  notice,
  hariBol,
  greeted,
  greetedTitle,
  slokaTitle,
  etiquetteTitle,
  slokaFallback,
  slokaReason,
  catalog,
  NOTICES,
};
