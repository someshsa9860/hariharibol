// "Import": copy a language's translated chapters from storage into the database, where the app reads them.
// A run works in storage one verse at a time; this is the step that publishes the result to the verses.
//
// The table is the server's own dry run — the same code as the import, writing nothing — so what it says a
// chapter would do is what the import then does. Chapters with something to change start ticked; the rest are
// shown but left alone, and importing twice is harmless either way.
//
// The import itself is a job in the worker, not part of the request: the button queues it and this dialog then
// follows that run — progress, a line for each chapter, Cancel — through the same live cache the translation
// runs use. Closing the window does not stop it, and opening the dialog for a language that is being imported
// follows that run instead of offering a second one.
//
// The Bhagavatam's vikara tags are not part of this: they have their own import (components/vikara-import-section.tsx),
// which shares the queue, the worker and `ImportRunView` below but is never started or followed from here.

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, CheckCircle2, CloudOff, Database, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label, Select } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiRequestError } from '@/lib/api';
import {
  chapterName,
  IMPORT_ACTIVE,
  refreshAfterImport,
  useCancelImportRun,
  useImportPreview,
  useImportRun,
  useImportTranslations,
  useNow,
  type BookId,
  type FeedLine,
  type ImportChapter,
  type ImportResult,
  type ImportRun,
  type AnyImportRun,
  type Overview,
} from '@/lib/translation';
import { cn, formatDate } from '@/lib/utils';
import { formatCount, ProgressBar, StatusBadge, timeAgo } from './translation-bits';
import { ActivityFeed } from './translation-run-panel';

const hasWork = (line: ImportChapter) => line.created + line.updated > 0;
const hasProblem = (line: ImportChapter) => !!line.error || line.conflicts.length > 0 || line.missing.length > 0;

const failure = (err: unknown) => (err instanceof ApiRequestError ? err.message : 'The request did not go through.');

