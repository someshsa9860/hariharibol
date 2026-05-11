'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Music2, Star, MessageCircle, User, LogOut, Sun, Moon } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const LINKS = [
  { href: '/home',        icon: <Home size={18} />,          label: 'Home' },
  { href: '/books',       icon: <BookOpen size={18} />,      label: 'Read' },
  { href: '/verse-of-day',icon: <Star size={18} />,          label: 'Verse of Day' },
  { href: '/mantras',     icon: <Music2 size={18} />,        label: 'Mantras' },
  { href: '/chanting',    icon: <span style={{ fontSize: 16, fontFamily: 'Noto Sans Devanagari' }}>ॐ</span>, label: 'Chanting' },
  { href: '/gurudev',     icon: <MessageCircle size={18} />, label: 'GuruDev' },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const { darkMode, toggleDark, user, logout } = useAppStore();

  return (
    <aside className="app-sidebar flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/home" className="flex items-center gap-2 font-bold text-lg" style={{ color: 'var(--accent)', fontFamily: 'Playfair Display, serif' }}>
          <svg width="24" height="24" viewBox="0 0 200 200" fill="none">
            <path d="M100 160c-80 0-140-60-140-130 45 0 80 25 90 60M100 160c80 0 140-60 140-130-45 0-80 25-90 60" stroke="currentColor" strokeWidth="10" strokeLinecap="round"/>
            <ellipse cx="100" cy="170" rx="150" ry="24" stroke="currentColor" strokeWidth="8"/>
          </svg>
          HariHariBol
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <p className="text-xs font-bold uppercase tracking-wider px-3 mb-2 mt-2" style={{ color: 'var(--muted)' }}>Practice</p>
        {LINKS.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + '/');
          return (
            <Link
              key={l.href}
              href={l.href}
              className={active ? 'nav-item-active' : 'nav-item'}
            >
              {l.icon}
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={toggleDark} className="nav-item w-full mb-1">
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
        {user ? (
          <>
            <Link href="/profile" className="nav-item w-full">
              <User size={16} /> Profile
            </Link>
            <button onClick={logout} className="nav-item w-full" style={{ color: '#f87171' }}>
              <LogOut size={16} /> Sign Out
            </button>
          </>
        ) : (
          <Link href="/login" className="btn-primary w-full text-sm mt-2 justify-center">Sign In</Link>
        )}
      </div>
    </aside>
  );
}
