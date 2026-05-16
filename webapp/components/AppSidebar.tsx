'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Music2, Star, MessageCircle, LogOut, Sun, Moon } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const NAV_ITEMS = [
  { href: '/home',         icon: <Home size={18} />,          label: 'Home',         dot: 'var(--saffron)' },
  { href: '/books',        icon: <BookOpen size={18} />,      label: 'Read',         dot: 'var(--peacock)' },
  { href: '/mantras',      icon: <Music2 size={18} />,        label: 'Mantras',      dot: 'var(--accent-2)' },
  {
    href: '/chanting',
    icon: <span style={{ fontSize: 16, fontFamily: 'Noto Sans Devanagari', lineHeight: 1 }}>ॐ</span>,
    label: 'Chanting',
    dot: 'var(--forest)',
  },
  { href: '/verse-of-day', icon: <Star size={18} />,          label: 'Verse of Day', dot: 'var(--maroon)' },
  { href: '/gurudev',      icon: <MessageCircle size={18} />, label: 'GuruDev',      dot: 'var(--lotus)' },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const { darkMode, toggleDark, user, logout } = useAppStore();

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'ॐ';

  return (
    <aside
      className="app-sidebar flex flex-col h-full"
      style={{ background: 'linear-gradient(180deg, var(--bg) 0%, var(--bg-2) 100%)' }}
    >
      {/* Brand header */}
      <div className="p-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/home" className="flex items-center gap-2.5" style={{ textDecoration: 'none' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--gradient-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 8px var(--accent-glow)',
            }}
          >
            <span
              style={{
                color: '#fff',
                fontFamily: 'Noto Sans Devanagari, serif',
                fontSize: 18,
                lineHeight: 1,
                fontWeight: 700,
              }}
            >
              ॐ
            </span>
          </div>
          <span
            style={{
              fontFamily: 'Playfair Display, serif',
              fontWeight: 700,
              fontSize: '1.1rem',
              background: 'var(--gradient-gold)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            HariHariBol
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <p
          className="text-xs font-bold uppercase tracking-wider px-3 mb-2 mt-2"
          style={{ color: 'var(--muted)' }}
        >
          Practice
        </p>
        {NAV_ITEMS.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + '/');
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: active ? 700 : 600,
                color: active ? 'var(--saffron)' : 'var(--muted)',
                background: active ? 'rgba(255,107,0,0.09)' : 'transparent',
                borderLeft: active ? '3px solid var(--saffron)' : '3px solid transparent',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                marginBottom: 2,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--surface-2)';
                  e.currentTarget.style.color = 'var(--text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--muted)';
                }
              }}
            >
              {/* Accent color dot */}
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: l.dot,
                  flexShrink: 0,
                  opacity: active ? 1 : 0.45,
                  transition: 'opacity 0.2s',
                }}
              />
              <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={toggleDark} className="nav-item w-full mb-2">
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </button>

        {user ? (
          <>
            {/* User profile card */}
            <Link
              href="/profile"
              className="flex items-center gap-3 rounded-xl mb-1"
              style={{
                padding: '8px 10px',
                textDecoration: 'none',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="avatar"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    border: '2px solid var(--accent-2)',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    border: '2px solid var(--accent-2)',
                    background: 'var(--gradient-gold)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 13,
                    fontFamily: 'Playfair Display, serif',
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p
                  style={{
                    fontFamily: 'Playfair Display, serif',
                    fontWeight: 700,
                    fontSize: 13,
                    color: 'var(--text)',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user.displayName || 'Devotee'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.3 }}>View Profile</p>
              </div>
            </Link>

            <button onClick={logout} className="nav-item w-full" style={{ color: '#f87171' }}>
              <LogOut size={16} /> Sign Out
            </button>
          </>
        ) : (
          <Link href="/login" className="btn-primary w-full text-sm mt-2 justify-center">
            Sign In
          </Link>
        )}
      </div>
    </aside>
  );
}
