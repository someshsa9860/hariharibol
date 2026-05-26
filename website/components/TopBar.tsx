'use client';

import { useRouter } from 'next/navigation';
import { Menu, Sun, Moon, Search, Bell, User } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface Props {
  title?: string;
  onMenuToggle?: () => void;
}

export default function TopBar({ title, onMenuToggle }: Props) {
  const { darkMode, toggleDark, user } = useAppStore();
  const router = useRouter();

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : null;

  return (
    <div className="app-topbar gap-2">
      <button className="md:hidden btn-ghost p-2" onClick={onMenuToggle}>
        <Menu size={18} />
      </button>

      {/* Title */}
      <>
        {title && (
          <h1
            className="font-bold text-base"
            style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)', flex: 1 }}
          >
            {title}
          </h1>
        )}
        <div style={{ flex: 1 }} />
      </>

      {/* Action icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button onClick={() => router.push('/search')} className="btn-ghost p-2" title="Search (⌘K)">
          <Search size={16} />
        </button>

        {/* Notification bell with dot indicator */}
        <button className="btn-ghost p-2" style={{ position: 'relative' }} title="Notifications">
          <Bell size={16} />
          <span
            style={{
              position: 'absolute',
              top: 7,
              right: 7,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--saffron)',
            }}
          />
        </button>

        <button onClick={toggleDark} className="btn-ghost p-2" title="Toggle theme">
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* User avatar with gold ring */}
        {user && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '2px solid var(--accent-2)',
              overflow: 'hidden',
              flexShrink: 0,
              cursor: 'pointer',
              background: user.avatarUrl ? 'transparent' : 'var(--gradient-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : initials ? (
              <span
                style={{
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'Playfair Display, serif',
                }}
              >
                {initials}
              </span>
            ) : (
              <User size={14} style={{ color: '#fff' }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
