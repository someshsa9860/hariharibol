'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Sun, Moon, BookOpen } from 'lucide-react';
import { useSiteStore } from '@/lib/store';

const NAV_LINKS = [
  { href: '/books',        label: 'Books' },
  { href: '/sampradayas',  label: 'Traditions' },
  { href: '/verse-of-day', label: 'Verse of Day' },
  { href: '/mantras',      label: 'Mantras' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { darkMode, toggleDark, user } = useSiteStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'var(--bg)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--border)' : 'none',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
      }}
    >
      <div className="container-site flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl" style={{ color: 'var(--accent)', fontFamily: 'Playfair Display, Georgia, serif' }}>
          <svg width="28" height="28" viewBox="0 0 200 200" fill="none">
            <path d="M100 160c-80 0-140-60-140-130 45 0 80 25 90 60M100 160c80 0 140-60 140-130-45 0-80 25-90 60" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/>
            <path d="M100 160c-55-12-100-60-100-140 35 12 68 48 78 90M100 160c55-12 100-60 100-140-35 12-68 48-78 90" stroke="currentColor" strokeWidth="8" strokeLinecap="round"/>
            <ellipse cx="100" cy="170" rx="160" ry="28" stroke="currentColor" strokeWidth="6"/>
          </svg>
          HariHariBol
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                color: pathname === l.href ? 'var(--accent)' : 'var(--muted)',
                background: pathname === l.href ? 'var(--surface-2)' : 'transparent',
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={toggleDark} className="btn-ghost p-2 rounded-xl" aria-label="Toggle theme">
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <Link href="/app" className="btn-primary text-sm py-2 px-4">
              <BookOpen size={15} /> Open App
            </Link>
          ) : (
            <Link href="/login" className="btn-primary text-sm py-2 px-4">Get Started</Link>
          )}
          <button className="md:hidden btn-ghost p-2" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
          <div className="container-site py-4 flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 rounded-xl text-sm font-semibold"
                style={{ color: pathname === l.href ? 'var(--accent)' : 'var(--text)' }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
