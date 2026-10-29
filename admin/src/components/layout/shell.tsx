import { useState, type ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { FinanceBanner } from '../finance-banner';

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={menuOpen} onOpenChange={setMenuOpen} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar title={title} onMenu={() => setMenuOpen(true)} />
        <FinanceBanner />
        <div className="relative flex-1 overflow-hidden">
          <main className="h-full overflow-y-auto p-3 sm:p-4 md:p-6">{children}</main>
          {/* A row's details open here, over the page, as a full page of their own (components/detail-dialog.tsx).
              Empty and invisible until something is portalled in. */}
          <div id="detail-root" className="absolute inset-0 z-30 overflow-y-auto empty:pointer-events-none empty:hidden" />
        </div>
      </div>
    </div>
  );
}
