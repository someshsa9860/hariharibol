// "New translation": pick a language and, if wanted, only some chapters, a verse limit and a spending
// limit. The estimate on the right is the server's own arithmetic over what is already saved, so the
// number shown is what a run would actually have left to do: verses not translated yet, plus verses Claude
// translated under another version. Verses already done under the current version are never sent again, and
// when that is every verse the server refuses the start (409) and the button is off.

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { useEstimate, useStartRun, type Overview } from '@/lib/translation';
import { cn } from '@/lib/utils';
import { formatCount, formatUsd } from './translation-bits';

function useDebounced<T>(value: T, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function StartDialog({
  open,
  onOpenChange,
  overview,
  language: preset,
  onStarted,
  onOpenRun,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: Overview;
  language: string | null;
  onStarted: (runId: string) => void;
  onOpenRun: (runId: string) => void;
}) {
  const { settings, languages, chapters: allChapters } = overview;
  const [language, setLanguage] = useState(preset ?? languages[0]?.code ?? '');
  const [picked, setPicked] = useState<number[]>([]);
  const [limit, setLimit] = useState('');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState<{ message: string; runId?: string } | null>(null);
  const start = useStartRun();

  // Each time the dialog opens it starts from the language that was clicked, with nothing left over.
  useEffect(() => {
    if (!open) return;
    setLanguage(preset ?? languages[0]?.code ?? '');
    setPicked([]);
    setLimit('');
    setBudget('');
    setError(null);
    start.reset();
  }, [open, preset]);

  const limitNumber = limit.trim() === '' ? 0 : Math.floor(Number(limit));
  const budgetNumber = budget.trim() === '' ? 0 : Number(budget);
  const inputsOk = Number.isFinite(limitNumber) && limitNumber >= 0 && Number.isFinite(budgetNumber) && budgetNumber >= 0;

  const wanted = picked.length ? picked : allChapters;
  const debouncedChapters = useDebounced(wanted.join(','));
  const debouncedLimit = useDebounced(limitNumber);
  const estimate = useEstimate(language, debouncedChapters ? debouncedChapters.split(',').map(Number) : [], debouncedLimit, open && inputsOk);

  const blockers = [
    !settings.apiKeyConfigured && 'ANTHROPIC_API_KEY is not set on the server, so Claude cannot be called.',
    !settings.storage.ok && `The translations bucket is not set up: ${settings.storage.error ?? 'unknown problem'}.`,
    settings.versionError && settings.versionError,
  ].filter(Boolean) as string[];
  const warnings = [
    !settings.workerOnline && 'No worker is connected right now. The run will wait in the queue and start when one comes online.',
  ].filter(Boolean) as string[];

  const toggle = (chapter: number) => setPicked((prev) => (prev.includes(chapter) ? prev.filter((c) => c !== chapter) : [...prev, chapter].sort((a, b) => a - b)));
  const busyLanguage = overview.active.find((run) => run.language === language);
  const est = estimate.data;
  const nothingToDo = est !== undefined && est.willTranslate === 0;

  const submit = () => {
    setError(null);
    start.mutate(
      {
        language,
        chapters: picked.length ? picked : undefined,
        verseLimit: limitNumber > 0 ? limitNumber : undefined,
        budgetUsd: budgetNumber > 0 ? budgetNumber : undefined,
      },
      {
        onSuccess: (run) => {
          onOpenChange(false);
          onStarted(run.id);
        },
        onError: (err) => {
          const details = err instanceof ApiRequestError ? (err.details as { runId?: string } | undefined) : undefined;
          setError({ message: err instanceof ApiRequestError ? err.message : 'The request did not go through.', runId: details?.runId });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New translation</DialogTitle>
          <DialogDescription>
            Claude translates Prabhupāda's own words — translation, transliteration, word meanings and purport — into the language you pick. It runs on the server, so closing this page does not stop it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="language">Language</Label>
              <Select id="language" className="w-full" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {languages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name} — {item.endonym}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Chapters</Label>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setPicked([])}>
                  {picked.length === 0 ? 'All chapters' : 'Clear — use all'}
                </button>
              </div>
              <div className="grid grid-cols-9 gap-1.5">
                {allChapters.map((chapter) => {
                  const on = picked.length === 0 || picked.includes(chapter);
                  return (
                    <button
                      key={chapter}
                      type="button"
                      aria-pressed={picked.includes(chapter)}
                      onClick={() => toggle(chapter)}
                      className={cn(
                        'h-8 rounded-md border text-xs font-medium tabular-nums transition-colors',
                        picked.includes(chapter) ? 'border-primary bg-primary text-primary-foreground' : on ? 'bg-background hover:bg-accent' : 'text-muted-foreground'
                      )}
                    >
                      {chapter}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Verses already translated under the current version{est?.version ? ` (${est.version})` : ''} are skipped. Only verses that are missing, or that Claude made under an older version, are sent to Claude.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="limit">Stop after (verses)</Label>
                <Input id="limit" type="number" min={1} step={1} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="No limit" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget">Spending limit (USD)</Label>
                <Input id="budget" type="number" min={0} step="0.5" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="No limit" />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">A small verse limit is a good first run: read the result before translating the whole book.</p>
          </div>

          <aside className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimate</p>
            {est ? (
              <dl className={cn('space-y-1.5', estimate.isFetching && 'opacity-60')}>
                <Row label="In the chapters" value={`${formatCount(est.verses)} verses`} />
                <Row label="Already saved" value={formatCount(est.saved)} />
                {est.outdated > 0 && <Row label="Older version" value={formatCount(est.outdated)} />}
                <Row label="To translate" value={<b>{formatCount(est.willTranslate)}</b>} />
                <Row label="Claude calls" value={`≈ ${formatCount(est.calls)}`} />
                <Row label="Tokens" value={`≈ ${formatCount(est.inputTokens + est.outputTokens)}`} />
                <div className="border-t pt-2">
                  <Row label="Cost" value={<b className="text-base">{est.costUsd ? `≈ ${formatUsd(est.costUsd)}` : '$0'}</b>} />
                </div>
                <p className="pt-1 text-[11px] leading-snug text-muted-foreground">Model {est.model}. A guess from the length of the English text — the real cost is shown while it runs.</p>
              </dl>
            ) : estimate.isError ? (
              <p className="text-sm text-muted-foreground">Could not work out an estimate right now. You can still start the run.</p>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Working it out…
              </div>
            )}
            {nothingToDo && (
              <p className="text-xs text-success">
                Everything in this selection is already translated under version {est.version ?? 'the current one'}. To translate it again, set a new TRANSLATION_VERSION on the server.
              </p>
            )}
          </aside>
        </div>

        {busyLanguage && (
          <p className="mt-4 rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-sm">
            There is already a {busyLanguage.status.toLowerCase()} run for this language.{' '}
            <button type="button" className="font-medium underline underline-offset-2" onClick={() => { onOpenChange(false); onOpenRun(busyLanguage.id); }}>
              Open it
            </button>
          </p>
        )}
        {[...blockers, ...warnings].map((text) => (
          <p key={text} className={cn('mt-3 flex gap-2 rounded-md border px-3 py-2 text-sm', blockers.includes(text) ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-warning/50 bg-warning/15')}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {text}
          </p>
        ))}
        {error && (
          <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error.message}{' '}
            {error.runId && (
              <button type="button" className="font-medium underline underline-offset-2" onClick={() => { onOpenChange(false); onOpenRun(error.runId!); }}>
                Open that run
              </button>
            )}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={start.isPending || blockers.length > 0 || !inputsOk || !language || !!busyLanguage || nothingToDo}>
            {start.isPending ? <Loader2 className="animate-spin" /> : <Play />}
            Start translating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
