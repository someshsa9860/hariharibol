import { useState } from 'react';
import { Eye } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { DetailDialog, JsonValue } from '@/components/detail-dialog';
import { useResource, useResourceList } from '@/lib/use-resource';
import { Select } from '@/components/ui/input';
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
  actor: { name: string | null; email: string } | null;
};
type ActionCount = { action: string; count: number };

export function AuditPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<AuditRow | null>(null);
  const actions = useResource<ActionCount[]>(['audit-actions'], '/api/admin/audit/actions');
  const list = useResourceList<AuditRow>('audit', '/api/admin/audit', { page, pageSize: 30, action: action || undefined });

  const columns: Column<AuditRow>[] = [
    { key: 'action', header: 'Action', render: (r) => <Badge variant="outline">{r.action}</Badge> },
    { key: 'entity', header: 'Entity', render: (r) => `${r.entityType}${r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ''}` },
    { key: 'actor', header: 'Actor', render: (r) => r.actor?.email ?? 'System' },
    { key: 'when', header: 'When', render: (r) => formatDate(r.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) => (
        <Button variant="ghost" size="icon" onClick={(e) => (e.stopPropagation(), setViewing(r))}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Audit log" description="Only what changed is stored, not a full snapshot per edit." />

      <div className="mb-4">
        <Select value={action} onChange={(e) => (setAction(e.target.value), setPage(1))} className="w-64">
          <option value="">All actions</option>
          {actions.data?.map((a) => (
            <option key={a.action} value={a.action}>
              {a.action} ({a.count})
            </option>
          ))}
        </Select>
      </div>

      <DataTable columns={columns} page={list.data} isLoading={list.isLoading} isError={list.isError} onPageChange={setPage} />

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
