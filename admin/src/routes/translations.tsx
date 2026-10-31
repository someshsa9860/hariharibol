import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Database, Languages, Loader2, Plus, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImportDialog } from '@/components/translation-import-dialog';
import { StartDialog } from '@/components/translation-start-dialog';
import { TranslationOutput } from '@/components/translation-output';
import { VikaraSection } from '@/components/vikara-import-section';
import { RunPanel } from '@/components/translation-run-panel';
import { ProgressBar, ScoreMix, StatusBadge, describeChapters, formatCount, formatUsd, timeAgo } from '@/components/translation-bits';
import { useAuth } from '@/lib/auth';
import { useSocketStatus } from '@/lib/socket';
import {
  DEFAULT_BOOK,
  cantoOf,
  isBook,
  providerName,
  refreshCoverage,
  useCoverage,
  useImports,
  useOverview,
  useRun,
  useRuns,
  useTranslationLive,
  type BookId,
  type BookInfo,
  type Coverage,
  type ImportRun,
  type ImportStatus,
  type Overview,
  type Run,
} from '@/lib/translation';
import { cn } from '@/lib/utils';

// The page keeps no state of its own that matters: what is open (tab, run, language, chapter, verse) lives
// in the URL, and everything else is the server's. A refresh, a shared link or a second tab shows the same thing.

