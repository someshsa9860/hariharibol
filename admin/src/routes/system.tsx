import { Cpu, Database, Gauge, HardDrive, MemoryStick } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useResource } from '@/lib/use-resource';
import { formatBytes } from '@/lib/utils';

type Health = {
  process: { uptimeSeconds: number; nodeVersion: string; memory: { rssBytes: number; heapUsedBytes: number; heapTotalBytes: number } };
  os: { loadAvg: number[]; cpuCount: number; freeMemBytes: number; totalMemBytes: number };
  database: { sizeBytes: number };
};

type Storage = { mode: 'local' | 's3'; totalBytes: number; byKind: { kind: string; sizeBytes: number; count: number }[]; cachedAt: string };

type RequestEntry = { method: string; path: string; status: number; durationMs: number; at: number };
type Requests = {
  recent: RequestEntry[];
  summary: { count: number; avgDurationMs: number; p95DurationMs: number; byStatusClass: Record<string, number> };
  slowest: RequestEntry[];
};

type LogLine = { level: number; time: number; msg: string; [key: string]: unknown };

const LEVEL_LABEL: Record<number, { label: string; variant: 'secondary' | 'warning' | 'destructive' }> = {
  10: { label: 'TRACE', variant: 'secondary' },
  20: { label: 'DEBUG', variant: 'secondary' },
  30: { label: 'INFO', variant: 'secondary' },
  40: { label: 'WARN', variant: 'warning' },
  50: { label: 'ERROR', variant: 'destructive' },
  60: { label: 'FATAL', variant: 'destructive' },
};

function uptimeLabel(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function HealthTab() {
  const health = useResource<Health>(['system-health'], '/api/admin/system/health', undefined, { refetchInterval: 15_000 });
  const h = health.data;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Cpu className="h-4 w-4" />
            Process
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="space-y-1 text-sm">
              <p>Uptime: {uptimeLabel(h!.process.uptimeSeconds)}</p>
              <p className="text-muted-foreground">Node {h!.process.nodeVersion}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <MemoryStick className="h-4 w-4" />
            Process memory
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="space-y-1 text-sm">
              <p>RSS: {formatBytes(h!.process.memory.rssBytes)}</p>
              <p className="text-muted-foreground">
                Heap: {formatBytes(h!.process.memory.heapUsedBytes)} / {formatBytes(h!.process.memory.heapTotalBytes)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Cpu className="h-4 w-4" />
            Server
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="space-y-1 text-sm">
              <p>Load avg: {h!.os.loadAvg.map((n) => n.toFixed(2)).join(' / ')}</p>
              <p className="text-muted-foreground">
                {h!.os.cpuCount} CPUs · {formatBytes(h!.os.totalMemBytes - h!.os.freeMemBytes)} / {formatBytes(h!.os.totalMemBytes)} used
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Database className="h-4 w-4" />
            Database
          </CardTitle>
        </CardHeader>
        <CardContent>{health.isLoading ? <Skeleton className="h-16 w-full" /> : <p className="text-xl font-semibold">{formatBytes(h!.database.sizeBytes)}</p>}</CardContent>
      </Card>
    </div>
  );
}

function StorageTab() {
  const storage = useResource<Storage>(['system-storage'], '/api/admin/system/storage');
  const s = storage.data;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <HardDrive className="h-5 w-5 text-muted-foreground" />
        {storage.isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div>
            <p className="text-xl font-semibold">{formatBytes(s!.totalBytes)}</p>
            <p className="text-xs text-muted-foreground">
              {s!.mode === 'local' ? 'Local storage/ (no AWS credentials configured)' : 'S3 bucket'} · cached {new Date(s!.cachedAt).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>

      {storage.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-1.5">
          {s!.byKind
            .filter((k) => k.count > 0)
            .sort((a, b) => b.sizeBytes - a.sizeBytes)
            .map((k) => (
              <div key={k.kind} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="font-medium">{k.kind}</span>
                <span className="text-xs text-muted-foreground">{k.count} files · {formatBytes(k.sizeBytes)}</span>
              </div>
            ))}
          {s!.byKind.every((k) => k.count === 0) && <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>}
        </div>
      )}
    </div>
  );
}

function LogsTab() {
  const logs = useResource<LogLine[]>(['system-logs'], '/api/admin/system/logs', { limit: 200 }, { refetchInterval: 5000 });

  return (
    <div className="max-h-[32rem] space-y-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-xs">
      {logs.isLoading && <Skeleton className="h-64 w-full" />}
      {logs.data?.length === 0 && <p className="text-muted-foreground">No log lines captured since the process started.</p>}
      {[...(logs.data ?? [])].reverse().map((line, i) => {
        const meta = LEVEL_LABEL[line.level] ?? { label: String(line.level), variant: 'secondary' as const };
        return (
          <div key={i} className="flex items-start gap-2 border-b border-border/50 py-1 last:border-0">
            <span className="shrink-0 text-muted-foreground">{new Date(line.time).toLocaleTimeString()}</span>
            <Badge variant={meta.variant} className="shrink-0">
              {meta.label}
            </Badge>
            <span className="break-all">{line.msg}</span>
          </div>
        );
      })}
    </div>
  );
}

function statusVariant(status: number): 'success' | 'secondary' | 'warning' | 'destructive' {
  if (status >= 500) return 'destructive';
  if (status >= 400) return 'warning';
  if (status >= 300) return 'secondary';
  return 'success';
}

function RequestsTab() {
  const requests = useResource<Requests>(['system-requests'], '/api/admin/system/requests', undefined, { refetchInterval: 10_000 });
  const r = requests.data;

  return (
    <div>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Gauge className="h-4 w-4" />
              Avg latency
            </CardTitle>
          </CardHeader>
          <CardContent>{requests.isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-xl font-semibold">{r!.summary.avgDurationMs} ms</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>p95 latency</CardTitle>
          </CardHeader>
          <CardContent>{requests.isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-xl font-semibold">{r!.summary.p95DurationMs} ms</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By status</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <div className="flex gap-1.5">
                <Badge variant="success">2xx {r!.summary.byStatusClass['2xx']}</Badge>
                <Badge variant="secondary">3xx {r!.summary.byStatusClass['3xx']}</Badge>
                <Badge variant="warning">4xx {r!.summary.byStatusClass['4xx']}</Badge>
                <Badge variant="destructive">5xx {r!.summary.byStatusClass['5xx']}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="mb-2 text-xs text-muted-foreground">
        Sampled from the last {r?.summary.count ?? 0} requests this process has logged — not a persisted metrics store; restarting the API clears it.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Method</TableHead>
            <TableHead>Path</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.isLoading &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={5}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {r?.recent.map((req, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{req.method}</TableCell>
              <TableCell className="max-w-xs truncate font-mono text-xs">{req.path}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(req.status)}>{req.status}</Badge>
              </TableCell>
              <TableCell>{req.durationMs} ms</TableCell>
              <TableCell className="text-xs text-muted-foreground">{new Date(req.at).toLocaleTimeString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SystemPage() {
  return (
    <div>
      <PageHeader title="System health" description="This API process only — the worker, websocket and deeplink containers run separately." />
      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="health">
          <HealthTab />
        </TabsContent>
        <TabsContent value="requests">
          <RequestsTab />
        </TabsContent>
        <TabsContent value="storage">
          <StorageTab />
        </TabsContent>
        <TabsContent value="logs">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
