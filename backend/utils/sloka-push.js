// What the daily sloka push says, and what the app needs to open it.
//
// The notification body is the verse itself — Sanskrit first, so the collapsed
// notification shows the verse, then its meaning in the reader's language and
// where it comes from. Pure: it takes rows already read and does no I/O, so
// `npm test` loads it on its own.

import * as language from './language.js';

// A push is capped at 4 KB and a Devanagari character is three bytes of it.
// The verse is cut only if it is far longer than any sloka is; the meaning is
// the part that can run on, and a notification is not the place for all of it.
const MAX_VERSE_CHARS = 600;
const MAX_MEANING_CHARS = 220;

// Said when a verse has nothing to show — the row is still worth delivering.
const FALLBACK_BODY = 'A verse chosen for you.';

function clip(text, max) {
  const clean = String(text || '').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}…`;
}

/** Where the verse sits in its book, as a person cites it: "2.47", "10.1.5-7". */
function versePlace(verse) {
  const numbers = [verse.cantoNumber, verse.chapterNumber].filter((n) => n != null);
  const own = verse.verseNumberEnd ? `${verse.verseNumber}-${verse.verseNumberEnd}` : `${verse.verseNumber}`;
  return [...numbers, own].join('.');
}

/** "Bhagavad Gita 2.47", or "Srimad Bhagavatam 10.1.5-7". */
function verseLabel(verse) {
  if (!verse?.book?.title) return null;
  return `${verse.book.title} ${versePlace(verse)}`;
}

/**
 * The body and data of the push for one user's sloka.
 *
 * `verse` carries its `book` and published `translations`; `user` is read only
 * for the languages they read in. The data holds the verse's place in its book,
 * so tapping the notification opens it without asking the API where it lives.
 * FCM data values must be strings — `services/fcm.js` does that conversion.
 */
function slokaPush({ verse, user }) {
  const chain = language.readingChain(user);
  const meaning = language.pickTranslation(verse.translations, chain)?.meaning;

  const text = verse.sanskrit?.trim() || verse.transliteration?.trim();
  const body = [
    text ? clip(text, MAX_VERSE_CHARS) : null,
    meaning ? clip(meaning, MAX_MEANING_CHARS) : null,
    text || meaning ? verseLabel(verse) : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    body: body || FALLBACK_BODY,
    data: {
      deeplink: `hariharibol://sloka/${verse.verseId}`,
      verseId: verse.verseId,
      bookSlug: verse.book?.slug,
      cantoNumber: verse.cantoNumber,
      chapterNumber: verse.chapterNumber,
      verseNumber: verse.verseNumber,
    },
  };
}

export { slokaPush, verseLabel, versePlace };
