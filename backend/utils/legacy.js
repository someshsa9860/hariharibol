// The rules for carrying a person over from the old app's server (POST /auth/legacy), with no I/O so
// test/legacy.test.js can load them as they are: which of the old server's emails can be used, how an old
// name or picture is tidied, and which of our mantras one of theirs is.

import { MATCH } from '../config/legacy.js';

// ── The email ──────────────────────────────────────────────────────────────

// An account needs an email here and some old accounts have none (signed up by phone number) or have a
// made-up one (the old Google/Apple sign-in wrote `name@2024-05-01-12:30:00`). Those get an address that
// cannot belong to anyone: `.invalid` is reserved (RFC 2606), so it can never be a real mailbox and no
// Google or Apple sign-in can ever carry it.
const PLACEHOLDER_DOMAIN = 'legacy.invalid';

const EMAIL = /^[a-z0-9._%+'-]+@(?:[a-z0-9-]+\.)+[a-z]{2,}$/;

/** The old server's email as it can be used here (trimmed, lower case), or null when it is not an address. */
function usableEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 255 || !EMAIL.test(email)) return null;
  return isPlaceholderEmail(email) ? null : email;
}

const placeholderEmail = (legacyUserId) => `legacy-${legacyUserId}@${PLACEHOLDER_DOMAIN}`;

const isPlaceholderEmail = (email) =>
  typeof email === 'string' && email.toLowerCase().endsWith(`@${PLACEHOLDER_DOMAIN}`);

/** What the app is told: a stand-in address is not the person's, so they are sent none. */
const emailForApp = (email) => (isPlaceholderEmail(email) ? null : email);

/** A display name from the old server: one line, no control characters, at most 100 characters. */
function cleanName(value) {
  if (typeof value !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const name = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
  return name || null;
}

/** A picture link from the old server, kept only when it is an https URL. */
function httpsUrl(value) {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url || url.length > 1000) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

// ── Which of our mantras is theirs ─────────────────────────────────────────

// Spellings of one mantra differ most in their vowels ("Shivay", "Shivaya", "Śivāya", "शिवाय") and the
// consonants say what is being chanted, so two texts are compared by their consonants alone — their
// *skeleton*. Devanagari is first turned into the Roman letters it would be written with.

const CONSONANTS = {
  क: 'k', ख: 'k', ग: 'g', घ: 'g', ङ: 'n',
  च: 'c', छ: 'c', ज: 'j', झ: 'j', ञ: 'n',
  ट: 't', ठ: 't', ड: 'd', ढ: 'd', ण: 'n',
  त: 't', थ: 't', द: 'd', ध: 'd', न: 'n',
  प: 'p', फ: 'p', ब: 'b', भ: 'b', म: 'm',
  य: 'y', र: 'r', ल: 'l', ळ: 'l', व: 'v',
  श: 's', ष: 's', स: 's', ह: 'h',
};
// Vowels on their own, and the signs that stand in for them after a consonant. Only what they sound
// like matters here (and `ai` — see below); ऋ and ॠ carry an r, ऌ an l.
const VOWELS = {
  अ: 'a', आ: 'a', इ: 'i', ई: 'i', उ: 'u', ऊ: 'u', ऋ: 'r', ॠ: 'r', ऌ: 'l', ॡ: 'l',
  ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऍ: 'e', ऑ: 'o', ऎ: 'e', ऒ: 'o',
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'r', 'ॄ': 'r', 'ॢ': 'l', 'ॣ': 'l',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॅ': 'e', 'ॆ': 'e', 'ॉ': 'o', 'ॊ': 'o',
};
const VIRAMA = '्';
const NUKTA = '़';
const LABIALS = 'पफबभम';

function devanagariToRoman(text) {
  const chars = [...text];
  let out = '';

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const code = ch.codePointAt(0);
    if (code < 0x0900 || code > 0x097f) {
      out += ch;
    } else if (CONSONANTS[ch]) {
      out += CONSONANTS[ch];
      // A consonant carries "a" unless a virama cuts it off or a vowel sign gives it another.
      let next = chars[i + 1];
      if (next === NUKTA) next = chars[i + 2];
      if (next !== VIRAMA && !VOWELS[next]) out += 'a';
    } else if (VOWELS[ch]) {
      out += VOWELS[ch];
    } else if (ch === 'ॐ') {
      out += 'om';
    } else if (ch === 'ं' || ch === 'ँ') {
      // The nasal is "m" before a lip sound and at the end of a word, otherwise "n" — how Sanskrit writes it.
      const next = chars[i + 1];
      out += next && CONSONANTS[next] && !LABIALS.includes(next) ? 'n' : 'm';
    } else if (ch === 'ः') {
      out += 'h';
    } else if (ch !== VIRAMA && ch !== NUKTA && ch !== 'ऽ') {
      out += ' '; // a danda, a digit, an accent: not a letter
    }
  }
  return out;
}

/**
 * The consonants of a text, in order, in the Roman letters they are written with: "Om Namah Shivay",
 * "Oṁ Namaḥ Śivāya" and "ॐ नमः शिवाय" all give `mnmsvy`. Vowels and `h` are left out (`sh`, `bh`, `ch` and
 * `ś` are one sound, and the `h` of "Namah" is not a letter anyone is sure to write); a doubled letter
 * is one; `w` is `v`; `ai` is `ay`, so "Jai", "Jay" and "Jaya" agree. Doubles are joined within a word only,
 * so "Hare Hare" is not "Hare".
 */
