import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clapperboard, Gauge, Loader2, Plus, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SceneRunPanel, StartScenesDialog, type StartPreset } from '@/components/scenes-run';
import { ScenesViewer } from '@/components/scenes-viewer';
import { ProgressBar, StatusBadge, formatCount, timeAgo } from '@/components/translation-bits';
import { useAuth } from '@/lib/auth';
import { useSocketStatus } from '@/lib/socket';
import { useChapters, useSceneRun, useScenesLive, useScenesOverview, useSceneRuns, type ChapterRow, type ScenesOverview, type SceneRun } from '@/lib/scenes';
import { cn } from '@/lib/utils';

// The page keeps no state of its own that matters: the tab, the canto, the open chapter and the open run live in the
// URL, and everything else is the server's. A refresh, a shared link or a second tab shows the same thing.

export function ScenesPage() {
  const { hasPermission } = useAuth();
  const canRun = hasPermission('scenes.run');
  const [params, setParams] = useSearchParams();
  const overview = useScenesOverview();
  const data = overview.data;
  const busy = (data?.active.length ?? 0) > 0;
  const coverage = useChapters(busy);
  useScenesLive();

  const [startFor, setStartFor] = useState<StartPreset | null | undefined>(undefined); // undefined = closed, null = open with no preset

  const tab = params.get('tab') === 'runs' ? 'runs' : 'chapters';
  const chapter = Number(params.get('chapter')) || null;
  const canto = Number(params.get('canto')) || 1;
  const openRunId = params.get('run');

  const update = (changes: Record<string, string | null>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      return next;
    });

  const book = data?.books[0];
  const chapterList = book?.chapters ?? [];
  const at = chapter ? chapterList.findIndex((c) => c.id === chapter) : -1;

  return (
    <div>
      <PageHeader
        title="Scenes"
        description="Reel scene prompts written by AI, a chapter at a time. The model reads the Hindi meaning of every verse of a chapter of Śrīmad-Bhāgavatam and writes the storyboard: narrator, dialogue and a visual prompt for each scene. Files are saved to storage as sk-<canto>-ch-<chapter>.json. Runs work on the server — closing this page never stops one."
        actions={
          <>
            <LiveIndicator />
            {canRun && (
              <Button onClick={() => setStartFor(null)} disabled={!data}>
                <Plus /> New scene run
              </Button>
            )}
          </>
        }
      />

      {overview.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {overview.isError && !data && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-destructive">The Scenes page could not be loaded.</p>
            <Button size="sm" variant="outline" onClick={() => overview.refetch()}>
              <RefreshCw /> Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {data && book && (
        <div className="space-y-6">
          <Health settings={data.settings} hasActive={busy} />
          <Limits data={data} />

          {chapter ? (
            <ScenesViewer
              chapter={chapter}
              label={chapterList[at]?.label ?? String(chapter)}
              neighbours={{ previous: chapterList[at - 1]?.id ?? null, next: chapterList[at + 1]?.id ?? null }}
              onOpen={(id) => update({ chapter: id ? String(id) : null, canto: id ? String(Math.floor(id / 100)) : params.get('canto') })}
              onWriteAgain={canRun ? (id) => setStartFor({ chapters: [id], force: true }) : undefined}
            />
          ) : (
            <Tabs value={tab} onValueChange={(value) => update({ tab: value === 'runs' ? 'runs' : null })}>
              <TabsList>
                <TabsTrigger value="chapters">Chapters</TabsTrigger>
                <TabsTrigger value="runs">
                  Runs
                  {busy && <Badge className="ml-2 px-1.5 py-0">{data.active.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chapters" className="space-y-6">
                {busy && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-medium">In progress</h3>
                    {data.active.map((run) => (
                      <Card key={run.id}>
                        <CardContent className="pt-6">
                          <SceneRunPanel run={run} feedHeight="max-h-52" onOpenChapter={(id) => update({ chapter: String(id) })} />
                        </CardContent>
                      </Card>
                    ))}
                  </section>
                )}
                <ChapterGrid
                  chapters={coverage.data?.chapters}
                  loading={coverage.isLoading}
                  error={coverage.isError}
                  written={coverage.data?.written ?? 0}
                  total={coverage.data?.total ?? chapterList.length}
                  canto={canto}
                  onCanto={(value) => update({ canto: String(value) })}
                  onOpen={(id) => update({ chapter: String(id) })}
                  onWriteCanto={canRun ? (value) => setStartFor({ cantos: [value] }) : undefined}
                  onRetry={() => coverage.refetch()}
                />
              </TabsContent>

              <TabsContent value="runs" className="space-y-8">
                {busy && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-medium">In progress</h3>
                    {data.active.map((run) => (
                      <Card key={run.id}>
                        <CardContent className="pt-6">
                          <SceneRunPanel run={run} onOpenChapter={(id) => update({ chapter: String(id) })} />
                        </CardContent>
                      </Card>
                    ))}
                  </section>
                )}
                <History onOpen={(id) => update({ run: id })} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}

      {data && startFor !== undefined && (
        <StartScenesDialog
          key={JSON.stringify(startFor)}
          open
          onOpenChange={(open) => !open && setStartFor(undefined)}
          overview={data}
          coverage={coverage.data}
          preset={startFor}
          onStarted={(run) => {
            update({ chapter: null, tab: null });
            void run;
          }}
        />
      )}

      <RunDialog id={openRunId} onClose={() => update({ run: null })} onOpenChapter={(id) => update({ run: null, chapter: String(id) })} />
    </div>
  );
}

function LiveIndicator() {
  const status = useSocketStatus();
  const text = { live: 'Live', connecting: 'Connecting…', offline: 'Updating every few seconds' }[status];
  return (
    <span
      className={cn('inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs', status === 'live' ? 'border-success/30 bg-success/10 text-success' : 'text-muted-foreground')}
      title={status === 'live' ? 'Progress arrives the moment it happens' : 'The live connection is not up; the page asks the server for news every few seconds instead'}
    >
      {status === 'live' ? <Wifi className="h-3.5 w-3.5" /> : status === 'connecting' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WifiOff className="h-3.5 w-3.5" />}
      {text}
    </span>
  );
}

// ── Is it ready, and how full is the minute ──────────────────────────────────────────────────────────

function Health({ settings, hasActive }: { settings: ScenesOverview['settings']; hasActive: boolean }) {
  const provider = settings.providers.find((p) => p.id === settings.defaultProvider);
  const problems = [
    !settings.apiKeyConfigured && { fatal: true, text: `${provider?.keyEnv ?? 'The API key'} is not set on the server, so nothing can be written. Add it to the server .env for the api and the worker, then restart them.` },
    !settings.storage.ok && { fatal: true, text: `The bucket cannot be used: ${settings.storage.error ?? 'unknown problem'}. The server reads the book from, and writes the scene files to, the app's own bucket (S3_BUCKET).` },
    !settings.workerOnline && {
      fatal: false,
      text: hasActive ? 'No worker is connected, so nothing is progressing. The run carries on by itself as soon as a worker starts.' : 'No worker is connected right now. A run you start waits in the queue until one is.',
    },
  ].filter(Boolean) as { fatal: boolean; text: string }[];

  if (problems.length === 0) {
    return (
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Ready
        </span>
        <span>
          {provider?.label} <span className="font-mono text-foreground">{settings.model}</span>
        </span>
        <span>
          Files go to <span className="font-mono text-foreground">{settings.outputFolder}</span> (for example {settings.fileExample})
        </span>
        {settings.storage.describe && <span>{settings.storage.describe}</span>}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {problems.map((problem) => (
        <p key={problem.text} role={problem.fatal ? 'alert' : 'status'} className={cn('flex gap-2 rounded-md border px-3 py-2 text-sm', problem.fatal ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-warning/50 bg-warning/15')}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {problem.text}
        </p>
      ))}
    </div>
  );
}

function Meter({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const percent = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {formatCount(used)} <span className="font-normal text-muted-foreground">/ {formatCount(limit)} {unit}</span>
        </span>
      </div>
      <ProgressBar percent={percent} tone={percent > 90 ? 'warning' : 'primary'} className="h-1.5" />
    </div>
  );
}

/** The free tier's limits, how full the worker's last minute was, and what this app has used today (the token calculator). */
function Limits({ data }: { data: ScenesOverview }) {
  const { limits, model } = data.settings;
  const minute = data.usage.minute;
  const today = data.usage.today;
  const fresh = minute && Date.now() - new Date(minute.at).getTime() < 90_000;
  return (
    <Card>
      <CardContent className="grid gap-5 p-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
        <Meter label="Requests this minute" used={fresh ? minute.requests : 0} limit={limits.rpm} unit="a minute" />
        <Meter label="Input tokens this minute" used={fresh ? minute.tokens : 0} limit={limits.tpm} unit="a minute" />
        <div className="flex items-center gap-3 text-sm">
          <Gauge className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold tabular-nums">
              {formatCount(today.inputTokens)} in · {formatCount(today.outputTokens)} out
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCount(today.calls)} request{today.calls === 1 ? '' : 's'} today (UTC) on <span className="font-mono">{model}</span>
              {limits.rpd > 0 && <> · cap {formatCount(limits.rpd)} a day</>}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Chapters ──────────────────────────────────────────────────────────────────────────────────────────

function ChapterGrid({
  chapters, loading, error, written, total, canto, onCanto, onOpen, onWriteCanto, onRetry,
}: {
  chapters: ChapterRow[] | undefined;
  loading: boolean;
  error: boolean;
  written: number;
  total: number;
  canto: number;
  onCanto: (canto: number) => void;
  onOpen: (chapter: number) => void;
  onWriteCanto?: (canto: number) => void;
  onRetry: () => void;
}) {
  const cantos = useMemo(() => {
    const map = new Map<number, { total: number; written: number }>();
    for (const row of chapters ?? []) {
      const key = row.canto ?? 0;
      const entry = map.get(key) ?? { total: 0, written: 0 };
      entry.total += 1;
      if (row.written) entry.written += 1;
      map.set(key, entry);
    }
    return [...map.entries()];
  }, [chapters]);
  const rows = (chapters ?? []).filter((row) => (row.canto ?? 0) === canto);
  const here = cantos.find(([key]) => key === canto)?.[1];

  if (error && !chapters) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <p className="text-sm text-destructive">The list of written chapters could not be read from storage.</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw /> Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">
          Śrīmad-Bhāgavatam <span className="font-normal text-muted-foreground">· {written} of {total} chapters have scene prompts</span>
        </h3>
      </div>
      <ProgressBar percent={total ? (written / total) * 100 : 0} tone="success" className="h-1.5" />

      {loading && !chapters ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Canto">
            {cantos.map(([key, info]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={key === canto}
                onClick={() => onCanto(key)}
                className={cn('rounded-lg border px-3 py-1.5 text-left transition-colors', key === canto ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'bg-card hover:bg-accent')}
              >
                <span className="block text-sm font-semibold">Canto {key}</span>
                <span className="block text-[11px] text-muted-foreground tabular-nums">
                  {info.written}/{info.total}
                </span>
              </button>
            ))}
          </div>

          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Canto {canto} <span className="font-normal text-muted-foreground">· {here?.written ?? 0} of {here?.total ?? 0} written</span>
                </p>
                {onWriteCanto && (
                  <Button size="sm" variant="outline" onClick={() => onWriteCanto(canto)}>
                    <Clapperboard /> Write canto {canto}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => onOpen(row.id)}
                    title={row.written ? `${row.title ?? ''} · ${row.scenes} scenes · ${row.seconds}s` : 'Not written yet'}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-left transition-colors hover:bg-accent',
                      row.written ? 'border-success/40 bg-success/10' : 'border-dashed text-muted-foreground'
                    )}
                  >
                    <span className="flex items-center justify-between text-sm font-semibold">
                      {row.label}
                      {row.written && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                    </span>
                    <span className="block text-[11px] tabular-nums text-muted-foreground">{row.written ? `${row.scenes} scenes` : '—'}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}

// ── Runs ──────────────────────────────────────────────────────────────────────────────────────────────

function History({ onOpen }: { onOpen: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const runs = useSceneRuns(page);
  const now = Date.now();

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">History</h3>
      {runs.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !runs.data?.items.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No scene runs yet.</p>
      ) : (
        <>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chapters</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Tokens in / out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.data.items.map((run: SceneRun) => (
                  <TableRow key={run.id} className="cursor-pointer" onClick={() => onOpen(run.id)}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {timeAgo(run.createdAt, now)}
                      <span className="block text-xs text-muted-foreground">{run.requestedBy?.name ?? ''}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} stalled={run.stalled} />
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {run.progress.done} / {run.progress.total}
                      {run.progress.skipped > 0 && <span className="text-muted-foreground"> (+{run.progress.skipped} skipped)</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{run.model}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatCount(run.usage.inputTokens)} / {formatCount(run.usage.outputTokens)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {runs.data.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-muted-foreground">
                {page} / {runs.data.totalPages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= runs.data.totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RunDialog({ id, onClose, onOpenChapter }: { id: string | null; onClose: () => void; onOpenChapter: (chapter: number) => void }) {
  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Scene run</DialogTitle>
          <DialogDescription>What it did, what it used, and its activity.</DialogDescription>
        </DialogHeader>
        {id && <RunFromId id={id} onOpenChapter={onOpenChapter} />}
      </DialogContent>
    </Dialog>
  );
}

function RunFromId({ id, onOpenChapter }: { id: string; onOpenChapter: (chapter: number) => void }) {
  const run = useSceneRun(id);
  if (!run.data) return <Skeleton className="h-48 w-full" />;
  return <SceneRunPanel run={run.data.run} onOpenChapter={onOpenChapter} feedHeight="max-h-80" />;
}
