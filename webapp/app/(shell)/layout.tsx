'use client';

import { useEffect } from 'react';
import AppSidebar from '@/components/AppSidebar';
import BottomNav from '@/components/BottomNav';
import { useAppStore } from '@/lib/store';

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const darkMode = useAppStore((s) => s.darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <div className="app-shell" style={{ paddingBottom: '3.5rem' }}>
      <AppSidebar />
      <div className="app-main pb-16 md:pb-0" style={{ gridColumn: '2', gridRow: '1 / -1' }}>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
