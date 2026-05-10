'use client';

import { useEffect } from 'react';
import { useThemeStore, THEMES, applyTheme, resolveSystemTheme } from '@/lib/theme-store';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeKey = useThemeStore(s => s.themeKey);

  useEffect(() => {
    const config = THEMES.find(t => t.key === themeKey) ?? THEMES[0];
    applyTheme(config);

    // Watch OS preference changes when theme is 'system'
    if (themeKey !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(resolveSystemTheme());
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themeKey]);

  return <>{children}</>;
}
