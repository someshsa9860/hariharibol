import { NavLink } from 'react-router-dom';
import { NAV } from '@/lib/nav';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

export function Sidebar() {
  const { hasPermission } = useAuth();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Flame className="h-5 w-5 text-chart-3" />
        <span className="text-sm font-semibold tracking-tight">HariHariBol Admin</span>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV.map((section) => {
          const items = section.items.filter((item) => hasPermission(item.permission));
          if (items.length === 0) return null;

          return (
            <div key={section.label}>
              <p className="px-2 pb-1.5 text-xs font-medium uppercase tracking-wider text-sidebar-muted">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-foreground'
                          : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                      )
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
