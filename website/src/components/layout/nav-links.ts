import type { IconName } from '@/components/ui/icon';

// The app's bottom bar is Home · Jap · Sakha · Reels · Read; the website keeps the same order and adds the routine
// to the desktop bar, where there is room.
export const TABS: { href: string; label: string; icon: IconName; match: (path: string) => boolean }[] = [
  { href: '/', label: 'Home', icon: 'home', match: (p) => p === '/' },
  { href: '/jap', label: 'Jap', icon: 'chant', match: (p) => p.startsWith('/jap') },
  { href: '/sakha', label: 'Sakha', icon: 'sakha', match: (p) => p.startsWith('/sakha') },
  { href: '/reels', label: 'Reels', icon: 'reels', match: (p) => p.startsWith('/reels') },
  { href: '/read', label: 'Read', icon: 'book', match: (p) => p.startsWith('/read') || p.startsWith('/verse') },
];

export const DESKTOP_LINKS: { href: string; label: string; match: (path: string) => boolean }[] = [
  { href: '/', label: 'Home', match: (p) => p === '/' },
  { href: '/read', label: 'Read', match: (p) => p.startsWith('/read') || p.startsWith('/verse') },
  { href: '/jap', label: 'Jap', match: (p) => p.startsWith('/jap') },
  { href: '/reels', label: 'Reels', match: (p) => p.startsWith('/reels') },
  { href: '/routine', label: 'Routine', match: (p) => p.startsWith('/routine') },
  { href: '/calendar', label: 'Calendar', match: (p) => p.startsWith('/calendar') },
  { href: '/plans', label: 'Plans', match: (p) => p.startsWith('/plans') },
];