function skeleton(text) {
  if (typeof text !== 'string' || !text) return '';

  const roman = devanagariToRoman(text.normalize('NFKD').toLowerCase()).replace(/[̀-ͯ]/g, '');

  return roman
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map((word) =>
      word
        .replace(/ai/g, 'ay')
        .replace(/w/g, 'v')
        .replace(/q/g, 'k')
        .replace(/x/g, 'ks')
        .replace(/(.)\1+/g, '$1')
        .replace(/[aeiouh]/g, '')
    )
    .join('')
    .slice(0, MATCH.maxLength);
}

function distance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length];
}

/**
 * How close two skeletons are, 0 to 1: 1 when they are the same; a little less when one sits inside the
 * other and is a fair share of it ("Namah Shivaya" in "Om Namah Shivaya"); otherwise their similarity, when
 * it is high enough. Only the first needs no length: "Om" is `m` and so is every spelling of it, but a
 * short run of letters proves nothing inside a longer text, hence `minContainedLength`.
 */
function closeness(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let best = 0;

  const share = short.length / long.length;
  if (short.length >= MATCH.minContainedLength && share >= MATCH.minContainedShare && long.includes(short)) {
    best = 0.8 + 0.2 * share;
  }

  // Too far apart in length to reach the threshold: skip the work.
  if (long.length - short.length <= long.length * (1 - MATCH.minSimilarity)) {
    const similarity = 1 - distance(a, b) / long.length;
    if (similarity >= MATCH.minSimilarity) best = Math.max(best, similarity);
  }
  return best;
}

/**
 * A mantra of ours as the matcher reads it: every way it is written — slug, name, transliteration, the
 * Sanskrit and every translation's name and text — as skeletons. [row] is a `Mantra` with its `translations`.
 */
function candidateFrom(row) {
  const texts = [row.slug?.replace(/-/g, ' '), row.name, row.transliteration, row.sanskrit];
  for (const translation of row.translations ?? []) texts.push(translation.name, translation.text);
  return {
    id: row.id,
    slug: row.slug,
    skeletons: [...new Set(texts.map(skeleton).filter(Boolean))],
  };
}

/** The texts of an old mantra the matcher reads: its title, subtitle and the mantra itself. */
const textsOf = (mantra) => [mantra.title, mantra.subtitle, mantra.mantra].filter((text) => typeof text === 'string');

/**
 * Which candidate an old mantra's [fields] are — `{ id, slug, score }` — or null when none is close enough
 * or two are about equally close (a guess is worse than none: "Gayatri Mantra" fits three of ours).
 */
function matchMantra(fields, candidates) {
  const wanted = [...new Set(fields.map(skeleton).filter(Boolean))];
  if (wanted.length === 0) return null;

  const scored = [];
  for (const candidate of candidates) {
    let best = 0;
    for (const have of candidate.skeletons) {
      for (const want of wanted) best = Math.max(best, closeness(want, have));
    }
    if (best > 0) scored.push({ id: candidate.id, slug: candidate.slug, score: best });
  }
  scored.sort((a, b) => b.score - a.score);

  const [first, second] = scored;
  if (!first || first.score < MATCH.minSimilarity) return null;
  if (second) {
    // An identical consonant skeleton wins unless another is identical too.
    if (first.score === 1 ? second.score === 1 : first.score - second.score < MATCH.minMargin) return null;
  }
  return first;
}

/**
 * The one of our mantras the person chanted most on the old server — the most chanted that is ours at all.
 *
 * [old] is the old server's `mantras` (`{ id, title, subtitle, mantra, count }`), [candidates] come from
 * `candidateFrom`. Each old mantra, most chanted first, is tried against [overrides] (old id → slug, from
 * config/legacy.js) and then by sound; the first to be one of ours is the answer. `mantraId` is null when
 * none is, and `unmatched` lists the titles that were looked at and were nothing, for the log.
 */
function pickFavourite(old, candidates, { overrides = {} } = {}) {
  const bySlug = new Map(candidates.map((candidate) => [candidate.slug, candidate]));
  const unmatched = [];

  // The order they came in breaks a tie.
  const ranked = old
    .map((mantra, index) => ({ mantra, index }))
    .sort((a, b) => b.mantra.count - a.mantra.count || a.index - b.index);

  for (const { mantra } of ranked) {
    const chosen = bySlug.get(overrides[mantra.id]);
    const found = chosen ? { id: chosen.id, slug: chosen.slug, score: 1 } : matchMantra(textsOf(mantra), candidates);
    if (found) {
      const via = chosen ? 'override' : 'name';
      return { mantraId: found.id, slug: found.slug, via, score: found.score, count: mantra.count, title: mantra.title, unmatched };
    }
    unmatched.push(mantra.title ?? mantra.subtitle ?? `#${mantra.id}`);
  }
  return { mantraId: null, slug: null, via: null, score: 0, count: 0, title: null, unmatched };
}

export {
  usableEmail,
  placeholderEmail,
  isPlaceholderEmail,
  emailForApp,
  cleanName,
  httpsUrl,
  skeleton,
  closeness,
  candidateFrom,
  textsOf,
  matchMantra,
  pickFavourite,
};