// Mounted only while it is open, so every opening starts from the language that was clicked with nothing left
// over, and the first look at the database is for that language rather than for the last one.
export function ImportDialog({ onClose, overview, book, language: initial, canPublish }: { onClose: () => void; overview: Overview; book: BookId; language: string; canPublish: boolean }) {
  const { languages } = overview;
  const queryClient = useQueryClient();
  // Only the translation imports: the vikara import is the same queue's other job and has its own section.
  const liveFor = (code: string) => overview.activeImports.find((item): item is ImportRun => item.kind === 'TRANSLATION' && item.language === code && item.book === book);

  const [language, setLanguage] = useState(initial);
  const [publish, setPublish] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  // The import being followed. Null while the dialog is still working out what an import would do.
  const [runId, setRunId] = useState<string | null>(() => liveFor(initial)?.id ?? null);
  const [error, setError] = useState<{ message: string; runId?: string } | null>(null);
  const importer = useImportTranslations();
  const canceller = useCancelImportRun();

  const followed = useImportRun(runId);
  const found = runId ? (followed.data?.run ?? overview.activeImports.find((item) => item.id === runId)) : undefined;
  const run = found?.kind === 'TRANSLATION' ? found : undefined;
  const live = !!run && IMPORT_ACTIVE.includes(run.status);
  const previewing = !runId;

  const preview = useImportPreview(book, language, publish, previewing);
  const plan = preview.data;

  // The chapters that have something to change are the ones ticked to begin with.
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
  const withoutFile = shown?.chapters.filter((line) => !line.found && !line.error).map((line) => line.chapter) ?? [];
  const problems = rows.filter(hasProblem);
  const totals = shown?.totals;
  const name = languages.find((item) => item.code === language)?.name ?? language;
  const activeRun = overview.active.find((item) => item.language === language && item.book === book);
  // Someone else queued an import of this language while this window was looking at the preview.
  const busyImport = previewing ? liveFor(language) : undefined;
  const otherImport = error?.runId;

  const toImport = plan ? plan.chapters.filter((line) => picked.has(line.chapter) && hasWork(line)) : [];
  const willChange = toImport.reduce((n, line) => n + line.created + line.updated, 0);
  const willReplaceVisible = toImport.reduce((n, line) => n + line.replacedVisible, 0);

  const toggle = (chapter: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(chapter)) next.delete(chapter);
      else next.add(chapter);
      return next;
    });

  // Another language is another question: forget the answer to the last one, and follow its import if it has one going.
  const pickLanguage = (code: string) => {
    setLanguage(code);
    setRunId(liveFor(code)?.id ?? null);
    setPicked(new Set());
    setError(null);
  };

  const follow = (id: string | null) => {
    setRunId(id);
    setError(null);
  };

  const submit = () => {
    setError(null);
    importer.mutate(
      { language, book, chapters: toImport.map((line) => line.chapter), publish },
      {
        onSuccess: (queued) => setRunId(queued.id),
        onError: (err) => {
          // Another import of this language got there first: the answer says which, so it can be opened.
          const details = err instanceof ApiRequestError ? (err.details as { runId?: string } | undefined) : undefined;
          setError({ message: failure(err), runId: details?.runId });
        },
      }
    );
  };

  const cancel = () => {
    if (!run || !confirm(`Stop importing ${name}? The chapters already imported stay in the database.`)) return;
    setError(null);
    canceller.mutate(run.id, { onError: (err) => setError({ message: failure(err) }) });
  };

  const previewError = preview.isError ? (preview.error instanceof ApiRequestError ? preview.error.message : 'The preview could not be worked out.') : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent page className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import into the database</DialogTitle>
          <DialogDescription>
            Copies the translation, transliteration, word meanings and purport that were saved in storage into the verses, so the app can read them. Each verse is matched by its book, chapter and verse number. The copying runs in the
            background, so this window can be closed while it works.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="import-language">Language</Label>
              <Select id="import-language" className="w-full" value={language} disabled={importer.isPending} onChange={(e) => pickLanguage(e.target.value)}>
                {languages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name} — {item.endonym}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="import-publish">Visibility</Label>
              {canPublish ? (
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox
                    id="import-publish"
                    className="mt-0.5"
                    checked={run ? run.publish : publish}
                    disabled={importer.isPending || !previewing}
                    onChange={(e) => {
                      setPublish(e.target.checked);
                      setError(null);
                    }}
                  />
                  <span>
                    Make them visible to readers
                    <span className="block text-xs text-muted-foreground">Off: new translations are saved hidden until someone reviews them. Translations that are already visible stay visible either way.</span>
                  </span>
                </label>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {run?.publish ? 'This import makes the new translations visible to readers.' : 'New translations are saved hidden. Making them visible needs the verse.publish permission.'}
                </p>
              )}
            </div>
          </div>

          {busyImport && (
            <p className="flex gap-2 rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {name} is already being imported ({busyImport.status === 'QUEUED' ? 'waiting for the worker' : 'running'}), so another cannot be started.{' '}
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

          {run && <ImportRunView run={run} feed={followed.data?.feed ?? []} />}

          {previewing && preview.isFetching && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Comparing {name} in storage with the database…
            </div>
          )}

          {previewing && previewError && (
            <p role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {previewError}
            </p>
          )}

          {shown && totals && !(previewing && preview.isFetching) && (
            <>
              {previewing ? <Summary totals={totals} found={rows.length} /> : <Outcome result={shown} />}

              {rows.length === 0 ? (
                <p className="rounded-md border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
                  {previewing ? `Nothing is saved in storage for ${name} yet. Translate it first, then come back.` : 'No chapter in this import had anything saved in storage.'}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewing && <TableHead className="w-10" />}
                        <TableHead>Chapter</TableHead>
                        <TableHead className="text-right" title="Verses with a translation in the file">In storage</TableHead>
                        <TableHead className="text-right" title="Not in the database yet">New</TableHead>
                        <TableHead className="text-right" title="Already in the database and different: replaced by the file, same record">Replaced</TableHead>
                        <TableHead className="text-right" title="Already the same as the file: left alone">Same</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((line) => (
                        <TableRow key={line.chapter} className={cn(previewing && !hasWork(line) && 'text-muted-foreground')}>
                          {previewing && (
                            <TableCell>
                              <Checkbox aria-label={`Import chapter ${line.chapter}`} checked={picked.has(line.chapter) && hasWork(line)} disabled={!hasWork(line) || importer.isPending} onChange={() => toggle(line.chapter)} />
                            </TableCell>
                          )}
                          <TableCell className="font-medium tabular-nums">{chapterName(book, line.chapter)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCount(line.inStorage)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCount(line.created)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCount(line.updated)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCount(line.unchanged)}</TableCell>
                          <TableCell className="text-xs">
                            <Notes line={line} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {withoutFile.length > 0 && rows.length > 0 && <p className="text-xs text-muted-foreground">No translation saved yet for chapter{withoutFile.length === 1 ? '' : 's'} {withoutFile.map((id) => chapterName(book, id)).join(', ')}.</p>}

              {problems.length > 0 && (
                <ul className="space-y-1 rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-xs">
                  {problems.map((line) => (
                    <li key={line.chapter}>
                      <b>Chapter {chapterName(book, line.chapter)}</b>
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

              {previewing && willReplaceVisible > 0 && (
                <p className="flex gap-2 rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {formatCount(willReplaceVisible)} of the translations being replaced are visible to readers now, and change as soon as you import. A verse edited by hand on the Verses page is replaced by what is in storage.
                  </span>
                </p>
              )}

              {previewing && activeRun && (
                <p className="flex gap-2 rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />A {activeRun.status.toLowerCase()} run is still working on {name}. Verses it has not saved yet are not included — import again once it has finished.
                </p>
              )}

              {previewing && rows.length > 0 && willChange === 0 && !previewError && <p className="text-sm text-success">The database already matches storage for {name}. Nothing to import.</p>}
            </>
          )}

          {error && (
            <p role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {error.message}{' '}
                {otherImport && (
                  <button type="button" className="font-medium underline underline-offset-2" onClick={() => follow(otherImport)}>
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
                {importer.isPending ? <Loader2 className="animate-spin" /> : <Database />}
                {importer.isPending ? 'Starting…' : toImport.length ? `Import ${toImport.length} chapter${toImport.length === 1 ? '' : 's'}` : 'Import'}
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

// One import as the worker is doing it, or as it ended. The chapter table of a finished one is the dialog's.
// `reopen` finishes the sentence "Closing this window does not stop the import. …" with where to find it again.
export function ImportRunView({ run, feed, reopen = 'Open it again from the language card to follow it.' }: { run: AnyImportRun; feed: FeedLine[]; reopen?: string }) {
  const live = IMPORT_ACTIVE.includes(run.status);
  const now = useNow(live);
  const { progress } = run;
  const total = progress.total || run.chapters.length;
  const who = run.requestedBy ? `Started by ${run.requestedBy.name}` : 'Started';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <StatusBadge status={run.status} stalled={run.stalled} />
        {run.cancelRequested && run.status === 'RUNNING' && <Badge variant="warning">Stopping…</Badge>}
        <span className="text-xs text-muted-foreground">
          {who} · {live ? timeAgo(run.createdAt, now) : run.finishedAt ? `finished ${formatDate(run.finishedAt)}` : formatDate(run.createdAt)}
        </span>
      </div>

      {live && run.stalled && (
        <div role="alert" className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">The worker has not reported for a while</p>
            <p className="text-muted-foreground">
              {run.heartbeatAt ? `Last heard ${timeAgo(run.heartbeatAt, now)}. ` : ''}If the worker was restarted, the import carries on by itself within a couple of minutes; otherwise cancel it and start it again.
            </p>
          </div>
        </div>
      )}

      {live && (
        <>
          {run.statusMessage && <p className="text-sm text-muted-foreground">{run.statusMessage}</p>}
          <div className="space-y-1.5">
            <ProgressBar percent={progress.percent} className="h-2.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {formatCount(progress.done)} of {formatCount(total)} chapter{total === 1 ? '' : 's'}
              </span>
              <span>{progress.percent}%</span>
            </div>
          </div>
          <ActivityFeed lines={feed} className="max-h-64" />
          <p className="text-xs text-muted-foreground">Closing this window does not stop the import. {reopen}</p>
        </>
      )}

      {run.status === 'FAILED' && (
        <>
          <div role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <Ban className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{run.statusMessage ?? 'The import stopped before it finished.'}</span>
          </div>
          <ActivityFeed lines={feed} className="max-h-48" />
        </>
      )}

      {run.status === 'CANCELLED' && <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{run.statusMessage ?? 'Cancelled.'}</p>}
    </div>
  );
}

function Notes({ line }: { line: ImportChapter }) {
  const notes = [
    line.error && 'Not imported',
    line.conflicts.length > 0 && `${line.conflicts.length} disagree`,
    line.missing.length > 0 && `${line.missing.length} not in database`,
    line.noTranslation > 0 && `${line.noTranslation} untranslated`,
    line.replacedVisible > 0 && `${line.replacedVisible} visible now`,
  ].filter(Boolean) as string[];
  return <span className={cn(line.error && 'font-medium text-destructive')}>{notes.join(' · ')}</span>;
}

// What the server found in storage, before anything is written.
function Summary({ totals, found }: { totals: ImportResult['totals']; found: number }) {
  if (found === 0) return null;
  const versions = Object.entries(totals.versions);
  return (
    <div className="space-y-1 text-sm">
      <p>
        <b>{formatCount(totals.inStorage)}</b> verses in storage: <b>{formatCount(totals.created)}</b> new, <b>{formatCount(totals.updated)}</b> would be replaced, <b>{formatCount(totals.unchanged)}</b> already the same.
      </p>
      {versions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Made under version {versions.map(([version, count]) => `${version} (${formatCount(count)})`).join(', ')}. A replaced verse keeps its record and id; only the text changes.
        </p>
      )}
    </div>
  );
}

// What the import did.
function Outcome({ result }: { result: ImportResult }) {
  const { totals } = result;
  const failed = totals.failedChapters > 0;
  return (
    <div className={cn('flex gap-2 rounded-md border px-3 py-2 text-sm', failed ? 'border-warning/50 bg-warning/15' : 'border-success/30 bg-success/10')}>
      {failed ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
      <div className="space-y-1">
        <p>
          {failed ? `${totals.failedChapters} chapter${totals.failedChapters === 1 ? '' : 's'} could not be imported and nothing of ${totals.failedChapters === 1 ? 'it was' : 'them was'} written. The rest went in: ` : 'Imported: '}
          <b>{formatCount(totals.created)}</b> new, <b>{formatCount(totals.updated)}</b> replaced, <b>{formatCount(totals.unchanged)}</b> already the same.
        </p>
        {totals.created > 0 && !result.publish && <p className="text-xs text-muted-foreground">The new translations are saved hidden. Import again with visibility on to show them to readers.</p>}
      </div>
    </div>
  );
}
