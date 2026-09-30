import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, MoreHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { DateRangeFilter, FilterSelect } from '@/components/table-filters';
import { DetailDialog, JsonValue } from '@/components/detail-dialog';
import { useResource } from '@/lib/use-resource';
import { useDataTable } from '@/lib/use-table';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, formatMinorUnits } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

type Subscription = {
  id: string;
  status: string;
  provider: string;
  externalId: string | null;
  startedAt: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  autoRenew: boolean;
  user: { email: string; name: string | null };
  plan: { name: string };
};
type Payment = {
  id: string;
  purpose: string;
  status: string;
  provider: string;
  externalId: string;
  amountMinor: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  message: string | null;
  isAnonymous: boolean;
  providerPayload: unknown;
  user: { email: string; name: string | null } | null;
};
type Summary = { totals: { purpose: string; currency: string; amountMinor: number; count: number }[] };
type Donor = { id: string; amountMinor: number; currency: string; message: string | null; paidAt: string; isAnonymous: boolean; donor: { name: string | null; email: string } | null };

const STATUS_VARIANT: Record<string, 'success' | 'secondary' | 'destructive' | 'warning'> = {
  ACTIVE: 'success', SUCCEEDED: 'success', IN_TRIAL: 'warning', GRACE: 'warning',
  CANCELLED: 'secondary', EXPIRED: 'secondary', FAILED: 'destructive', REFUNDED: 'destructive',
};

