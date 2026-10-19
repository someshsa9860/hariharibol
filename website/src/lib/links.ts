import type { Verse } from '@/lib/types';

/** Where a chapter is read. Books with cantos put the canto first: /read/srimad-bhagavatam/1/3. */
export function chapterHref(slug: string, cantoNumber: number | null | undefined, chapterNumber: number, verseNumber?: number): string {
  const base = cantoNumber ? `/read/${slug}/${cantoNumber}/${chapterNumber}` : `/read/${slug}/${chapterNumber}`;
  return verseNumber ? `${base}#v-${verseNumber}` : base;
}

/** The page that reads a verse in its place. A short work has no chapters, so it is the book's page. */
export function verseReadHref(verse: Pick<Verse, 'book' | 'cantoNumber' | 'chapterNumber' | 'verseNumber'>): string {
  const slug = verse.book?.slug ?? '';
  return verse.chapterNumber ? chapterHref(slug, verse.cantoNumber, verse.chapterNumber, verse.verseNumber) : `/read/${slug}#v-${verse.verseNumber}`;
}

export const verseHref = (verseId: string) => `/verse/${verseId}`;
