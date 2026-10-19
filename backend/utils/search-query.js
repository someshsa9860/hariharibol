// What a search box needs to forgive: the spelling of a Sanskrit word in Roman letters
// ("krishna", "krsna", "kṛṣṇa"), a typo, a missing or extra space, and a book named by
// whatever someone calls it ("gita", "bhagvat gita", "sb"). Pure functions only — the
// words the library holds come from `services/search-vocabulary.js`.
//
// How a misspelt word is found: every word is reduced to a rough *sound key* (below);
// words that sound alike share a key, and keys a letter or two apart are close enough
// to be the same word. The stored spellings behind those keys are then matched against
// the text as they are written there, diacritics and all. Nothing here edits the
// database, and a word typed in Devanagari or any other script is matched as typed.

const LATIN = /^[\p{Script=Latin}\p{M}]+$/u;

// IAST letters that a keyboard cannot type, as the plain letters they are said as.
// Done before the generic accent strip: ṛ is "ri" ("kṛṣṇa" is said "krishna"), not "r".
const IAST = {
  ṛ: 'ri', ṝ: 'ri', ḷ: 'li', ḹ: 'li',
  ś: 's', ṣ: 's',
  ṅ: 'n', ñ: 'n', ṇ: 'n',
  ṃ: 'm', ṁ: 'm', ḥ: 'h',
  ṭ: 't', ḍ: 'd',
  ā: 'a', ī: 'i', ū: 'u',
};

/** Lower-case, accents and IAST marks removed, anything but letters and digits a space. */
function fold(text) {
  const lower = String(text || '').toLowerCase();
  let out = '';
  for (const ch of lower) out += IAST[ch] ?? ch;
  return out
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * The sound of a Roman word, roughly. "bhagavad", "bhagvad" and "bhagwad" all come out
 * as "bagavad"/"bagvad"/"bagvad" — one or two letters apart, which the distance check then
 * forgives. Long vowels are short, aspirates are plain, sh/ch/ph fold, w is v, doubled
 * letters are single.
 */
function soundKey(word) {
  let s = fold(word).replace(/\s+/g, '');
  s = s
    .replace(/sh/g, 's')
    .replace(/ph/g, 'f')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/(.)\1+/g, '$1')
    .replace(/h/g, '')
    .replace(/(.)\1+/g, '$1');
  // "krishna" has an i that "kṛṣṇa" folds to as well; "krsna" typed without it is the
  // same word, so a lone r between a consonant and a consonant gets its i back.
  s = s.replace(/([^aeiou])r(?=[^aeiou]|$)/g, '$1ri');
  return s;
}

function isLatin(word) {
  return LATIN.test(word);
}

/** Edit distance with swaps counted once, giving up (Infinity) past `max`. */
function distance(a, b, max) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return Infinity;
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      row[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return Infinity;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length] <= max ? prev[b.length] : Infinity;
}

/** How many letters of a sound key may differ and still be the same word. */
function tolerance(length) {
  if (length >= 6) return 2;
  if (length >= 3) return 1;
  return 0;
}

// ─── the words the library holds ─────────────────────────────────────────────

/** Words by sound key. Build it once from `[{ word, n }]` (how often each is written). */
class Vocabulary {
  constructor(entries = []) {
    this.byKey = new Map();
    for (const { word, n } of entries) {
      if (!isLatin(word)) continue;
      const key = soundKey(word);
      if (key.length < 2) continue;
      let bucket = this.byKey.get(key);
      if (!bucket) this.byKey.set(key, (bucket = []));
      bucket.push({ word, n: n || 1 });
    }
    for (const bucket of this.byKey.values()) bucket.sort((a, b) => b.n - a.n);
    this.keys = [...this.byKey.keys()];
  }

  get size() {
    return this.byKey.size;
  }

  has(word) {
    return this.byKey.has(soundKey(word));
  }

  weight(key) {
    return this.byKey.get(key)?.reduce((sum, e) => sum + e.n, 0) ?? 0;
  }

