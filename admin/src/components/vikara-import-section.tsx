// The Bhagavatam's vikara tags: which of the six (kāma, krodha, lobha, moha, mada, mātsarya) a verse helps with.
//
// A Marathi translation run writes them to their own files in storage (issues/json/srimad-bhagavatam/), apart from the
// language files; "Import from S3" links them to the verses in the database, where the app's "what are you struggling
// with" picker reads them. It is a separate job from the translation import (`kind: 'VIKARA'`): the same queue, worker and
// live run view, but it never touches a translation, and importing a language never touches a vikara.
//
// The table is the server's own dry run, so what it says a chapter would do is what the import then does. The import
// never overwrites: a verse that already has vikara links is left alone, so importing twice changes nothing.

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, CheckCircle2, CloudDownload, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiRequestError } from '@/lib/api';
import {
  chapterName,
  IMPORT_ACTIVE,
  refreshAfterImport,
  useCancelImportRun,
  useImportRun,
  useImportVikaras,
  useVikaraPreview,
  useVikaraRuns,
  useVikaraStatus,
  type Overview,
  type VikaraChapter,
  type VikaraResult,
  type VikaraRun,
} from '@/lib/translation';
import { cn, formatDate } from '@/lib/utils';
import { ImportRunView } from './translation-import-dialog';
import { formatCount, ProgressBar, StatusBadge } from './translation-bits';

const BOOK = 'srimad-bhagavatam' as const;

