// The standard tags a reel made from a verse carries, and the helpers that read
// them back.
//
// Three of them are *keys*: `book:<slug>`, `canto:<slug>-<n>` and
// `chapter:<slug>[-<canto>]-<n>`. They are scoped by book on purpose — "chapter
// 3" means nothing on its own — and they are what "more like this" matches on,
// so they must come out identical for every reel of the same chapter. They are
// built here and nowhere else.
//
// The rest are plain hashtags (`karma-yoga`, the chapter's name) for people to
// read and search by; the keys are for the machine.

export const TAG_BOOK = 'book:';
export const TAG_CANTO = 'canto:';
export const TAG_CHAPTER = 'chapter:';

const MAX_TAG = 50;

/** "Karma Yoga!" → "karma-yoga". Keeps Devanagari and other letters; drops punctuation. */
export function slug(text) {
  return String(text ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_TAG);
}

/**
 * The tags for one verse. `book`, `canto` and `chapter` are the rows (canto and
 * chapter may be null — a short work has neither); `verse` supplies the numbers.
 */
export function verseTags({ book, canto, chapter, verse }) {
  const keys = [`${TAG_BOOK}${book.slug}`.slice(0, MAX_TAG)];

  const cantoNumber = canto?.number ?? verse?.cantoNumber ?? null;
  if (cantoNumber != null) keys.push(`${TAG_CANTO}${book.slug}-${cantoNumber}`.slice(0, MAX_TAG));

  const chapterNumber = chapter?.number ?? verse?.chapterNumber ?? null;
  if (chapterNumber != null) {
    keys.push(`${TAG_CHAPTER}${book.slug}${cantoNumber != null ? `-${cantoNumber}` : ''}-${chapterNumber}`.slice(0, MAX_TAG));
  }

  const names = [book.title, canto?.title, chapter?.title].map(slug).filter(Boolean);
  return [...new Set([...keys, ...names])];
}

/** Which of a reel's tags are the standard keys, most specific first. */
export function keyTagsOf(tags = []) {
  const find = (prefix) => tags.find((t) => t.startsWith(prefix)) ?? null;
  return { chapter: find(TAG_CHAPTER), canto: find(TAG_CANTO), book: find(TAG_BOOK) };
}

/** A tag as a person should read it: `chapter:bhagavad-gita-3` → `bhagavad-gita-3`. */
export const displayTag = (tag) => tag.replace(/^(book|canto|chapter):/, '');

/** "Bhagavad Gita 2.47" — the way a verse is cited on a reel. */
export function verseLabel({ book, verse }) {
  const numbers = [verse.cantoNumber, verse.chapterNumber].filter((n) => n != null);
  const own = verse.verseNumberEnd ? `${verse.verseNumber}-${verse.verseNumberEnd}` : `${verse.verseNumber}`;
  return `${book.title} ${[...numbers, own].join('.')}`;
}
