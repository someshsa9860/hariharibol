import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { NAV } from '@/lib/nav';
import { Shell } from '@/components/layout/shell';
import { Loader2, ShieldOff } from 'lucide-react';
import { Login } from '@/routes/login';
import { Dashboard } from '@/routes/dashboard';
import { UsersPage } from '@/routes/users';
import { RolesPage } from '@/routes/roles';
import { BooksPage } from '@/routes/books';
import { VersesPage } from '@/routes/verses';
import { MantrasPage } from '@/routes/mantras';
import { ReferencePage } from '@/routes/reference';
import { SlokasPage } from '@/routes/slokas';
import { PaymentsPage } from '@/routes/payments';
import { NotificationsPage } from '@/routes/notifications';
import { SettingsPage } from '@/routes/settings';
import { AiUsagePage } from '@/routes/ai-usage';
import { AuditPage } from '@/routes/audit';
import { JobsPage } from '@/routes/jobs';
import { AnalyticsPage } from '@/routes/analytics';
import { SystemPage } from '@/routes/system';

const ALL_ITEMS = NAV.flatMap((section) => section.items);

function titleFor(pathname: string) {
  return ALL_ITEMS.find((item) => item.path === pathname)?.label ?? 'HariHariBol Admin';
}

function Protected({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission } = useAuth();
  const location = useLocation();

  if (!hasPermission(permission)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <ShieldOff className="h-8 w-8" />
        <p className="text-sm">You don't have access to this section.</p>
      </div>
    );
  }

  return <Shell title={titleFor(location.pathname)}>{children}</Shell>;
}

export function Router() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (auth.status === 'signed-out') {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route
        path="/"
        element={
          <Protected permission="user.read">
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/users"
        element={
          <Protected permission="user.read">
            <UsersPage />
          </Protected>
        }
      />
      <Route
        path="/roles"
        element={
          <Protected permission="role.manage">
            <RolesPage />
          </Protected>
        }
      />
      <Route
        path="/books"
        element={
          <Protected permission="book.read">
            <BooksPage />
          </Protected>
        }
      />
      <Route
        path="/verses"
        element={
          <Protected permission="verse.read">
            <VersesPage />
          </Protected>
        }
      />
      <Route
        path="/mantras"
        element={
          <Protected permission="mantra.read">
            <MantrasPage />
          </Protected>
        }
      />
      <Route
        path="/reference"
        element={
          <Protected permission="reference.manage">
            <ReferencePage />
          </Protected>
        }
      />
      <Route
        path="/slokas"
        element={
          <Protected permission="sloka.manage">
            <SlokasPage />
          </Protected>
        }
      />
      <Route
        path="/payments"
        element={
          <Protected permission="payment.read">
            <PaymentsPage />
          </Protected>
        }
      />
      <Route
        path="/notifications"
        element={
          <Protected permission="notification.send">
            <NotificationsPage />
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected permission="setting.read">
            <SettingsPage />
          </Protected>
        }
      />
      <Route
        path="/ai"
        element={
          <Protected permission="ai.read">
            <AiUsagePage />
          </Protected>
        }
      />
      <Route
        path="/audit"
        element={
          <Protected permission="audit.read">
            <AuditPage />
          </Protected>
        }
      />
      <Route
        path="/jobs"
        element={
          <Protected permission="job.manage">
            <JobsPage />
          </Protected>
        }
      />
      <Route
        path="/analytics"
        element={
          <Protected permission="system.read">
            <AnalyticsPage />
          </Protected>
        }
      />
      <Route
        path="/system"
        element={
          <Protected permission="system.read">
            <SystemPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
