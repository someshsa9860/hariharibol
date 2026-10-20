// The signed-in session, kept in this browser. The API has no cookies: it hands back an access token (7 days) and a
// refresh token (a year, replaced on every use), and the page sends the first as a bearer.
//
// localStorage is readable by any script on the page, which is the usual trade for a token-based API; the site loads
// no third-party scripts except Google's and Apple's sign-in, and renders no HTML it did not build.

import type { SessionUser } from '@/lib/types';

const SESSION_KEY = 'hhb.session';
const DEVICE_KEY = 'hhb.device';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

type Listener = (session: StoredSession | null) => void;
const listeners = new Set<Listener>();

export function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function writeSession(session: StoredSession | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked (private mode): the session lives for this page only.
  }
  memory = session;
  listeners.forEach((listener) => listener(session));
}

let memory: StoredSession | null | undefined;

/** The current session; read from storage once, then kept in memory. */
export function currentSession(): StoredSession | null {
  if (memory === undefined) memory = readSession();
  return memory;
}

export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A random id for this browser, so the API can tell devices apart. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `web-${crypto.randomUUID()}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'web-anonymous';
  }
}