function Overview() {
  const summary = useResource<Summary>(['payments-summary'], '/api/admin/payments/summary');
  const donors = useResource<Donor[]>(['donors'], '/api/admin/payments/donors');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {summary.isLoading ? (
          <Skeleton className="h-24 w-full md:col-span-3" />
        ) : (
          summary.data?.totals.map((t) => (
            <Card key={`${t.purpose}-${t.currency}`}>
              <CardHeader>
                <CardTitle>
                  {t.purpose} · {t.currency}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatMinorUnits(t.amountMinor, t.currency)}</p>
                <p className="text-xs text-muted-foreground">{t.count} payments, last 30 days</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Recent donors</h3>
        <div className="space-y-1.5">
          {donors.isLoading && <Skeleton className="h-40 w-full" />}
          {donors.data?.slice(0, 20).map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{d.isAnonymous ? 'Anonymous' : d.donor?.name || d.donor?.email || 'Unknown'}</p>
                {d.message && <p className="text-xs text-muted-foreground">"{d.message}"</p>}
              </div>
              <div className="text-right">
                <p className="font-medium">{formatMinorUnits(d.amountMinor, d.currency)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(d.paidAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SUBSCRIPTION_STATUSES = ['IN_TRIAL', 'ACTIVE', 'GRACE', 'CANCELLED', 'EXPIRED', 'REFUNDED'];
const PAYMENT_STATUSES = ['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'];
const PROVIDERS = ['GOOGLE_PLAY', 'APPLE_APP_STORE', 'RAZORPAY'];

const person = (u: { email: string; name: string | null }) => (
  <div>
    <p className="font-medium leading-tight">{u.name || '—'}</p>
    <p className="text-xs leading-tight text-muted-foreground">{u.email}</p>
  </div>
);

function SubscriptionsTab() {
  const [viewing, setViewing] = useState<Subscription | null>(null);
  const table = useDataTable<Subscription>({
    id: 'subscriptions',
    scope: 'sub',
    path: '/api/admin/subscriptions',
    filters: ['status', 'provider'],
    defaultSort: { key: 'currentPeriodEnd', dir: 'desc' },
  });

  const columns: Column<Subscription>[] = [
    { key: 'user', header: 'User', fixed: true, csv: (s) => s.user.email, render: (s) => person(s.user) },
    { key: 'name', header: 'Name', csv: (s) => s.user.name, defaultHidden: true, render: (s) => s.user.name ?? '—' },
    { key: 'plan', header: 'Plan', csv: (s) => s.plan.name, render: (s) => s.plan.name },
    { key: 'provider', header: 'Provider', sort: 'provider', csv: (s) => s.provider, render: (s) => <Badge variant="outline">{s.provider}</Badge> },
    {
      key: 'status',
      header: 'Status',
      sort: 'status',
      csv: (s) => s.status,
      render: (s) => <Badge variant={STATUS_VARIANT[s.status] ?? 'secondary'}>{s.status}</Badge>,
    },
    { key: 'renews', header: 'Auto-renew', csv: (s) => (s.autoRenew ? 'Yes' : 'No'), defaultHidden: true, render: (s) => (s.autoRenew ? 'Yes' : 'No') },
    { key: 'started', header: 'Started', sort: 'startedAt', csv: (s) => s.startedAt, defaultHidden: true, render: (s) => formatDate(s.startedAt) },
    { key: 'ends', header: 'Period ends', sort: 'currentPeriodEnd', csv: (s) => s.currentPeriodEnd, render: (s) => formatDate(s.currentPeriodEnd) },
    { key: 'externalId', header: 'Provider id', csv: (s) => s.externalId, defaultHidden: true, render: (s) => <span className="font-mono text-xs">{s.externalId ?? '—'}</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (s) => (
        <Button variant="ghost" size="icon" aria-label="View details" onClick={(e) => (e.stopPropagation(), setViewing(s))}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <DataTable
        table={table}
        columns={columns}
        exportName="subscriptions"
        searchPlaceholder="Search user email or name…"
        emptyMessage="No subscriptions yet."
        onRowClick={setViewing}
        filters={
          <>
            <FilterSelect table={table} name="status" label="All statuses" options={SUBSCRIPTION_STATUSES} />
            <FilterSelect table={table} name="provider" label="All providers" className="w-44" options={PROVIDERS} />
          </>
        }
      />

      <DetailDialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.user.name || viewing?.user.email}
        description={viewing?.plan.name}
        fields={
          viewing
            ? [
                { label: 'Email', value: viewing.user.email },
                { label: 'Status', value: <Badge variant={STATUS_VARIANT[viewing.status] ?? 'secondary'}>{viewing.status}</Badge> },
                { label: 'Provider', value: <Badge variant="outline">{viewing.provider}</Badge> },
                { label: 'Provider subscription id', value: <span className="font-mono text-xs">{viewing.externalId ?? '—'}</span> },
                { label: 'Started', value: formatDate(viewing.startedAt) },
                { label: 'Period ends', value: formatDate(viewing.currentPeriodEnd) },
                { label: 'Auto-renew', value: viewing.autoRenew ? 'Yes' : 'No' },
                { label: 'Cancelled', value: viewing.cancelledAt ? formatDate(viewing.cancelledAt) : '—' },
                { label: 'Subscription ID', value: <span className="font-mono text-xs">{viewing.id}</span> },
              ]
            : []
        }
      />
    </div>
  );
}

function PaymentsTab() {
  const { hasPermission } = useAuth();
  const [viewing, setViewing] = useState<Payment | null>(null);
  const table = useDataTable<Payment>({
    id: 'payments',
    scope: 'pay',
    path: '/api/admin/payments',
    filters: ['purpose', 'status', 'provider', 'from', 'to'],
    defaultSort: { key: 'createdAt', dir: 'desc' },
  });

  const canRefund = hasPermission('payment.refund');

  // Money moves here, so refunds are one payment at a time — there is deliberately
  // no bulk refund. Cancelling the prompt cancels the refund.
  const refund = (p: Payment) => {
    const reason = prompt(`Refund ${formatMinorUnits(p.amountMinor, p.currency)}? Reason (optional):`);
    if (reason === null) return;
    table.runBulk([p], 'Refunded', (row) => api.post(`/api/admin/payments/${row.id}/refund`, { reason }));
  };

  const columns: Column<Payment>[] = [
    {
      key: 'user',
      header: 'User',
      fixed: true,
      csv: (p) => p.user?.email ?? (p.isAnonymous ? 'Anonymous' : ''),
      render: (p) =>
        p.user ? person(p.user) : <span className="text-muted-foreground">{p.isAnonymous ? 'Anonymous' : '—'}</span>,
    },
    { key: 'purpose', header: 'Purpose', sort: 'purpose', csv: (p) => p.purpose, render: (p) => <Badge variant="outline">{p.purpose}</Badge> },
    // Amount and currency are separate CSV columns: minor units differ by currency, so one
    // number in a spreadsheet would be ambiguous.
    { key: 'amount', header: 'Amount', sort: 'amount', className: 'tabular-nums', csv: (p) => p.amountMinor, render: (p) => formatMinorUnits(p.amountMinor, p.currency) },
    { key: 'currency', header: 'Currency', csv: (p) => p.currency, defaultHidden: true, render: (p) => p.currency },
    { key: 'provider', header: 'Provider', sort: 'provider', csv: (p) => p.provider, render: (p) => p.provider },
    {
      key: 'status',
      header: 'Status',
      sort: 'status',
      csv: (p) => p.status,
      render: (p) => <Badge variant={STATUS_VARIANT[p.status] ?? 'secondary'}>{p.status}</Badge>,
    },
    { key: 'created', header: 'Created', sort: 'createdAt', csv: (p) => p.createdAt, render: (p) => formatDate(p.createdAt) },
    { key: 'paid', header: 'Paid', sort: 'paidAt', csv: (p) => p.paidAt, defaultHidden: true, render: (p) => (p.paidAt ? formatDate(p.paidAt) : '—') },
    { key: 'message', header: 'Message', csv: (p) => p.message, defaultHidden: true, render: (p) => <p className="max-w-xs truncate">{p.message ?? '—'}</p> },
    { key: 'externalId', header: 'Provider id', csv: (p) => p.externalId, defaultHidden: true, render: (p) => <span className="font-mono text-xs">{p.externalId}</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Row actions" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setViewing(p)}>
              <Eye className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            {canRefund && p.status === 'SUCCEEDED' && (
              <DropdownMenuItem className="text-destructive" onClick={() => refund(p)}>
                Refund
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <DataTable
        table={table}
        columns={columns}
        exportName="payments"
        searchPlaceholder="Search user or provider transaction id…"
        emptyMessage="No payments yet."
        onRowClick={setViewing}
        filters={
          <>
            <FilterSelect
              table={table}
              name="purpose"
              label="All purposes"
              options={[
                { value: 'SUBSCRIPTION', label: 'Subscription' },
                { value: 'DONATION', label: 'Donation' },
              ]}
            />
            <FilterSelect table={table} name="status" label="All statuses" options={PAYMENT_STATUSES} />
            <FilterSelect table={table} name="provider" label="All providers" className="w-44" options={PROVIDERS} />
            {/* The API filters this range on when the payment was created. */}
            <DateRangeFilter table={table} />
          </>
        }
      />

      <DetailDialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.user ? viewing.user.name || viewing.user.email : viewing?.isAnonymous ? 'Anonymous donor' : 'Payment'}
        description={viewing ? formatMinorUnits(viewing.amountMinor, viewing.currency) : undefined}
        fields={
          viewing
            ? [
                { label: 'Purpose', value: <Badge variant="outline">{viewing.purpose}</Badge> },
                { label: 'Status', value: <Badge variant={STATUS_VARIANT[viewing.status] ?? 'secondary'}>{viewing.status}</Badge> },
                { label: 'Provider', value: viewing.provider },
                { label: 'Provider transaction id', value: <span className="font-mono text-xs">{viewing.externalId}</span> },
                { label: 'Created', value: formatDate(viewing.createdAt) },
                { label: 'Paid', value: viewing.paidAt ? formatDate(viewing.paidAt) : '—' },
                { label: 'Refunded', value: viewing.refundedAt ? formatDate(viewing.refundedAt) : '—' },
                ...(viewing.message ? [{ label: 'Message', value: viewing.message, full: true }] : []),
                { label: 'Provider payload', value: <JsonValue value={viewing.providerPayload} />, full: true },
                { label: 'Payment ID', value: <span className="font-mono text-xs">{viewing.id}</span> },
              ]
            : []
        }
      />
    </div>
  );
}

const TABS = ['overview', 'subscriptions', 'payments'];

export function PaymentsPage() {
  // The tab lives in the URL so "the failed payments from last week" is a link,
  // and a refresh doesn't drop you back on the overview.
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') ?? '';
  const tab = TABS.includes(requested) ? requested : 'overview';

  return (
    <div>
      <PageHeader title="Payments" description="One ledger for subscriptions and donations, split by purpose." />
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Overview />
        </TabsContent>
        <TabsContent value="subscriptions">
          <SubscriptionsTab />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
