import { NavLink, useLocation } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useEffect } from 'react';
import { NAV } from '@/lib/nav';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { hasPermission } = useAuth();

  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <img src="/logo.png" alt="" className="h-7 w-7 object-contain" />
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
                    onClick={onNavigate}
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
    </>
  );
}

/** Fixed beside the page from `md` up; on a phone the same list slides in from the left (opened by the topbar's menu button). */
export function Sidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { pathname } = useLocation();
  useEffect(() => onOpenChange(false), [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <SidebarBody />
      </aside>

      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 md:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg focus-visible:outline-none md:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
            <SidebarBody onNavigate={() => onOpenChange(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
