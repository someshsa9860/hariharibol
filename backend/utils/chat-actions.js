// "Take me there": Sakha can offer to open a page, a mantra or a verse in the app.
//
// The model never calls anything. When — and only when — the reader plainly asks to be taken somewhere, it ends its
// reply with one marker, `[[open:page:reels]]`, `[[open:mantra:maha mantra]]` or `[[open:verse:bhagavad-gita:2.47]]`.
// The server takes the marker out of the text on its way to the phone (`createFilter`, chunk-safe like the {name}
// filler in utils/chat-name.js), checks the place really exists (services/chat-actions.js) and sends it as an
// `action` event. The app shows it as a card and opens nothing until the reader taps Open — a model can guess wrong,
// so a person always decides.
//
// Pure: no database, no I/O.

/** The app's own pages Sakha may offer, by the id used in a marker. The app maps each id to a route. */
export const PAGES = ['home', 'jap', 'reels', 'read', 'routine', 'settings', 'plans', 'search'];

const PREFIX = '[[open:';
const SUFFIX = ']]';
// A real marker is short; anything longer is ordinary text that happened to start with the same characters.
const MAX_MARKER = 160;

/**
 * What a marker says, or null when it is not one we know.
 *   page:reels                        → { kind: 'page', page: 'reels' }
 *   mantra:maha mantra                → { kind: 'mantra', query: 'maha mantra' }
 *   verse:bhagavad-gita:2.47          → { kind: 'verse', book: 'bhagavad-gita', numbers: [2, 47] }
 *   verse:srimad-bhagavatam:1.2.6     → { kind: 'verse', book: 'srimad-bhagavatam', numbers: [1, 2, 6] }
 */
export function parse(marker) {
  if (typeof marker !== 'string' || !marker.startsWith(PREFIX) || !marker.endsWith(SUFFIX)) return null;
  const body = marker.slice(PREFIX.length, -SUFFIX.length).trim();
  const colon = body.indexOf(':');
  if (colon < 1) return null;
  const kind = body.slice(0, colon).trim().toLowerCase();
  const rest = body.slice(colon + 1).trim();
  if (!rest) return null;

  if (kind === 'page') {
    const page = rest.toLowerCase();
    return PAGES.includes(page) ? { kind: 'page', page } : null;
  }
  if (kind === 'mantra') {
    return rest.length <= 100 ? { kind: 'mantra', query: rest } : null;
  }
  if (kind === 'verse') {
    const split = rest.lastIndexOf(':');
    if (split < 1) return null;
    const book = rest.slice(0, split).trim().toLowerCase();
    const numbers = rest.slice(split + 1).trim().split('.');
    const valid = numbers.length >= 2 && numbers.length <= 3 && numbers.every((n) => /^\d{1,4}$/.test(n.trim()));
    if (!book || book.length > 60 || !valid) return null;
    return { kind: 'verse', book, numbers: numbers.map((n) => Number(n)) };
  }
  return null;
}

/**
 * A filter for streamed text. `push(chunk)` returns `{ text, actions }`: the text that is safe to show, with any marker
 * removed, and the actions found. Text that might be the start of a marker is held back until it is known to be one or
 * not. `flush()` returns whatever is left at the end of the stream (a marker cut short is dropped, not shown).
 * Only the first action of a reply is kept — one offer at a time.
 */
export function createFilter() {
  let buffer = '';
  const actions = [];

  const take = () => {
    const found = actions.splice(0);
    return found;
  };

  function drain(atEnd) {
    let text = '';
    for (;;) {
      const start = buffer.indexOf('[[');
      if (start === -1) {
        // A single "[" at the end may be the first half of "[[".
        const keep = !atEnd && buffer.endsWith('[') ? 1 : 0;
        text += buffer.slice(0, buffer.length - keep);
        buffer = buffer.slice(buffer.length - keep);
        return text;
      }
      text += buffer.slice(0, start);
      buffer = buffer.slice(start);

      const end = buffer.indexOf(SUFFIX);
      const couldBeMarker = PREFIX.startsWith(buffer.slice(0, PREFIX.length).toLowerCase()) || buffer.toLowerCase().startsWith(PREFIX);
      if (!couldBeMarker) {
        // "[[" that is not ours: ordinary text.
        text += buffer.slice(0, 2);
        buffer = buffer.slice(2);
        continue;
      }
      if (end === -1) {
        if (!atEnd && buffer.length < MAX_MARKER) return text;
        // Never closed: drop a marker cut short at the end; a long run is just text.
        if (atEnd) {
          buffer = '';
          return text;
        }
        text += buffer.slice(0, 2);
        buffer = buffer.slice(2);
        continue;
      }
      const marker = buffer.slice(0, end + SUFFIX.length);
      buffer = buffer.slice(end + SUFFIX.length);
      if (marker.length > MAX_MARKER) {
        text += marker;
        continue;
      }
      const action = parse(marker);
      if (action && actions.length === 0) actions.push(action);
      // A marker is removed whether or not it was understood; so is the space it leaves behind.
      buffer = buffer.replace(/^[ \t]+(?=\n|$)/, '');
    }
  }

  return {
    push(chunk) {
      buffer += chunk;
      const text = drain(false);
      return { text, actions: take() };
    },
    flush() {
      const text = drain(true);
      buffer = '';
      return { text, actions: take() };
    },
  };
}

/** Takes the markers out of a finished text: `{ text, action }` (the first understood marker, or null). */
export function extract(text) {
  const filter = createFilter();
  const a = filter.push(text || '');
  const b = filter.flush();
  return { text: (a.text + b.text).trimEnd(), action: a.actions[0] || b.actions[0] || null };
}