  /**
   * The stored spellings a typed word could be.
   *
   * `exact`  — words that sound the same (the typed word is spelt right, or nearly).
   * `near`   — words a letter or two away, only looked for when nothing sounds the same.
   * `prefix` — words it could grow into, for the word still being typed.
   * Each list is the commonest first and short; `variants` is the three together.
   */
  lookup(word, { prefix = false, limit = 6 } = {}) {
    const key = soundKey(word);
    const exact = (this.byKey.get(key) || []).slice(0, limit).map((e) => e.word);
    const out = { key, exact, near: [], prefix: [] };

    if (key.length >= 2 && prefix) {
      out.prefix = this.keys
        .filter((k) => k !== key && k.startsWith(key))
        .sort((a, b) => this.weight(b) - this.weight(a))
        .slice(0, limit)
        .flatMap((k) => this.byKey.get(k).slice(0, 2).map((e) => e.word));
    }

    const max = tolerance(key.length);
    if (!exact.length && !out.prefix.length && max > 0) {
      const scored = [];
      for (const k of this.keys) {
        const d = distance(key, k, max);
        if (d !== Infinity) scored.push({ k, d, w: this.weight(k) });
      }
      scored.sort((a, b) => a.d - b.d || b.w - a.w);
      out.near = scored.slice(0, limit).flatMap(({ k }) => this.byKey.get(k).slice(0, 2).map((e) => e.word));
    }

    out.variants = [...new Set([...exact, ...out.near, ...out.prefix])];
    return out;
  }
}

// ─── reading the query ───────────────────────────────────────────────────────

