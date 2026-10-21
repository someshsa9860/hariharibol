import 'server-only';
import { ApiError } from '@/lib/api/core';
import { serverGet } from '@/lib/api/server';

export interface SharedContent {
  status: 'ok';
  type: 'VERSE' | 'MANTRA' | 'REEL';
  code: string;
  canonicalUrl: string;
  title: string;
  reference: string | null;
  sanskrit: string | null;
  transliteration: string | null;
  text: string | null;
  language: string;
  imageUrl: string | null;
  continuePath: string;
  verseId?: string;
}

export type SharedResult = { state: 'ok'; content: SharedContent } | { state: 'gone' } | { state: 'missing' };

/** What a shared link shows. A link that never existed and one that used to work are told apart; a server fault is not hidden as either. */
export async function loadShared(route: 'shloka' | 'naam' | 'darshan', code: string): Promise<SharedResult> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{8,16}$/.test(code)) return { state: 'missing' };
  try {
    return { state: 'ok', content: await serverGet<SharedContent>(`/api/web/share/${route}/${code}`, { revalidate: 120 }) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { state: 'missing' };
    if (error instanceof ApiError && error.status === 410) return { state: 'gone' };
    throw error;
  }
}

export interface Invitation { valid: boolean; code: string; referrerName: string | null }

export async function loadInvitation(code: string): Promise<Invitation | null> {
  if (!/^[A-Za-z0-9-]{4,24}$/.test(code)) return null;
  try {
    return await serverGet<Invitation>(`/api/web/referral/${code}`, { revalidate: 300 });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}
