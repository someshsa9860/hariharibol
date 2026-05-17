'use client';

import { useEffect } from 'react';
import { Menu } from 'lucide-react';
import AppSidebar from '@/components/AppSidebar';
import BottomNav from '@/components/BottomNav';
import { useAppStore } from '@/lib/store';
import api from '@/lib/api';

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const darkMode = useAppStore((s) => s.darkMode);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // Sync favorites from API on mount, merge with locally stored favorites
  useEffect(() => {
    if (!isAuthenticated) return;
    const sync = async () => {
      try {
        const [vRes, mRes] = await Promise.all([
          api.get<{ id: string }[]>('/users/me/favorites/verses').catch(() => ({ data: [] as { id: string }[] })),
          api.get<{ id: string }[]>('/users/me/favorites/mantras').catch(() => ({ data: [] as { id: string }[] })),
        ]);
        const { favoriteVerseIds, favoriteMantraIds, toggleFavoriteVerse, toggleFavoriteMantra } =
          useAppStore.getState();
        vRes.data.forEach((v) => { if (!favoriteVerseIds.has(v.id)) toggleFavoriteVerse(v.id); });
        mRes.data.forEach((m) => { if (!favoriteMantraIds.has(m.id)) toggleFavoriteMantra(m.id); });
      } catch {}
    };
    sync();
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app-shell">
      {/* Desktop sidebar — 260px wide, sticky, hidden on mobile via CSS */}
      <AppSidebar />

      {/* Mobile drawer backdrop */}
      <div
        className="md:hidden"
        onClick={() => setSidebarOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'rgba(0,0,0,0.5)',
          opacity: sidebarOpen ? 1 : 0,
          pointerEvents: sidebarOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Mobile drawer sidebar — slides in from left */}
      <div
        className="md:hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100%',
          width: 260,
          zIndex: 50,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <AppSidebar />
      </div>

      {/* Main content area */}
      <div className="app-main pb-16 md:pb-0">
        {/* Mobile topbar with hamburger — hidden on desktop */}
        <div
          className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4"
          style={{ height: 56, background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Menu size={18} />
          </button>
          <span
            style={{
              fontFamily: 'Playfair Display, serif',
              fontWeight: 700,
              fontSize: '1.05rem',
              background: 'var(--gradient-gold)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            HariHariBol
          </span>
        </div>

        {children}
      </div>

      {/* Bottom nav — mobile only, hidden on md+ via CSS */}
      <BottomNav />
    </div>
  );
}
