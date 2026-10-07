import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useActiveSection } from '@/lib/use-active-section';
import { useScrolledPast } from '@/lib/use-scrolled-past';
import { NAV_LINKS, PLAY_STORE_URL } from '@/site';

const SECTION_IDS = NAV_LINKS.map((link) => link.id);

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useScrolledPast(8);
  const activeSection = useActiveSection(SECTION_IDS);
  const headerRef = useRef<HTMLElement>(null);

  // While the phone menu is open, Escape or a click outside the header closes it.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onClick);
    };
  }, [menuOpen]);

  return (
    <header ref={headerRef} className={clsx('site-header', scrolled && 'is-scrolled')} id="site-header">
      <div className="header-inner">
        <a className="brand" href="#top" aria-label="HariHariBol home">
          <span className="brand-mark" aria-hidden="true">ॐ</span>
          <span>HariHariBol</span>
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className="sr-only">Open navigation</span>
          <span></span>
          <span></span>
        </button>
        <nav id="site-nav" className={clsx('site-nav', menuOpen && 'is-open')} aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              aria-current={activeSection === link.id ? 'true' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a className="nav-cta" href={PLAY_STORE_URL} rel="noopener" onClick={() => setMenuOpen(false)}>
            Download
          </a>
        </nav>
      </div>
    </header>
  );
}