/** `["bhagavad", "gita", "2"]` from "Bhagavad-gita  2" — the words of what was typed. */
function words(text) {
  return String(text || '')
    .split(/[\s​‌‍]+|[.,;:!?()"“”‘’|।॥\-–—]+/u)
    .map((w) => w.trim())
    .filter(Boolean);
}

/**
 * Joins and splits words the way a typist might have got them wrong. "bhaga vad" is one
 * word the library knows; "dharmakshetrekurukshetre" is two. Only done for Roman words
 * the library does not hold as typed.
 */
function respace(list, vocab) {
  if (!vocab || !vocab.size) return list;
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const w = list[i];
    const next = list[i + 1];
    if (next && isLatin(w) && isLatin(next) && !(vocab.has(w) && vocab.has(next)) && vocab.has(w + next)) {
      out.push(w + next);
      i += 1;
      continue;
    }
    if (isLatin(w) && w.length >= 6 && !vocab.has(w)) {
      const cut = splitInTwo(w, vocab);
      if (cut) {
        out.push(...cut);
        continue;
      }
    }
    out.push(w);
  }
  return out;
}

function splitInTwo(word, vocab) {
  let best = null;
  for (let i = 3; i <= word.length - 3; i += 1) {
    const a = word.slice(0, i);
    const b = word.slice(i);
    if (vocab.has(a) && vocab.has(b)) {
      const score = Math.min(a.length, b.length);
      if (!best || score > best.score) best = { score, parts: [a, b] };
    }
  }
  return best ? best.parts : null;
}

/**
 * Each word of the query with the spellings to look for, and the query as it reads once
 * the typos are fixed (`corrected`, null when nothing needed fixing).
 *
 * The last word is also looked for as the start of longer ones — it is still being typed.
 */
function interpret(text, vocab) {
  const typed = words(text);
  const list = respace(typed, vocab);
  const respaced = list.join(' ') !== typed.join(' ');
  let changed = respaced;

  const terms = list.map((word, index) => {
    const literal = word.toLowerCase();
    const variants = new Set([literal]);
    let best = literal;
    if (vocab && vocab.size && isLatin(word)) {
      const found = vocab.lookup(word, { prefix: index === list.length - 1 });
      for (const v of found.variants) variants.add(v);
      // A word is *corrected* only when nothing in the library sounds like it and
      // something merely close was found. A different Roman spelling of a word the
      // library holds ("krishna" for "kṛṣṇa") is the same word, not a mistake.
      if (!found.exact.length && found.near.length) {
        best = found.near[0];
        changed = true;
      }
    }
    return { word, literal, variants: [...variants], best };
  });

  return { terms, corrected: changed ? terms.map((t) => t.best).join(' ') : null };
}

// ─── naming a book ───────────────────────────────────────────────────────────

// How people name the two big books, beyond what a slug gives for free. Matched on the
// slug so a renamed title cannot break it; a book not listed still answers to its slug's
// words and initials.
const EXTRA_ALIASES = [
  { slug: /gita/, names: ['geeta', 'gita', 'bhagavad', 'bhagwad', 'bhagvad', 'bhagavadgita', 'bhagvatgita', 'bhagwatgita', 'bhagavatgita', 'bg'] },
  { slug: /bhagavatam|bhagavata/, names: ['bhagavatam', 'bhagvatam', 'bhagwatam', 'bhagvat', 'bhagwat', 'bhagavat', 'srimad', 'shrimad', 'srimadbhagavatam', 'srimadbhagvatam', 'sb'] },
];

/** The names a book answers to, as sound keys. */
function aliasKeys(book) {
  const slugWords = String(book.slug || '').split('-').filter(Boolean);
  const names = [
    slugWords.join(''),
    slugWords.map((w) => w[0]).join(''),
    ...slugWords,
    ...String(book.title || '').split(/\s+/),
    String(book.title || '').replace(/\s+/g, ''),
  ];
  for (const extra of EXTRA_ALIASES) {
    if (extra.slug.test(book.slug || '')) names.push(...extra.names);
  }
  return [...new Set(names.map(soundKey).filter((k) => k.length >= 2))];
}

/**
 * "gita karmanye" → { book, text: "karmanye" }: the leading one to three words are the
 * book's name (spelt however, a letter or two out) and the rest is what to look for.
 * Returns `{ book: null, text }` when the query does not start with a book, or when the
 * book is all there is — someone typing just "gita" wants the book and its verses, not
 * an empty scope.
 */
function parseBookTag(text, books) {
  const list = words(text);
  const none = { book: null, text: list.join(' ') };
  if (list.length < 2 || !books?.length) return none;

  // The name is made of words; the first number is where the verse starts, not part of it.
  const firstNumber = list.findIndex((w) => /\d/.test(w));
  const nameWords = firstNumber === -1 ? list.length : firstNumber;

  const keyed = books.map((book) => ({ book, keys: aliasKeys(book) }));
  for (let n = Math.min(3, nameWords, list.length - 1); n >= 1; n -= 1) {
    const typed = soundKey(list.slice(0, n).join(''));
    if (typed.length < 2) continue;
    let best = null;
    for (const { book, keys } of keyed) {
      for (const key of keys) {
        const d = distance(typed, key, tolerance(Math.min(typed.length, key.length)));
        if (d !== Infinity && (!best || d < best.d)) best = { book, d };
      }
    }
    if (best) return { book: best.book, text: list.slice(n).join(' ') };
  }
  return none;
}

/** True for "2.47", "1.3.28", "2": a verse's place, not a thing to search for. */
function isVerseNumber(text) {
  return /^\d+(\.\d+){0,2}$/.test(String(text || '').trim());
}

// ─── showing what matched ────────────────────────────────────────────────────

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A Postgres regex alternation of the spellings, safe to hand to `~*`. */
function alternation(variants) {
  return variants.map(escapeRegex).join('|');
}

/**
 * The stretch of `text` around the first spelling that occurs in it, with the matched
 * words in `[brackets]` — the same convention the app's offline search uses. Null when
 * none occur.
 */
function excerpt(text, terms, { radius = 70 } = {}) {
  if (!text) return null;
  const variants = [...new Set(terms.flatMap((t) => t.variants))].sort((a, b) => b.length - a.length);
  if (!variants.length) return null;
  const re = new RegExp(variants.map(escapeRegex).join('|'), 'giu');
  const first = re.exec(text);
  if (!first) return null;

  const start = Math.max(0, first.index - radius);
  const end = Math.min(text.length, first.index + first[0].length + radius);
  let piece = text.slice(start, end).replace(/\s+/g, ' ');
  piece = piece.replace(new RegExp(variants.map(escapeRegex).join('|'), 'giu'), (m) => `[${m}]`);
  return `${start > 0 ? '…' : ''}${piece.trim()}${end < text.length ? '…' : ''}`;
}

export {
  fold,
  soundKey,
  distance,
  tolerance,
  words,
  respace,
  interpret,
  parseBookTag,
  isVerseNumber,
  aliasKeys,
  alternation,
  escapeRegex,
  excerpt,
  Vocabulary,
};
