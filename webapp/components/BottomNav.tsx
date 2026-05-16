'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Star, Music2, MessageCircle } from 'lucide-react';

const TABS = [
  { href: '/home',         icon: <Home size={20} />,          label: 'Home' },
  { href: '/books',        icon: <BookOpen size={20} />,      label: 'Read' },
  { href: '/verse-of-day', icon: <Star size={20} />,          label: 'Daily' },
  { href: '/mantras',      icon: <Music2 size={20} />,        label: 'Mantras' },
  { href: '/gurudev',      icon: <MessageCircle size={20} />, label: 'GuruDev' },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="bottom-nav justify-around items-center h-14"
      style={{
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        background: 'color-mix(in srgb, var(--bg-2) 90%, transparent)',
      }}
    >
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + '/');
        return (
          <Link
            key={t.href}
            href={t.href}
            className="flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-semibold relative"
            style={{
              color: active ? 'var(--saffron)' : 'var(--muted)',
              transition: 'color 0.2s ease',
            }}
          >
            {/* Saffron top border indicator for active tab */}
            {active && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '55%',
                  height: 2,
                  background: 'var(--saffron)',
                  borderRadius: '0 0 3px 3px',
                }}
              />
            )}
            {t.icon}
            <span style={{ fontSize: 10 }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
