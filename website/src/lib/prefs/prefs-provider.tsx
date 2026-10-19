'use client';

// Things a reader chooses and the browser remembers: the colour theme, how verses are laid out, and the reading
// language. The reading language is also a cookie, because the server renders chapters and needs to know it.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { READING_COOKIE, DEFAULT_LANGUAGE } from '@/lib/config';
import { api } from '@/lib/api/client';
import { currentSession, writeSession } from '@/lib/auth/session-store';

export type Theme = 'system' | 'light' | 'dark';

export interface ReaderSettings {
  fontScale: number;
  showSanskrit: boolean;
  showTransliteration: boolean;
  showWordMeanings: boolean;
  showPurport: boolean;
}

const DEFAULT_READER: ReaderSettings = {
  fontScale: 1,
  showSanskrit: true,
  showTransliteration: true,
  showWordMeanings: false,
  showPurport: true,
};

const STORAGE_KEY = 'hhb.prefs';
export const FONT_SCALE_MIN = 0.85;
export const FONT_SCALE_MAX = 1.6;

interface PrefsValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  reader: ReaderSettings;
  setReader: (patch: Partial<ReaderSettings>) => void;
  readingLanguage: string;
  setReadingLanguage: (code: string) => void;
}

const PrefsContext = createContext<PrefsValue | null>(null);

export function usePrefs(): PrefsValue {
  const value = useContext(PrefsContext);
  if (!value) throw new Error('usePrefs needs <PrefsProvider>');
  return value;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

export function PrefsProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage: string }) {
  const router = useRouter();
  const [theme, setThemeState] = useState<Theme>('system');
  const [reader, setReaderState] = useState<ReaderSettings>(DEFAULT_READER);
  const [readingLanguage, setLanguageState] = useState(initialLanguage || DEFAULT_LANGUAGE);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { theme?: Theme; reader?: Partial<ReaderSettings> } | null;
      if (saved?.theme) {
        setThemeState(saved.theme);
        applyTheme(saved.theme);
      }
      if (saved?.reader) setReaderState({ ...DEFAULT_READER, ...saved.reader });
    } catch {
      // Unreadable storage: the defaults stand.
    }
  }, []);

  const persist = useCallback((nextTheme: Theme, nextReader: ReaderSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: nextTheme, reader: nextReader }));
    } catch {
      // Not remembered; still applied to this page.
    }
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      applyTheme(next);
      persist(next, reader);
    },
    [persist, reader],
  );

  const setReader = useCallback(
    (patch: Partial<ReaderSettings>) => {
      const next = { ...reader, ...patch };
      next.fontScale = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, next.fontScale));
      setReaderState(next);
      persist(theme, next);
    },
    [persist, reader, theme],
  );

  const setReadingLanguage = useCallback(
    (code: string) => {
      setLanguageState(code);
      document.cookie = `${READING_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
      // Pages the server rendered in the old language are drawn again in the new one.
      router.refresh();
      const session = currentSession();
      if (session) {
        api('/me/languages', { method: 'PATCH', auth: 'required', body: { readingLanguage: code } })
          .then(() => writeSession({ ...session, user: { ...session.user, readingLanguage: code } }))
          .catch(() => undefined);
      }
    },
    [router],
  );

  const value = useMemo(
    () => ({ theme, setTheme, reader, setReader, readingLanguage, setReadingLanguage }),
    [theme, setTheme, reader, setReader, readingLanguage, setReadingLanguage],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}
