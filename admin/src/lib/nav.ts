import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ShieldPlus,
  BookOpen,
  ScrollText,
  Music,
  Clapperboard,
  UserCheck,
  LifeBuoy,
  Library,
  Sun,
  CreditCard,
  Crown,
  Wallet,
  Bell,
  Settings,
  Sparkles,
  History,
  ListTodo,
  Activity,
  TrendingUp,
  Languages,
  Film,
  MessageCircle,
  CalendarDays,
  Terminal,
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
      { label: 'Reels', path: '/reels', icon: Clapperboard, permission: 'reel.read' },
      { label: 'Translations', path: '/translations', icon: Languages, permission: 'translation.read' },
      { label: 'Scenes', path: '/scenes', icon: Film, permission: 'scenes.read' },
      { label: 'Reference data', path: '/reference', icon: Library, permission: 'reference.manage' },
      { label: 'Daily sloka', path: '/slokas', icon: Sun, permission: 'sloka.manage' },
      { label: 'Hindu calendar', path: '/calendar', icon: CalendarDays, permission: 'panchang.manage' },
    ],
  },
  {
    label: 'Users',
    items: [
      { label: 'Users', path: '/users', icon: Users, permission: 'user.read' },
      { label: 'Admins', path: '/admins', icon: ShieldPlus, permission: 'role.manage' },
      { label: 'Creators', path: '/creators', icon: UserCheck, permission: 'creator.manage' },
      { label: 'Support', path: '/support', icon: LifeBuoy, permission: 'support.manage' },
      { label: 'Roles & permissions', path: '/roles', icon: ShieldCheck, permission: 'role.manage' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Payments', path: '/payments', icon: CreditCard, permission: 'payment.read' },
      { label: 'Plans', path: '/plans', icon: Crown, permission: 'payment.read' },
      { label: 'Finance', path: '/finance', icon: Wallet, permission: 'finance.manage' },
      { label: 'Notifications', path: '/notifications', icon: Bell, permission: 'notification.send' },
      { label: 'Settings', path: '/settings', icon: Settings, permission: 'setting.read' },
      { label: 'AI usage', path: '/ai', icon: Sparkles, permission: 'ai.read' },
      { label: 'Ask Sakha', path: '/chat', icon: MessageCircle, permission: 'chat.manage' },
      { label: 'Audit log', path: '/audit', icon: History, permission: 'audit.read' },
      { label: 'Jobs', path: '/jobs', icon: ListTodo, permission: 'job.manage' },
      { label: 'Maintenance', path: '/maintenance', icon: Terminal, permission: 'system.maintenance' },
      { label: 'Analytics', path: '/analytics', icon: TrendingUp, permission: 'system.read' },
      { label: 'System health', path: '/system', icon: Activity, permission: 'system.read' },
    ],
  },
];