const hasWork = (line: VikaraChapter) => line.links > 0;
const hasProblem = (line: VikaraChapter) => !!line.error || line.conflicts.length > 0 || line.missing.length > 0;
const failure = (err: unknown) => (err instanceof ApiRequestError ? err.message : 'The request did not go through.');
const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`;

/** One line for what an import did (or, for a preview, would do). */
function describe(result: VikaraResult) {
  const { totals } = result;
  const parts = [`${plural(totals.links, 'link')} on ${plural(totals.verses, 'verse')}`];
  if (totals.alreadyLinked > 0) parts.push(`${plural(totals.alreadyLinked, 'verse')} already linked, left alone`);
  if (totals.noTags > 0) parts.push(`${formatCount(totals.noTags)} with no vikara`);
  return parts.join(' · ');
}

const lastFinished = (runs: VikaraRun[] | undefined) => runs?.find((run) => !IMPORT_ACTIVE.includes(run.status));

export function VikaraSection({ overview, canImport }: { overview: Overview; canImport: boolean }) {
  const status = useVikaraStatus();
  const runs = useVikaraRuns();
  const [open, setOpen] = useState(false);

  const active = overview.activeImports.find((item): item is VikaraRun => item.kind === 'VIKARA');
  const last = lastFinished(runs.data);
  const missing = status.data?.vikaras.filter((item) => !item.inDatabase) ?? [];

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">Vikara tags</h3>
      <Card className={cn(active && 'ring-1 ring-primary/40')}>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl space-y-1">
              <p className="flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4 text-primary" /> Which vikara a verse helps with
              </p>
              <p className="text-sm text-muted-foreground">
                The Marathi translation run records, for each verse, the vikaras it genuinely helps with — usually none — in a separate file in storage. Importing links them to the verses so the app's "what are you struggling with" picker can offer them.
                Verses that already have vikara links are left as they are.
              </p>
            </div>
            {canImport && (
              <Button onClick={() => setOpen(true)} variant={active ? 'outline' : 'default'} title={active ? 'Follow the import, or cancel it' : 'Link the vikara tag files in storage to the verses in the database'}>
                <CloudDownload /> {active ? 'Open import' : 'Import from S3'}
              </Button>
            )}
          </div>

          {status.isLoading && <p className="text-sm text-muted-foreground">Counting what the database holds…</p>}
          {status.isError && <p className="text-sm text-destructive">What the database holds could not be loaded.</p>}
          {status.data && (
            <div className="space-y-2">
              <p className="text-sm">
                <b>{formatCount(status.data.verses)}</b> verse{status.data.verses === 1 ? '' : 's'} of the Bhagavatam {status.data.verses === 1 ? 'has' : 'have'} a vikara in the database (<b>{formatCount(status.data.links)}</b> link{status.data.links === 1 ? '' : 's'}).
              </p>
              <ul className="flex flex-wrap gap-2">
                {status.data.vikaras.map((item) => (
                  <li key={item.slug}>
                    <Badge variant={item.inDatabase ? 'outline' : 'warning'} className="gap-1.5 font-normal">
                      {item.name}
                      <span className="font-medium tabular-nums">{item.inDatabase ? formatCount(item.links) : 'missing'}</span>
                    </Badge>
                  </li>
                ))}
              </ul>
              {missing.length > 0 && (
                <p className="flex gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {missing.map((item) => item.name).join(', ')} {missing.length === 1 ? 'is' : 'are'} not in the database, so an import is refused. Run the seed first (npm run seed in the backend).
                </p>
              )}
            </div>
          )}

          {active && (
            <div className="space-y-1" role="status">
              <p className={cn('text-xs', active.stalled ? 'text-destructive' : 'text-muted-foreground')}>
                {active.status === 'QUEUED'
                  ? 'Vikara import: waiting for the worker'
                  : `Importing vikara tags: ${active.progress.done}/${active.progress.total || active.chapters.length} chapters (${active.progress.percent}%)`}
                {active.cancelRequested && ' · stopping'}
                {active.stalled && ' · the worker has not reported for a while'}
              </p>
              {active.status === 'RUNNING' && <ProgressBar percent={active.progress.percent} className="h-1.5" />}
            </div>
          )}

          {!active && last && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <StatusBadge status={last.status} />
              <span>
                Last import {last.finishedAt ? formatDate(last.finishedAt) : formatDate(last.createdAt)}
                {last.requestedBy ? ` by ${last.requestedBy.name}` : ''}
                {last.result ? ` — ${describe(last.result)}` : last.statusMessage ? ` — ${last.statusMessage}` : ''}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {open && <VikaraImportDialog onClose={() => setOpen(false)} overview={overview} />}
    </section>
  );
}

// Mounted only while it is open, so every opening starts with nothing left over and the first look at storage is fresh.
function VikaraImportDialog({ onClose, overview }: { onClose: () => void; overview: Overview }) {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(() => overview.activeImports.find((item) => item.kind === 'VIKARA')?.id ?? null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<{ message: string; runId?: string } | null>(null);
  const importer = useImportVikaras();
  const canceller = useCancelImportRun();

  const followed = useImportRun(runId);
  const found = runId ? (followed.data?.run ?? overview.activeImports.find((item) => item.id === runId)) : undefined;
  const run = found?.kind === 'VIKARA' ? found : undefined;
  const live = !!run && IMPORT_ACTIVE.includes(run.status);
  const previewing = !runId;

  const preview = useVikaraPreview(previewing);
  const plan = preview.data;

  // The chapters that have links to add are the ones ticked to begin with.
  useEffect(() => {
    if (plan) setPicked(new Set(plan.chapters.filter(hasWork).map((line) => line.chapter)));
  }, [plan]);

  // The database has changed once an import ends. The socket says so to the page; this covers it being down.
  const settled = useRef<string | null>(null);
  useEffect(() => {
    if (!run || IMPORT_ACTIVE.includes(run.status) || settled.current === run.id) return;
    settled.current = run.id;
    refreshAfterImport(queryClient);
  }, [run, queryClient]);

  const result = run?.result ?? null;
  const shown = previewing ? plan : result;
  const rows = shown?.chapters.filter((line) => line.found || line.error) ?? [];
  const withoutFile = shown?.chapters.filter((line) => !line.found && !line.error).length ?? 0;
  const problems = rows.filter(hasProblem);
  // Someone else queued one while this window was looking at the preview.
  const busyImport = previewing ? overview.activeImports.find((item) => item.kind === 'VIKARA') : undefined;

  const toImport = plan ? plan.chapters.filter((line) => picked.has(line.chapter) && hasWork(line)) : [];
  const willLink = toImport.reduce((n, line) => n + line.links, 0);

  const toggle = (chapter: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(chapter)) next.delete(chapter);
      else next.add(chapter);
      return next;
    });

  const follow = (id: string | null) => {
    setRunId(id);
    setError(null);
  };

  const submit = () => {
    setError(null);
    importer.mutate(
      { chapters: toImport.map((line) => line.chapter) },
      {
        onSuccess: (queued) => setRunId(queued.id),
        onError: (err) => {
          // Another vikara import got there first: the answer says which, so it can be opened.
          const details = err instanceof ApiRequestError ? (err.details as { runId?: string } | undefined) : undefined;
          setError({ message: failure(err), runId: details?.runId });
        },
      }
    );
  };

  const cancel = () => {
    if (!run || !confirm('Stop importing the vikara tags? The chapters already imported stay in the database.')) return;
    setError(null);
    canceller.mutate(run.id, { onError: (err) => setError({ message: failure(err) }) });
  };

  const previewError = preview.isError ? (preview.error instanceof ApiRequestError ? preview.error.message : 'The preview could not be worked out.') : null;
  const waiting = previewing && preview.isFetching;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent page className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import vikara tags from storage</DialogTitle>
          <DialogDescription>
            Links each Śrīmad-Bhāgavatam verse in the tag files to the vikaras it was marked with. A verse is matched by its book, canto, chapter and verse number. A verse that already has vikara links is left alone and nothing is ever removed. The work runs in the
            background, so this window can be closed while it works.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {busyImport && (
            <p className="flex gap-2 rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                A vikara import is already {busyImport.status === 'QUEUED' ? 'waiting for the worker' : 'running'}, so another cannot be started.{' '}
                <button type="button" className="font-medium underline underline-offset-2" onClick={() => follow(busyImport.id)}>
                  Open it
                </button>
              </span>
            </p>
          )}

          {runId && !run && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-6 text-sm text-muted-foreground">
              {followed.isError ? (
                <>
                  <AlertTriangle className="h-4 w-4" /> That import could not be found.
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading the import…
                </>
              )}
            </div>
          )}

          {run && <ImportRunView run={run} feed={followed.data?.feed ?? []} reopen="Open it again with Import from S3 to follow it." />}

          {waiting && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the tag files in storage and comparing them with the database… this can take a minute for the whole Bhagavatam.
            </div>
          )}

          {previewing && previewError && (
            <p role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {previewError}
            </p>
          )}

          {shown && !waiting && (
            <>
              {previewing ? <Summary result={shown} found={rows.length} /> : <Outcome result={shown} />}

              {rows.length === 0 ? (
                <p className="rounded-md border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                  {previewing ? 'No vikara tag file is saved in storage yet. Translate a chapter into Marathi first; the run writes the tags beside it.' : 'No chapter in this import had a tag file in storage.'}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewing && <TableHead className="w-10" />}
                        <TableHead>Chapter</TableHead>
                        <TableHead className="text-right" title="Verses in the tag file that are in the database">In storage</TableHead>
                        <TableHead className="text-right" title="Of those, the verses with at least one vikara named">Tagged</TableHead>
                        <TableHead className="text-right" title="Verses that help with none — the usual answer">None</TableHead>
                        <TableHead className="text-right" title={previewing ? 'Vikara links this import would add' : 'Vikara links added'}>{previewing ? 'To add' : 'Added'}</TableHead>
                        <TableHead className="text-right" title="Tagged verses that already have vikara links: left alone">Already linked</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((line) => (
                        <TableRow key={line.chapter} className={cn(previewing && !hasWork(line) && 'text-muted-foreground')}>
                          {previewing && (
                            <TableCell>
                              <Checkbox aria-label={`Import chapter ${chapterName(BOOK, line.chapter)}`} checked={picked.has(line.chapter) && hasWork(line)} disabled={!hasWork(line) || importer.isPending} onChange={() => toggle(line.chapter)} />
                            </TableCell>
                          )}
                          <TableCell className="font-medium tabular-nums">{chapterName(BOOK, line.chapter)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCount(line.inStorage)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCount(line.tagged)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCount(line.noTags)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCount(line.links)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCount(line.alreadyLinked)}</TableCell>
                          <TableCell className="text-xs">
                            <Notes line={line} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {withoutFile > 0 && rows.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatCount(withoutFile)} chapter{withoutFile === 1 ? ' has' : 's have'} no tag file in storage yet (not translated into Marathi, or translated before tags were kept apart).
                </p>
              )}

              {problems.length > 0 && (
                <ul className="space-y-1 rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-xs">
                  {problems.map((line) => (
                    <li key={line.chapter}>
                      <b>Chapter {chapterName(BOOK, line.chapter)}</b>
                      {line.error && <> — {line.error}</>}
                      {line.conflicts.length > 0 && (
                        <>
                          {' '}
                          — left alone because the file and the database disagree: {line.conflicts.slice(0, 3).map((c) => `${c.verseId} (${c.reason})`).join('; ')}
                          {line.conflicts.length > 3 && ` and ${line.conflicts.length - 3} more`}
                        </>
                      )}
                      {line.missing.length > 0 && (
                        <>
                          {' '}
                          — not in the database, so skipped: {line.missing.slice(0, 8).join(', ')}
                          {line.missing.length > 8 && ` and ${line.missing.length - 8} more`}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {previewing && rows.length > 0 && willLink === 0 && !previewError && <p className="text-sm text-success">Nothing to add: every tagged verse in storage already has its vikara links in the database.</p>}
            </>
          )}

          {error && (
            <p role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {error.message}{' '}
                {error.runId && (
                  <button type="button" className="font-medium underline underline-offset-2" onClick={() => follow(error.runId ?? null)}>
                    Open that import
                  </button>
                )}
              </span>
            </p>
          )}
        </div>

        <DialogFooter>
          {previewing ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={importer.isPending || preview.isFetching || !plan || toImport.length === 0 || !!busyImport}>
                {importer.isPending ? <Loader2 className="animate-spin" /> : <CloudDownload />}
                {importer.isPending ? 'Starting…' : toImport.length ? `Import ${plural(toImport.length, 'chapter')}` : 'Import'}
              </Button>
            </>
          ) : live && run ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button variant="destructive" onClick={cancel} disabled={canceller.isPending || run.cancelRequested}>
                {canceller.isPending ? <Loader2 className="animate-spin" /> : <Ban />}
                {run.cancelRequested ? 'Stopping…' : 'Cancel import'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => follow(null)}>
                Compare again
              </Button>
              <Button onClick={onClose}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Notes({ line }: { line: VikaraChapter }) {
  const notes = [
    line.error && 'Not imported',
    line.conflicts.length > 0 && `${line.conflicts.length} disagree`,
    line.missing.length > 0 && `${line.missing.length} not in database`,
    line.ignored > 0 && `${line.ignored} unknown name${line.ignored === 1 ? '' : 's'} ignored`,
  ].filter(Boolean) as string[];
  return <span className={cn(line.error && 'font-medium text-destructive')}>{notes.join(' · ')}</span>;
}

// What the server found in storage, before anything is written.
function Summary({ result, found }: { result: VikaraResult; found: number }) {
  if (found === 0) return null;
  const { totals } = result;
  return (
    <div className="space-y-1 text-sm">
      <p>
        <b>{formatCount(totals.inStorage)}</b> verses in {plural(found, 'tag file')}: <b>{formatCount(totals.tagged)}</b> with a vikara, <b>{formatCount(totals.noTags)}</b> with none.
      </p>
      <p>
        This import would add <b>{plural(totals.links, 'link')}</b> to <b>{plural(totals.verses, 'verse')}</b>
        {totals.alreadyLinked > 0 && <>; {plural(totals.alreadyLinked, 'tagged verse')} already {totals.alreadyLinked === 1 ? 'has' : 'have'} links and would be left alone</>}.
      </p>
    </div>
  );
}

// What the import did.
function Outcome({ result }: { result: VikaraResult }) {
  const { totals } = result;
  const failed = totals.failedChapters > 0;
  return (
    <div className={cn('flex gap-2 rounded-md border px-3 py-2 text-sm', failed ? 'border-warning/50 bg-warning/15' : 'border-success/30 bg-success/10')}>
      {failed ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
      <p>
        {failed ? `${plural(totals.failedChapters, 'chapter')} could not be imported and nothing of ${totals.failedChapters === 1 ? 'it was' : 'them was'} written. The rest went in: ` : 'Imported: '}
        <b>{plural(totals.links, 'link')}</b> on <b>{plural(totals.verses, 'verse')}</b>
        {totals.alreadyLinked > 0 && <>, {formatCount(totals.alreadyLinked)} already linked and left unchanged</>}.
      </p>
    </div>
  );
}
