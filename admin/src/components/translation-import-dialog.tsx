// "Import": copy a language's translated chapters from storage into the database, where the app reads them.
// A run works in storage one verse at a time; this is the step that publishes the result to the verses.
//
// The table is the server's own dry run — the same code as the import, writing nothing — so what it says a
// chapter would do is what the import then does. Chapters with something to change start ticked; the rest are
// shown but left alone, and importing twice is harmless either way.

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label, Select } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiRequestError } from '@/lib/api';
import { chapterName, useImportPreview, useImportTranslations, type ImportChapter, type ImportResult, type Overview, type BookId } from '@/lib/translation';
import { cn } from '@/lib/utils';
import { formatCount } from './translation-bits';

const hasWork = (line: ImportChapter) => line.created + line.updated > 0;
const hasProblem = (line: ImportChapter) => !!line.error || line.conflicts.length > 0 || line.missing.length > 0;

// Mounted only while it is open, so every opening starts from the language that was clicked with nothing left
// over, and the first look at the database is for that language rather than for the last one.
export function ImportDialog({ onClose, overview, book, language: initial, canPublish }: { onClose: () => void; overview: Overview; book: BookId; language: string; canPublish: boolean }) {
  const { languages } = overview;
  const [language, setLanguage] = useState(initial);
  const [publish, setPublish] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importer = useImportTranslations();

  // Another language, or visibility switched, is another question: forget the answer to the last one.
  const change = (apply: () => void) => {
    apply();
    setResult(null);
    setError(null);
    importer.reset();
  };

  const preview = useImportPreview(book, language, publish, !result);
  const plan = preview.data;

  // The chapters that have something to change are the ones ticked to begin with.
  useEffect(() => {
    if (plan) setPicked(new Set(plan.chapters.filter(hasWork).map((line) => line.chapter)));
  }, [plan]);

  const shown = result ?? plan;
  const rows = shown?.chapters.filter((line) => line.found || line.error) ?? [];
  const withoutFile = shown?.chapters.filter((line) => !line.found && !line.error).map((line) => line.chapter) ?? [];
  const problems = rows.filter(hasProblem);
  const totals = shown?.totals;
  const name = languages.find((item) => item.code === language)?.name ?? language;
  const activeRun = overview.active.find((run) => run.language === language && run.book === book);

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

  const submit = () => {
    setError(null);
    importer.mutate(
      { language, book, chapters: toImport.map((line) => line.chapter), publish },
      {
        onSuccess: setResult,
        onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'The request did not go through.'),
      }
    );
  };

  const previewError = preview.isError ? (preview.error instanceof ApiRequestError ? preview.error.message : 'The preview could not be worked out.') : null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import into the database</DialogTitle>
          <DialogDescription>
            Copies the translation, transliteration, word meanings and purport that were saved in storage into the verses, so the app can read them. Each verse is matched by its book, chapter and verse number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="import-language">Language</Label>
              <Select id="import-language" className="w-full" value={language} disabled={importer.isPending} onChange={(e) => change(() => setLanguage(e.target.value))}>
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
                  <Checkbox id="import-publish" className="mt-0.5" checked={publish} disabled={importer.isPending} onChange={(e) => change(() => setPublish(e.target.checked))} />
                  <span>
                    Make them visible to readers
                    <span className="block text-xs text-muted-foreground">Off: new translations are saved hidden until someone reviews them. Translations that are already visible stay visible either way.</span>
                  </span>
                </label>
              ) : (
                <p className="text-xs text-muted-foreground">New translations are saved hidden. Making them visible needs the verse.publish permission.</p>
              )}
            </div>
          </div>

          {preview.isFetching && !result && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Comparing {name} in storage with the database…
            </div>
          )}

          {previewError && !result && (
            <p role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {previewError}
            </p>
          )}

          {shown && totals && !(preview.isFetching && !result) && (
            <>
              {result ? <Outcome result={result} /> : <Summary totals={totals} found={rows.length} />}

              {rows.length === 0 ? (
                <p className="rounded-md border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">Nothing is saved in storage for {name} yet. Translate it first, then come back.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {!result && <TableHead className="w-10" />}
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
                        <TableRow key={line.chapter} className={cn(!result && !hasWork(line) && 'text-muted-foreground')}>
                          {!result && (
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

              {!result && willReplaceVisible > 0 && (
                <p className="flex gap-2 rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {formatCount(willReplaceVisible)} of the translations being replaced are visible to readers now, and change as soon as you import. A verse edited by hand on the Verses page is replaced by what is in storage.
                  </span>
                </p>
              )}

              {!result && activeRun && (
                <p className="flex gap-2 rounded-md border border-warning/50 bg-warning/15 px-3 py-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />A {activeRun.status.toLowerCase()} run is still working on {name}. Verses it has not saved yet are not included — import again once it has finished.
                </p>
              )}

              {!result && rows.length > 0 && willChange === 0 && !previewError && <p className="text-sm text-success">The database already matches storage for {name}. Nothing to import.</p>}
            </>
          )}

          {error && (
            <p role="alert" className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={submit} disabled={importer.isPending || preview.isFetching || !plan || toImport.length === 0}>
              {importer.isPending ? <Loader2 className="animate-spin" /> : <Database />}
              {importer.isPending ? 'Importing…' : toImport.length ? `Import ${toImport.length} chapter${toImport.length === 1 ? '' : 's'}` : 'Import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
