// The reader's first name, kept out of every prompt. Pure, so test/chat-name.test.js covers it.
//
// Sakha is told to write `{name}` wherever it would say the person's name (config/chat.js), and the token is filled in
// here, on its way to the phone: piece by piece while the reply streams, and when a saved message is shown. What is
// stored keeps the token, so the name never comes back into the history the model reads, the summary it is given, or
// the request a provider logs.

import { NAME_TOKEN } from '../config/chat.js';

const NAME_MAX = 30;

// Any letter or mark of any script, the joiners some scripts need inside a name, and the few marks a name can hold.
// Nothing markdown would act on: the account name is typed by the person (or their Google profile) and ends up in text
// that is drawn as markdown.
const NOT_IN_A_NAME = /[^\p{L}\p{M}‌‍'’.-]/gu;

const TOKEN = new RegExp(NAME_TOKEN.replace(/[{}]/g, '\\$&'), 'gi');
// A token that may still be arriving: `{`, `{n`, `{na`, `{nam`, `{name` at the very end of what has come so far.
const ARRIVING = /\{(?:n(?:a(?:m(?:e)?)?)?)?$/i;

/** The first word of the account name, cleaned; null when there is nothing usable. */
export function firstNameOf(fullName) {
  const word = String(fullName || '').trim().split(/\s+/)[0] || '';
  const clean = [...word.replace(NOT_IN_A_NAME, '')].slice(0, NAME_MAX).join('');
  return /\p{L}/u.test(clean) ? clean : null;
}

// A name replaces the token; with no name the token goes, and the comma that set it off with it.
function swap(text, name) {
  if (!text) return text;
  if (name) return text.replace(TOKEN, () => name);
  return text
    .replace(new RegExp(`\\s*,\\s*${TOKEN.source}`, 'gi'), '')
    .replace(new RegExp(`${TOKEN.source}\\s*,\\s*`, 'gi'), '')
    .replace(new RegExp(` ?${TOKEN.source}`, 'gi'), '');
}

/** A finished message as the reader sees it. */
export function fill(text, name) {
  return swap(text, name);
}

/**
 * For a reply that arrives in pieces: `push(piece)` returns what is safe to send now, `flush()` what was held back.
 * A token can be cut anywhere (`…{na` | `me}…`), so the end of a piece that might be the start of one waits for the
 * next. Text with no name has no comma tidying here — what has been sent cannot be taken back — so the saved message
 * is the one that reads cleanly.
 */
export function createFiller(name) {
  let held = '';
  return {
    push(piece) {
      const text = held + piece;
      const from = text.search(ARRIVING);
      held = from === -1 ? '' : text.slice(from);
      const ready = from === -1 ? text : text.slice(0, from);
      return name ? swap(ready, name) : ready.replace(TOKEN, '');
    },
    flush() {
      const rest = held;
      held = '';
      return name ? swap(rest, name) : rest.replace(TOKEN, '');
    },
  };
}
