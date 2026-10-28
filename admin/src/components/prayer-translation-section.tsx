// The Prayers page's Translations tab: in-progress runs, the queue, a card per language with how much of the published prayers
// it has and how that language gets its script, and the history of runs. Built like the Hindu calendar's Translations tab
// (without its words table: a prayer's translations are read and corrected in the prayer, on its Languages tab). The page
// keeps nothing that matters — the open run lives in the URL (`?run=`), the rest is the server's.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Languages, Loader2, RefreshCw, Wifi, WifiOff, XCircle } from 'lucide-react';
import { PrayerRunPanel, StartPrayerDialog } from '@/components/prayer-run';
import { ProgressBar, StatusBadge, formatCount, timeAgo } from '@/components/translation-bits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  HOW_HINT, HOW_LABEL, useCancelPrayer, usePrayerOverview, usePrayerRun, usePrayerRuns,
  type HowText, type LanguageCoverage, type PrayerOverview, type PrayerRun,
} from '@/lib/prayers';
import { useSocketStatus } from '@/lib/socket';
import { cn } from '@/lib/utils';

export function PrayerTranslations({ canTranslate }: { canTranslate: boolean }) {
  const [params, setParams] = useSearchParams();
  const overview = usePrayerOverview(true);
  const data = overview.data;
  const busy = (data?.active.length ?? 0) > 0;
  // Runs go one at a time in the order made: the oldest is on screen, the ones waiting behind it are the queue.
  const queued = (data?.active ?? []).filter((run, i) => i > 0 && run.status === 'QUEUED');
  const current = (data?.active ?? []).filter((run) => !queued.includes(run));

  // undefined = closed, '' = open with no language chosen. A language's editor links here with `?translate=<code>`.
  const [startFor, setStartFor] = useState<string | undefined>(() => (canTranslate ? params.get('translate') ?? undefined : undefined));
  const openRunId = params.get('run');
  const setParam = (name: string, value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(name, value);
      else next.delete(name);
      return next;
    });
  const setRun = (id: string | null) => setParam('run', id);

  // The link is spent once the dialog is open; leaving it would reopen the dialog on every visit to the URL.
  useEffect(() => {
    if (params.get('translate') !== null) setParam('translate', null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Each published prayer’s title, summary and about, and each verse’s meaning, in the 11 reading languages — and the verses written out in a script where a rule cannot do it. A verse is
          never translated, only spelled in the other script. Readers whose reading language has a translation see it; the rest see English. Runs work on the server — closing this page never
          stops one.
        </p>
        <div className="flex items-center gap-2">
          <LiveIndicator />
          {canTranslate && (
            <Button onClick={() => setStartFor('')} disabled={!data}>
              <Languages /> New translation
            </Button>
          )}
        </div>
      </div>

      {overview.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {overview.isError && !data && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-destructive">The prayers’ translations could not be loaded.</p>
            <Button size="sm" variant="outline" onClick={() => overview.refetch()}>
              <RefreshCw /> Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <Health data={data} hasActive={busy} />

          {busy && (
            <section className="space-y-3">
              <h3 className="text-sm font-medium">In progress</h3>
              {current.map((run) => (
                <Card key={run.id}>
                  <CardContent className="pt-6">
                    <PrayerRunPanel run={run} feedHeight="max-h-52" />
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          <Queue runs={queued} canTranslate={canTranslate} />
          <Coverage overview={data} canTranslate={canTranslate} onTranslate={(language) => setStartFor(language)} />
          <History onOpen={setRun} />
        </>
      )}

      {data && startFor !== undefined && (
        <StartPrayerDialog
          key={startFor}
          open
          onOpenChange={(open) => !open && setStartFor(undefined)}
          overview={data}
          language={startFor}
          onStarted={(run) => setRun(run.id)}
          onOpenRun={setRun}
        />
      )}

      <RunDialog id={openRunId} onClose={() => setRun(null)} />
    </div>
  );
}

/** Whether progress is arriving live or the page is asking for it. The Prayers page shows it in its header too. */
export function LiveIndicator() {
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

// ── Is it ready ──────────────────────────────────────────────────────────────────────────────────────

function Health({ data, hasActive }: { data: PrayerOverview; hasActive: boolean }) {
  const { translation } = data;
  const provider = translation.providers.find((p) => p.id === translation.defaultProvider);
  const problems = [
    !translation.apiKeyConfigured && {
      fatal: false,
      text: `${provider?.keyEnv ?? 'The default provider’s API key'} is not set on the server, so a run that uses the default provider cannot start. Pick a provider whose key is set when you start a run, or add the key to the server .env for the api and the worker and restart them. Reading and editing do not need it.`,
    },
    translation.workerOnline === false && {
      fatal: false,
      text: hasActive
        ? 'No worker is connected, so nothing is progressing. The run carries on by itself as soon as a worker starts.'
        : 'No worker is connected right now. A translation run you start waits until one is.',
    },
    data.publishedTotal === 0 && { fatal: true, text: 'No prayer is published yet, so there is nothing to translate. Write one and publish it on the Prayers tab first; drafts are never translated.' },
  ].filter(Boolean) as { fatal: boolean; text: string }[];

  return (
    <div className="space-y-2">
      {problems.map((problem) => (
        <p key={problem.text} role={problem.fatal ? 'alert' : 'status'} className={cn('flex gap-2 rounded-md border px-3 py-2 text-sm', problem.fatal ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-warning/50 bg-warning/15')}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {problem.text}
        </p>
      ))}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {problems.length === 0 && (
          <span className="inline-flex items-center gap-1.5 text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Ready
          </span>
        )}
        <span>
          {formatCount(data.publishedTotal)} published prayer{data.publishedTotal === 1 ? '' : 's'} to translate
          {data.counts?.draft > 0 && <> ({formatCount(data.counts.draft)} draft{data.counts.draft === 1 ? '' : 's'} wait to be published)</>}
        </span>
        <span>
          Default: {provider?.label ?? translation.defaultProvider} <span className="font-mono text-foreground">{translation.model}</span>
        </span>
      </p>
    </div>
  );
}

// ── Languages ────────────────────────────────────────────────────────────────────────────────────────

/** How a language gets its script: one word when the server sends one, or the mix when prayers differ. */
function HowBadges({ how }: { how: LanguageCoverage['how'] }) {
  if (typeof how === 'string') return <Badge variant={how === 'model' ? 'default' : 'secondary'} title={HOW_HINT[how]}>{HOW_LABEL[how]}</Badge>;
  return (
    <>
      {(Object.keys(HOW_LABEL) as HowText[])
        .filter((kind) => (how?.[kind] ?? 0) > 0)
        .map((kind) => (
          <Badge key={kind} variant={kind === 'model' ? 'default' : 'secondary'} title={HOW_HINT[kind]}>
            {HOW_LABEL[kind]} {how[kind]}
          </Badge>
        ))}
    </>
  );
}

function Coverage({ overview, canTranslate, onTranslate }: { overview: PrayerOverview; canTranslate: boolean; onTranslate: (language: string) => void }) {
  const total = overview.publishedTotal;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">
        Languages <span className="font-normal text-muted-foreground">· of the {formatCount(total)} published prayer{total === 1 ? '' : 's'}</span>
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {overview.languages.map((language) => {
          const live = overview.active.some((run) => run.language === language.code);
          const done = total > 0 && language.translated >= total && language.stale === 0;
          const started = language.translated > 0 || language.partial > 0;
          return (
            <Card key={language.code}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">
                      {language.name} <span className="font-normal text-muted-foreground">{language.endonym}</span>
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5">
                      <HowBadges how={language.how} />
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatCount(language.translated)} of {formatCount(total)} complete
                      {language.partial > 0 && <> · {formatCount(language.partial)} partly</>}
                      {language.stale > 0 && <> · <span className="text-destructive">{formatCount(language.stale)} out of date</span></>}
                      {language.edited > 0 && <> · {formatCount(language.edited)} edited by hand</>}
                    </p>
                  </div>
                  {canTranslate && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={live || total === 0}
                      onClick={() => onTranslate(language.code)}
                      title={live ? 'A run for this language is already going' : done ? 'Everything is translated; start one to translate it again' : undefined}
                    >
                      <Languages /> {live ? 'Running' : started && !done ? 'Finish' : done ? 'Again' : 'Translate'}
                    </Button>
                  )}
                </div>
                <ProgressBar percent={total ? (language.translated / total) * 100 : 0} tone={done ? 'success' : 'primary'} className="h-1.5" />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        <strong className="font-medium">Same script</strong>: the original is already in that script, so no verse is converted (only the title, summary and meanings are translated).{' '}
        <strong className="font-medium">Automatic</strong>: a rule spells the verse in that script when it is read, so a run does not write it (a verse can still be overridden by hand in the prayer).{' '}
        <strong className="font-medium">AI</strong>: the model writes the verse out in that script. English is the Roman-letter spelling of each verse only. A translation is an AI draft until
        someone reads it, and is shown to readers at once; one saved by hand is never overwritten by a run.
      </p>
    </section>
  );
}

function Queue({ runs, canTranslate }: { runs: PrayerRun[]; canTranslate: boolean }) {
  const cancel = useCancelPrayer();
  if (runs.length === 0) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">
        Queue <span className="font-normal text-muted-foreground">· starts by itself, one after another, in this order</span>
      </h3>
      <Card className="divide-y">
        {runs.map((run, index) => (
          <div key={run.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {run.languageName} <span className="font-normal text-muted-foreground">{run.endonym}</span>
                {index === 0 && <Badge className="ml-2" variant="secondary">Next</Badge>}
                {run.force && <Badge className="ml-2" variant="outline">Translating again</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                {run.requestedBy?.name ? `Added by ${run.requestedBy.name} · ` : ''}
                {run.provider} <span className="font-mono">{run.model}</span>
              </p>
            </div>
            {canTranslate && (
              <Button size="sm" variant="outline" className="text-destructive" disabled={cancel.isPending} onClick={() => confirm('Remove this run from the queue?') && cancel.mutate(run.id)}>
                <XCircle /> Remove
              </Button>
            )}
          </div>
        ))}
      </Card>
    </section>
  );
}

// ── History ──────────────────────────────────────────────────────────────────────────────────────────

function History({ onOpen }: { onOpen: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const runs = usePrayerRuns(page, true);
  const now = Date.now();

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">History</h3>
      {runs.isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !runs.data?.items.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No translation runs yet.</p>
      ) : (
        <>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prayers</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Tokens in / out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.data.items.map((run) => (
                  <TableRow key={run.id} className="cursor-pointer" onClick={() => onOpen(run.id)}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {timeAgo(run.createdAt, now)}
                      <span className="block text-xs text-muted-foreground">{run.requestedBy?.name ?? ''}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {run.languageName} <span className="text-muted-foreground">{run.endonym}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} stalled={run.stalled} />
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {run.progress.done} / {run.progress.total}
                    </TableCell>
                    <TableCell className="text-xs">
                      {run.provider} <span className="font-mono">{run.model}</span>
                    </TableCell>
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
              <span className="text-muted-foreground tabular-nums">
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

function RunDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent page className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Translation run</DialogTitle>
          <DialogDescription>What it did, what it used, and its activity.</DialogDescription>
        </DialogHeader>
        {id && <RunFromId id={id} />}
      </DialogContent>
    </Dialog>
  );
}

function RunFromId({ id }: { id: string }) {
  const run = usePrayerRun(id);
  if (!run.data) return <Skeleton className="h-48 w-full" />;
  return <PrayerRunPanel run={run.data.run} feedHeight="max-h-80" />;
}
