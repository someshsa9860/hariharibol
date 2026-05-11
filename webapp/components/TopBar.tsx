'use client';

import { Menu, Sun, Moon } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface Props { title?: string; onMenuToggle?: () => void; }

export default function TopBar({ title, onMenuToggle }: Props) {
  const { darkMode, toggleDark } = useAppStore();
  return (
    <div className="app-topbar gap-3">
      <button className="md:hidden btn-ghost p-2" onClick={onMenuToggle}>
        <Menu size={18} />
      </button>
      {title && (
        <h1 className="font-bold text-base flex-1" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
          {title}
        </h1>
      )}
      <div className="flex-1" />
      <button onClick={toggleDark} className="btn-ghost p-2">
        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  );
}
