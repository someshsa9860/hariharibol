'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminStore } from '@/lib/store';
import {
  LayoutDashboard, Users, MessageSquare, Settings,
  LogOut, BookOpen, BarChart3, Sparkles, ChevronRight,
  Library, Mic2, Music, Languages, Globe2, Download, PenSquare,
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const topItems: NavItem[] = [
  { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/analytics',    label: 'Analytics',    icon: BarChart3 },
  { href: '/verse-of-day', label: 'Verse of Day', icon: Sparkles },
];

const contentGroups: NavGroup[] = [
  {
    label: 'Content',
    defaultOpen: true,
    items: [
      { href: '/sampradayas', label: 'Sampradayas', icon: BookOpen },
      { href: '/books',       label: 'Books',        icon: Library },
      { href: '/narrations',  label: 'Narrations',   icon: Mic2 },
      { href: '/mantras',     label: 'Mantras',      icon: Music },
    ],
  },
  {
    label: 'Translations',
    defaultOpen: false,
    items: [
      { href: '/translations',               label: 'Dashboard',    icon: Languages },
      { href: '/translations/workspace',     label: 'Workspace',    icon: PenSquare },
      { href: '/translations/import-export', label: 'Import/Export', icon: Download },
    ],
  },
];

const bottomItems: NavItem[] = [
  { href: '/languages',  label: 'Languages',  icon: Globe2 },
  { href: '/users',      label: 'Users',      icon: Users },
  { href: '/moderation', label: 'Moderation', icon: MessageSquare },
  { href: '/settings',   label: 'Settings',   icon: Settings },
];

function NavLink({ item, pathname, hovered, setHovered }: {
  item: NavItem; pathname: string;
  hovered: string | null; setHovered: (v: string | null) => void;
}) {
  const Icon = item.icon;
  const isActive = pathname === item.href || (item.href !== '/translations' && pathname.startsWith(item.href + '/'))
    || (item.href === '/translations' && (pathname === '/translations' || pathname === '/translations/'));
  const isHov = hovered === item.href;

  return (
    <Link
      href={item.href}
      onMouseEnter={() => setHovered(item.href)}
      onMouseLeave={() => setHovered(null)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 relative no-underline"
      style={{
        color: isActive ? 'var(--accent)' : isHov ? 'var(--text)' : 'var(--muted)',
        background: isActive
          ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
          : isHov ? 'var(--surface-2)' : 'transparent',
        border: isActive
          ? '1px solid color-mix(in srgb, var(--accent) 25%, transparent)'
          : '1px solid transparent',
        fontWeight: isActive ? 700 : 600,
      }}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
          style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
      )}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200"
        style={{
          background: isActive
            ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
            : isHov ? 'var(--surface-2)' : 'transparent',
        }}>
        <Icon size={15} style={{ color: isActive ? 'var(--accent)' : isHov ? 'var(--text)' : 'var(--muted)' }} />
      </div>
      <span className="flex-1">{item.label}</span>
      {isActive && <ChevronRight size={13} style={{ color: 'var(--accent)', opacity: 0.7 }} />}
    </Link>
  );
}

function CollapsibleGroup({ group, pathname, hovered, setHovered }: {
  group: NavGroup; pathname: string;
  hovered: string | null; setHovered: (v: string | null) => void;
}) {
  const isGroupActive = group.items.some(i =>
    pathname === i.href || pathname.startsWith(i.href + '/')
  );
  const [open, setOpen] = useState(group.defaultOpen || isGroupActive);

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 mb-0.5"
        style={{ color: 'var(--muted)', opacity: 0.7 }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}>
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] flex-1 text-left">{group.label}</span>
        <ChevronDown size={11}
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
      </button>

      {open && (
        <div className="space-y-0.5">
          {group.items.map(item => (
            <NavLink key={item.href} item={item} pathname={pathname} hovered={hovered} setHovered={setHovered} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { admin, logout } = useAdminStore() as any;
  const [hovered, setHovered] = useState<string | null>(null);

  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <div className="w-64 min-h-screen flex flex-col relative flex-shrink-0"
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)',
        backdropFilter: 'blur(20px)',
      }}>

      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--accent), transparent)', opacity: 0.4 }} />

      {/* Subtle orb */}
      <div className="absolute top-24 -left-10 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)', filter: 'blur(30px)' }} />

      {/* ── Logo ── */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-all duration-300 group-hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              boxShadow: '0 4px 15px var(--accent-glow)',
            }}>
            <span className="font-black" style={{ fontFamily: 'serif', color: 'var(--bg)' }}>ॐ</span>
          </div>
          <div>
            <p className="font-bold text-sm leading-tight" style={{ color: 'var(--text)' }}>HariHariBol</p>
            <p className="text-[10px] font-medium tracking-[0.12em] uppercase mt-0.5" style={{ color: 'var(--muted)' }}>
              Admin Console
            </p>
          </div>
        </Link>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">

        {/* Top items */}
        <p className="px-3 pt-1 pb-2 text-[9px] font-bold uppercase tracking-[0.2em]"
          style={{ color: 'var(--muted)', opacity: 0.6 }}>
          Navigation
        </p>
        <div className="space-y-0.5 mb-1">
          {topItems.map(item => (
            <NavLink key={item.href} item={item} pathname={pathname} hovered={hovered} setHovered={setHovered} />
          ))}
        </div>

        {/* Collapsible groups (Content, Translations) */}
        {contentGroups.map(group => (
          <CollapsibleGroup key={group.label} group={group} pathname={pathname} hovered={hovered} setHovered={setHovered} />
        ))}

        {/* Bottom flat items */}
        <div className="mt-2">
          <p className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em]"
            style={{ color: 'var(--muted)', opacity: 0.6 }}>
            System
          </p>
          <div className="space-y-0.5">
            {bottomItems.map(item => (
              <NavLink key={item.href} item={item} pathname={pathname} hovered={hovered} setHovered={setHovered} />
            ))}
          </div>
        </div>
      </nav>

      {/* ── User + Logout ── */}
      <div className="px-3 pb-4" style={{ borderTop: '1px solid var(--border)' }}>
        {admin && (
          <div className="px-3 py-3 rounded-xl mb-2 mt-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  background: 'color-mix(in srgb, var(--accent) 20%, transparent)',
                  color: 'var(--accent)',
                  border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                }}>
                {admin.email?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{admin.email}</p>
                <p className="text-[10px] font-medium" style={{ color: 'var(--accent)' }}>Administrator</p>
              </div>
            </div>
          </div>
        )}

        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-semibold transition-all duration-200"
          style={{ color: 'var(--muted)', background: 'transparent' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)';
            (e.currentTarget as HTMLElement).style.color = '#f87171';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--muted)';
          }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(248,113,113,0.08)' }}>
            <LogOut size={14} style={{ color: '#f87171' }} />
          </div>
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}
