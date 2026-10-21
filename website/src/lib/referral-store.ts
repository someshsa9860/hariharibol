'use client';

// The invitation code a visitor arrived with, kept until they sign in and it can be claimed. localStorage first,
// with a cookie as a fallback for browsers that block storage. It is a claim waiting to be made, not a reward: the
// server decides whether it counts (a new account, not their own code, first claim wins).

const KEY = 'hhb.ref';
const COOKIE = 'hhb_ref';
const CODE = /^[A-Za-z0-9]{4,20}$/;

export function rememberReferral(code: string): void {
  if (!CODE.test(code)) return;
  // The first invitation a visitor follows wins, so a later link cannot quietly replace it.
  if (recallReferral()) return;
  try { localStorage.setItem(KEY, code); } catch { /* storage blocked: the cookie below still holds it */ }
  document.cookie = `${COOKIE}=${code}; Max-Age=${60 * 60 * 24 * 14}; Path=/; SameSite=Lax`;
}

export function recallReferral(): string | null {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && CODE.test(stored)) return stored;
  } catch { /* fall through */ }
  const fromCookie = document.cookie.split('; ').find((p) => p.startsWith(`${COOKIE}=`))?.split('=')[1];
  return fromCookie && CODE.test(fromCookie) ? fromCookie : null;
}

export function forgetReferral(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
  document.cookie = `${COOKIE}=; Max-Age=0; Path=/`;
}
