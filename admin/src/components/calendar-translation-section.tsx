// The Hindu calendar's Translations tab: in-progress runs, the queue, a card per language with how much of the calendar's wording
// it has, the words themselves (read, correct by hand, delete) and the history of runs. Built like the Devotee etiquette page's
// Translations tab; the page keeps nothing that matters — the open run lives in the URL (`?run=`), the rest is the server's.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Languages, Loader2, Pencil, RefreshCw, Trash2, Wifi, WifiOff, XCircle } from 'lucide-react';
import { CalendarRunPanel, StartCalendarDialog } from '@/components/calendar-translation-run';
import { ProgressBar, StatusBadge, formatCount, timeAgo } from '@/components/translation-bits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiRequestError } from '@/lib/api';
import {
  KIND_LABEL, useCalendarLive, useCalendarOverview, useCalendarRun, useCalendarRuns, useCalendarWords, useCancelCalendar, useDeleteCalendarWord, useSaveCalendarWord,
  type CalendarOverview, type CalendarRun, type WordKind, type WordRow, type WordState,
} from '@/lib/calendar-translation';
import { useSocketStatus } from '@/lib/socket';
import { cn } from '@/lib/utils';

const KIND_ONE: Record<WordKind, string> = { NAME: 'Name', DESCRIPTION: 'Description', TERM: 'Term' };
const STATE_LABEL: Record<WordState, string> = { translated: 'Translated', missing: 'Missing', edited: 'Edited by hand' };

export function CalendarTranslations({ canTranslate }: { canTranslate: boolean }) {
  const [params, setParams] = useSearchParams();
  const overview = useCalendarOverview(true);
  const data = overview.data;
  const busy = (data?.active.length ?? 0) > 0;
  // Runs go one at a time in the order made: the oldest is on screen, the ones waiting behind it are the queue.
  const queued = (data?.active ?? []).filter((run, i) => i > 0 && run.status === 'QUEUED');
  const current = (data?.active ?? []).filter((run) => !queued.includes(run));
  useCalendarLive();

  const [startFor, setStartFor] = useState<string | undefined>(undefined); // undefined = closed, '' = open with no language chosen
  const openRunId = params.get('run');
  const setRun = (id: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set('run', id);
      else next.delete('run');
      return next;
    });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">
          The festival names and descriptions and the panchang terms (tithi, nakshatra, yoga, karana, month, zodiac sign) in the 11 reading languages. A translation belongs to the English
          wording, not to a day or a place, so one serves every year. Readers whose reading language has one see it in the calendar and in the festival push; the rest see English. Runs work
          on the server — closing this page never stops one.
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
            <p className="text-sm text-destructive">The calendar's translations could not be loaded.</p>
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
                    <CalendarRunPanel run={run} feedHeight="max-h-52" />
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          <Queue runs={queued} canTranslate={canTranslate} />
          <Coverage overview={data} canTranslate={canTranslate} onTranslate={(language) => setStartFor(language)} />
          <Words overview={data} canTranslate={canTranslate} />
          <History onOpen={setRun} />
        </>
      )}

      {data && startFor !== undefined && (
        <StartCalendarDialog key={startFor} open onOpenChange={(open) => !open && setStartFor(undefined)} overview={data} language={startFor} onStarted={(run) => setRun(run.id)} />
      )}

      <RunDialog id={openRunId} onClose={() => setRun(null)} />
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

// ── Is it ready ──────────────────────────────────────────────────────────────────────────────────────

function Health({ data, hasActive }: { data: CalendarOverview; hasActive: boolean }) {
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
    data.itemsTotal === 0 && { fatal: true, text: 'The calendar holds no festivals or days yet, so there is nothing to translate. Generate a year on the Calendar tab first.' },
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
          {formatCount(data.itemsTotal)} words to translate
          {data.itemsTotal > 0 && (
            <>
              {' '}
              ({(Object.keys(KIND_LABEL) as WordKind[]).map((kind) => `${formatCount(data.itemsByKind[kind] ?? 0)} ${KIND_LABEL[kind].toLowerCase()}`).join(', ')})
            </>
          )}
        </span>
        <span>
          Default: {provider?.label ?? translation.defaultProvider} <span className="font-mono text-foreground">{translation.model}</span>
        </span>
      </p>
    </div>
  );
}

