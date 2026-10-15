// One translation run: how far it is, what it costs, why it stopped if it did, and what the worker is
// doing right now. The same panel is used for a live run on the page and for a past one in a dialog.

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  CircleDollarSign,
  CloudOff,
  Eye,
  HardDrive,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  Settings2,
  Timer,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ACTIVE, useCancelRun, useNow, useResumeRun, useRun, type FeedLine, type PauseReason, type Run, type BookId, PART_LABELS, providerName } from '@/lib/translation';
import { cn, formatDate } from '@/lib/utils';
import {
  ProgressBar,
  ScoreMix,
  StatusBadge,
  clockTime,
  describeChapters,
  formatCount,
  formatDuration,
  formatUsd,
  timeAgo,
} from './translation-bits';

/** The chapter id a verse id belongs to: the Gita's chapter number, or a Bhagavatam canto × 100 + chapter. */
export const chapterOf = (verseId: string) => {
  const parts = verseId.split('.').map(Number);
  return parts[0] === 2 ? parts[1] * 100 + parts[2] : parts[1];
};

const PAUSE: Record<PauseReason, { title: string; icon: LucideIcon; needsYou: boolean }> = {
  credit: { title: 'Out of Anthropic credit', icon: CircleDollarSign, needsYou: true },
  auth: { title: 'Anthropic rejected the API key', icon: KeyRound, needsYou: true },
  config: { title: 'Something is not set up on the server', icon: Settings2, needsYou: true },
  storage: { title: "The server can't use the translations bucket", icon: HardDrive, needsYou: true },
  budget: { title: 'Budget reached', icon: CircleDollarSign, needsYou: true },
  unavailable: { title: 'Anthropic or storage is not answering', icon: CloudOff, needsYou: false },
  rate_limit: { title: 'Anthropic is rate limiting this key', icon: Timer, needsYou: false },
  busy: { title: 'Another run holds this version', icon: Wrench, needsYou: false },
  error: { title: 'Unexpected error', icon: AlertTriangle, needsYou: false },
};

const LEVEL_DOT = { info: 'bg-muted-foreground/40', warn: 'bg-warning', success: 'bg-success', error: 'bg-destructive' } as const;
const LEVEL_TEXT = { info: 'text-foreground', warn: 'text-amber-700 dark:text-amber-400', success: 'text-success', error: 'text-destructive' } as const;

