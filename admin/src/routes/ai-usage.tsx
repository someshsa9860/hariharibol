import { useState } from 'react';
import { Eye, Play } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/data-table';
import { FilterSelect, FlagFilter } from '@/components/table-filters';
import { DetailDialog } from '@/components/detail-dialog';
import { useResource, useResourceMutation } from '@/lib/use-resource';
import { useDataTable } from '@/lib/use-table';
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
  const [viewing, setViewing] = useState<UsageRow | null>(null);
  const spend = useResource<Spend>(['ai-spend'], '/api/admin/ai/spend');
  const coverage = useResource<Coverage>(['ai-coverage'], '/api/admin/ai/coverage');
  const table = useDataTable<UsageRow>({
    id: 'ai-usage',
    path: '/api/admin/ai/usage',
    filters: ['operation', 'provider', 'succeeded'],
    defaultSort: { key: 'createdAt', dir: 'desc' },
  });
  const mutate = useResourceMutation('ai-usage');

  const columns: Column<UsageRow>[] = [
    { key: 'operation', header: 'Operation', sort: 'operation', fixed: true, csv: (r) => r.operation, render: (r) => r.operation },
    { key: 'provider', header: 'Provider', csv: (r) => r.provider, render: (r) => <Badge variant="outline">{r.provider}</Badge> },
    { key: 'model', header: 'Model', csv: (r) => r.model, defaultHidden: true, render: (r) => r.model },
    { key: 'input', header: 'Tokens in', sort: 'inputTokens', csv: (r) => r.inputTokens, defaultHidden: true, render: (r) => r.inputTokens.toLocaleString() },
    { key: 'output', header: 'Tokens out', sort: 'outputTokens', csv: (r) => r.outputTokens, defaultHidden: true, render: (r) => r.outputTokens.toLocaleString() },
    // Micros are millionths of a dollar; the CSV keeps the raw integer so a spreadsheet can sum it exactly.
    { key: 'cost', header: 'Cost', sort: 'cost', csv: (r) => r.costMicros, render: (r) => formatMicros(r.costMicros) },
    {
      key: 'status',
      header: 'Status',
      csv: (r) => (r.succeeded ? 'OK' : `Failed: ${r.errorMessage ?? ''}`),
      render: (r) => <Badge variant={r.succeeded ? 'success' : 'destructive'}>{r.succeeded ? 'OK' : 'Failed'}</Badge>,
    },
    { key: 'when', header: 'When', sort: 'createdAt', csv: (r) => r.createdAt, render: (r) => formatDate(r.createdAt) },
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
      <DataTable
        table={table}
        columns={columns}
        exportName="ai-usage"
        emptyMessage="No AI calls yet — the batch passes log here as they run."
        onRowClick={setViewing}
        rowClassName={(r) => (r.succeeded ? undefined : 'bg-destructive/5')}
        filters={
          <>
            <FilterSelect
              table={table}
              name="operation"
              label="All operations"
              className="w-48"
              // The operations the backend names in services/ai/index.js; the spend card
              // below lists whichever have actually been called.
              options={[
                ...new Set([
                  'verse.issue-map',
                  'verse.explanation',
                  'sloka.reason',
                  ...(spend.data?.byOperation.map((o) => o.operation) ?? []),
                ]),
              ]}
            />
            <FilterSelect table={table} name="provider" label="All providers" className="w-40" options={['GEMINI', 'OPENAI']} />
            <FlagFilter table={table} name="succeeded" label="Any outcome" yes="Succeeded" no="Failed" />
          </>
        }
      />

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
