'use client';

// Share links as the site sees them. The grammar is the backend's (`backend/utils/share.js`): content lives on
// /shloka, /naam and /darshan; an invitation on /satsang. Nothing else reads a share URL.

import { api } from '@/lib/api/client';
import { currentSession } from '@/lib/auth/session-store';
import { SITE_URL } from '@/lib/config';

export type ShareType = 'VERSE' | 'MANTRA' | 'REEL';

export const CONTENT_ROUTE: Record<ShareType, string> = { VERSE: 'shloka', MANTRA: 'naam', REEL: 'darshan' };
export const REFERRAL_ROUTE = 'satsang';

/** What a screen hands to the share studio — the same shape from every entry point. */
export interface ShareTarget {
  type: ShareType;
  /** Verse id ("1.2.47"), mantra slug, or reel id. */
  id: string;
  title: string;
  sanskrit?: string | null;
  transliteration?: string | null;
  translation?: string | null;
  reference?: string | null;
  /** Where the page already lives on the site; the fallback when no personal link can be made (signed out). */
  path: string;
}

export interface MadeLink { url: string; personal: boolean }

/** The link to hand out: a personal /shloka|naam|darshan link when signed in, else the page's own address. */
export async function linkFor(target: ShareTarget): Promise<MadeLink> {
  if (currentSession()) {
    try {
      const made = await api<{ url: string }>('/share/link', { method: 'POST', auth: 'required', body: { type: target.type, targetId: target.id } });
      return { url: made.url, personal: true };
    } catch { /* fall through to the public page */ }
  }
  return { url: `${SITE_URL}${target.path}`, personal: false };
}

export function plainText(target: ShareTarget): string {
  return [target.sanskrit, target.transliteration, target.translation, target.reference ? `— ${target.reference}` : null]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join('\n\n');
}

const REFERRAL_KEY = 'hhb.ref';

/** Remembers an invitation code across sign-in and refresh; the first one wins, as it does on the server. */
export function rememberReferral(code: string): void {
  try {
    if (!localStorage.getItem(REFERRAL_KEY)) localStorage.setItem(REFERRAL_KEY, JSON.stringify({ code, at: Date.now() }));
  } catch { /* private mode: the typed-code fallback still works */ }
}

export function pendingReferral(): string | null {
  try {
    const raw = localStorage.getItem(REFERRAL_KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code: string; at: number };
    // The server's window is 7 days from account creation; a code kept for longer than a month is stale.
    if (Date.now() - at > 30 * 86400_000) { localStorage.removeItem(REFERRAL_KEY); return null; }
    return code;
  } catch { return null; }
}

export function forgetReferral(): void {
  try { localStorage.removeItem(REFERRAL_KEY); } catch { /* nothing to forget */ }
}
