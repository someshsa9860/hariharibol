import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/data-table';
import { FilterSelect } from '@/components/table-filters';
import { DetailDialog } from '@/components/detail-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useResource } from '@/lib/use-resource';
import { useDataTable } from '@/lib/use-table';
import { formatDate } from '@/lib/utils';

type Funnel = {
  sent: number;
  delivered: number;
  opened: number;
  engaged: number;
  deliveredRate: number | null;
  openedRate: number | null;
  engagedRate: number | null;
  averageStaySeconds: number | null;
};

type Campaign = {
  id: string;
  key: string;
  type: string;
  source: string;
  title: string;
  body: string;
  targetedUsers: number;
  sentDevices: number;
  failedDevices: number;
  createdAt: string;
  funnel: Funnel;
};

type CampaignDetail = Campaign & {
  minSeconds: number;
  stayBuckets: { bucket: string; count: number }[];
  byPlatform: { platform: string; reached: number; opened: number }[];
  inApp: { notifications: number; read: number };
  recent: {
    id: string;
    event: 'OPENED' | 'ENGAGED';
    durationMs: number | null;
    screen: string | null;
    occurredAt: string;
    device: { platform: string; appVersion: string | null };
  }[];
};

const TYPES = ['SLOKA', 'SADHANA', 'ANNOUNCEMENT', 'SYSTEM', 'REEL', 'REFERRAL', 'FESTIVAL'];

// How long someone must stay after tapping for it to count as having read.
const READ_SECONDS = 10;

const n = (value: number) => value.toLocaleString();
const pct = (value: number | null) => (value === null ? '' : ` (${value}%)`);

/** A count with its share beside it, or a dash when nothing has been sent. */
function Counted({ value, rate }: { value: number; rate: number | null }) {
  return (
    <span className="tabular-nums">
      {n(value)}
      <span className="text-xs text-muted-foreground">{pct(rate)}</span>
    </span>
  );
}

