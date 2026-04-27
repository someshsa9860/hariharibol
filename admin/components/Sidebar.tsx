'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminStore } from '@/lib/store';
import { LayoutDashboard, Users, MessageSquare, Settings, LogOut, BookOpen, BarChart3, Sparkles } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/verse-of-day', label: 'Verse of Day', icon: Sparkles },
  { href: '/sampradayas', label: 'Sampradayas', icon: BookOpen },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/moderation', label: 'Moderation', icon: MessageSquare },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAdminStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="p-6 border-b">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="text-3xl">🙏</div>
          <div>
            <h1 className="text-lg font-bold text-dark">HariHariBol</h1>
            <p className="text-xs text-gray-500">Admin</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
