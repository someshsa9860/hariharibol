import { useState } from 'react';
import { History } from 'lucide-react';
import { useResourceList } from '@/lib/use-resource';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { JsonValue } from '@/components/json-value';
import { formatDate } from '@/lib/utils';

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
  ipAddress: string | null;
  actor: { id: string; name: string | null; email: string } | null;
};

/** One or more kinds of record whose history this shows; `entityId` narrows it to one row. */
export type AuditScope = {
  entityType: string | string[];
  entityId?: string | null;
  /** Also (or only) what this person did as a staff member, for a user's page. */
  actorId?: string;
  title?: string;
};

function Rows({ scope }: { scope: { entityType?: string; entityId?: string | null; actorId?: string } }) {
  const [page, setPage] = useState(1);
  const list = useResourceList<AuditRow>(
    `audit-scope:${scope.entityType ?? ''}:${scope.entityId ?? ''}:${scope.actorId ?? ''}`,
    '/api/admin/audit',
    { page, pageSize: 10, ...(scope.entityType ? { entityType: scope.entityType } : {}), ...(scope.entityId ? { entityId: scope.entityId } : {}), ...(scope.actorId ? { actorId: scope.actorId } : {}), sort: 'createdAt', dir: 'desc' }
  );
  const [open, setOpen] = useState<string | null>(null);

  if (list.isLoading) return <Skeleton className="h-20 w-full" />;
  const items = list.data?.items ?? [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>;

  return (
    <div>
      <ul className="divide-y rounded-md border">
        {items.map((row) => (
          <li key={row.id} className="px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Badge variant="outline" className="font-mono text-xs">{row.action}</Badge>
              <span className="text-xs text-muted-foreground">{row.entityType}{row.entityId ? ` · ${row.entityId.slice(0, 10)}` : ''}</span>
              <span className="text-xs">by {row.actor ? row.actor.name || row.actor.email : <em>deleted account</em>}</span>
              <span className="ml-auto text-xs text-muted-foreground">{formatDate(row.createdAt)}</span>
              {Boolean(row.before || row.after) && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setOpen(open === row.id ? null : row.id)}>
                  {open === row.id ? 'Hide changes' : 'Show changes'}
                </Button>
              )}
            </div>
            {open === row.id && (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div><p className="mb-1 text-xs font-medium text-muted-foreground">Before</p><JsonValue value={row.before} /></div>
                <div><p className="mb-1 text-xs font-medium text-muted-foreground">After</p><JsonValue value={row.after} /></div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {(list.data?.totalPages ?? 1) > 1 && (
        <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {list.data?.totalPages}</span>
          <Button variant="outline" size="sm" disabled={!list.data?.hasMore} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}

/**
 * The audit trail for what is on screen: every staff change made to this record (and, for a person, what they did as
 * staff). Shown only to people who may read the audit log; everyone else sees nothing, not an error.
 */
export function EntityAudit({ scope }: { scope: AuditScope }) {
  const { hasPermission } = useAuth();
  if (!hasPermission('audit.read')) return null;
  const types = Array.isArray(scope.entityType) ? scope.entityType : [scope.entityType];

  return (
    <section className="mt-6" aria-label="Audit log">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4" /> {scope.title ?? 'Audit log'}</h3>
      <div className="space-y-4">
        {types.map((t) => (
          <div key={t}>
            {types.length > 1 && <p className="mb-1 text-xs font-medium text-muted-foreground">{t}</p>}
            <Rows scope={{ entityType: t, entityId: scope.entityId }} />
          </div>
        ))}
        {scope.actorId && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Changes this person made as staff</p>
            <Rows scope={{ actorId: scope.actorId }} />
          </div>
        )}
      </div>
    </section>
  );
}
