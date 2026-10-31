import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, Mic, Play, Plus, RefreshCw, Trash2, Wifi, WifiOff, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityFeed } from '@/components/translation-run-panel';
import { ProgressBar, StatusBadge, formatCount, formatDuration, timeAgo } from '@/components/translation-bits';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  ACTIVE, useCancelNarration, useComparison, useNarrationEstimate, useNarrationLive, useNarrationOverview, useNarrationRun, useNarrationRuns, useResumeNarration,
  useStartCompare, useStartNarration, type EngineInfo, type NarrationOverview, type NarrationRun, type Target,
} from '@/lib/narration';
import { useSocketStatus } from '@/lib/socket';
import { useNow } from '@/lib/translation';
import { cn, formatDate } from '@/lib/utils';

// Like the Scenes page, this one keeps no state that matters: the tab, the open run and the open comparison live in the
// URL, and everything else is the server's. Runs work on the server — closing this page never stops one.

const errorText = (err: unknown) => (err instanceof ApiRequestError ? err.message : 'The request did not go through.');
const dollars = (n: number) => (n < 0.01 ? '< $0.01' : `$${n.toFixed(2)}`);
const minutesText = (m: number) => (m < 1 ? 'under a minute' : m < 90 ? `${m} min` : `${(m / 60).toFixed(1)} h`);

