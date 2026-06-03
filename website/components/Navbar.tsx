'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Sun, Moon, BookOpen, Search, Sparkles } from 'lucide-react';
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
        background: scrolled
          ? darkMode
            ? 'rgba(15, 23, 42, 0.95)'
            : 'rgba(255, 255, 255, 0.98)'
          : 'transparent',
        borderBottom: scrolled ? '1px solid var(--border)' : 'none',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      <div className="container-site flex items-center justify-between" style={{ height: 'clamp(56px, 8vh, 72px)', padding: '0 1.5rem' }}>
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold tracking-tight transition-all duration-300 hover:opacity-80"
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #FF6B00, #D4A055)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <Sparkles size={24} style={{ color: 'var(--accent)' }} />
            Hariharibol
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-2">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:text-accent"
              style={{
                color: pathname === l.href ? 'var(--accent)' : 'var(--text)',
                background: pathname === l.href
                  ? 'linear-gradient(135deg, rgba(255, 153, 51, 0.1), rgba(255, 179, 102, 0.1))'
                  : 'transparent',
                borderBottom: pathname === l.href ? '2px solid var(--accent)' : 'none',
                paddingBottom: pathname === l.href ? 'calc(0.5rem - 2px)' : '0.5rem',
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1 md:gap-2">
          <Link
            href="/search"
            className="btn-ghost p-2 md:p-2.5 rounded-lg hover:bg-accent hover:bg-opacity-10 transition-all"
            aria-label="Search"
            title="Search"
          >
            <Search size={18} />
          </Link>
          <button
            onClick={toggleDark}
            className="btn-ghost p-2 md:p-2.5 rounded-lg hover:bg-accent hover:bg-opacity-10 transition-all"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <Link
              href="/app/home"
              className="btn-primary text-xs md:text-sm py-1.5 md:py-2 px-3 md:px-4 hidden sm:inline-flex gap-1 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                boxShadow: '0 4px 15px rgba(255, 153, 51, 0.3)',
              }}
            >
              <BookOpen size={15} /> App
            </Link>
          ) : (
            <Link
              href="/login"
              className="btn-primary text-xs md:text-sm py-1.5 md:py-2 px-3 md:px-4 hidden sm:inline-flex rounded-lg"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                boxShadow: '0 4px 15px rgba(255, 153, 51, 0.3)',
              }}
            >
              Join
            </Link>
          )}
          <button
            className="md:hidden btn-ghost p-2 rounded-lg hover:bg-accent hover:bg-opacity-10"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="md:hidden border-t transition-all duration-300"
          style={{
            background: darkMode ? 'rgba(30, 41, 59, 0.98)' : 'rgba(248, 249, 250, 0.98)',
            borderColor: 'var(--border)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="container-site py-4 flex flex-col gap-1" style={{ padding: '1rem 1.5rem' }}>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  color: pathname === l.href ? 'white' : 'var(--text)',
                  background: pathname === l.href
                    ? 'linear-gradient(135deg, var(--accent), var(--accent-2))'
                    : 'transparent',
                }}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/search"
              onClick={() => setMenuOpen(false)}
              className="px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-200"
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
