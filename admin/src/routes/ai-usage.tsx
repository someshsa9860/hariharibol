import { useState } from 'react';
import { Eye, Play } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/data-table';
import { DetailDialog } from '@/components/detail-dialog';
import { useResource, useResourceList, useResourceMutation } from '@/lib/use-resource';
import { formatDate, formatMicros } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

type Spend = { monthToDateMicros: number; failures: number; byOperation: { operation: string; calls: number; costMicros: number }[] };
type Coverage = { eligibleVerses: number; mappedToIssues: number; withEnglishExplanation: number; remaining: { issueMapping: number; explanations: number } };
type UsageRow = {
  id: string;
  operation: string;
  provider: string;
  model: string;
  targetType: string | null;
  targetId: string | null;
  inputTokens: number;
  outputTokens: number;
  succeeded: boolean;
  errorMessage: string | null;
  costMicros: number;
  createdAt: string;
};

export function AiUsagePage() {
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<UsageRow | null>(null);
  const spend = useResource<Spend>(['ai-spend'], '/api/admin/ai/spend');
  const coverage = useResource<Coverage>(['ai-coverage'], '/api/admin/ai/coverage');
  const list = useResourceList<UsageRow>('ai-usage', '/api/admin/ai/usage', { page, pageSize: 25 });
  const mutate = useResourceMutation('ai-usage');

  const columns: Column<UsageRow>[] = [
    { key: 'operation', header: 'Operation', render: (r) => r.operation },
    { key: 'provider', header: 'Provider', render: (r) => <Badge variant="outline">{r.provider}</Badge> },
    { key: 'cost', header: 'Cost', render: (r) => formatMicros(r.costMicros) },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={r.succeeded ? 'success' : 'destructive'}>{r.succeeded ? 'OK' : 'Failed'}</Badge> },
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
      <PageHeader title="AI usage" description="Spend is bounded by the corpus, not by user count — every call is logged." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spend (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {spend.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <p className="text-2xl font-semibold">{formatMicros(spend.data?.monthToDateMicros ?? 0)}</p>
                <p className="text-xs text-muted-foreground">{spend.data?.failures} failed calls</p>
                <div className="mt-3 space-y-1">
                  {spend.data?.byOperation.map((o) => (
                    <div key={o.operation} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{o.operation}</span>
                      <span>{o.calls} calls · {formatMicros(o.costMicros)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            {coverage.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <p className="text-sm">
                  {coverage.data?.mappedToIssues} / {coverage.data?.eligibleVerses} verses mapped to issues
                </p>
                <p className="text-sm">
                  {coverage.data?.withEnglishExplanation} / {coverage.data?.eligibleVerses} have an English explanation
                </p>
                {hasPermission('ai.run') && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => mutate.mutate({ path: '/api/admin/ai/jobs/issue-map', method: 'post', body: { limit: 100 } })}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Run issue-mapping
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => mutate.mutate({ path: '/api/admin/ai/jobs/explanations', method: 'post', body: { limit: 100 } })}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Run explanations
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <h3 className="mb-2 mt-6 text-sm font-medium">Recent calls</h3>
      <DataTable columns={columns} page={list.data} isLoading={list.isLoading} isError={list.isError} onPageChange={setPage} />

      <DetailDialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.operation}
        description={viewing?.model}
        fields={
          viewing
            ? [
                { label: 'Provider', value: <Badge variant="outline">{viewing.provider}</Badge> },
                { label: 'Status', value: <Badge variant={viewing.succeeded ? 'success' : 'destructive'}>{viewing.succeeded ? 'OK' : 'Failed'}</Badge> },
                { label: 'Cost', value: formatMicros(viewing.costMicros) },
                { label: 'Tokens', value: `${viewing.inputTokens} in / ${viewing.outputTokens} out` },
                { label: 'Target', value: viewing.targetType ? `${viewing.targetType} · ${viewing.targetId}` : '—' },
                { label: 'When', value: formatDate(viewing.createdAt) },
                ...(viewing.errorMessage ? [{ label: 'Error', value: viewing.errorMessage, full: true }] : []),
                { label: 'Call ID', value: <span className="font-mono text-xs">{viewing.id}</span> },
              ]
            : []
        }
      />
    </div>
  );
}
