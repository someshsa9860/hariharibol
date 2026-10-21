// The scene run's two interactive pieces: the panel for a run (how far it is, what it has used, why it stopped, what the
// worker is doing now) and the dialog that starts one. The feed and the bars are the Translations page's.

import { useMemo, useState } from 'react';
import { AlertTriangle, CircleDollarSign, CloudOff, HardDrive, KeyRound, Loader2, Play, RefreshCw, Rocket, Settings2, Timer, Wrench, XCircle, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  ACTIVE, useCancelScenes, useResumeScenes, useSceneEstimate, useSceneRun, useStartScenes,
  type ChapterInfo, type PauseReason, type ProviderId, type SceneRun, type ScenesCoverage, type ScenesOverview,
} from '@/lib/scenes';
import { useNow } from '@/lib/translation';
import { cn, formatDate } from '@/lib/utils';
import { ActivityFeed } from './translation-run-panel';
import { ProgressBar, StatusBadge, formatCount, formatDuration, timeAgo } from './translation-bits';

const PAUSE: Record<PauseReason, { title: string; icon: LucideIcon; needsYou: boolean }> = {
  credit: { title: 'Out of credit', icon: CircleDollarSign, needsYou: true },
  auth: { title: 'The API key was refused', icon: KeyRound, needsYou: true },
  config: { title: 'Something is not set up on the server', icon: Settings2, needsYou: true },
  storage: { title: "The server can't use the bucket", icon: HardDrive, needsYou: true },
  unavailable: { title: 'The provider or storage is not answering', icon: CloudOff, needsYou: false },
  rate_limit: { title: 'The free-tier limit was reached', icon: Timer, needsYou: false },
  busy: { title: 'Another process holds this', icon: Wrench, needsYou: false },
  error: { title: 'Unexpected error', icon: AlertTriangle, needsYou: false },
};

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SceneRunPanel({ run: initial, onOpenChapter, feedHeight = 'max-h-72' }: { run: SceneRun; onOpenChapter: (chapter: number) => void; feedHeight?: string }) {
  const { hasPermission } = useAuth();
  const canRun = hasPermission('scenes.run');
  const detail = useSceneRun(initial.id);
  const run = detail.data?.run ?? initial;
  const feed = detail.data?.feed ?? [];
  const resume = useResumeScenes();
  const cancel = useCancelScenes();
  const [problem, setProblem] = useState<string | null>(null);

  const active = ACTIVE.includes(run.status);
  const now = useNow(active);
  const retryIn = run.status === 'PAUSED' && run.resumeAt ? Math.max(0, Math.round((new Date(run.resumeAt).getTime() - now) / 1000)) : null;
  const pause = run.status === 'PAUSED' && run.pauseReason ? PAUSE[run.pauseReason] : null;
  const PauseIcon = pause?.icon ?? AlertTriangle;
  const { progress } = run;
  const tone = run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'destructive' : run.status === 'PAUSED' ? 'warning' : run.status === 'CANCELLED' ? 'muted' : 'primary';

  const fail = (err: unknown) => setProblem(err instanceof ApiRequestError ? err.message : 'The request did not go through.');
  const doResume = () => {
    setProblem(null);
    resume.mutate(run.id, { onError: fail });
  };
  const doCancel = () => {
    if (!confirm(run.status === 'RUNNING' && !run.stalled ? 'Stop this run? It finishes the chapter it is on, then stops. Chapters already written are kept.' : 'Cancel this run? Chapters already written are kept.')) return;
    setProblem(null);
    cancel.mutate(run.id, { onError: fail });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{run.bookTitle}</Badge>
            <h3 className="text-base font-semibold">
              {run.chapters.length} chapter{run.chapters.length === 1 ? '' : 's'}
            </h3>
            <StatusBadge status={run.status} stalled={run.stalled} />
            {run.force && <Badge variant="secondary">Writing again</Badge>}
            {run.cancelRequested && run.status === 'RUNNING' && <Badge variant="warning">Stopping…</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {run.provider} <span className="font-mono">{run.model}</span> · from the Hindi verse meanings
          </p>
          <p className="text-xs text-muted-foreground">
            {run.requestedBy ? `Started by ${run.requestedBy.name}` : 'Started'} {timeAgo(run.createdAt, now)}
            {run.finishedAt && <> · finished {formatDate(run.finishedAt)}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRun && (run.status === 'PAUSED' || run.status === 'FAILED') && (
            <Button size="sm" onClick={doResume} disabled={resume.isPending}>
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

      {problem && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {problem}
        </p>
      )}

      {run.stalled && (
        <div role="alert" className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">The worker has not reported for a while</p>
            <p className="text-muted-foreground">A restarted worker picks the run up again within a couple of minutes. If it does not, cancel and start it again; written chapters are kept. {run.heartbeatAt && <>Last heard {timeAgo(run.heartbeatAt, now)}.</>}</p>
          </div>
        </div>
      )}

      {pause && (
        <div role="status" className={cn('flex gap-3 rounded-md border p-3 text-sm', pause.needsYou ? 'border-warning/50 bg-warning/15' : 'border-border bg-muted/50')}>
          <PauseIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">{pause.title}</p>
            <p className="text-muted-foreground">{run.statusMessage}</p>
            {retryIn !== null && <p className="mt-1 text-xs">Trying again in {formatDuration(retryIn)}.</p>}
          </div>
        </div>
      )}

      {run.status === 'FAILED' && run.statusMessage && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {run.statusMessage}{' '}
          {run.errorChapter && (
            <button type="button" className="underline" onClick={() => onOpenChapter(run.errorChapter!)}>
              Open chapter {run.errorChapterRef}
            </button>
          )}
        </p>
      )}
      {(run.status === 'COMPLETED' || run.status === 'CANCELLED') && run.statusMessage && <p className="text-sm text-muted-foreground">{run.statusMessage}</p>}

      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-medium tabular-nums">
            {progress.done} of {progress.total} chapters
            {progress.skipped > 0 && <span className="font-normal text-muted-foreground"> · {progress.skipped} skipped (no Hindi yet)</span>}
          </span>
          <span className="text-muted-foreground tabular-nums">{progress.percent}%</span>
        </div>
        <ProgressBar percent={progress.percent} tone={tone} />
        {run.status === 'RUNNING' && progress.currentRef && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Writing chapter {progress.currentRef}
            {progress.etaSeconds !== null && <> · about {formatDuration(progress.etaSeconds)} left</>}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Requests" value={formatCount(run.usage.calls)} hint={progress.secondsPerChapter ? `${progress.secondsPerChapter}s a chapter` : undefined} />
        <Stat label="Tokens in" value={formatCount(run.usage.inputTokens)} />
        <Stat label="Tokens out" value={formatCount(run.usage.outputTokens)} />
        <Stat label="Attempts" value={run.attempts} />
      </div>

      <div>
        <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Activity</h4>
        <ActivityFeed lines={feed} className={feedHeight} />
      </div>
    </div>
  );
}

// ── Starting a run ──────────────────────────────────────────────────────────────────────────────────

export type StartPreset = { chapters?: number[]; cantos?: number[]; force?: boolean };

const MODEL_HINTS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

export function StartScenesDialog({ open, onOpenChange, overview, coverage, preset, onStarted }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: ScenesOverview;
  coverage: ScenesCoverage | undefined;
  preset: StartPreset | null;
  onStarted: (run: SceneRun) => void;
}) {
  const start = useStartScenes();
  const book = overview.books[0];
  const cantos = useMemo(() => [...new Set(book.chapters.map((c) => c.canto ?? 0))], [book]);
  const writtenBy = useMemo(() => {
    const done = new Map<number, number>();
    for (const row of coverage?.chapters ?? []) if (row.written) done.set(row.canto ?? 0, (done.get(row.canto ?? 0) ?? 0) + 1);
    return done;
  }, [coverage]);
  const perCanto = (canto: number) => book.chapters.filter((c) => (c.canto ?? 0) === canto).length;

  const [picked, setPicked] = useState<Set<number>>(() => new Set(preset?.cantos ?? (preset?.chapters ? [] : cantos)));
  const [provider, setProvider] = useState<ProviderId>(overview.settings.defaultProvider);
  const [model, setModel] = useState('');
  const [force, setForce] = useState(preset?.force ?? false);
  const [problem, setProblem] = useState<string | null>(null);

  const chapters: ChapterInfo[] = preset?.chapters ? book.chapters.filter((c) => preset.chapters!.includes(c.id)) : book.chapters.filter((c) => picked.has(c.canto ?? 0));
  const ids = chapters.map((c) => c.id);
  const estimate = useSceneEstimate(ids, force, open);
  const providerInfo = overview.settings.providers.find((p) => p.id === provider);
  const keyMissing = providerInfo && !providerInfo.apiKeyConfigured;
  const nothing = estimate.data?.willWrite === 0;

  const toggle = (canto: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(canto)) next.delete(canto);
      else next.add(canto);
      return next;
    });

  const submit = () => {
    setProblem(null);
    start.mutate(
      { chapters: ids, provider, model: model.trim() || undefined, force },
      {
        onSuccess: (run) => {
          onOpenChange(false);
          onStarted(run);
        },
        onError: (err) => setProblem(err instanceof ApiRequestError ? err.message : 'The request did not go through.'),
      }
    );
  };

  const e = estimate.data;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent page className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{preset?.chapters?.length === 1 ? `Write chapter ${chapters[0]?.label}` : 'New scene run'}</DialogTitle>
          <DialogDescription>
            {overview.active.length > 0 && <span className="mb-1 block font-medium text-foreground">A run is going, so this one joins the queue and starts by itself when the others are done.</span>}
            For each chapter the model reads the Hindi meaning of every verse and writes the scenes: narrator, dialogue and a visual prompt for each. One request a chapter, kept under the model's free limits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {!preset?.chapters && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cantos</Label>
                <div className="flex gap-3 text-xs">
                  <button type="button" className="text-primary hover:underline" onClick={() => setPicked(new Set(cantos))}>
                    All
                  </button>
                  <button type="button" className="text-muted-foreground hover:underline" onClick={() => setPicked(new Set())}>
                    None
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {cantos.map((canto) => {
                  const on = picked.has(canto);
                  const done = writtenBy.get(canto) ?? 0;
                  return (
                    <button
                      key={canto}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(canto)}
                      className={cn('rounded-lg border px-2 py-1.5 text-left transition-colors', on ? 'border-primary bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-accent')}
                    >
                      <span className="block text-sm font-semibold">Canto {canto}</span>
                      <span className="block text-[11px] text-muted-foreground tabular-nums">
                        {done}/{perCanto(canto)} written
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <Checkbox checked={force} onChange={(ev) => setForce(ev.target.checked)} className="mt-0.5" />
            <span>
              Write chapters again that already have a file
              <span className="block text-xs text-muted-foreground">The file now in storage is kept as a dated backup. Left off, written chapters are skipped.</span>
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="scene-provider">Provider</Label>
              <Select
                id="scene-provider"
                className="w-full"
                value={provider}
                onChange={(ev) => {
                  setProvider(ev.target.value as ProviderId);
                  setModel('');
                }}
              >
                {overview.settings.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {p.apiKeyConfigured ? '' : ' (no key)'}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="scene-model">Model</Label>
              <Input id="scene-model" list="scene-models" value={model} onChange={(ev) => setModel(ev.target.value)} placeholder={providerInfo?.defaultModel ?? ''} />
              {provider === 'gemini' && (
                <datalist id="scene-models">
                  {MODEL_HINTS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              )}
            </div>
          </div>
          {keyMissing && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {providerInfo!.keyEnv} is not set on the server, so {providerInfo!.company} cannot be called.
            </p>
          )}

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            {ids.length === 0 ? (
              <p className="text-muted-foreground">Choose at least one canto.</p>
            ) : !e ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Working out what it would take…
              </p>
            ) : e.sampled === 0 ? (
              <p role="status">None of the chapters sampled has Hindi meanings yet, so they would be skipped. Run the Hindi translation first (Translations page).</p>
            ) : nothing ? (
              <p>Every chapter chosen already has its file. Tick “Write chapters again” to replace them.</p>
            ) : (
              <>
                <p className="font-medium">
                  {e.willWrite} chapter{e.willWrite === 1 ? '' : 's'} to write
                  {e.alreadyWritten > 0 && <span className="font-normal text-muted-foreground"> · {e.alreadyWritten} already written</span>}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  About {formatCount(e.inputTokens)} input tokens in {formatCount(e.requests)} request{e.requests === 1 ? '' : 's'}
                  {e.sampled > 0 && <> (≈ {formatCount(e.inputTokensPerChapter)} a chapter, from {e.sampled} sampled)</>}. At {e.limits.rpm} requests and {formatCount(e.limits.tpm)} tokens a minute that takes roughly{' '}
                  {e.minutes < 90 ? `${e.minutes} minute${e.minutes === 1 ? '' : 's'}` : `${(e.minutes / 60).toFixed(1)} hours`}. Output tokens depend on the chapter and are counted as they arrive.
                </p>
              </>
            )}
          </div>

          {problem && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {problem}
            </p>
          )}
        </div>

        <DialogFooter className="mt-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={start.isPending || ids.length === 0 || nothing || !!keyMissing}>
            {start.isPending ? <Loader2 className="animate-spin" /> : <Rocket />} {overview.active.length > 0 ? 'Add to queue' : 'Start'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
