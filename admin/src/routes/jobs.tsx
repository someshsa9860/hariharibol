import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Play, RotateCcw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useResource } from '@/lib/use-resource';
import { api, ApiRequestError } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type QueueCounts = { waiting: number; active: number; completed: number; failed: number; delayed: number };
type Overview = { queues: { queue: string; counts: QueueCounts }[]; schedules: { name: string; queue: string; cron: string; description: string }[] };
type FailedJob = { id: string; name: string; attemptsMade: number; failedReason: string; failedAt: string };

// Queue state moves on its own — workers finish jobs while the page is open —
// so it refreshes itself. (react-query pauses this while the tab is hidden.)
const REFRESH_MS = 10_000;
const BATCH = 5;

export function JobsPage() {
  const queryClient = useQueryClient();
  const overview = useResource<Overview>(['jobs'], '/api/admin/jobs', undefined, { refetchInterval: REFRESH_MS });
  const [openQueue, setOpenQueue] = useState<string | null>(null);
  const failed = useResource<FailedJob[]>(['jobs-failed', openQueue], `/api/admin/jobs/${openQueue}/failed`, undefined, {
    enabled: !!openQueue,
    refetchInterval: REFRESH_MS,
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Runs the calls a few at a time and says how many landed. The failed list has
  // its own query key, so it is refreshed explicitly — it would otherwise keep
  // showing a job that was just retried.
  async function run(label: string, calls: (() => Promise<unknown>)[]) {
    setBusy(true);
    setNotice(null);
    let done = 0;
    let firstError: unknown;
    for (let i = 0; i < calls.length; i += BATCH) {
      const results = await Promise.allSettled(calls.slice(i, i + BATCH).map((call) => call()));
      for (const result of results) {
        if (result.status === 'fulfilled') done++;
        else firstError ??= result.reason;
      }
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['jobs-failed'] }),
    ]);
    setBusy(false);

    if (firstError === undefined) {
      setNotice({ tone: 'success', text: `${label}.` });
    } else {
      const why = firstError instanceof ApiRequestError ? firstError.message : 'request failed';
      setNotice({ tone: 'error', text: `${label}: ${done} of ${calls.length} done, ${calls.length - done} failed (${why}).` });
    }
  }

  return (
    <div>
      <PageHeader title="Jobs" description="Live BullMQ / Redis state — not a database table." />

      {notice && (
        <p
          role="status"
          className={`mb-4 rounded-md border px-3 py-2 text-sm ${
            notice.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          {notice.text}
        </p>
      )}

      {overview.isLoading ? (
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {overview.data?.queues.map((q) => (
            <Card
              key={q.queue}
              className={`cursor-pointer transition-colors ${openQueue === q.queue ? 'ring-2 ring-ring' : ''}`}
              onClick={() => setOpenQueue(q.queue === openQueue ? null : q.queue)}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{q.queue}</span>
                  {q.counts.failed > 0 && <Badge variant="destructive">{q.counts.failed} failed</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>Waiting: {q.counts.waiting}</span>
                  <span>Active: {q.counts.active}</span>
                  <span>Completed: {q.counts.completed}</span>
                  <span>Delayed: {q.counts.delayed}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {openQueue && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">Failed jobs · {openQueue}</h3>
            {(failed.data?.length ?? 0) > 0 && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(
                      `Retried ${failed.data!.length} failed ${failed.data!.length === 1 ? 'job' : 'jobs'}`,
                      failed.data!.map((j) => () => api.post(`/api/admin/jobs/${openQueue}/${j.id}/retry`, {}))
                    )
                  }
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Retry all
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Discard every failed job in ${openQueue}? They can't be retried afterwards.`)) {
                      run('Cleared the failed jobs', [() => api.delete(`/api/admin/jobs/${openQueue}/failed`)]);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear all
                </Button>
              </div>
            )}
          </div>
          {failed.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : failed.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No failed jobs.</p>
          ) : (
            <div className="space-y-2">
              {failed.data?.map((j) => (
                <Card key={j.id}>
                  <CardContent className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{j.name}</p>
                      <p className="truncate text-xs text-destructive">{j.failedReason}</p>
                      <p className="text-xs text-muted-foreground">
                        {j.attemptsMade} attempts · {formatDate(j.failedAt)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => run('Retried the job', [() => api.post(`/api/admin/jobs/${openQueue}/${j.id}/retry`, {})])}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-medium">Scheduled jobs</h3>
        <div className="space-y-2">
          {overview.data?.schedules.map((s) => (
            <Card key={s.name}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.description} · <span className="font-mono">{s.cron}</span> · {s.queue}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => run(`Started ${s.name}`, [() => api.post(`/api/admin/jobs/run/${s.name}`, {})])}
                >
                  <Play className="h-3.5 w-3.5" />
                  Run now
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
