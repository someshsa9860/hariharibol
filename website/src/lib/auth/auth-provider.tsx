'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { API_BASE, READING_COOKIE } from '@/lib/config';
import { baseHeaders } from '@/lib/api/client';
import { ApiError, readEnvelope } from '@/lib/api/core';
import type { SessionUser } from '@/lib/types';
import { appCheckToken } from './app-check';
import { currentSession, deviceId, onSessionChange, readSession, writeSession, type StoredSession } from './session-store';

const AuthDialog = dynamic(() => import('@/components/auth/auth-dialog').then((m) => m.AuthDialog), { ssr: false });

export type Provider = 'GOOGLE' | 'APPLE';

interface AuthValue {
  /** `loading` only until the browser has looked at its storage. */
  status: 'loading' | 'in' | 'out';
  user: SessionUser | null;
  /** Opens the sign-in dialog. `reason` is the sentence shown above the buttons. */
  openSignIn: (reason?: string) => void;
  /** True when signed in; otherwise opens the dialog and returns false. For actions that need an account. */
  requireSignIn: (reason: string) => boolean;
  signInWithToken: (provider: Provider, idToken: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<SessionUser>) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth needs <AuthProvider>');
  return value;
}

function cookieLanguage(): string | undefined {
  return document.cookie.split('; ').find((part) => part.startsWith(`${READING_COOKIE}=`))?.split('=')[1];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [status, setStatus] = useState<AuthValue['status']>('loading');
  const [dialog, setDialog] = useState<{ open: boolean; reason?: string }>({ open: false });

  useEffect(() => {
    const stored = readSession();
    writeSession(stored); // fills the in-memory copy
    setSession(stored);
    setStatus(stored ? 'in' : 'out');
    return onSessionChange((next) => {
      setSession(next);
      setStatus(next ? 'in' : 'out');
    });
  }, []);

  const openSignIn = useCallback((reason?: string) => setDialog({ open: true, reason }), []);

  const requireSignIn = useCallback(
    (reason: string) => {
      if (currentSession()) return true;
      setDialog({ open: true, reason });
      return false;
    },
    [],
  );

  const signInWithToken = useCallback(async (provider: Provider, idToken: string, name?: string) => {
    const attestation = await appCheckToken();
    let response: Response;
    try {
      response = await fetch(`${API_BASE}/api/app/auth/social`, {
        method: 'POST',
        headers: { ...baseHeaders(), 'Content-Type': 'application/json', ...(attestation ? { 'X-Firebase-AppCheck': attestation } : {}) },
        body: JSON.stringify({
          provider,
          idToken,
          name,
          deviceId: deviceId(),
          platform: 'web',
          readingLanguage: cookieLanguage(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
    } catch {
      throw new ApiError(0, 'NETWORK', 'No connection');
    }
    const { data } = await readEnvelope<{ user: SessionUser; tokens: { accessToken: string; refreshToken: string } }>(response);
    writeSession({ accessToken: data.tokens.accessToken, refreshToken: data.tokens.refreshToken, user: data.user });
    // The account's reading language wins over this browser's, so a phone's choice follows to the website.
    if (data.user.readingLanguage) {
      document.cookie = `${READING_COOKIE}=${data.user.readingLanguage}; path=/; max-age=31536000; samesite=lax`;
    }
    setDialog({ open: false });
    if (data.user.readingLanguage && data.user.readingLanguage !== cookieLanguage()) window.location.reload();
  }, []);

  const signOut = useCallback(async () => {
    const stored = currentSession();
    writeSession(null);
    if (stored) {
      fetch(`${API_BASE}/api/app/auth/logout`, {
        method: 'POST',
        headers: { ...baseHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
      }).catch(() => undefined);
    }
  }, []);

  const updateUser = useCallback((patch: Partial<SessionUser>) => {
    const stored = currentSession();
    if (stored) writeSession({ ...stored, user: { ...stored.user, ...patch } });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ status, user: session?.user ?? null, openSignIn, requireSignIn, signInWithToken, signOut, updateUser }),
    [status, session, openSignIn, requireSignIn, signInWithToken, signOut, updateUser],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {dialog.open && <AuthDialog reason={dialog.reason} onClose={() => setDialog({ open: false })} />}
    </AuthContext.Provider>
  );
}