export function TranslationsPage() {
  const { hasPermission } = useAuth();
  const canRun = hasPermission('translation.run');
  const canImport = hasPermission('translation.import');
  const canPublish = hasPermission('verse.publish');
  const [params, setParams] = useSearchParams();
  const overview = useOverview();
  const bookParam = params.get('book');
  const bookId: BookId = isBook(bookParam) ? bookParam : DEFAULT_BOOK;
  const coverage = useCoverage(bookId);
  const imports = useImports(bookId);
  useTranslationLive();

  const [startFor, setStartFor] = useState<{ language: string | null } | null>(null);
  const [importFor, setImportFor] = useState<string | null>(null);

  const tab = params.get('tab') === 'output' ? 'output' : 'runs';
  const openRunId = params.get('run');

  const update = (changes: Record<string, string | null>, replace = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace }
    );

  const openOutput = (book: BookId, language: string, chapter: number, verseId?: string) =>
    update({ tab: 'output', run: null, book: book === DEFAULT_BOOK ? null : book, lang: language, chapter: String(chapter), verse: verseId ?? null });
  const pickBook = (book: BookId) => update({ book: book === DEFAULT_BOOK ? null : book, run: null, lang: null, chapter: null, verse: null });
  const openRun = (id: string | null) => update({ run: id });

  const data = overview.data;
  const book: BookInfo | undefined = data?.books.find((b) => b.id === bookId) ?? data?.books[0];
  const activeHere = data && book ? data.active.filter((run) => run.book === book.id) : [];

  return (
    <div>
      <PageHeader
        title="Translations"
        description="Claude or OpenAI translates Prabhupāda's Bhagavad-gītā and Śrīmad-Bhāgavatam into other languages. Both books can be translated at the same time. Runs work on the server — closing or refreshing this page never stops one."
        actions={
          <>
            <LiveIndicator />
            {canRun && (
              <Button onClick={() => setStartFor({ language: null })} disabled={!data}>
                <Plus /> New translation
              </Button>
            )}
          </>
        }
      />

      {overview.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full" />
            ))}
          </div>
        </div>
      )}

      {overview.isError && !data && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-destructive">The translations page could not be loaded.</p>
            <Button size="sm" variant="outline" onClick={() => overview.refetch()}>
              <RefreshCw /> Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {data && book && (
        <div className="space-y-6">
          <Health settings={data.settings} hasActive={data.active.length + data.activeImports.length > 0} />

          <div className="grid gap-2 sm:grid-cols-2" role="tablist" aria-label="Book">
            {data.books.map((item) => {
              // Translation runs and imports into the database are both work the worker is doing for this book.
              const running = [...data.active.filter((run) => run.book === item.id), ...data.activeImports.filter((job) => job.book === item.id)];
              const selected = item.id === book.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => pickBook(item.id)}
                  className={cn('flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors', selected ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'bg-card hover:bg-accent')}
                >
                  <span>
                    <span className="block font-semibold">{item.title}</span>
                    <span className="block text-xs text-muted-foreground">{item.id === 'srimad-bhagavatam' ? '12 cantos · 335 chapters' : '18 chapters'}</span>
                  </span>
                  {running.length > 0 && (
                    <Badge variant={running.some((run) => run.status === 'RUNNING') ? 'default' : 'outline'} className="shrink-0">
                      {running.length} active
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          <Tabs value={tab} onValueChange={(value) => update({ tab: value === 'output' ? 'output' : null })}>
            <TabsList>
              <TabsTrigger value="runs">
                Runs
                {activeHere.length > 0 && <Badge className="ml-2 px-1.5 py-0">{activeHere.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="output">Output</TabsTrigger>
            </TabsList>

            <TabsContent value="runs" className="space-y-8">
              {activeHere.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-sm font-medium">In progress — {book.title}</h3>
                  {activeHere.map((run) => (
                    <Card key={run.id}>
                      <CardContent className="pt-6">
                        <RunPanel run={run} chaptersInBook={book.chapters.length} onOpenOutput={openOutput} />
                      </CardContent>
                    </Card>
                  ))}
                </section>
              )}

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Languages</h3>
                  <RefreshCoverage book={book.id} recount={coverage.data?.recounting ? (coverage.data.recount ?? { done: 0, total: 0 }) : null} />
                </div>
                <LanguageGrid
                  overview={data}
                  book={book}
                  coverage={coverage.data}
                  imports={imports.data}
                  loading={coverage.isLoading}
                  canRun={canRun}
                  canImport={canImport}
                  onStart={(language) => setStartFor({ language })}
                  onImport={setImportFor}
                  onOpenRun={openRun}
                  onOpenOutput={openOutput}
                />
              </section>

              {/* The Bhagavatam's vikara tags: the same worker queue as the imports above, but a different job and never a translation. */}
              {book.id === 'srimad-bhagavatam' && <VikaraSection overview={data} canImport={canImport} />}

              <History overview={data} book={book} onOpen={openRun} />
            </TabsContent>

            <TabsContent value="output">
              <TranslationOutput
                book={book.id}
                overview={data}
                coverage={coverage.data}
                selection={{
                  language: params.get('lang'),
                  chapter: params.get('chapter') ? Number(params.get('chapter')) : null,
                  verseId: params.get('verse'),
                }}
                onSelect={(next) =>
                  update(
                    {
                      ...('language' in next && { lang: next.language ?? null }),
                      ...('chapter' in next && { chapter: next.chapter ? String(next.chapter) : null }),
                      ...('verseId' in next && { verse: next.verseId ?? null }),
                    },
                    true
                  )
                }
                liveRun={(params.get('lang') ? activeHere.find((run) => run.language === params.get('lang')) : activeHere[0]) ?? undefined}
              />
            </TabsContent>
          </Tabs>

          <StartDialog
            open={startFor !== null}
            onOpenChange={(open) => !open && setStartFor(null)}
            overview={data}
            book={book}
            language={startFor?.language ?? null}
            onStarted={() => update({ tab: null })}
            onOpenRun={openRun}
          />
          {importFor && <ImportDialog onClose={() => setImportFor(null)} overview={data} book={book.id} language={importFor} canPublish={canPublish} />}
        </div>
      )}

      <RunDialog id={openRunId} books={data?.books ?? []} onClose={() => openRun(null)} onOpenOutput={openOutput} />
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

function RefreshCoverage({ book, recount }: { book: BookId; recount?: { done: number; total: number } | null }) {
  const queryClient = useQueryClient();
  const [starting, setStarting] = useState(false);
  const busy = starting || !!recount;
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      title="Counts are kept in the database; this counts the saved files in storage again, in the background"
      onClick={async () => {
        setStarting(true);
        try {
          await refreshCoverage(queryClient, book);
        } finally {
          setStarting(false);
        }
      }}
    >
      <RefreshCw className={cn(busy && 'animate-spin')} /> {recount?.total ? `Counting ${recount.done}/${recount.total}` : busy ? 'Counting…' : 'Recount'}
    </Button>
  );
}

// ── What is wrong before anything is started ─────────────────────────────────────────────────────────

function Health({ settings, hasActive }: { settings: Overview['settings']; hasActive: boolean }) {
  const problems = [
    !settings.apiKeyConfigured && { fatal: true, text: `No AI provider has an API key on the server (${settings.providers.map((p) => p.keyEnv).join(' or ')}), so nothing can be translated. Add one to the server .env for the api and worker, then restart them.` },
    ...settings.providers.filter((p) => !p.apiKeyConfigured && settings.apiKeyConfigured).map((p) => ({ fatal: false, text: `${p.label} is not available: ${p.keyEnv} is not set on the server.` })),
    !settings.storage.ok && { fatal: true, text: `The translations bucket cannot be used: ${settings.storage.error ?? 'unknown problem'}. The server reads and writes the app's own bucket (S3_BUCKET), so check that and its AWS credentials.` },
    settings.versionError && { fatal: true, text: settings.versionError },
    !settings.workerOnline && {
      fatal: false,
      text: hasActive
        ? 'No worker is connected, so nothing is progressing. What is queued waits and carries on by itself as soon as a worker starts.'
        : 'No worker is connected right now. A run or an import you start will wait in the queue until one is.',
    },
  ].filter(Boolean) as { fatal: boolean; text: string }[];

  if (problems.length === 0) {
    return (
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Ready
        </span>
        <span>
          {settings.providers.filter((p) => p.apiKeyConfigured).map((p) => `${p.label} ${p.defaultModel}`).join(' · ')}
        </span>
        <span>
          Version <span className="font-mono text-foreground">{settings.version}</span>
        </span>
        {settings.storage.describe && <span>Saving to {settings.storage.describe}</span>}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {problems.map((problem) => (
        <p
          key={problem.text}
          role={problem.fatal ? 'alert' : 'status'}
          className={cn('flex gap-2 rounded-md border px-3 py-2 text-sm', problem.fatal ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-warning/50 bg-warning/15')}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {problem.text}
        </p>
      ))}
    </div>
  );
}

// ── One card per language ────────────────────────────────────────────────────────────────────────────

function LanguageGrid({
  overview,
  book,
  coverage,
  imports,
  loading,
  canRun,
  canImport,
  onStart,
  onImport,
  onOpenRun,
  onOpenOutput,
}: {
  overview: Overview;
  book: BookInfo;
  coverage: Coverage | undefined;
  imports: ImportStatus | undefined;
  loading: boolean;
  canRun: boolean;
  canImport: boolean;
  onStart: (language: string) => void;
  onImport: (language: string) => void;
  onOpenRun: (id: string) => void;
  onOpenOutput: (book: BookId, language: string, chapter: number) => void;
}) {
  const isSB = book.id === 'srimad-bhagavatam';
  // The Gita gets a box per chapter; the Bhagavatam, with 335, gets one per canto.
  const boxes = isSB ? Array.from({ length: 12 }, (_, i) => i + 1) : book.chapters.map((c) => c.id);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {overview.languages.map((language) => {
        const stats = coverage?.languages.find((item) => item.code === language.code);
        const run = overview.active.find((item) => item.language === language.code && item.book === book.id);
        // The copy into the database, which the worker does apart from the translating.
        const importing = overview.activeImports.find((item): item is ImportRun => item.kind === 'TRANSLATION' && item.language === language.code && item.book === book.id);
        const total = coverage?.total ?? 0;
        const percent = total && stats ? (stats.saved / total) * 100 : 0;
        const firstChapter = stats?.chapters.find((item) => item.saved > 0)?.chapter ?? book.chapters[0].id;
        // Everything is translated under the version a new run would use (or by a person): a run would find nothing to do.
        const upToDate = !!stats && total > 0 && stats.upToDate >= total;
        const outdated = stats ? stats.saved - stats.upToDate : 0;
        const inDatabase = imports?.languages.find((item) => item.code === language.code);

        return (
          <Card key={language.code} className={cn('h-full', (run || importing) && 'ring-1 ring-primary/40')}>
            <CardContent className="flex h-full flex-col gap-3 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold leading-tight">{language.name}</p>
                  <p className="text-lg text-muted-foreground" lang={language.code}>
                    {language.endonym}
                  </p>
                </div>
                {run && <StatusBadge status={run.status} stalled={run.stalled} />}
              </div>

              {loading && !stats ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-semibold tabular-nums">
                        {formatCount(stats?.saved ?? 0)} <span className="font-normal text-muted-foreground">of {formatCount(total)} verses</span>
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">{Math.round(percent)}%</span>
                    </div>
                    <ProgressBar percent={percent} tone={percent >= 100 ? 'success' : 'primary'} />
                  </div>

                  <div className="flex gap-0.5" title={isSB ? 'Cantos 1 to 12 — the fuller the box, the more of the canto is translated' : 'Chapters 1 to 18 — the fuller the box, the more of the chapter is translated'}>
                    {boxes.map((chapter) => {
                      const members = isSB ? (stats?.chapters.filter((c) => cantoOf(c.chapter) === chapter) ?? []) : (stats?.chapters.filter((c) => c.chapter === chapter) ?? []);
                      const item = members.length ? { saved: members.reduce((n, c) => n + c.saved, 0), total: members.reduce((n, c) => n + c.total, 0) } : undefined;
                      const fraction = item && item.total ? item.saved / item.total : 0;
                      const label = isSB ? `Canto ${chapter}` : `Chapter ${chapter}`;
                      return (
                        <span key={chapter} className="relative h-5 flex-1 overflow-hidden rounded-[3px] bg-muted" title={item ? `${label}: ${item.saved} of ${item.total}` : label}>
                          <span className={cn('absolute inset-x-0 bottom-0', fraction >= 1 ? 'bg-success' : 'bg-primary/60')} style={{ height: `${fraction * 100}%` }} />
                        </span>
                      );
                    })}
                  </div>

                  {stats && stats.saved > 0 ? <ScoreMix scores={stats.scores} unscored={stats.scores.unscored} /> : <p className="text-xs text-muted-foreground">Nothing translated yet.</p>}

                  {upToDate ? (
                    <p className="flex items-center gap-1.5 text-xs text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Up to date · version <span className="font-mono">{coverage?.version}</span>
                    </p>
                  ) : (
                    outdated > 0 && (
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        {formatCount(outdated)} verse{outdated === 1 ? '' : 's'} translated under an older version — a new run translates {outdated === 1 ? 'it' : 'them'} again.
                      </p>
                    )
                  )}

                  {stats && stats.saved > 0 && <InDatabase status={inDatabase} saved={stats.saved} version={imports?.version ?? null} />}

                  {run && (
                    <p className="text-xs text-muted-foreground">
                      This run: {run.progress.done}/{run.progress.total} verses ({run.progress.percent}%)
                      {run.status === 'PAUSED' && ' · paused'}
                    </p>
                  )}

                  {importing && (
                    <div className="space-y-1" role="status">
                      <p className={cn('text-xs', importing.stalled ? 'text-destructive' : 'text-muted-foreground')}>
                        {importing.status === 'QUEUED'
                          ? 'Import into the database: waiting for the worker'
                          : `Importing into the database: ${importing.progress.done}/${importing.progress.total || importing.chapters.length} chapters (${importing.progress.percent}%)`}
                        {importing.cancelRequested && ' · stopping'}
                        {importing.stalled && ' · the worker has not reported for a while'}
                      </p>
                      {importing.status === 'RUNNING' && <ProgressBar percent={importing.progress.percent} className="h-1.5" />}
                    </div>
                  )}
                </>
              )}

              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                {run ? (
                  <Button size="sm" onClick={() => onOpenRun(run.id)}>
                    Open run
                  </Button>
                ) : (
                  canRun && (
                    <Button
                      size="sm"
                      onClick={() => onStart(language.code)}
                      disabled={upToDate}
                      title={upToDate ? `Every verse is already translated under version ${coverage?.version}. Set a new TRANSLATION_VERSION to translate it again.` : undefined}
                    >
                      <Languages /> {upToDate ? 'Up to date' : 'Translate'}
                    </Button>
                  )
                )}
                {canImport && importing && (
                  // The same dialog: opened for a language that is being imported, it follows that import.
                  <Button size="sm" variant="outline" onClick={() => onImport(language.code)} title="Follow the import into the database, or cancel it">
                    <Database /> Open import
                  </Button>
                )}
                {canImport && !importing && !run && (
                  <Button size="sm" variant="outline" disabled={!stats?.saved} onClick={() => onImport(language.code)} title="Copy the translated chapters from storage into the database">
                    <Database /> Import
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={!stats?.saved} onClick={() => onOpenOutput(book.id, language.code, firstChapter)}>
                  View output
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// What the database holds from Claude's runs for this language, so "translated" and "imported" are not confused.
function InDatabase({ status, saved, version }: { status: ImportStatus['languages'][number] | undefined; saved: number; version: string | null }) {
  if (!status || status.rows === 0) {
    return <p className="text-xs text-amber-800 dark:text-amber-300">Not in the database yet — Import puts it there.</p>;
  }
  const older = version ? status.rows - status.current : 0;
  return (
    <p className="text-xs text-muted-foreground" title={status.updatedAt ? `Last changed ${timeAgo(status.updatedAt)}` : undefined}>
      <span className="font-medium text-foreground">{formatCount(status.rows)}</span> in the database, <span className="font-medium text-foreground">{formatCount(status.published)}</span> visible to readers
      {older > 0 && <> · {formatCount(older)} from an older version</>}
      {status.rows < saved && <> · {formatCount(saved - status.rows)} saved but not imported</>}
    </p>
  );
}

// ── Past and present runs ────────────────────────────────────────────────────────────────────────────

const STATUSES = ['QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;

function History({ overview, book, onOpen }: { overview: Overview; book: BookInfo; onOpen: (id: string) => void }) {
  const [status, setStatus] = useState('');
  const [language, setLanguage] = useState('');
  const [page, setPage] = useState(1);
  const runs = useRuns({ status: status || undefined, language: language || undefined, book: book.id, page });

  const filter = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">All runs — {book.title}</h3>
        <div className="flex gap-2">
          <Select value={language} onChange={filter(setLanguage)} aria-label="Language" className="h-8 text-xs">
            <option value="">Every language</option>
            {overview.languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={filter(setStatus)} aria-label="Status" className="h-8 text-xs">
            <option value="">Any status</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {item.charAt(0) + item.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Language</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Chapters</TableHead>
              <TableHead className="min-w-40">Progress</TableHead>
              <TableHead title="Verses that scored 3 / 2 / 1">Scores 3·2·1</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : runs.data?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {status || language ? 'No runs match.' : 'No translation has been run yet.'}
                </TableCell>
              </TableRow>
            ) : (
              runs.data?.items.map((run) => <HistoryRow key={run.id} run={run} chapters={book.chapters.length} onOpen={onOpen} />)
            )}
          </TableBody>
        </Table>
      </div>

      {runs.data && runs.data.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {runs.data.page} of {runs.data.totalPages} · {runs.data.total} runs
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= runs.data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function HistoryRow({ run, chapters, onOpen }: { run: Run; chapters: number; onOpen: (id: string) => void }) {
  return (
    <TableRow className="cursor-pointer" onClick={() => onOpen(run.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(run.id)}>
      <TableCell>
        <span className="font-medium">{run.languageName}</span> <span className="text-muted-foreground" lang={run.language}>{run.endonym}</span>
      </TableCell>
      <TableCell>
        <StatusBadge status={run.status} stalled={run.stalled} />
      </TableCell>
      <TableCell className="text-muted-foreground">{describeChapters(run.chapters, chapters, run.book)}</TableCell>
      <TableCell>
        <div className="space-y-1">
          <ProgressBar percent={run.progress.percent} tone={run.status === 'COMPLETED' ? 'success' : run.status === 'FAILED' ? 'destructive' : run.status === 'PAUSED' ? 'warning' : 'primary'} className="h-1.5" />
          <span className="text-xs tabular-nums text-muted-foreground">
            {run.progress.done}/{run.progress.total}
          </span>
        </div>
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">
        {run.scores[3]} · {run.scores[2]} · <span className={cn(run.scores[1] > 0 && 'font-medium text-amber-700 dark:text-amber-400')}>{run.scores[1]}</span>
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{run.lanes && run.lanes.length > 1 ? `${run.lanes.length} models` : `${providerName(run.provider)} · ${run.model}`}</TableCell>
      <TableCell className="tabular-nums">{formatUsd(run.usage.costUsd)}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{timeAgo(run.createdAt)}</TableCell>
    </TableRow>
  );
}

// A run opened by link (?run=…) is fetched on its own, so it is there after a refresh and in a new tab.
function RunDialog({ id, books, onClose, onOpenOutput }: { id: string | null; books: BookInfo[]; onClose: () => void; onOpenOutput: (book: BookId, language: string, chapter: number, verseId?: string) => void }) {
  const run = useRun(id);
  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent page className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Translation run</DialogTitle>
          <DialogDescription>Everything about this run, as the server has it.</DialogDescription>
        </DialogHeader>
        {run.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : run.isError || !run.data ? (
          <p className="text-sm text-destructive">This run could not be found.</p>
        ) : (
          <RunPanel run={run.data.run} chaptersInBook={books.find((b) => b.id === run.data.run.book)?.chapters.length ?? 18} onOpenOutput={onOpenOutput} feedHeight="max-h-80" />
        )}
      </DialogContent>
    </Dialog>
  );
}
