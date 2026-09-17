import { useState } from 'react';
import { Eye, MoreHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { DetailDialog, JsonValue } from '@/components/detail-dialog';
import { useResource, useResourceList, useResourceMutation } from '@/lib/use-resource';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
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

function SubscriptionsTab() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<Subscription | null>(null);
  const list = useResourceList<Subscription>('subscriptions', '/api/admin/subscriptions', { page, pageSize: 20, status: status || undefined });

  const columns: Column<Subscription>[] = [
    { key: 'user', header: 'User', render: (s) => (
        <div>
          <p className="font-medium">{s.user.name || '—'}</p>
          <p className="text-xs text-muted-foreground">{s.user.email}</p>
        </div>
      ) },
    { key: 'plan', header: 'Plan', render: (s) => s.plan.name },
    { key: 'provider', header: 'Provider', render: (s) => <Badge variant="outline">{s.provider}</Badge> },
    { key: 'status', header: 'Status', render: (s) => <Badge variant={STATUS_VARIANT[s.status] ?? 'secondary'}>{s.status}</Badge> },
    { key: 'ends', header: 'Period ends', render: (s) => formatDate(s.currentPeriodEnd) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (s) => (
        <Button variant="ghost" size="icon" onClick={(e) => (e.stopPropagation(), setViewing(s))}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <Select value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="w-48">
          <option value="">All statuses</option>
          {['IN_TRIAL', 'ACTIVE', 'GRACE', 'CANCELLED', 'EXPIRED', 'REFUNDED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>
      <DataTable columns={columns} page={list.data} isLoading={list.isLoading} isError={list.isError} onPageChange={setPage} />

      <DetailDialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.user.name || viewing?.user.email}
        description={viewing?.plan.name}
        fields={
          viewing
            ? [
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
  const [status, setStatus] = useState('');
  const [purpose, setPurpose] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<Payment | null>(null);
  const list = useResourceList<Payment>('payments', '/api/admin/payments', {
    page, pageSize: 20, status: status || undefined, purpose: purpose || undefined,
  });
  const mutate = useResourceMutation('payments');

  const columns: Column<Payment>[] = [
    { key: 'user', header: 'User', render: (p) => (p.user ? <div><p className="font-medium">{p.user.name || '—'}</p><p className="text-xs text-muted-foreground">{p.user.email}</p></div> : '—') },
    { key: 'purpose', header: 'Purpose', render: (p) => <Badge variant="outline">{p.purpose}</Badge> },
    { key: 'amount', header: 'Amount', render: (p) => formatMinorUnits(p.amountMinor, p.currency) },
    { key: 'provider', header: 'Provider', render: (p) => p.provider },
    { key: 'status', header: 'Status', render: (p) => <Badge variant={STATUS_VARIANT[p.status] ?? 'secondary'}>{p.status}</Badge> },
    { key: 'date', header: 'Paid', render: (p) => (p.paidAt ? formatDate(p.paidAt) : '—') },
    {
      key: 'actions', header: '', className: 'text-right',
      render: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setViewing(p)}>
              <Eye className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            {hasPermission('payment.refund') && p.status === 'SUCCEEDED' && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  const reason = prompt('Refund reason (optional):') ?? '';
                  mutate.mutate({ path: `/api/admin/payments/${p.id}/refund`, method: 'post', body: { reason } });
                }}
              >
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
      <div className="mb-4 flex gap-2">
        <Select value={purpose} onChange={(e) => (setPurpose(e.target.value), setPage(1))} className="w-40">
          <option value="">All purposes</option>
          <option value="SUBSCRIPTION">Subscription</option>
          <option value="DONATION">Donation</option>
        </Select>
        <Select value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="w-40">
          <option value="">All statuses</option>
          {['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </div>
      <DataTable columns={columns} page={list.data} isLoading={list.isLoading} isError={list.isError} onPageChange={setPage} />

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

export function PaymentsPage() {
  return (
    <div>
      <PageHeader title="Payments" description="One ledger for subscriptions and donations, split by purpose." />
      <Tabs defaultValue="overview">
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
