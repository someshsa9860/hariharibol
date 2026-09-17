import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  BookOpen,
  ScrollText,
  Music,
  Library,
  Sun,
  CreditCard,
  Bell,
  Settings,
  Sparkles,
  History,
  ListTodo,
  Activity,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  permission: string;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

// Mirrors backend/config/constants.js PERMISSIONS groups (content/users/system)
// and backend/routes/admin/* one for one — a nav item's path is the resource
// it manages, same rule as the route files themselves.
export const NAV: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'user.read' }],
  },
  {
    label: 'Content',
    items: [
      { label: 'Books', path: '/books', icon: BookOpen, permission: 'book.read' },
      { label: 'Verses', path: '/verses', icon: ScrollText, permission: 'verse.read' },
      { label: 'Mantras', path: '/mantras', icon: Music, permission: 'mantra.read' },
      { label: 'Reference data', path: '/reference', icon: Library, permission: 'reference.manage' },
      { label: 'Daily sloka', path: '/slokas', icon: Sun, permission: 'sloka.manage' },
    ],
  },
  {
    label: 'Users',
    items: [
      { label: 'Users', path: '/users', icon: Users, permission: 'user.read' },
      { label: 'Roles & permissions', path: '/roles', icon: ShieldCheck, permission: 'role.manage' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Payments', path: '/payments', icon: CreditCard, permission: 'payment.read' },
      { label: 'Notifications', path: '/notifications', icon: Bell, permission: 'notification.send' },
      { label: 'Settings', path: '/settings', icon: Settings, permission: 'setting.read' },
      { label: 'AI usage', path: '/ai', icon: Sparkles, permission: 'ai.read' },
      { label: 'Audit log', path: '/audit', icon: History, permission: 'audit.read' },
      { label: 'Jobs', path: '/jobs', icon: ListTodo, permission: 'job.manage' },
      { label: 'Analytics', path: '/analytics', icon: TrendingUp, permission: 'system.read' },
      { label: 'System health', path: '/system', icon: Activity, permission: 'system.read' },
    ],
  },
];
