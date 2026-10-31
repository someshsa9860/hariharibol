'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Icon } from '@/components/ui/icon';
import { AccountMenu } from './account-menu';
import { SettingsMenu } from './settings-menu';
import { DESKTOP_LINKS } from './nav-links';

export function SiteHeader() {
  const path = usePathname();
  // Reels run edge to edge under a dark bar, like the app's.
  const dark = path.startsWith('/reels');

  return (
    <header className={clsx('site-header', dark && 'site-header-dark')}>
      <div className="site-header-inner">
        <Link href="/" className="brand" aria-label="HariHariBol home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logo-128.png" alt="" width={38} height={38} />
          <span>HariHariBol</span>
        </Link>

        <nav className="desktop-nav" aria-label="Main">
          {DESKTOP_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={clsx('nav-link', link.match(path) && 'is-active')} aria-current={link.match(path) ? 'page' : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <Link href="/search" className="icon-btn" aria-label="Search"><Icon name="search" /></Link>
          <Link href="/sakha" className="btn btn-primary btn-sm sakha-cta">
            <Icon name="sakha" size={16} /> Ask Sakha
          </Link>
          <SettingsMenu />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
