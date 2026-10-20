'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Icon } from '@/components/ui/icon';
import { TABS } from './nav-links';

/** Phone navigation: the app's own bar, with Sakha raised in the middle. Desktop has the header instead. */
export function BottomTabs() {
  const path = usePathname();
  const dark = path.startsWith('/reels');

  return (
    <nav className={clsx('bottom-tabs', dark && 'bottom-tabs-dark')} aria-label="Main">
      {TABS.map((tab) => {
        const active = tab.match(path);
        const centre = tab.href === '/sakha';
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx('tab-link', active && 'is-active', centre && 'tab-centre')}
            aria-current={active ? 'page' : undefined}
          >
            <span className="tab-icon"><Icon name={tab.icon} size={centre ? 26 : 22} /></span>
            <span className="tab-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
