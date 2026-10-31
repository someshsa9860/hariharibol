// The prayers' translation run's two interactive pieces: the panel for a run (how far it is, what it has used, why it stopped,
// what the worker is doing now) and the dialog that starts one, with the provider and model chosen per run. Built like
// calendar-translation-run.tsx; the feed and the bars are the Translations page's.

import { useState } from 'react';
import { AlertTriangle, CircleDollarSign, CloudOff, HardDrive, KeyRound, Loader2, Play, RefreshCw, Rocket, Settings2, Timer, Wrench, XCircle, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label, Select } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  ACTIVE, usePrayerEstimate, usePrayerRun, useCancelPrayer, useResumePrayer, useStartPrayer,
  type PauseReason, type PrayerOverview, type PrayerRun, type ProviderId,
} from '@/lib/prayers';
import { useNow } from '@/lib/translation';
import { cn, formatDate } from '@/lib/utils';
import { ModelPicker, unusableReasonFor } from './model-picker';
import { ActivityFeed } from './translation-run-panel';
import { ProgressBar, StatusBadge, formatCount, formatDuration, timeAgo } from './translation-bits';

const PAUSE: Record<PauseReason, { title: string; icon: LucideIcon; needsYou: boolean }> = {
  credit: { title: 'Out of credit', icon: CircleDollarSign, needsYou: true },
  auth: { title: 'The API key was refused', icon: KeyRound, needsYou: true },
  config: { title: 'Something is not set up on the server', icon: Settings2, needsYou: true },
  storage: { title: "The server can't use its storage", icon: HardDrive, needsYou: true },
  unavailable: { title: 'The provider is not answering', icon: CloudOff, needsYou: false },
  rate_limit: { title: 'The provider’s limit was reached', icon: Timer, needsYou: false },
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

export function PrayerRunPanel({ run: initial, feedHeight = 'max-h-72' }: { run: PrayerRun; feedHeight?: string }) {
  const { hasPermission } = useAuth();
  const canRun = hasPermission('prayer.translate');
  const detail = usePrayerRun(initial.id);
  const run = detail.data?.run ?? initial;
  const feed = detail.data?.feed ?? [];
  const resume = useResumePrayer();
  const cancel = useCancelPrayer();
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
    if (!confirm(run.status === 'RUNNING' && !run.stalled ? 'Stop this run? It finishes the request it is on, then stops. Prayers already translated are kept.' : 'Cancel this run? Prayers already translated are kept.')) return;
    setProblem(null);
    cancel.mutate(run.id, { onError: fail });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">
              {run.languageName} <span className="font-normal text-muted-foreground">{run.endonym}</span>
            </h3>
            <StatusBadge status={run.status} stalled={run.stalled} />
            {run.force && <Badge variant="secondary">Translating again</Badge>}
            {run.cancelRequested && run.status === 'RUNNING' && <Badge variant="warning">Stopping…</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {run.provider} <span className="font-mono">{run.model}</span> · from the original verses and the English wording
          </p>
          <p className="text-xs text-muted-foreground">
            {run.requestedBy?.name ? `Started by ${run.requestedBy.name}` : 'Started'} {timeAgo(run.createdAt, now)}
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
            <p className="text-muted-foreground">A restarted worker picks the run up again within a couple of minutes. If it does not, cancel and start it again; translated prayers are kept. {run.heartbeatAt && <>Last heard {timeAgo(run.heartbeatAt, now)}.</>}</p>
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
          {run.statusMessage}
        </p>
      )}
      {(run.status === 'COMPLETED' || run.status === 'CANCELLED') && run.statusMessage && <p className="text-sm text-muted-foreground">{run.statusMessage}</p>}

      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-medium tabular-nums">
            {progress.done} of {progress.total} prayer{progress.total === 1 ? '' : 's'}
          </span>
          <span className="text-muted-foreground tabular-nums">{progress.percent}%</span>
        </div>
        <ProgressBar percent={progress.percent} tone={tone} />
        {run.status === 'RUNNING' && progress.currentSlug && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> Translating <span className="truncate font-mono">{progress.currentSlug}</span>
            {progress.etaSeconds !== null && <span className="shrink-0"> · about {formatDuration(progress.etaSeconds)} left</span>}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Requests" value={formatCount(run.usage.calls)} />
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

const money = (usd: number) => (usd < 0.01 ? '<0.01' : usd.toFixed(2));

export function StartPrayerDialog({ open, onOpenChange, overview, language: preset, onStarted, onOpenRun }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: PrayerOverview;
  /** The language the dialog opens on, from a coverage card; blank lets the admin choose. */
  language: string;
  onStarted: (run: PrayerRun) => void;
  /** Opens the run that already holds the language, when the server refuses with a 409 that names it (`details.runId`). */
  onOpenRun?: (runId: string) => void;
}) {
  const start = useStartPrayer();
  const [language, setLanguage] = useState(preset || overview.languages[0]?.code || '');
  const [provider, setProvider] = useState<ProviderId>(overview.translation.defaultProvider);
  const [model, setModel] = useState('');
  const [force, setForce] = useState(false);
  const [problem, setProblem] = useState<{ message: string; runId: string | null } | null>(null);

  const estimate = usePrayerEstimate(language, force, provider, model, open);
  const info = overview.languages.find((l) => l.code === language);
  const providerInfo = overview.translation.providers.find((p) => p.id === provider);
  const keyMissing = providerInfo && !providerInfo.apiKeyConfigured;
  const unusable = unusableReasonFor(overview.translation.providers, provider, model);
  const e = estimate.data;
  const nothing = e?.language === language && e.willTranslate === 0;

  const submit = () => {
    setProblem(null);
    start.mutate(
      { language, provider, model: model.trim() || undefined, force },
      {
        onSuccess: (run) => {
          onOpenChange(false);
          onStarted(run);
        },
        onError: (err) => {
          if (!(err instanceof ApiRequestError)) return setProblem({ message: 'The request did not go through.', runId: null });
          // A 409 for a language that already has a live run names it, so the admin can go and look.
          const runId = err.status === 409 ? (err.details as { runId?: string } | undefined)?.runId ?? null : null;
          setProblem({ message: err.message, runId });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent page className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{info ? `Translate the prayers into ${info.name}` : 'New prayer translation'}</DialogTitle>
          <DialogDescription>
            {overview.active.length > 0 && <span className="mb-1 block font-medium text-foreground">A run is going, so this one joins the queue and starts by itself when the others are done.</span>}
            Only published prayers are translated. The model writes each prayer’s title, summary and about, and each verse’s meaning, in the language, and writes the verses out in its script where a rule cannot (a verse is never translated, only spelled in the other script). Anything an editor wrote by hand is kept. The results are AI drafts, shown to readers at once; read them before you rely on them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1">
            <Label htmlFor="prayer-language">Language</Label>
            <Select id="prayer-language" className="w-full" value={language} onChange={(ev) => setLanguage(ev.target.value)}>
              {overview.languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} · {l.endonym} ({l.translated}/{overview.publishedTotal})
                </option>
              ))}
            </Select>
            {language === 'en' && <p className="text-xs text-muted-foreground">English is the Roman-letter spelling of each verse only; titles and meanings are already English.</p>}
          </div>

          <div className="flex items-start gap-3">
            <Switch id="prayer-force" checked={force} onCheckedChange={setForce} aria-labelledby="prayer-force-label" className="mt-0.5" />
            <label id="prayer-force-label" htmlFor="prayer-force" className="cursor-pointer text-sm">
              Translate again what already has a translation
              <span className="block text-xs text-muted-foreground">Replaces machine translations only; a title, meaning or verse an editor wrote or corrected is never replaced. Left off, only what is missing or out of date is translated.</span>
            </label>
          </div>

          <ModelPicker
            idPrefix="prayer"
            providers={overview.translation.providers}
            provider={provider}
            model={model}
            onChange={(next) => {
              setProvider(next.provider as ProviderId);
              setModel(next.model);
            }}
          />
          {keyMissing && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {providerInfo!.keyEnv} is not set on the server, so {providerInfo!.company} cannot be called.
            </p>
          )}
          {unusable && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {unusable}
            </p>
          )}
          {e?.unusable && e.language === language && e.unusable !== unusable && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {e.unusable}
            </p>
          )}
          {overview.translation.workerOnline === false && (
            <p role="status" className="rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-sm">
              No worker is online. The run will wait in the queue until one starts.
            </p>
          )}

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            {!language ? (
              <p className="text-muted-foreground">Choose a language.</p>
            ) : !e || e.language !== language ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Working out what it would take…
              </p>
            ) : nothing ? (
              <p>Every published prayer is already translated into {info?.name}. Switch on “Translate again” to replace the machine translations.</p>
            ) : (
              <>
                <p className="font-medium">
                  {e.willTranslate} prayer{e.willTranslate === 1 ? '' : 's'} to translate
                  <span className="font-normal text-muted-foreground">
                    {' '}
                    ({[
                      e.byPiece.headers > 0 && `${e.byPiece.headers} title${e.byPiece.headers === 1 ? '' : 's'}`,
                      e.byPiece.renderings > 0 && `${e.byPiece.renderings} verse${e.byPiece.renderings === 1 ? '' : 's'} to spell`,
                      e.byPiece.meanings > 0 && `${e.byPiece.meanings} meaning${e.byPiece.meanings === 1 ? '' : 's'}`,
                    ].filter(Boolean).join(', ')})
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  About {formatCount(e.inputTokens)} tokens in and {formatCount(e.outputTokens)} out, in {formatCount(e.requests)} request{e.requests === 1 ? '' : 's'} — roughly {e.minutes} minute{e.minutes === 1 ? '' : 's'}.
                  The token counts are estimates; the real ones are counted as they arrive.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {e.costUsd !== null ? `About $${money(e.costUsd)} for ${e.model}.` : `${e.model} has no price in the catalogue, so the cost is not estimated.`}
                </p>
              </>
            )}
          </div>

          {problem && (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <p>{problem.message}</p>
              {problem.runId && onOpenRun && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => { onOpenChange(false); onOpenRun(problem.runId!); }}>
                  Open that run
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-5">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={start.isPending || !language || nothing || !!keyMissing || !!unusable}>
            {start.isPending ? <Loader2 className="animate-spin" /> : <Rocket />} {overview.active.length > 0 ? 'Add to queue' : 'Start'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