export function NotificationStats() {
  const [viewing, setViewing] = useState<Campaign | null>(null);

  const table = useDataTable<Campaign>({
    id: 'push-campaigns',
    path: '/api/admin/notifications/campaigns',
    filters: ['type'],
    defaultSort: { key: 'createdAt', dir: 'desc' },
  });

  const columns: Column<Campaign>[] = [
    {
      key: 'title',
      header: 'Notification',
      sort: 'title',
      fixed: true,
      csv: (c) => c.title,
      render: (c) => (
        <div className="max-w-xs">
          <p className="truncate font-medium">{c.title}</p>
          <p className="truncate text-xs text-muted-foreground">{c.body}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Type', sort: 'type', csv: (c) => c.type, render: (c) => <Badge variant="outline">{c.type}</Badge> },
    { key: 'sent', header: 'Sent to devices', sort: 'sentDevices', csv: (c) => String(c.sentDevices), render: (c) => <span className="tabular-nums">{n(c.sentDevices)}</span> },
    { key: 'delivered', header: 'Delivered', csv: (c) => String(c.funnel.delivered), render: (c) => <Counted value={c.funnel.delivered} rate={c.funnel.deliveredRate} /> },
    { key: 'opened', header: 'Opened', csv: (c) => String(c.funnel.opened), render: (c) => <Counted value={c.funnel.opened} rate={c.funnel.openedRate} /> },
    { key: 'read', header: `Read ${READ_SECONDS}s+`, csv: (c) => String(c.funnel.engaged), render: (c) => <Counted value={c.funnel.engaged} rate={c.funnel.engagedRate} /> },
    { key: 'when', header: 'Sent', sort: 'createdAt', csv: (c) => c.createdAt, render: (c) => formatDate(c.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <Button variant="ghost" size="icon" aria-label="View statistics" onClick={(e) => (e.stopPropagation(), setViewing(c))}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="mb-8">
      <h3 className="mb-1 text-sm font-medium">Delivery statistics</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        One row per notification. Sent is what Firebase accepted; delivered, opened and read come from the app, so they
        count only phones running a version that reports them.
      </p>
      <DataTable
        table={table}
        columns={columns}
        exportName="notification-stats"
        searchPlaceholder="Search title or message…"
        emptyMessage="Nothing has been sent yet."
        onRowClick={setViewing}
        filters={<FilterSelect table={table} name="type" label="All types" options={TYPES} />}
      />
      <CampaignDialog campaign={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function Step({ label, value, rate, hint }: { label: string; value: number; rate: number | null; hint: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{n(value)}</p>
      <p className="text-xs text-muted-foreground">{rate === null ? hint : `${rate}% ${hint}`}</p>
    </div>
  );
}

function CampaignDialog({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
  const detail = useResource<CampaignDetail>(
    ['push-campaign', campaign?.id, READ_SECONDS],
    `/api/admin/notifications/campaigns/${campaign?.id}`,
    { minSeconds: READ_SECONDS },
    { enabled: !!campaign },
  );
  const d = detail.data;
  const f = d?.funnel ?? campaign?.funnel;
  const mostStays = Math.max(1, ...(d?.stayBuckets.map((b) => b.count) ?? [1]));

  return (
    <DetailDialog
      open={!!campaign}
      onOpenChange={(open) => !open && onClose()}
      title={campaign?.title}
      description={campaign ? `${campaign.type} · ${formatDate(campaign.createdAt)}` : undefined}
      fields={campaign ? [{ label: 'Message', value: campaign.body, full: true }] : []}
    >
      {campaign && f && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Step label="Sent" value={f.sent} rate={null} hint="devices" />
            <Step label="Delivered" value={f.delivered} rate={f.deliveredRate} hint="of sent" />
            <Step label="Opened" value={f.opened} rate={f.openedRate} hint="of sent" />
            <Step label={`Read ${READ_SECONDS}s+`} value={f.engaged} rate={f.engagedRate} hint="of opened" />
          </div>
          <p className="text-xs text-muted-foreground">
            {n(campaign.targetedUsers)} people addressed
            {campaign.failedDevices > 0 && ` · ${n(campaign.failedDevices)} devices Firebase refused`}
            {f.averageStaySeconds !== null && ` · readers stayed ${f.averageStaySeconds}s on average`}.
          </p>

          {detail.isLoading && <Skeleton className="h-24 w-full" />}
          {d && (
            <>
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  How long readers stayed after opening
                </p>
                <div className="space-y-1">
                  {d.stayBuckets.map((b) => (
                    <div key={b.bucket} className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-muted-foreground">{b.bucket}</span>
                      <div className="h-2 flex-1 rounded bg-muted">
                        <div className="h-2 rounded bg-primary" style={{ width: `${(b.count / mostStays) * 100}%` }} />
                      </div>
                      <span className="w-10 text-right tabular-nums">{n(b.count)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {d.byPlatform.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {d.byPlatform.map((p) => (
                    <Badge key={p.platform} variant="outline">
                      {p.platform}: {n(p.reached)} reached · {n(p.opened)} opened
                    </Badge>
                  ))}
                </div>
              )}

              {d.inApp.notifications > 0 && (
                <p className="text-xs text-muted-foreground">
                  In the app's list for {n(d.inApp.notifications)} people; {n(d.inApp.read)} have marked it read.
                </p>
              )}

              {d.recent.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Latest opens</p>
                  <ul className="max-h-40 space-y-1 overflow-auto text-xs">
                    {d.recent.map((e) => (
                      <li key={e.id} className="flex justify-between gap-3">
                        <span>
                          {e.event === 'OPENED' ? 'Tapped' : `Read for ${Math.round((e.durationMs ?? 0) / 1000)}s`}
                          <span className="text-muted-foreground">
                            {' '}· {e.device.platform}
                            {e.device.appVersion ? ` ${e.device.appVersion}` : ''}
                            {e.screen ? ` · ${e.screen}` : ''}
                          </span>
                        </span>
                        <span className="whitespace-nowrap text-muted-foreground">{formatDate(e.occurredAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </DetailDialog>
  );
}
