'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Sun, Moon, BookOpen, Search } from 'lucide-react';
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
        background: scrolled ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--border)' : 'none',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
      }}
    >
      <div className="container-site flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, Georgia, serif' }}>
          ह
          <span style={{ color: 'var(--accent)' }}>HariHariBol</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                color: pathname === l.href ? 'var(--accent)' : 'var(--text)',
                background: pathname === l.href ? 'var(--surface)' : 'transparent',
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link href="/search" className="btn-ghost p-2 rounded-xl" aria-label="Search" title="Search (⌘K)">
            <Search size={18} />
          </Link>
          <button onClick={toggleDark} className="btn-ghost p-2 rounded-xl" aria-label="Toggle theme">
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <Link href="/app" className="btn-primary text-sm py-2 px-4 hidden sm:inline-flex">
              <BookOpen size={15} /> Open App
            </Link>
          ) : (
            <Link href="/login" className="btn-primary text-sm py-2 px-4 hidden sm:inline-flex">Get Started</Link>
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
            <Link
              href="/search"
              onClick={() => setMenuOpen(false)}
              className="px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2"
              style={{ color: pathname === '/search' ? 'var(--accent)' : 'var(--text)' }}
            >
              <Search size={15} />
              Search
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
