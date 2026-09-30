import { useState } from 'react';
import { Eye } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { DateRangeFilter, FilterSelect } from '@/components/table-filters';
import { DetailDialog, JsonValue } from '@/components/detail-dialog';
import { useResource } from '@/lib/use-resource';
import { useDataTable } from '@/lib/use-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
};
type ActionCount = { action: string; count: number };

export function AuditPage() {
  const [viewing, setViewing] = useState<AuditRow | null>(null);
  const actions = useResource<ActionCount[]>(['audit-actions'], '/api/admin/audit/actions');
  const table = useDataTable<AuditRow>({
    id: 'audit',
    path: '/api/admin/audit',
    filters: ['action', 'from', 'to'],
    defaultSort: { key: 'createdAt', dir: 'desc' },
    pageSize: 50,
  });

  // Action names read "book.publish", "user.ban" — the part before the first dot
  // is the kind of record, and the API matches `action` by prefix, so "book." is
  // a one-click "everything that happened to books".
  const groups = [...new Set((actions.data ?? []).map((a) => a.action.split('.')[0]))].sort();

  const columns: Column<AuditRow>[] = [
    {
      key: 'action',
      header: 'Action',
      sort: 'action',
      fixed: true,
      csv: (r) => r.action,
      render: (r) => <Badge variant="outline">{r.action}</Badge>,
    },
    {
      key: 'entity',
      header: 'Entity',
      sort: 'entityType',
      csv: (r) => `${r.entityType}${r.entityId ? ` ${r.entityId}` : ''}`,
      render: (r) => (
        <span>
          {r.entityType}
          {r.entityId && <span className="ml-1 font-mono text-xs text-muted-foreground">{r.entityId.slice(0, 8)}</span>}
        </span>
      ),
    },
    { key: 'actor', header: 'Actor', csv: (r) => r.actor?.email ?? 'System', render: (r) => r.actor?.email ?? <span className="text-muted-foreground">System</span> },
    { key: 'ip', header: 'IP address', csv: (r) => r.ipAddress, defaultHidden: true, render: (r) => r.ipAddress ?? '—' },
    { key: 'when', header: 'When', sort: 'createdAt', csv: (r) => r.createdAt, render: (r) => formatDate(r.createdAt) },
    { key: 'id', header: 'ID', csv: (r) => r.id, defaultHidden: true, render: (r) => <span className="font-mono text-xs">{r.id}</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <Button variant="ghost" size="icon" aria-label="View details" onClick={(e) => (e.stopPropagation(), setViewing(r))}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Audit log" description="Only what changed is stored, not a full snapshot per edit." />

      <DataTable
        table={table}
        columns={columns}
        exportName="audit-log"
        searchPlaceholder="Search action, actor email or record id…"
        emptyMessage="Nothing has been logged yet."
        onRowClick={setViewing}
        filters={
          <>
            <FilterSelect
              table={table}
              name="action"
              label="All actions"
              className="w-56"
              options={[
                // Prefix filter: "book." matches every book action. Offered ahead of the exact names.
                ...groups.map((g) => ({ value: `${g}.`, label: `${g}.* (all)` })),
                ...(actions.data ?? []).map((a) => ({ value: a.action, label: `${a.action} (${a.count})` })),
              ]}
            />
            <DateRangeFilter table={table} />
          </>
        }
      />

      <DetailDialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.action}
        description={viewing ? `${viewing.entityType}${viewing.entityId ? ` · ${viewing.entityId}` : ''}` : undefined}
        fields={
          viewing
            ? [
                { label: 'Actor', value: viewing.actor?.email ?? 'System' },
                { label: 'When', value: formatDate(viewing.createdAt) },
                { label: 'IP address', value: viewing.ipAddress ?? '—' },
                { label: 'User agent', value: viewing.userAgent ?? '—', full: true },
                { label: 'Before', value: <JsonValue value={viewing.before} />, full: true },
                { label: 'After', value: <JsonValue value={viewing.after} />, full: true },
              ]
            : []
        }
      />
    </div>
  );
}
