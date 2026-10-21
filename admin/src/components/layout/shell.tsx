import type { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { FinanceBanner } from '../finance-banner';

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} />
        <FinanceBanner />
        <div className="relative flex-1 overflow-hidden">
          <main className="h-full overflow-y-auto p-6">{children}</main>
          {/* A row's details open here, over the page, as a full page of their own (components/detail-dialog.tsx).
              Empty and invisible until something is portalled in. */}
          <div id="detail-root" className="absolute inset-0 z-30 overflow-y-auto empty:pointer-events-none empty:hidden" />
        </div>
      </div>
    </div>
  );
}
