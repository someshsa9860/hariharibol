import 'server-only';
import { ApiError } from '@/lib/api/core';
import { serverGet } from '@/lib/api/server';

export type ShareKind = 'SHLOKA' | 'MANTRA' | 'REEL';

export interface SharedContent {
  kind: ShareKind;
  code: string;
  targetId: string;
  url: string;
  appUri: string;
  query: string;
  stores: { play: string | null; appStore: string | null };
  content: {
    title: string;
    sanskrit: string | null;
    transliteration: string | null;
    meaning: string | null;
    imageUrl: string | null;
    place: Record<string, string | number | null>;
  };
}

export type ShareLookup = { state: 'ok'; data: SharedContent } | { state: 'missing' } | { state: 'gone' } | { state: 'error' };

/** Resolves a code on the server. 404 → missing, 410 → gone (taken down), anything else → error (shown as "try again"). */
export async function lookupShare(code: string, kind: ShareKind, query: Record<string, string | undefined> = {}): Promise<ShareLookup> {
  try {
    const clean: Record<string, string> = { kind };
    for (const [key, value] of Object.entries(query)) if (typeof value === 'string' && key.startsWith('utm_')) clean[key] = value;
    const data = await serverGet<SharedContent>(`/api/app/share/links/${encodeURIComponent(code)}`, { query: clean, revalidate: 120 });
    return { state: 'ok', data };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return { state: 'missing' };
    if (error instanceof ApiError && error.status === 410) return { state: 'gone' };
    return { state: 'error' };
  }
}

/** Where "Continue on the website" goes: the same thing, read in the site itself. */
export function continueHref(data: SharedContent): string {
  const place = data.content.place;
  if (data.kind === 'SHLOKA') return `/verse/${place.verseId}`;
  if (data.kind === 'MANTRA') return `/jap/${place.slug}`;
  return `/reels/${place.reelId}`;
}
