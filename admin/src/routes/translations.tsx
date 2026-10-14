import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Languages, Loader2, Plus, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StartDialog } from '@/components/translation-start-dialog';
import { TranslationOutput } from '@/components/translation-output';
import { RunPanel } from '@/components/translation-run-panel';
import { ProgressBar, ScoreMix, StatusBadge, describeChapters, formatCount, formatUsd, timeAgo } from '@/components/translation-bits';
import { useAuth } from '@/lib/auth';
import { useSocketStatus } from '@/lib/socket';
import {
  refreshCoverage,
  useCoverage,
  useOverview,
  useRun,
  useRuns,
  useTranslationLive,
  type Coverage,
  type Overview,
  type Run,
} from '@/lib/translation';
import { cn } from '@/lib/utils';

// The page keeps no state of its own that matters: what is open (tab, run, language, chapter, verse) lives
// in the URL, and everything else is the server's. A refresh, a shared link or a second tab shows the same thing.

export function TranslationsPage() {
  const { hasPermission } = useAuth();
  const canRun = hasPermission('translation.run');
  const [params, setParams] = useSearchParams();
  const overview = useOverview();
  const coverage = useCoverage();
  useTranslationLive();

  const [startFor, setStartFor] = useState<{ language: string | null } | null>(null);

  const tab = params.get('tab') === 'output' ? 'output' : 'runs';
  const openRunId = params.get('run');

  const update = (changes: Record<string, string | null>, replace = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace }
    );

  const openOutput = (language: string, chapter: number, verseId?: string) =>
    update({ tab: 'output', run: null, lang: language, chapter: String(chapter), verse: verseId ?? null });
  const openRun = (id: string | null) => update({ run: id });

  const data = overview.data;

  return (
    <div>
      <PageHeader
        title="Translations"
        description="Claude translates Prabhupāda's Bhagavad-gītā into other languages. Runs work on the server — closing or refreshing this page never stops one."
        actions={
          <>
            <LiveIndicator />
            {canRun && (
              <Button onClick={() => setStartFor({ language: null })} disabled={!data}>
                <Plus /> New translation
              </Button>
            )}
          </>
        }
      />

      {overview.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        </div>
      )}

      {overview.isError && !data && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-destructive">The translations page could not be loaded.</p>
            <Button size="sm" variant="outline" onClick={() => overview.refetch()}>
              <RefreshCw /> Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-6">
          <Health settings={data.settings} hasActive={data.active.length > 0} />

          <Tabs value={tab} onValueChange={(value) => update({ tab: value === 'output' ? 'output' : null })}>
            <TabsList>
              <TabsTrigger value="runs">
                Runs
                {data.active.length > 0 && <Badge className="ml-2 px-1.5 py-0">{data.active.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="output">Output</TabsTrigger>
            </TabsList>

            <TabsContent value="runs" className="space-y-8">
              {data.active.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-sm font-medium">In progress</h3>
                  {data.active.map((run) => (
                    <Card key={run.id}>
                      <CardContent className="pt-6">
                        <RunPanel run={run} chaptersInBook={data.chapters.length} onOpenOutput={openOutput} />
                      </CardContent>
                    </Card>
                  ))}
                </section>
              )}

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Languages</h3>
                  <RefreshCoverage />
                </div>
                <LanguageGrid overview={data} coverage={coverage.data} loading={coverage.isLoading} canRun={canRun} onStart={(language) => setStartFor({ language })} onOpenRun={openRun} onOpenOutput={openOutput} />
              </section>

              <History overview={data} onOpen={openRun} />
            </TabsContent>

            <TabsContent value="output">
              <TranslationOutput
                overview={data}
                coverage={coverage.data}
                selection={{
                  language: params.get('lang'),
                  chapter: params.get('chapter') ? Number(params.get('chapter')) : null,
                  verseId: params.get('verse'),
                }}
                onSelect={(next) =>
                  update(
                    {
                      ...('language' in next && { lang: next.language ?? null }),
                      ...('chapter' in next && { chapter: next.chapter ? String(next.chapter) : null }),
                      ...('verseId' in next && { verse: next.verseId ?? null }),
                    },
                    true
                  )
                }
                liveRun={(params.get('lang') ? data.active.find((run) => run.language === params.get('lang')) : data.active[0]) ?? undefined}
              />
            </TabsContent>
          </Tabs>

          <StartDialog
            open={startFor !== null}
            onOpenChange={(open) => !open && setStartFor(null)}
            overview={data}
            language={startFor?.language ?? null}
            onStarted={() => update({ tab: null })}
            onOpenRun={openRun}
          />
        </div>
      )}

      <RunDialog id={openRunId} chaptersInBook={data?.chapters.length ?? 18} onClose={() => openRun(null)} onOpenOutput={openOutput} />
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

