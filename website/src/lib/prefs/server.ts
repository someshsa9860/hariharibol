import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LANGUAGE, READING_COOKIE } from '@/lib/config';

/** The reader's reading language, from the cookie the browser sets. A crawler has none and gets English. */
export async function readingLanguage(): Promise<string> {
  const value = (await cookies()).get(READING_COOKIE)?.value ?? '';
  return /^[a-z]{2,3}$/.test(value) ? value : DEFAULT_LANGUAGE;
}

/** The `languages` query the book endpoints take: reading language first, then English. */
export function languagesQuery(language: string): string {
  return language === DEFAULT_LANGUAGE ? DEFAULT_LANGUAGE : `${language},${DEFAULT_LANGUAGE}`;
}
