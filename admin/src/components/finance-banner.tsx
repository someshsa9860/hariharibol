import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useResource } from '@/lib/use-resource';

const label = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Month-end nudge for the super admin, on every page until the month's costs are confirmed. */
export function FinanceBanner() {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('finance.manage');
  const pending = useResource<{ months: string[] }>(['finance-pending'], '/api/admin/finance/pending', undefined, {
    enabled: allowed,
    staleTime: 5 * 60_000,
  });
  const month = pending.data?.months[0];
  if (!allowed || !month) return null;

  return (
    <Link to="/finance" className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-6 py-2 text-sm hover:bg-amber-500/15">
      <Wallet className="h-4 w-4 shrink-0" />
      <span>
        <strong>{label(month)}</strong> costs are not entered yet. Add advertising, salaries and purchases, then confirm the month.
      </span>
    </Link>
  );
}
