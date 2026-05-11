import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User { id: string; email: string; displayName?: string; avatarUrl?: string; }

interface AppStore {
  user: User | null;
  token: string | null;
  darkMode: boolean;
  fontSize: 'sm' | 'md' | 'lg';
  chantCount: number;
  setUser: (u: User | null) => void;
  setToken: (t: string | null) => void;
  toggleDark: () => void;
  setFontSize: (s: 'sm' | 'md' | 'lg') => void;
  incrementChant: (by?: number) => void;
  resetChant: () => void;
  logout: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      darkMode: false,
      fontSize: 'md',
      chantCount: 0,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      toggleDark: () => set((s) => ({ darkMode: !s.darkMode })),
      setFontSize: (fontSize) => set({ fontSize }),
      incrementChant: (by = 1) => set((s) => ({ chantCount: s.chantCount + by })),
      resetChant: () => set({ chantCount: 0 }),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'hhb-app-store', partialize: (s) => ({ darkMode: s.darkMode, token: s.token, user: s.user, fontSize: s.fontSize }) },
  ),
);