// ── Languages ────────────────────────────────────────────────────────────────────────────────────────

function Coverage({ overview, canTranslate, onTranslate }: { overview: CalendarOverview; canTranslate: boolean; onTranslate: (language: string) => void }) {
  const total = overview.itemsTotal;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">
        Languages <span className="font-normal text-muted-foreground">· of the {formatCount(total)} words the calendar holds</span>
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {overview.languages.map((language) => {
          const live = overview.active.some((run) => run.language === language.code);
          const done = total > 0 && language.translated >= total;
          return (
            <Card key={language.code}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {language.name} <span className="font-normal text-muted-foreground">{language.endonym}</span>
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatCount(language.translated)} of {formatCount(total)} translated
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
                      <Languages /> {live ? 'Running' : language.translated > 0 && !done ? 'Finish' : done ? 'Again' : 'Translate'}
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
        A translation is an AI draft until someone reads it, and is shown to readers at once. One saved by hand below is never overwritten by a run.
      </p>
    </section>
  );
}

function Queue({ runs, canTranslate }: { runs: CalendarRun[]; canTranslate: boolean }) {
  const cancel = useCancelCalendar();
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

// ── The words ────────────────────────────────────────────────────────────────────────────────────────

function Words({ overview, canTranslate }: { overview: CalendarOverview; canTranslate: boolean }) {
  const [language, setLanguage] = useState(overview.languages[0]?.code ?? '');
  const [kind, setKind] = useState<WordKind | ''>('');
  const [state, setState] = useState<WordState | ''>('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<WordRow | null>(null);
  const words = useCalendarWords({ language, kind, state, q, page }, true);
  const remove = useDeleteCalendarWord();
  const [problem, setProblem] = useState<string | null>(null);
  const info = overview.languages.find((l) => l.code === language);

  // The search box waits for a pause in typing before it asks the server, and a new search starts on page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ((prev) => {
        if (prev !== search.trim()) setPage(1);
        return search.trim();
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const narrow = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setPage(1);
  };

  const doDelete = (row: WordRow) => {
    if (!row.translation) return;
    if (!confirm(`Delete the ${info?.name ?? ''} translation of “${row.source.length > 60 ? `${row.source.slice(0, 60)}…` : row.source}”? Readers see English until a run or an editor writes it again.`)) return;
    setProblem(null);
    remove.mutate(row.translation.id, { onError: (err) => setProblem(err instanceof ApiRequestError ? err.message : 'The request did not go through.') });
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">Words</h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="calendar-words-language">Language</Label>
          <Select id="calendar-words-language" className="w-48" value={language} onChange={(ev) => narrow(setLanguage)(ev.target.value)}>
            {overview.languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} · {l.endonym}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="calendar-words-kind">Kind</Label>
          <Select id="calendar-words-kind" className="w-40" value={kind} onChange={(ev) => narrow(setKind)(ev.target.value as WordKind | '')}>
            <option value="">All kinds</option>
            {(Object.keys(KIND_LABEL) as WordKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="calendar-words-state">State</Label>
          <Select id="calendar-words-state" className="w-44" value={state} onChange={(ev) => narrow(setState)(ev.target.value as WordState | '')}>
            <option value="">Any state</option>
            {(Object.keys(STATE_LABEL) as WordState[]).map((s) => (
              <option key={s} value={s}>
                {STATE_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-48 flex-1 space-y-1">
          <Label htmlFor="calendar-words-search">Search</Label>
          <Input id="calendar-words-search" value={search} onChange={(ev) => setSearch(ev.target.value)} placeholder="The English or the translation…" autoComplete="off" />
        </div>
      </div>

      {problem && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {problem}
        </p>
      )}

      {words.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : words.isError && !words.data ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-destructive">The words could not be loaded.</p>
            <Button size="sm" variant="outline" onClick={() => words.refetch()}>
              <RefreshCw /> Try again
            </Button>
          </CardContent>
        </Card>
      ) : !words.data?.items.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No words match.</p>
      ) : (
        <>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Kind</TableHead>
                  <TableHead>English</TableHead>
                  <TableHead>{info?.name ?? 'Translation'}</TableHead>
                  {canTranslate && <TableHead className="w-24 text-right" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {words.data.items.map((row) => (
                  <TableRow key={`${row.kind}:${row.source}`}>
                    <TableCell className="align-top">
                      <Badge variant="outline">{row.kind === 'TERM' && row.group ? row.group : KIND_ONE[row.kind]}</Badge>
                    </TableCell>
                    <TableCell className="max-w-sm align-top text-sm">
                      <p className="whitespace-pre-wrap">{row.source}</p>
                    </TableCell>
                    <TableCell className="max-w-sm align-top text-sm">
                      {row.translation ? (
                        <>
                          <p className="whitespace-pre-wrap">{row.translation.text}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.translation.isEdited ? 'Edited by hand' : `AI draft${row.translation.translatedBy ? ` · ${row.translation.translatedBy}` : ''}`}
                          </p>
                        </>
                      ) : (
                        <Badge variant="warning">Missing</Badge>
                      )}
                    </TableCell>
                    {canTranslate && (
                      <TableCell className="whitespace-nowrap text-right align-top">
                        <Button variant="ghost" size="icon" aria-label={row.translation ? 'Edit the translation' : 'Write the translation'} onClick={() => setEditing(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {row.translation && (
                          <Button variant="ghost" size="icon" aria-label="Delete the translation" className="text-destructive" disabled={remove.isPending} onClick={() => doDelete(row)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Pager page={words.data.page} totalPages={words.data.totalPages} total={words.data.total} onPage={setPage} />
        </>
      )}

      {editing && <WordDialog key={`${editing.kind}:${editing.source}:${language}`} row={editing} language={language} languageName={info?.name ?? language} onClose={() => setEditing(null)} />}
    </section>
  );
}

function WordDialog({ row, language, languageName, onClose }: { row: WordRow; language: string; languageName: string; onClose: () => void }) {
  const save = useSaveCalendarWord();
  const [text, setText] = useState(row.translation?.text ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const unchanged = text.trim() === (row.translation?.text ?? '') && !!row.translation?.isEdited;

  const submit = () => {
    setProblem(null);
    save.mutate(
      { language, kind: row.kind, source: row.source, text: text.trim() },
      { onSuccess: onClose, onError: (err) => setProblem(err instanceof ApiRequestError ? err.message : 'The request did not go through.') }
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{row.translation ? 'Edit' : 'Write'} the {languageName} translation</DialogTitle>
          <DialogDescription>Saved as written by an editor, so a translation run never replaces it. Readers see it at once.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>English{row.kind === 'TERM' && row.group ? ` · ${row.group}` : ` · ${KIND_ONE[row.kind].toLowerCase()}`}</Label>
            <p className="whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2 text-sm">{row.source}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="calendar-word-text">{languageName}</Label>
            <Textarea id="calendar-word-text" value={text} maxLength={1200} rows={row.kind === 'DESCRIPTION' ? 6 : 3} onChange={(ev) => setText(ev.target.value)} autoFocus />
          </div>
          {problem && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {problem}
            </p>
          )}
        </div>
        <DialogFooter className="mt-5">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending || !text.trim() || unchanged}>
            {save.isPending && <Loader2 className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Pager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-xs text-muted-foreground tabular-nums">{formatCount(total)} word{total === 1 ? '' : 's'}</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ── History ──────────────────────────────────────────────────────────────────────────────────────────

function History({ onOpen }: { onOpen: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const runs = useCalendarRuns(page, true);
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
                  <TableHead>Words</TableHead>
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
  const run = useCalendarRun(id);
  if (!run.data) return <Skeleton className="h-48 w-full" />;
  return <CalendarRunPanel run={run.data.run} feedHeight="max-h-80" />;
}
