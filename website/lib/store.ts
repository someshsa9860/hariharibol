import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

interface SiteStore {
  user: User | null;
  token: string | null;
  darkMode: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  toggleDark: () => void;
  logout: () => void;
}

export const useSiteStore = create<SiteStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      darkMode: false,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      toggleDark: () => set((s) => ({ darkMode: !s.darkMode })),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'hhb-site-store', partialize: (s) => ({ darkMode: s.darkMode, token: s.token, user: s.user }) },
  ),
);
