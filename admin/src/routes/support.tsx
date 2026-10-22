import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { FilterSelect } from '@/components/table-filters';
import { useDataTable } from '@/lib/use-table';
import { api, ApiRequestError } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea, Select } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, formatDateOnly } from '@/lib/utils';

type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
type Kind = 'TICKET' | 'FEEDBACK';

type Row = {
  id: string;
  kind: Kind;
  category: string;
  status: Status;
  subject: string | null;
  rating: number | null;
  lastMessageAt: string;
  createdAt: string;
  preview: string | null;
  messageCount: number;
  awaitingStaff: boolean;
  user: { id: string; email: string; name: string | null };
};

type Detail = Row & {
  deviceInfo: Record<string, string | number | boolean> | null;
  screenshotUrl: string | null;
  messages: { id: string; fromStaff: boolean; body: string; createdAt: string; author?: { name: string | null; email: string } | null }[];
};

type Summary = { open: number; inProgress: number; resolved: number; tickets: number; feedback: number; averageRating: number | null; ratingCount: number };

const STATUS_LABEL: Record<Status, string> = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved' };
const STATUS_VARIANT: Record<Status, 'warning' | 'default' | 'success'> = { OPEN: 'warning', IN_PROGRESS: 'default', RESOLVED: 'success' };
const CATEGORIES = ['bug', 'payment', 'account', 'content', 'suggestion', 'other'];

function Stars({ value }: { value: number | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('h-3.5 w-3.5', n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
      ))}
    </span>
  );
}

export function SupportPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const summary = useResource<Summary>(['support-summary'], '/api/admin/support/summary');

  const table = useDataTable<Row>({
    id: 'support',
    path: '/api/admin/support/tickets',
    filters: ['status', 'kind', 'category', 'maxRating'],
    defaultSort: { key: 'lastMessageAt', dir: 'desc' },
  });

  const columns: Column<Row>[] = [
    {
      key: 'from',
      header: 'From',
      fixed: true,
      csv: (r) => r.user.email,
      render: (r) => (
        <div>
          <p className="font-medium leading-tight">{r.user.name || r.user.email}</p>
          <p className="text-xs leading-tight text-muted-foreground">{r.user.email}</p>
        </div>
      ),
    },
    {
      key: 'what',
      header: 'What',
      csv: (r) => `${r.subject ?? ''} ${r.preview ?? ''}`.trim(),
      render: (r) => (
        <div className="max-w-sm">
          <p className="truncate text-sm">{r.subject || r.preview || '(no message)'}</p>
          {r.subject && r.preview && <p className="truncate text-xs text-muted-foreground">{r.preview}</p>}
        </div>
      ),
    },
    { key: 'kind', header: 'Type', csv: (r) => r.kind, render: (r) => <Badge variant="outline">{r.kind === 'TICKET' ? 'Ticket' : 'Feedback'}</Badge> },
    { key: 'category', header: 'Category', csv: (r) => r.category, render: (r) => <span className="capitalize">{r.category}</span> },
    { key: 'rating', header: 'Rating', sort: 'rating', csv: (r) => r.rating ?? '', render: (r) => <Stars value={r.rating} /> },
    {
      key: 'status',
      header: 'Status',
      sort: 'status',
      csv: (r) => r.status,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
          {r.awaitingStaff && r.status !== 'RESOLVED' && <span className="text-xs text-amber-600">needs reply</span>}
        </div>
      ),
    },
    { key: 'last', header: 'Last activity', sort: 'lastMessageAt', csv: (r) => r.lastMessageAt, render: (r) => formatDateOnly(r.lastMessageAt) },
  ];

  return (
    <div>
      <PageHeader title="Support" description="Tickets and feedback from the app. Replying sends the reader a push." />

      {summary.data && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Open', summary.data.open],
            ['In progress', summary.data.inProgress],
            ['Resolved', summary.data.resolved],
            [`Average rating (${summary.data.ratingCount})`, summary.data.averageRating ?? '—'],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DataTable
        table={table}
        columns={columns}
        exportName="support"
        searchPlaceholder="Search message, subject or sender…"
        onRowClick={(r) => setOpenId(r.id)}
        filters={
          <>
            <FilterSelect table={table} name="status" label="All statuses" options={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
            <FilterSelect table={table} name="kind" label="Tickets and feedback" options={[{ value: 'TICKET', label: 'Tickets' }, { value: 'FEEDBACK', label: 'Feedback' }]} />
            <FilterSelect table={table} name="category" label="All categories" options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
            <FilterSelect table={table} name="maxRating" label="Any rating" options={[{ value: '2', label: '2 stars or less' }, { value: '3', label: '3 stars or less' }]} />
          </>
        }
      />

      <TicketDialog id={openId} onClose={() => setOpenId(null)} onChanged={() => void summary.refetch()} />
    </div>
  );
}

function TicketDialog({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const detail = useResource<Detail>(['support-ticket', id], `/api/admin/support/tickets/${id}`, undefined, { enabled: !!id });

  const refresh = () => {
    void detail.refetch();
    void queryClient.invalidateQueries({ queryKey: ['support'] });
    onChanged();
  };

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      refresh();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const t = detail.data;
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent page>
        <DialogHeader>
          <DialogTitle>{t ? (t.subject || (t.kind === 'TICKET' ? 'Ticket' : 'Feedback')) : 'Loading…'}</DialogTitle>
        </DialogHeader>
        {t && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                {t.user.name || t.user.email} <span className="text-muted-foreground">({t.user.email})</span>
              </span>
              <Badge variant="outline" className="capitalize">{t.category}</Badge>
              <Stars value={t.rating} />
              <Select
                className="ml-auto w-40"
                value={t.status}
                disabled={busy}
                onChange={(e) => void run(() => api.patch(`/api/admin/support/tickets/${t.id}`, { status: e.target.value }))}
              >
                {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </Select>
            </div>

            {t.deviceInfo && (
              <p className="text-xs text-muted-foreground">
                {Object.entries(t.deviceInfo).filter(([, v]) => v !== null && v !== '').map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </p>
            )}

            {t.screenshotUrl && (
              <a href={t.screenshotUrl} target="_blank" rel="noreferrer">
                <img src={t.screenshotUrl} alt="Screenshot from the reader" className="max-h-72 rounded-md border" />
              </a>
            )}

            <div className="space-y-2">
              {t.messages.length === 0 && <p className="text-muted-foreground">No message — rating only.</p>}
              {t.messages.map((m) => (
                <div key={m.id} className={cn('max-w-[85%] rounded-lg px-3 py-2', m.fromStaff ? 'ml-auto bg-primary/10' : 'bg-muted')}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.fromStaff ? m.author?.name || m.author?.email || 'Staff' : 'Reader'} · {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <Textarea placeholder="Write a reply — the reader gets a push" value={text} onChange={(e) => setText(e.target.value)} />
              {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
              <div className="mt-2 flex justify-end">
                <Button
                  disabled={busy || text.trim().length === 0}
                  onClick={() =>
                    void run(async () => {
                      await api.post(`/api/admin/support/tickets/${t.id}/messages`, { body: text.trim() });
                      setText('');
                    })
                  }
                >
                  Send reply
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