export function ActivityFeed({ lines, onOpenVerse, className }: { lines: FeedLine[]; onOpenVerse?: (verseId: string) => void; className?: string }) {
  if (lines.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">Nothing has happened yet.</p>;
  return (
    <ol className={cn('divide-y divide-border/60 overflow-y-auto rounded-md border bg-background', className)} aria-live="polite">
      {lines.map((line, index) => (
        <li key={`${line.at}-${index}`} className="grid grid-cols-[4.5rem_0.5rem_1fr_auto] items-baseline gap-x-2 px-3 py-1.5 text-xs">
          <span className="font-mono text-muted-foreground tabular-nums">{clockTime(line.at)}</span>
          <span className={cn('h-1.5 w-1.5 self-center rounded-full', LEVEL_DOT[line.level] ?? LEVEL_DOT.info)} />
          <span className={cn('min-w-0 break-words', LEVEL_TEXT[line.level] ?? LEVEL_TEXT.info)}>{line.text}</span>
          {line.verseId && onOpenVerse ? (
            <button
              type="button"
              onClick={() => onOpenVerse(line.verseId!)}
              title={`Read ${line.verseId}`}
              aria-label={`Read ${line.verseId}`}
              className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span />
          )}
        </li>
      ))}
    </ol>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums">{value}</p>
      {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ResumeDialog({ run, open, onOpenChange, onResume, busy }: { run: Run; open: boolean; onOpenChange: (open: boolean) => void; onResume: (budgetUsd?: number | null) => void; busy: boolean }) {
  const [mode, setMode] = useState<'keep' | 'raise' | 'none'>(run.pauseReason === 'budget' ? 'raise' : 'keep');
  const [amount, setAmount] = useState('');
  const raised = Number(amount);
  const invalid = mode === 'raise' && !(raised > run.usage.costUsd);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resume {run.languageName}</DialogTitle>
          <DialogDescription>
            Verses already saved are kept — the run picks up at the first one that is not. {run.usage.costUsd > 0 && <>So far it has cost {formatUsd(run.usage.costUsd)}.</>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {([
            ['keep', run.budgetUsd === null ? 'No spending limit' : `Keep the budget (${formatUsd(run.budgetUsd)})`],
            ['raise', 'Set a new budget'],
            ['none', 'Remove the limit'],
          ] as const).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="budget-mode" checked={mode === value} onChange={() => setMode(value)} className="accent-[var(--primary)]" />
              {label}
            </label>
          ))}
          {mode === 'raise' && (
            <div className="space-y-1 pl-6">
              <Label htmlFor="new-budget">New total budget (USD)</Label>
              <Input id="new-budget" type="number" min={0} step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`More than ${formatUsd(run.usage.costUsd)}`} autoFocus />
              <p className="text-xs text-muted-foreground">The budget counts everything this run has spent, not only what is left.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button disabled={busy || invalid} onClick={() => onResume(mode === 'keep' ? undefined : mode === 'none' ? null : raised)}>
            {busy ? <Loader2 className="animate-spin" /> : <Play />}
            Resume
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RunPanel({
  run: initial,
  chaptersInBook,
  onOpenOutput,
  feedHeight = 'max-h-72',
}: {
  run: Run;
  chaptersInBook: number;
  onOpenOutput: (book: BookId, language: string, chapter: number, verseId?: string) => void;
  feedHeight?: string;
}) {
  const { hasPermission } = useAuth();
  const canRun = hasPermission('translation.run');
  const detail = useRun(initial.id);
  const run = detail.data?.run ?? initial;
  const feed = detail.data?.feed ?? [];

  const resume = useResumeRun();
  const cancel = useCancelRun();
  const [resumeOpen, setResumeOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const active = ACTIVE.includes(run.status);
  const now = useNow(active);
  const retryIn = run.status === 'PAUSED' && run.resumeAt ? Math.max(0, Math.round((new Date(run.resumeAt).getTime() - now) / 1000)) : null;

  const pause = run.status === 'PAUSED' && run.pauseReason ? PAUSE[run.pauseReason] : null;
  const PauseIcon = pause?.icon ?? AlertTriangle;
  const needsPerson = run.status === 'FAILED' || (run.status === 'PAUSED' && retryIn === null);

  const fail = (err: unknown) => setProblem(err instanceof ApiRequestError ? err.message : 'The request did not go through.');
  const doResume = (budgetUsd?: number | null) => {
    setProblem(null);
    resume.mutate({ id: run.id, budgetUsd }, { onSuccess: () => setResumeOpen(false), onError: fail });
  };
  const doCancel = () => {
    const warning =
      run.status === 'RUNNING' && !run.stalled
        ? 'Stop this run? It finishes the verse it is on, then stops. Verses already saved are kept.'
        : 'Cancel this run? Verses already saved are kept.';
    if (!confirm(warning)) return;
    setProblem(null);
    cancel.mutate(run.id, { onError: fail });
  };

  const { progress } = run;
  const barTone = run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'destructive' : run.status === 'PAUSED' ? 'warning' : run.status === 'CANCELLED' ? 'muted' : 'primary';
  const openChapter = progress.currentVerseId ? chapterOf(progress.currentVerseId) : (run.chapters[0] ?? 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{run.book === 'srimad-bhagavatam' ? 'Śrīmad-Bhāgavatam' : 'Bhagavad-gītā'}</Badge>
            <h3 className="text-base font-semibold">{run.languageName}</h3>
            <span className="text-base text-muted-foreground" lang={run.language}>
              {run.endonym}
            </span>
            <StatusBadge status={run.status} stalled={run.stalled} />
            {run.cancelRequested && run.status === 'RUNNING' && <Badge variant="warning">Stopping…</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {describeChapters(run.chapters, chaptersInBook, run.book)}
            {run.verseLimit ? ` · first ${run.verseLimit} verses` : ''} · version <span className="font-mono">{run.version}</span> {!run.lanes?.length && <> · {providerName(run.provider)} {run.model}</>}
          </p>
          <p className="text-xs text-muted-foreground">
            {run.requestedBy ? `Started by ${run.requestedBy.name}` : 'Started'} {timeAgo(run.createdAt, now)}
            {run.finishedAt && <> · finished {formatDate(run.finishedAt)}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenOutput(run.book, run.language, openChapter, progress.currentVerseId ?? undefined)}>
            <Eye /> View output
          </Button>
          {canRun && (run.status === 'PAUSED' || run.status === 'FAILED') && (
            <Button size="sm" onClick={() => (run.pauseReason === 'budget' || run.budgetUsd !== null ? setResumeOpen(true) : doResume())} disabled={resume.isPending}>
              {resume.isPending ? <Loader2 className="animate-spin" /> : run.status === 'FAILED' ? <RefreshCw /> : <Play />}
              {run.status === 'FAILED' ? 'Try again' : retryIn !== null ? 'Retry now' : 'Resume'}
            </Button>
          )}
          {canRun && active && !(run.cancelRequested && run.status === 'RUNNING') && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={doCancel} disabled={cancel.isPending}>
              {cancel.isPending ? <Loader2 className="animate-spin" /> : <XCircle />}
              Cancel
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
            <p className="text-muted-foreground">
              It may have been restarted or stopped — a restarted worker picks the run up again by itself within a couple of minutes. If it does not, Cancel this run and start it again; nothing already saved is lost.
              {run.heartbeatAt && <> Last heard {timeAgo(run.heartbeatAt, now)}.</>}
            </p>
          </div>
        </div>
      )}

      {pause && (
        <div role="status" className={cn('flex gap-3 rounded-md border p-3 text-sm', pause.needsYou ? 'border-warning/50 bg-warning/15' : 'border-border bg-muted/50')}>
          <PauseIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium">
              {pause.title}
              {retryIn !== null && <span className="ml-2 font-normal text-muted-foreground">· trying again in {formatDuration(retryIn)}</span>}
            </p>
            {run.statusMessage && <p className="break-words text-muted-foreground">{run.statusMessage}</p>}
            {retryIn === null && <p className="text-xs text-muted-foreground">Nothing happens until you press Resume.</p>}
          </div>
        </div>
      )}

      {run.status === 'FAILED' && (
        <div role="alert" className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <Ban className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium text-destructive">The run stopped{run.errorVerseId ? ` at verse ${run.errorVerseId}` : ''}</p>
            {run.statusMessage && <p className="break-words text-muted-foreground">{run.statusMessage}</p>}
            <p className="text-xs text-muted-foreground">{formatCount(progress.done)} verses are saved. “Try again” continues from the first one that is not.</p>
          </div>
        </div>
      )}

      {run.status === 'COMPLETED' && run.statusMessage && <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{run.statusMessage}</p>}
      {run.status === 'CANCELLED' && run.statusMessage && <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{run.statusMessage}</p>}
      {(run.status === 'QUEUED' || (run.status === 'RUNNING' && !run.stalled)) && run.statusMessage && !needsPerson && (
        <p className="text-sm text-muted-foreground">{run.statusMessage}</p>
      )}

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium tabular-nums">
            {formatCount(progress.done)} <span className="font-normal text-muted-foreground">of {formatCount(progress.total)} verses</span>
          </span>
          <span className="font-semibold tabular-nums">{progress.percent}%</span>
        </div>
        <ProgressBar percent={progress.percent} tone={barTone} className="h-2.5" />
      </div>

      {run.lanes && run.lanes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{run.lanes.length === 1 ? 'Request' : 'Requests running side by side'}</p>
          {run.lanes.map((lane) => {
            const total = lane.total ?? 0;
            const done = lane.done ?? 0;
            return (
              <div key={lane.key} className="rounded-md border p-2 text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{lane.parts.map((part) => PART_LABELS[part]).join(' + ')}</span>
                  <span className="text-muted-foreground">{providerName(lane.provider)} · <span className="font-mono">{lane.model}</span>{lane.effort !== 'off' ? ` · ${lane.effort}` : ''}</span>
                </div>
                <ProgressBar percent={total ? Math.min(100, (done / total) * 100) : 0} tone={barTone} className="my-1.5 h-1.5" />
                <p className="tabular-nums text-muted-foreground">{formatCount(done)} of {formatCount(total)} verses · {formatCount(lane.calls ?? 0)} calls · {formatUsd((lane.costMicros ?? 0) / 1e6)}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Stat label="Now translating" value={run.status === 'RUNNING' && progress.currentVerseId ? progress.currentVerseId : '—'} />
        <Stat
          label="Time left"
          value={run.status === 'RUNNING' ? formatDuration(progress.etaSeconds) : '—'}
          hint={progress.secondsPerVerse ? `${formatDuration(progress.secondsPerVerse)} per verse` : undefined}
        />
        <Stat
          label="Cost"
          value={formatUsd(run.usage.costUsd)}
          hint={run.budgetUsd !== null ? `of ${formatUsd(run.budgetUsd)} budget` : 'no budget set'}
        />
        <Stat label="Model calls" value={formatCount(run.usage.calls)} hint={`${formatCount(run.usage.inputTokens + run.usage.outputTokens)} tokens`} />
      </div>

      {run.budgetUsd !== null && run.budgetUsd > 0 && (
        <ProgressBar percent={(run.usage.costUsd / run.budgetUsd) * 100} tone={run.usage.costUsd >= run.budgetUsd ? 'destructive' : 'muted'} className="h-1" />
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">How the verses scored</p>
        <ScoreMix scores={run.scores} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Activity</p>
          {detail.isFetching && !detail.isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <ActivityFeed lines={feed} className={feedHeight} onOpenVerse={(verseId) => onOpenOutput(run.book, run.language, chapterOf(verseId), verseId)} />
      </div>

      <ResumeDialog run={run} open={resumeOpen} onOpenChange={setResumeOpen} onResume={doResume} busy={resume.isPending} />
    </div>
  );
}