export function NarrationPage() {
  const { hasPermission } = useAuth();
  const canRun = hasPermission('narration.run');
  const [params, setParams] = useSearchParams();
  const overview = useNarrationOverview();
  const data = overview.data;
  useNarrationLive();

  const [starting, setStarting] = useState(false);
  const tab = params.get('tab') === 'compare' ? 'compare' : 'runs';
  const update = (changes: Record<string, string | null>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      return next;
    });

  const narrations = (data?.active ?? []).filter((run) => run.kind === 'NARRATION');

  return (
    <div>
      <PageHeader
        title="Narration (AI voices)"
        description="The English or Hindi translation of every verse, spoken by a text-to-speech engine and saved to storage as narration/api/<book>/<language>/<engine>/<model>/<voice>/<chapter>/<verse>. Listen to voices side by side in Compare first, then narrate a book. Runs work on the server — closing this page never stops one."
        actions={
          <>
            <LiveIndicator />
            {canRun && tab === 'runs' && (
              <Button onClick={() => setStarting(true)} disabled={!data}>
                <Plus /> New narration run
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
            <p className="text-sm text-destructive">The Narration page could not be loaded.</p>
            <Button size="sm" variant="outline" onClick={() => overview.refetch()}>
              <RefreshCw /> Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-6">
          <Health settings={data.settings} />

          <Tabs value={tab} onValueChange={(value) => update({ tab: value === 'compare' ? 'compare' : null })}>
            <TabsList>
              <TabsTrigger value="runs">
                Runs
                {narrations.length > 0 && <Badge className="ml-2 px-1.5 py-0">{narrations.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="compare">Compare voices</TabsTrigger>
            </TabsList>

            <TabsContent value="runs" className="space-y-6">
              {narrations.map((run) => (
                <Card key={run.id}>
                  <CardContent className="pt-6">
                    <RunPanel run={run} />
                  </CardContent>
                </Card>
              ))}
              <RunsTable kind="NARRATION" openId={params.get('run')} onOpen={(id) => update({ run: id })} />
            </TabsContent>

            <TabsContent value="compare" className="space-y-6">
              <CompareTab overview={data} canRun={canRun} openId={params.get('compare')} onOpen={(id) => update({ compare: id })} />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {data && starting && <StartRunDialog overview={data} onClose={() => setStarting(false)} onStarted={(id) => update({ run: id })} />}
    </div>
  );
}

function LiveIndicator() {
  const status = useSocketStatus();
  const live = status === 'live';
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', live ? 'text-success' : 'text-muted-foreground')} title={live ? 'Updating live' : 'Checking every few seconds'}>
      {live ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      {live ? 'Live' : 'Polling'}
    </span>
  );
}

/** The checklist: can a run work at all? Each engine says whether its key is set, and its price says how far to trust it. */
function Health({ settings }: { settings: NarrationOverview['settings'] }) {
  const row = (key: string, ok: boolean | null, label: string, detail?: string) => (
    <li key={key} className="flex items-start gap-2 text-sm">
      {ok === null ? <AlertTriangle className="mt-0.5 h-4 w-4 text-muted-foreground" /> : ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 text-destructive" />}
      <span>
        {label}
        {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
      </span>
    </li>
  );
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <ul className="grid gap-2 md:grid-cols-2">
          {row('storage', settings.storage.ok, settings.storage.ok ? `Verse texts and clips: ${settings.storage.describe ?? 'storage'}` : 'Storage is not set up', settings.storage.error)}
          {row('worker', settings.workerOnline, settings.workerOnline === null ? 'Worker: unknown' : settings.workerOnline ? 'The worker is online' : 'No worker is online — runs wait until one starts')}
          {settings.engines.map((engine) =>
            row(engine.id, engine.configured, `${engine.label}: ${engine.configured ? 'key set' : `${engine.keyEnv} is not set`}`, engine.price.usdPerMillionChars === null ? 'No price known, so no cost is shown.' : `About $${engine.price.usdPerMillionChars} per million characters${engine.price.verified ? '' : ' — not verified against the price list'}.`)
          )}
        </ul>
        <p className="text-xs text-muted-foreground">
          Prices, request limits and model names here come from third-party summaries and have not been checked against Google. Try one verse in Compare before a long run. Spending is not metered here; check Google’s console.
        </p>
      </CardContent>
    </Card>
  );
}

/* ---------- choosing a voice ---------- */

function useTargetState(overview: NarrationOverview, initial?: Target) {
  const [target, setTarget] = useState<Target>(initial ?? { engine: overview.settings.defaults.engine, model: overview.settings.defaults.model, voice: overview.settings.defaults.voice });
  const engine = overview.settings.engines.find((e) => e.id === target.engine);
  // Changing the engine keeps the voice when the new engine has it, and takes the engine's first model otherwise.
  const setEngine = (id: string) => {
    const next = overview.settings.engines.find((e) => e.id === id);
    if (next) setTarget({ engine: id, model: next.models[0], voice: next.voices.includes(target.voice) ? target.voice : next.voices[0] });
  };
  return { target, setTarget, engine, setEngine };
}

function TargetFields({ engines, target, engine, onEngine, onChange, compact }: { engines: EngineInfo[]; target: Target; engine?: EngineInfo; onEngine: (id: string) => void; onChange: (t: Target) => void; compact?: boolean }) {
  return (
    <div className={cn('grid gap-2', compact ? 'sm:grid-cols-3' : 'sm:grid-cols-3')}>
      <Select aria-label="Engine" value={target.engine} onChange={(e) => onEngine(e.target.value)}>
        {engines.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label}
            {e.configured ? '' : ' (no key)'}
          </option>
        ))}
      </Select>
      <Select aria-label="Model" value={target.model} onChange={(e) => onChange({ ...target, model: e.target.value })}>
        {(engine?.models ?? []).map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </Select>
      <Select aria-label="Voice" value={target.voice} onChange={(e) => onChange({ ...target, voice: e.target.value })}>
        {(engine?.voices ?? []).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </Select>
    </div>
  );
}

/* ---------- starting a run ---------- */

const parseChapters = (text: string): number[] | null | 'bad' => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d{1,4}(\s*,\s*\d{1,4})*$/.test(trimmed)) return 'bad';
  return [...new Set(trimmed.split(',').map((n) => Number(n.trim())))].sort((a, b) => a - b);
};

function StartRunDialog({ overview, onClose, onStarted }: { overview: NarrationOverview; onClose: () => void; onStarted: (id: string) => void }) {
  const { settings, books } = overview;
  const [book, setBook] = useState(settings.defaultBook);
  const [language, setLanguage] = useState(settings.defaults.language);
  const { target, setTarget, engine, setEngine } = useTargetState(overview);
  const [chapterText, setChapterText] = useState('');
  const [force, setForce] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const start = useStartNarration();

  const chapters = parseChapters(chapterText);
  const bookInfo = books.find((b) => b.id === book);
  const estimate = useNarrationEstimate({ book, language, chapters: chapters === 'bad' ? null : chapters, ...target, force }, chapters !== 'bad');
  const est = estimate.data;
  const noKey = engine && !engine.configured;

  const submit = () => {
    if (chapters === 'bad') return;
    if (force && !confirm('Make again replaces every clip already made in this voice. The old clips are not kept. Continue?')) return;
    setProblem(null);
    start.mutate(
      { book, language, ...target, ...(chapters ? { chapters } : {}), force },
      { onSuccess: (run) => { onStarted(run.id); onClose(); }, onError: (err) => setProblem(errorText(err)) }
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent page className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New narration run</DialogTitle>
          <DialogDescription>Speaks the translation of each verse (not the purport) in one voice. A verse whose clip was made from the same text is not made again.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Book</Label>
              <Select className="w-full" value={book} onChange={(e) => setBook(e.target.value)}>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>{b.title}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select className="w-full" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {settings.languages.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Voice</Label>
            <TargetFields engines={settings.engines} target={target} engine={engine} onEngine={setEngine} onChange={setTarget} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="chapters">Chapters</Label>
            <Input id="chapters" value={chapterText} onChange={(e) => setChapterText(e.target.value)} placeholder="Leave empty for the whole book, or e.g. 1, 2, 18" aria-invalid={chapters === 'bad'} />
            <p className="text-xs text-muted-foreground">
              {chapters === 'bad' ? <span className="text-destructive">Chapters are numbers separated by commas.</span> : bookInfo?.chapters.length ? `${bookInfo.title} has ${bookInfo.chapters.length} chapters (${bookInfo.chapters[0].id} to ${bookInfo.chapters[bookInfo.chapters.length - 1].id}).` : ''}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={force} onChange={(e) => setForce(e.target.checked)} /> Make again clips that already exist
          </label>

          {noKey && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{engine.keyEnv} is not set on the server, so {engine.label} cannot be called.</p>}

          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            {estimate.isError ? (
              <p className="text-destructive">{errorText(estimate.error)}</p>
            ) : !est ? (
              <p className="text-muted-foreground">Working out the size…</p>
            ) : (
              <div className="space-y-1">
                <p>
                  <strong>{formatCount(est.verses)}</strong> verses to make{est.alreadyMade > 0 && <> ({formatCount(est.alreadyMade)} already made)</>}, about <strong>{formatCount(est.characters)}</strong> characters in{' '}
                  <strong>{formatCount(est.requests)}</strong> requests, at least {minutesText(est.minutesAtLimit)} at the engine’s rate.
                </p>
                <p className={cn(est.priced && !est.priceVerified && 'text-amber-700 dark:text-amber-400')}>
                  {est.costUsd === null ? 'No price is known for this engine, so the cost cannot be shown.' : `About ${dollars(est.costUsd)}${est.priceVerified ? '' : ' — the price is NOT verified'}.`}
                </p>
                {est.sampled && <p className="text-xs text-muted-foreground">Worked out from {est.sampledChapters} of {est.chapters} chapters.</p>}
                {est.versesWithoutText > 0 && <p className="text-xs text-muted-foreground">{formatCount(est.versesWithoutText)} verses have no {language === 'hi' ? 'Hindi' : 'English'} text and are left out.</p>}
              </div>
            )}
          </div>

          {problem && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{problem}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={submit} disabled={start.isPending || chapters === 'bad' || !!noKey || !est || est.verses === 0}>
            {start.isPending ? <Loader2 className="animate-spin" /> : <Mic />} Start narrating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- a run ---------- */

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function RunPanel({ run: initial }: { run: NarrationRun }) {
  const { hasPermission } = useAuth();
  const canRun = hasPermission('narration.run');
  const detail = useNarrationRun(initial.id);
  const run = detail.data?.run ?? initial;
  const feed = detail.data?.feed ?? [];
  const resume = useResumeNarration();
  const cancel = useCancelNarration();
  const [problem, setProblem] = useState<string | null>(null);

  const active = ACTIVE.includes(run.status);
  const now = useNow(active);
  const retryIn = run.status === 'PAUSED' && run.resumeAt ? Math.max(0, Math.round((new Date(run.resumeAt).getTime() - now) / 1000)) : null;
  const { progress } = run;
  const tone = run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'destructive' : run.status === 'PAUSED' ? 'warning' : run.status === 'CANCELLED' ? 'muted' : 'primary';

  const doCancel = () => {
    if (!confirm(run.status === 'RUNNING' && !run.stalled ? 'Stop this run? It finishes the verse it is on, then stops. Clips already made are kept.' : 'Cancel this run? Clips already made are kept.')) return;
    setProblem(null);
    cancel.mutate(run.id, { onError: (err) => setProblem(errorText(err)) });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{run.bookTitle}</Badge>
            <h3 className="text-base font-semibold">
              {run.kind === 'COMPARE' ? `Verse ${run.verseIds?.[0] ?? ''}` : `${run.chapters.length} chapter${run.chapters.length === 1 ? '' : 's'}`} · {run.languageName}
            </h3>
            <StatusBadge status={run.status} stalled={run.stalled} />
            {run.force && <Badge variant="secondary">Making again</Badge>}
            {run.cancelRequested && run.status === 'RUNNING' && <Badge variant="warning">Stopping…</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {run.kind === 'COMPARE' ? `${run.targets?.length ?? 0} voices` : <>{run.engineLabel} <span className="font-mono">{run.model}</span> · {run.voice}</>}
          </p>
          <p className="text-xs text-muted-foreground">
            {run.requestedBy ? `Started by ${run.requestedBy.name}` : 'Started'} {timeAgo(run.createdAt, now)}
            {run.finishedAt && <> · finished {formatDate(run.finishedAt)}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRun && (run.status === 'PAUSED' || run.status === 'FAILED') && (
            <Button size="sm" disabled={resume.isPending} onClick={() => { setProblem(null); resume.mutate(run.id, { onError: (err) => setProblem(errorText(err)) }); }}>
              {resume.isPending ? <Loader2 className="animate-spin" /> : run.status === 'FAILED' ? <RefreshCw /> : <Play />}
              {run.status === 'FAILED' ? 'Try again' : retryIn !== null ? 'Retry now' : 'Resume'}
            </Button>
          )}
          {canRun && active && !(run.cancelRequested && run.status === 'RUNNING') && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={doCancel} disabled={cancel.isPending}>
              {cancel.isPending ? <Loader2 className="animate-spin" /> : <XCircle />} Cancel
            </Button>
          )}
        </div>
      </div>

      {problem && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{problem}</p>}
      {run.stalled && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm">The worker has not reported for a while. A restarted worker picks the run up again; if it does not, cancel and start it again. Clips made are kept.</p>}
      {run.statusMessage && (run.status === 'PAUSED' || run.status === 'FAILED') && (
        <div role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {run.statusMessage}
          {retryIn !== null && <span className="block text-xs text-muted-foreground">Trying again by itself in {formatDuration(retryIn)}.</span>}
        </div>
      )}
      {run.status === 'QUEUED' && run.statusMessage && <p className="text-sm text-muted-foreground">{run.statusMessage}</p>}

      <div className="space-y-1.5">
        <ProgressBar percent={progress.percent} tone={tone} />
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatCount(progress.done)} made · {formatCount(progress.skipped)} already there · {formatCount(progress.failed)} not made · {formatCount(progress.total)} in all
          {progress.currentVerseId && <> · now {progress.currentVerseId}</>}
          {progress.etaSeconds !== null && <> · about {formatDuration(progress.etaSeconds)} left</>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Characters sent" value={formatCount(run.usage.characters)} />
        <Stat label="Audio made" value={formatDuration(run.usage.audioSeconds)} />
        <Stat label="Requests" value={formatCount(run.usage.calls)} />
        <Stat label="Cost so far" value={run.usage.costUsd === null ? 'unknown' : dollars(run.usage.costUsd)} />
      </div>

      <ActivityFeed lines={feed} className="max-h-60" />
    </div>
  );
}

function RunsTable({ kind, openId, onOpen }: { kind: 'NARRATION' | 'COMPARE'; openId: string | null; onOpen: (id: string | null) => void }) {
  const [page, setPage] = useState(1);
  const runs = useNarrationRuns(page, kind);
  const now = useNow(false);
  const items = runs.data?.items ?? [];
  const open = items.find((r) => r.id === openId);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">{kind === 'COMPARE' ? 'Earlier comparisons' : 'All runs'}</h3>
      {runs.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{kind === 'COMPARE' ? 'No comparisons yet.' : 'No narration runs yet.'}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>{kind === 'COMPARE' ? 'Verse' : 'Book / chapters'}</TableHead>
              <TableHead>Voice</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Made</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((run) => (
              <TableRow key={run.id} className="cursor-pointer" onClick={() => onOpen(run.id === openId ? null : run.id)}>
                <TableCell className="whitespace-nowrap text-xs">{timeAgo(run.createdAt, now)}</TableCell>
                <TableCell className="text-sm">{kind === 'COMPARE' ? run.verseIds?.[0] : `${run.bookTitle} · ${run.chapters.length} ch · ${run.languageName}`}</TableCell>
                <TableCell className="text-xs">{kind === 'COMPARE' ? `${run.targets?.length ?? 0} voices` : `${run.engineLabel ?? ''} ${run.voice ?? ''}`}</TableCell>
                <TableCell><StatusBadge status={run.status} stalled={run.stalled} /></TableCell>
                <TableCell className="text-right tabular-nums">{run.progress.done + run.progress.skipped}/{run.progress.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {runs.data && runs.data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {runs.data.totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= runs.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
      {open && kind === 'NARRATION' && (
        <Card>
          <CardContent className="pt-6">
            <RunPanel run={open} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}

/* ---------- comparing voices ---------- */

function CompareTab({ overview, canRun, openId, onOpen }: { overview: NarrationOverview; canRun: boolean; openId: string | null; onOpen: (id: string | null) => void }) {
  const { settings } = overview;
  const [verseId, setVerseId] = useState('1.2.47');
  const [language, setLanguage] = useState(settings.defaults.language);
  const [targets, setTargets] = useState<Target[]>([
    { engine: settings.defaults.engine, model: settings.defaults.model, voice: settings.defaults.voice },
    { engine: settings.defaults.engine, model: settings.defaults.model, voice: settings.engines.find((e) => e.id === settings.defaults.engine)?.voices[1] ?? settings.defaults.voice },
  ]);
  const [problem, setProblem] = useState<string | null>(null);
  const start = useStartCompare();

  const setTarget = (index: number, next: Target) => setTargets((prev) => prev.map((t, i) => (i === index ? next : t)));
  const setEngine = (index: number, id: string) => {
    const engine = settings.engines.find((e) => e.id === id);
    if (engine) setTarget(index, { engine: id, model: engine.models[0], voice: engine.voices.includes(targets[index].voice) ? targets[index].voice : engine.voices[0] });
  };
  const missingKey = targets.map((t) => settings.engines.find((e) => e.id === t.engine)).find((e) => e && !e.configured);

  const submit = () => {
    setProblem(null);
    start.mutate({ language, verseId: verseId.trim(), targets }, { onSuccess: (run) => onOpen(run.id), onError: (err) => setProblem(errorText(err)) });
  };

  return (
    <div className="space-y-6">
      {canRun && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">Speak one verse in up to {settings.maxTargets} voices and play them side by side. Making a verse again replaces its earlier clip in those voices.</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="verse">Verse</Label>
                <Input id="verse" value={verseId} onChange={(e) => setVerseId(e.target.value)} placeholder="e.g. 1.2.47 for Gita 2.47" />
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {settings.languages.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              {targets.map((target, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1">
                    <TargetFields engines={settings.engines} target={target} engine={settings.engines.find((e) => e.id === target.engine)} onEngine={(id) => setEngine(index, id)} onChange={(t) => setTarget(index, t)} compact />
                  </div>
                  <Button size="icon" variant="ghost" aria-label="Remove this voice" disabled={targets.length <= 1} onClick={() => setTargets(targets.filter((_, i) => i !== index))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" disabled={targets.length >= settings.maxTargets} onClick={() => setTargets([...targets, { ...targets[targets.length - 1] }])}>
                <Plus /> Add a voice
              </Button>
            </div>
            {missingKey && <p role="alert" className="text-sm text-destructive">{missingKey.keyEnv} is not set on the server, so {missingKey.label} cannot be called.</p>}
            {problem && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{problem}</p>}
            <Button onClick={submit} disabled={start.isPending || !verseId.trim() || !!missingKey}>
              {start.isPending ? <Loader2 className="animate-spin" /> : <Mic />} Speak this verse
            </Button>
          </CardContent>
        </Card>
      )}

      {openId && <ComparisonView id={openId} />}
      <RunsTable kind="COMPARE" openId={openId} onOpen={onOpen} />
    </div>
  );
}

function ComparisonView({ id }: { id: string }) {
  const comparison = useComparison(id);
  const data = comparison.data;
  if (comparison.isLoading) return <Skeleton className="h-40 w-full" />;
  if (comparison.isError || !data) return <p className="text-sm text-destructive">That comparison could not be loaded.</p>;
  const { run, cells } = data;
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">Verse {data.verseId}</h3>
          <Badge variant="outline">{run.languageName}</Badge>
          <StatusBadge status={run.status} stalled={run.stalled} />
        </div>
        {run.status === 'PAUSED' || run.status === 'FAILED' ? <RunPanel run={run} /> : (
          <ProgressBar percent={run.progress.percent} tone={run.status === 'COMPLETED' ? 'success' : 'primary'} />
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {cells.map((cell) => {
            const result = run.results?.find((r) => r.key === cell.key);
            return (
              <div key={cell.key} className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">{cell.voice} <span className="text-xs font-normal text-muted-foreground">{cell.engine} · {cell.model}</span></p>
                {cell.clip?.url ? (
                  <audio controls preload="none" src={cell.clip.url} className="w-full" />
                ) : result?.error ? (
                  <p className="text-xs text-destructive">{result.error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{ACTIVE.includes(run.status) ? 'Not made yet…' : 'No clip.'}</p>
                )}
                {cell.clip && <p className="text-xs text-muted-foreground tabular-nums">{formatDuration(cell.clip.seconds)} · {formatCount(cell.clip.characters)} characters · {Math.round(cell.clip.bytes / 1024)} KB</p>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