function RefreshCoverage() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      title="Counts are cached for a few minutes; this reads storage again"
      onClick={async () => {
        setBusy(true);
        try {
          await refreshCoverage(queryClient);
        } finally {
          setBusy(false);
        }
      }}
    >
      <RefreshCw className={cn(busy && 'animate-spin')} /> Recount
    </Button>
  );
}

// ── What is wrong before anything is started ─────────────────────────────────────────────────────────

function Health({ settings, hasActive }: { settings: Overview['settings']; hasActive: boolean }) {
  const problems = [
    !settings.apiKeyConfigured && { fatal: true, text: 'ANTHROPIC_API_KEY is not set on the server, so Claude cannot be called. Add it to the server .env for the api and worker, then restart them.' },
    !settings.storage.ok && { fatal: true, text: `The translations bucket cannot be used: ${settings.storage.error ?? 'unknown problem'}. The server reads and writes the app's own bucket (S3_BUCKET), so check that and its AWS credentials.` },
    settings.versionError && { fatal: true, text: settings.versionError },
    !settings.workerOnline && {
      fatal: false,
      text: hasActive
        ? 'No worker is connected, so nothing is progressing. The run waits and carries on by itself as soon as a worker starts.'
        : 'No worker is connected right now. A run you start will wait in the queue until one is.',
    },
  ].filter(Boolean) as { fatal: boolean; text: string }[];

  if (problems.length === 0) {
    return (
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Ready
        </span>
        <span>
          Model <span className="font-mono text-foreground">{settings.model}</span>
        </span>
        <span>
          Version <span className="font-mono text-foreground">{settings.version}</span>
        </span>
        {settings.storage.describe && <span>Saving to {settings.storage.describe}</span>}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {problems.map((problem) => (
        <p
          key={problem.text}
          role={problem.fatal ? 'alert' : 'status'}
          className={cn('flex gap-2 rounded-md border px-3 py-2 text-sm', problem.fatal ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-warning/50 bg-warning/15')}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {problem.text}
        </p>
      ))}
    </div>
  );
}

// ── One card per language ────────────────────────────────────────────────────────────────────────────

function LanguageGrid({
  overview,
  coverage,
  loading,
  canRun,
  onStart,
  onOpenRun,
  onOpenOutput,
}: {
  overview: Overview;
  coverage: Coverage | undefined;
  loading: boolean;
  canRun: boolean;
  onStart: (language: string) => void;
  onOpenRun: (id: string) => void;
  onOpenOutput: (language: string, chapter: number) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {overview.languages.map((language) => {
        const stats = coverage?.languages.find((item) => item.code === language.code);
        const run = overview.active.find((item) => item.language === language.code);
        const total = coverage?.total ?? 0;
        const percent = total && stats ? (stats.saved / total) * 100 : 0;
        const firstChapter = stats?.chapters.find((item) => item.saved > 0)?.chapter ?? 1;

        return (
          <Card key={language.code} className={cn('h-full', run && 'ring-1 ring-primary/40')}>
            <CardContent className="flex h-full flex-col gap-3 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold leading-tight">{language.name}</p>
                  <p className="text-lg text-muted-foreground" lang={language.code}>
                    {language.endonym}
                  </p>
                </div>
                {run && <StatusBadge status={run.status} stalled={run.stalled} />}
              </div>

              {loading && !stats ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-semibold tabular-nums">
                        {formatCount(stats?.saved ?? 0)} <span className="font-normal text-muted-foreground">of {formatCount(total)} verses</span>
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">{Math.round(percent)}%</span>
                    </div>
                    <ProgressBar percent={percent} tone={percent >= 100 ? 'success' : 'primary'} />
                  </div>

                  <div className="flex gap-0.5" title="Chapters 1 to 18 — the fuller the box, the more of the chapter is translated">
                    {overview.chapters.map((chapter) => {
                      const item = stats?.chapters.find((c) => c.chapter === chapter);
                      const fraction = item && item.total ? item.saved / item.total : 0;
                      return (
                        <span key={chapter} className="relative h-5 flex-1 overflow-hidden rounded-[3px] bg-muted" title={item ? `Chapter ${chapter}: ${item.saved} of ${item.total}` : `Chapter ${chapter}`}>
                          <span className={cn('absolute inset-x-0 bottom-0', fraction >= 1 ? 'bg-success' : 'bg-primary/60')} style={{ height: `${fraction * 100}%` }} />
                        </span>
                      );
                    })}
                  </div>

                  {stats && stats.saved > 0 ? <ScoreMix scores={stats.scores} unscored={stats.scores.unscored} /> : <p className="text-xs text-muted-foreground">Nothing translated yet.</p>}

                  {run && (
                    <p className="text-xs text-muted-foreground">
                      This run: {run.progress.done}/{run.progress.total} verses ({run.progress.percent}%)
                      {run.status === 'PAUSED' && ' · paused'}
                    </p>
                  )}
                </>
              )}

              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                {run ? (
                  <Button size="sm" onClick={() => onOpenRun(run.id)}>
                    Open run
                  </Button>
                ) : (
                  canRun && (
                    <Button size="sm" onClick={() => onStart(language.code)}>
                      <Languages /> Translate
                    </Button>
                  )
                )}
                <Button size="sm" variant="outline" disabled={!stats?.saved} onClick={() => onOpenOutput(language.code, firstChapter)}>
                  View output
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Past and present runs ────────────────────────────────────────────────────────────────────────────

const STATUSES = ['QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;

function History({ overview, onOpen }: { overview: Overview; onOpen: (id: string) => void }) {
  const [status, setStatus] = useState('');
  const [language, setLanguage] = useState('');
  const [page, setPage] = useState(1);
  const runs = useRuns({ status: status || undefined, language: language || undefined, page });

  const filter = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">All runs</h3>
        <div className="flex gap-2">
          <Select value={language} onChange={filter(setLanguage)} aria-label="Language" className="h-8 text-xs">
            <option value="">Every language</option>
            {overview.languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={filter(setStatus)} aria-label="Status" className="h-8 text-xs">
            <option value="">Any status</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {item.charAt(0) + item.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Language</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Chapters</TableHead>
              <TableHead className="min-w-40">Progress</TableHead>
              <TableHead title="Verses that scored 3 / 2 / 1">Scores 3·2·1</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : runs.data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {status || language ? 'No runs match.' : 'No translation has been run yet.'}
                </TableCell>
              </TableRow>
            ) : (
              runs.data?.items.map((run) => <HistoryRow key={run.id} run={run} chapters={overview.chapters.length} onOpen={onOpen} />)
            )}
          </TableBody>
        </Table>
      </div>

      {runs.data && runs.data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {runs.data.page} of {runs.data.totalPages} · {runs.data.total} runs
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= runs.data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function HistoryRow({ run, chapters, onOpen }: { run: Run; chapters: number; onOpen: (id: string) => void }) {
  return (
    <TableRow className="cursor-pointer" onClick={() => onOpen(run.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(run.id)}>
      <TableCell>
        <span className="font-medium">{run.languageName}</span> <span className="text-muted-foreground" lang={run.language}>{run.endonym}</span>
      </TableCell>
      <TableCell>
        <StatusBadge status={run.status} stalled={run.stalled} />
      </TableCell>
      <TableCell className="text-muted-foreground">{describeChapters(run.chapters, chapters)}</TableCell>
      <TableCell>
        <div className="space-y-1">
          <ProgressBar percent={run.progress.percent} tone={run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'destructive' : run.status === 'PAUSED' ? 'warning' : 'primary'} className="h-1.5" />
          <span className="text-xs tabular-nums text-muted-foreground">
            {run.progress.done}/{run.progress.total}
          </span>
        </div>
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">
        {run.scores[3]} · {run.scores[2]} · <span className={cn(run.scores[1] > 0 && 'font-medium text-amber-700 dark:text-amber-400')}>{run.scores[1]}</span>
      </TableCell>
      <TableCell className="tabular-nums">{formatUsd(run.usage.costUsd)}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{timeAgo(run.createdAt)}</TableCell>
    </TableRow>
  );
}

// A run opened by link (?run=…) is fetched on its own, so it is there after a refresh and in a new tab.
function RunDialog({ id, chaptersInBook, onClose, onOpenOutput }: { id: string | null; chaptersInBook: number; onClose: () => void; onOpenOutput: (language: string, chapter: number, verseId?: string) => void }) {
  const run = useRun(id);
  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Translation run</DialogTitle>
          <DialogDescription>Everything about this run, as the server has it.</DialogDescription>
        </DialogHeader>
        {run.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : run.isError || !run.data ? (
          <p className="text-sm text-destructive">This run could not be found.</p>
        ) : (
          <RunPanel run={run.data.run} chaptersInBook={chaptersInBook} onOpenOutput={onOpenOutput} feedHeight="max-h-80" />
        )}
      </DialogContent>
    </Dialog>
  );
}
