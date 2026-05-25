import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User { id: string; email: string; displayName?: string; avatarUrl?: string; }

interface AppStore {
  // User slice
  user: User | null;
  token: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setUser: (u: User | null) => void;
  setToken: (t: string | null) => void;
  setRefreshToken: (t: string | null) => void;
  login: (user: User, accessToken: string, refreshToken?: string) => void;
  logout: () => void;

  // UI slice
  darkMode: boolean;
  theme: 'light' | 'dark';
  fontSize: 'sm' | 'md' | 'lg';
  sidebarOpen: boolean;
  toggleDark: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setFontSize: (s: 'sm' | 'md' | 'lg') => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Chant slice
  chantCount: number;
  incrementChant: (by?: number) => void;
  resetChant: () => void;

  // Favorites slice
  favoriteVerseIds: Set<string>;
  favoriteMantraIds: Set<string>;
  toggleFavoriteVerse: (id: string) => void;
  toggleFavoriteMantra: (id: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // User slice
      user: null,
      token: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setUser: (user) => set((s) => ({ user, isAuthenticated: !!user && !!s.token })),
      setToken: (token) => set((s) => ({ token, accessToken: token, isAuthenticated: !!s.user && !!token })),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      login: (user, accessToken, refreshToken = null as string | null) =>
        set({ user, token: accessToken, accessToken, refreshToken, isAuthenticated: true }),
      logout: () =>
        set({ user: null, token: null, accessToken: null, refreshToken: null, isAuthenticated: false, chantCount: 0 }),

      // UI slice
      darkMode: false,
      theme: 'light',
      fontSize: 'md',
      sidebarOpen: false,
      toggleDark: () => set((s) => ({ darkMode: !s.darkMode, theme: s.darkMode ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme, darkMode: theme === 'dark' }),
      setFontSize: (fontSize) => set({ fontSize }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      // Chant slice
      chantCount: 0,
      incrementChant: (by = 1) => set((s) => ({ chantCount: s.chantCount + by })),
      resetChant: () => set({ chantCount: 0 }),

      // Favorites slice
      favoriteVerseIds: new Set<string>(),
      favoriteMantraIds: new Set<string>(),
      toggleFavoriteVerse: (id) =>
        set((s) => {
          const next = new Set(s.favoriteVerseIds);
          if (next.has(id)) next.delete(id); else next.add(id);
          return { favoriteVerseIds: next };
        }),
      toggleFavoriteMantra: (id) =>
        set((s) => {
          const next = new Set(s.favoriteMantraIds);
          if (next.has(id)) next.delete(id); else next.add(id);
          return { favoriteMantraIds: next };
        }),
    }),
    {
      name: 'hhb-app-store',
      partialize: (s) => ({
        user: s.user,
        token: s.token,
        refreshToken: s.refreshToken,
        darkMode: s.darkMode,
        theme: s.theme,
        fontSize: s.fontSize,
        // Serialize Sets as arrays for JSON storage
        favoriteVerseIds: [...s.favoriteVerseIds],
        favoriteMantraIds: [...s.favoriteMantraIds],
      }),
      merge: (persisted: any, current) => ({
        ...current,
        ...persisted,
        accessToken: persisted.token ?? null,
        refreshToken: persisted.refreshToken ?? null,
        isAuthenticated: !!(persisted.user && persisted.token),
        // Deserialize arrays back to Sets on rehydration
        favoriteVerseIds: new Set<string>(persisted.favoriteVerseIds ?? []),
        favoriteMantraIds: new Set<string>(persisted.favoriteMantraIds ?? []),
      }),
    },
  ),
);
