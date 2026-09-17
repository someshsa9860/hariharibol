import { useState } from 'react';
import { Play, RotateCcw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useResource, useResourceMutation } from '@/lib/use-resource';
import { formatDate } from '@/lib/utils';

type QueueCounts = { waiting: number; active: number; completed: number; failed: number; delayed: number };
type Overview = { queues: { queue: string; counts: QueueCounts }[]; schedules: { name: string; queue: string; cron: string; description: string }[] };
type FailedJob = { id: string; name: string; attemptsMade: number; failedReason: string; failedAt: string };

export function JobsPage() {
  const overview = useResource<Overview>(['jobs'], '/api/admin/jobs');
  const mutate = useResourceMutation('jobs');
  const [openQueue, setOpenQueue] = useState<string | null>(null);
  const failed = useResource<FailedJob[]>(['jobs-failed', openQueue], `/api/admin/jobs/${openQueue}/failed`, undefined, {
    enabled: !!openQueue,
  });

  return (
    <div>
      <PageHeader title="Jobs" description="Live BullMQ / Redis state — not a database table." />

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
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => mutate.mutate({ path: `/api/admin/jobs/${openQueue}/failed`, method: 'delete' })}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all
              </Button>
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
                      onClick={() => mutate.mutate({ path: `/api/admin/jobs/${openQueue}/${j.id}/retry`, method: 'post' })}
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
                <Button size="sm" variant="outline" onClick={() => mutate.mutate({ path: `/api/admin/jobs/run/${s.name}`, method: 'post', body: {} })}>
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
