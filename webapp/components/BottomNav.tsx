'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Star, Music2, MessageCircle } from 'lucide-react';

const TABS = [
  { href: '/home',         icon: <Home size={20} />,         label: 'Home' },
  { href: '/books',        icon: <BookOpen size={20} />,     label: 'Read' },
  { href: '/verse-of-day', icon: <Star size={20} />,         label: 'Daily' },
  { href: '/mantras',      icon: <Music2 size={20} />,       label: 'Mantras' },
  { href: '/gurudev',      icon: <MessageCircle size={20} />,label: 'GuruDev' },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav justify-around items-center h-14">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + '/');
        return (
          <Link
            key={t.href}
            href={t.href}
            className="flex flex-col items-center gap-0.5 py-2 px-3 text-xs font-semibold transition-colors"
            style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}
          >
            {t.icon}
            <span style={{ fontSize: 10 }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
