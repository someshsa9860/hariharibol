'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { usePrefs, type Theme } from '@/lib/prefs/prefs-provider';
import { FALLBACK_LANGUAGES } from '@/lib/languages';
import { api } from '@/lib/api/client';
import type { Language } from '@/lib/types';
import { Popover } from './popover';

const THEMES: { value: Theme; label: string; icon: 'sun' | 'moon' | 'settings' }[] = [
  { value: 'system', label: 'Auto', icon: 'settings' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

/** Reading language and colour theme — the two choices that apply before anyone signs in. */
export function ReadingLanguageSelect({ id, bookSlug }: { id?: string; bookSlug?: string }) {
  const { readingLanguage, setReadingLanguage } = usePrefs();
  const [languages, setLanguages] = useState<{ code: string; nativeName: string; englishName: string }[]>(FALLBACK_LANGUAGES);

  useEffect(() => {
    api<Language[]>('/reference/languages', { auth: 'none' })
      .then((list) => {
        const reading = list.filter((language) => language.isReadingLanguage);
        if (reading.length) setLanguages(reading);
      })
      .catch(() => undefined);
  }, []);

  // On a book's page, offer only the languages that book has text in (the one in use stays listed).
  const [bookCodes, setBookCodes] = useState<string[] | null>(null);
  useEffect(() => {
    if (!bookSlug) return;
    api<string[]>(`/books/${encodeURIComponent(bookSlug)}/languages`, { auth: 'none' })
      .then((codes) => setBookCodes(codes))
      .catch(() => undefined);
  }, [bookSlug]);
  const shown = bookCodes?.length ? languages.filter((language) => bookCodes.includes(language.code) || language.code === readingLanguage) : languages;

  return (
    <select id={id} className="select" value={readingLanguage} onChange={(event) => setReadingLanguage(event.target.value)}>
      {shown.map((language) => (
        <option key={language.code} value={language.code}>
          {language.nativeName} · {language.englishName}
        </option>
      ))}
    </select>
  );
}

export function ThemeSwitch() {
  const { theme, setTheme } = usePrefs();
  return (
    <div className="segmented" role="group" aria-label="Colour theme">
      {THEMES.map((option) => (
        <button key={option.value} aria-pressed={theme === option.value} onClick={() => setTheme(option.value)}>
          <Icon name={option.icon} size={16} /> {option.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsMenu() {
  return (
    <Popover label="Language and theme" trigger={<Icon name="globe" />}>
      {() => (
        <div className="popover-body">
          <label className="field-label" htmlFor="menu-reading-language">Read in</label>
          <ReadingLanguageSelect id="menu-reading-language" />
          <span className="field-label">Appearance</span>
          <ThemeSwitch />
        </div>
      )}
    </Popover>
  );
}
