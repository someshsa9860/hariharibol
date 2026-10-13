// Small pieces the Translations page is built from: how a status, a score and a progress bar look,
// and how seconds, dollars and "a while ago" read. Nothing here fetches.

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RunStatus, Score } from '@/lib/translation';

export function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

export function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `$${value.toFixed(value < 1 ? 3 : 2)}`;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function timeAgo(iso: string | null, now = Date.now()) {
  if (!iso) return '—';
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const STATUS: Record<RunStatus, { label: string; variant: 'secondary' | 'default' | 'warning' | 'success' | 'destructive' | 'outline' }> = {
  QUEUED: { label: 'Waiting', variant: 'secondary' },
  RUNNING: { label: 'Running', variant: 'default' },
  PAUSED: { label: 'Paused', variant: 'warning' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'destructive' },
  CANCELLED: { label: 'Cancelled', variant: 'outline' },
};

export function StatusBadge({ status, stalled }: { status: RunStatus; stalled?: boolean }) {
  const { label, variant } = STATUS[status];
  return (
    <Badge variant={stalled ? 'destructive' : variant} className={cn('gap-1.5', status === 'PAUSED' && !stalled && 'text-amber-700 dark:text-amber-400')}>
      {status === 'RUNNING' && !stalled && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
      )}
      {stalled ? 'Not responding' : label}
    </Badge>
  );
}

export const SCORE_LABEL: Record<Score, string> = { 3: 'Perfect', 2: 'Good', 1: 'Needs another round' };

const SCORE_STYLE: Record<Score, string> = {
  3: 'bg-success/15 text-success border-success/30',
  2: 'bg-primary/10 text-primary border-primary/25',
  1: 'bg-warning/20 text-amber-700 dark:text-amber-400 border-warning/40',
};

const SCORE_DOT: Record<Score, string> = { 3: 'bg-success', 2: 'bg-primary/70', 1: 'bg-warning' };

export function ScoreBadge({ score, short }: { score: Score | null | undefined; short?: boolean }) {
  if (!score) return <Badge variant="outline">No score</Badge>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', SCORE_STYLE[score])}>
      <span className="font-semibold">{score}/3</span>
      {!short && <span>{SCORE_LABEL[score]}</span>}
    </span>
  );
}

export function ScoreDot({ score, className }: { score: Score | null | undefined; className?: string }) {
  return (
    <span
      title={score ? `Score ${score}/3 — ${SCORE_LABEL[score]}` : 'Not translated'}
      className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', score ? SCORE_DOT[score] : 'bg-muted-foreground/25', className)}
    />
  );
}

/** How the verses of a run (or a language) scored, as one bar and a legend. */
export function ScoreMix({ scores, unscored = 0 }: { scores: { 1: number; 2: number; 3: number }; unscored?: number }) {
  const total = scores[1] + scores[2] + scores[3] + unscored;
  if (total === 0) return <p className="text-xs text-muted-foreground">No verses scored yet.</p>;
  const segments: { score: Score | 0; count: number; className: string }[] = [
    { score: 3, count: scores[3], className: 'bg-success' },
    { score: 2, count: scores[2], className: 'bg-primary/70' },
    { score: 1, count: scores[1], className: 'bg-warning' },
    { score: 0, count: unscored, className: 'bg-muted-foreground/30' },
  ];
  return (
    <div className="space-y-1.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {segments.map((s) => s.count > 0 && <div key={s.score} className={s.className} style={{ width: `${(s.count / total) * 100}%` }} />)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>
          <b className="text-foreground">{scores[3]}</b> perfect
        </span>
        <span>
          <b className="text-foreground">{scores[2]}</b> good
        </span>
        <span>
          <b className={cn(scores[1] > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-foreground')}>{scores[1]}</b> need another round
        </span>
        {unscored > 0 && (
          <span>
            <b className="text-foreground">{unscored}</b> unscored
          </span>
        )}
      </div>
    </div>
  );
}

export function ProgressBar({ percent, tone = 'primary', className }: { percent: number; tone?: 'primary' | 'success' | 'warning' | 'destructive' | 'muted'; className?: string }) {
  const fill = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', destructive: 'bg-destructive', muted: 'bg-muted-foreground/50' }[tone];
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-700 ease-out', fill)} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

export function describeChapters(chapters: number[], all: number) {
  if (chapters.length === 0 || chapters.length >= all) return 'All chapters';
  if (chapters.length === 1) return `Chapter ${chapters[0]}`;
  return `Chapters ${chapters.join(', ')}`;
}
