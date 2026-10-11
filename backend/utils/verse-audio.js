// Where a verse's recitation lives in storage.
//
// A verse's own `audioPath` always wins. Failing that, a book with a
// `recitationParent` has one recording per verse beneath that folder:
//
//   <parent>/<chapter>/<verse>.mp3             Bhagavad Gita
//   <parent>/<canto>/<chapter>/<verse>.mp3     a book with cantos
//   <parent>/<verse>.mp3                       a short work
//
// So setting the folder on a book covers every verse in it, and nothing has to be
// written per verse. A compound verse (13-14) is filed under its first number.
//
// This builds a key and nothing more — it does not check the file is there. Every
// caller needs the verse's `cantoNumber`, `chapterNumber` and `verseNumber`, and the
// book's `recitationParent`, in what it selected.

/** The storage key of a verse's recitation, or null when it has none. */
export function verseAudioPath(verse, book) {
  if (verse.audioPath) return verse.audioPath;

  const parent = book?.recitationParent?.trim().replace(/^\/+|\/+$/g, '');
  if (!parent) return null;

  const parts = [verse.cantoNumber, verse.chapterNumber, verse.verseNumber].filter((n) => n != null);
  return `${[parent, ...parts].join('/')}.mp3`;
}
