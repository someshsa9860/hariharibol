import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, EyeOff, Languages, Loader2, MoreHorizontal, Pencil, Plus, RefreshCw, Send, Wifi, WifiOff, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { FilterSelect } from '@/components/table-filters';
import { EtiquetteItemDialog } from '@/components/etiquette-item-dialog';
import { EtiquetteRunPanel, StartEtiquetteDialog } from '@/components/etiquette-run';
import { ProgressBar, StatusBadge, formatCount, timeAgo } from '@/components/translation-bits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  STATUS_LABEL, STATUS_VARIANT, TABLE_ID, useCancelEtiquette, useEtiquetteLive, useEtiquetteOverview, useEtiquetteRun, useEtiquetteRuns,
  type EtiquetteOverview, type EtiquetteRow, type EtiquetteRun,
} from '@/lib/etiquette';
import { useDataTable } from '@/lib/use-table';
import { useSocketStatus } from '@/lib/socket';
import { cn, formatDateOnly } from '@/lib/utils';

// The page keeps no state of its own that matters: the tab, the open item, the language filter and the open run live in the
// URL, and everything else is the server's. A refresh, a shared link or a second tab shows the same thing.

const ROOT = '/api/admin/etiquette';

export function EtiquettePage() {
  const { hasPermission } = useAuth();
  const canTranslate = hasPermission('etiquette.translate');
  const [params, setParams] = useSearchParams();
  const overview = useEtiquetteOverview();
  const data = overview.data;
  const busy = (data?.active.length ?? 0) > 0;
  // Runs go one at a time in the order made: the oldest is on screen, the waiting ones after it are the queue.
  const queued = (data?.active ?? []).filter((run, i) => i > 0 && run.status === 'QUEUED');
  const current = (data?.active ?? []).filter((run) => !queued.includes(run));
  useEtiquetteLive();

  const [startFor, setStartFor] = useState<string | undefined>(undefined); // undefined = closed, '' = open with no language chosen

  const tab = params.get('tab') === 'translations' ? 'translations' : 'items';
  const item = params.get('item');
  const openRunId = params.get('run');

  const update = (changes: Record<string, string | null>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      return next;
    });

  return (
    <div>
      <PageHeader
        title="Devotee etiquette"
        description="One etiquette a day, pushed to every reader at 7:15 their time and kept in the app under Devotee etiquette. Items come from the seed file with their source; an item that disparages or harms faith in any god is Excluded — kept here, never shown or pushed. Translation runs work on the server — closing this page never stops one."
        actions={
          <>
            <LiveIndicator />
            <Button onClick={() => update({ item: 'new' })} disabled={!data}>
              <Plus /> New etiquette
            </Button>
          </>
        }
      />

      {overview.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {overview.isError && !data && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-destructive">The Devotee etiquette page could not be loaded.</p>
            <Button size="sm" variant="outline" onClick={() => overview.refetch()}>
              <RefreshCw /> Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-6">
          <Health data={data} hasActive={busy} />
          <Counts data={data} />

          <Tabs value={tab} onValueChange={(value) => update({ tab: value === 'translations' ? 'translations' : null })}>
            <TabsList>
              <TabsTrigger value="items">Etiquette</TabsTrigger>
              <TabsTrigger value="translations">
                Translations
                {busy && <Badge className="ml-2 px-1.5 py-0">{data.active.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="items">
              <Items overview={data} onOpen={(id) => update({ item: id })} />
            </TabsContent>

            <TabsContent value="translations" className="space-y-8">
              {busy && (
                <section className="space-y-3">
                  <h3 className="text-sm font-medium">In progress</h3>
                  {current.map((run) => (
                    <Card key={run.id}>
                      <CardContent className="pt-6">
                        <EtiquetteRunPanel run={run} feedHeight="max-h-52" />
                      </CardContent>
                    </Card>
                  ))}
                </section>
              )}
              <Queue runs={queued} canTranslate={canTranslate} />
              <Coverage overview={data} canTranslate={canTranslate} onTranslate={(language) => setStartFor(language)} />
              <History onOpen={(id) => update({ run: id })} />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {data && <EtiquetteItemDialog target={item} onTarget={(target) => update({ item: target })} overview={data} />}

      {data && startFor !== undefined && (
        <StartEtiquetteDialog
          key={startFor}
          open
          onOpenChange={(open) => !open && setStartFor(undefined)}
          overview={data}
          language={startFor}
          onStarted={() => update({ tab: 'translations' })}
        />
      )}

      <RunDialog id={openRunId} onClose={() => update({ run: null })} />
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

// ── Is it ready, and what is today's item ─────────────────────────────────────────────────────────────

function Health({ data, hasActive }: { data: EtiquetteOverview; hasActive: boolean }) {
  const { translation, delivery } = data;
  const provider = translation.providers.find((p) => p.id === translation.defaultProvider);
  const problems = [
    !translation.apiKeyConfigured && {
      fatal: true,
      text: `${provider?.keyEnv ?? 'The API key'} is not set on the server, so no translation can be written. Add it to the server .env for the api and the worker, then restart them. Reading, editing and the daily push do not need it.`,
    },
    translation.workerOnline === false && {
      fatal: false,
      text: hasActive
        ? 'No worker is connected, so nothing is progressing. The run carries on by itself as soon as a worker starts. The daily push is sent by the worker too.'
        : 'No worker is connected right now. The daily push and any translation run you start wait until one is.',
    },
    data.publishedTotal === 0 && { fatal: true, text: 'No etiquette is published, so there is nothing to push. Run npm run seed:etiquette in backend/, or publish an item below.' },
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
          Pushed daily at <span className="font-mono text-foreground">{delivery.time}</span> each reader&apos;s time
          {delivery.time !== delivery.defaultTime && <> (default {delivery.defaultTime})</>} ·{' '}
          <Link to="/settings" className="underline underline-offset-2 hover:text-foreground" title={`Setting ${delivery.settingKey}`}>
            change in Settings
          </Link>
        </span>
        <span>
          Today (UTC):{' '}
          {delivery.today ? (
            <span className="text-foreground">
              {delivery.today.title} <span className="text-muted-foreground">· {data.categories.find((c) => c.id === delivery.today?.category)?.name ?? delivery.today.category}</span>
            </span>
          ) : (
            'not picked yet — chosen when the first push of the day goes out'
          )}
        </span>
        {translation.apiKeyConfigured && (
          <span>
            Translations by {provider?.label} <span className="font-mono text-foreground">{translation.model}</span>
          </span>
        )}
      </p>
    </div>
  );
}

function Counts({ data }: { data: EtiquetteOverview }) {
  const { counts } = data;
  const cells = [
    { label: 'Shown to readers', value: counts.published, hint: 'Published — in the app and in the daily rotation' },
    { label: 'Drafts', value: counts.draft, hint: 'Held back — not shown or pushed until published' },
    { label: 'Excluded', value: counts.excluded, hint: 'Kept in the database, never shown or pushed — wording that harms faith in any god' },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cells.map((cell) => (
        <Card key={cell.label} title={cell.hint}>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold tabular-nums">{formatCount(cell.value)}</p>
            <p className="text-xs text-muted-foreground">{cell.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Etiquette ────────────────────────────────────────────────────────────────────────────────────────

function Items({ overview, onOpen }: { overview: EtiquetteOverview; onOpen: (id: string) => void }) {
  // The "Missing in…" filter needs two API params at once; the language is read here so `untranslated` follows it.
  const [params] = useSearchParams();
  const language = params.get('language') ?? '';
  const table = useDataTable<EtiquetteRow>({
    id: TABLE_ID,
    path: `${ROOT}/items`,
    filters: ['category', 'status', 'language'],
    params: { untranslated: language ? 'true' : undefined },
    defaultSort: { key: 'sortOrder', dir: 'asc' },
  });

  const setStatus = (rows: EtiquetteRow[], status: 'PUBLISHED' | 'DRAFT') => {
    // An excluded item is brought back one at a time, in its own dialog, with the confirmation that deserves.
    const movable = rows.filter((row) => row.status !== status && row.status !== 'EXCLUDED');
    if (movable.length === 0) return;
    table.runBulk(movable, status === 'PUBLISHED' ? 'Published' : 'Held back', (row) => api.post(`${ROOT}/items/${row.id}/status`, { status }));
  };

  const columns: Column<EtiquetteRow>[] = [
    {
      key: 'title',
      header: 'Etiquette',
      sort: 'title',
      fixed: true,
      csv: (row) => row.title,
      render: (row) => (
        <div className="max-w-md">
          <p className="font-medium">{row.title}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{row.summary}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sort: 'category',
      csv: (row) => row.category,
      render: (row) => <Badge variant="outline">{overview.categories.find((c) => c.id === row.category)?.name ?? row.category}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      sort: 'status',
      csv: (row) => STATUS_LABEL[row.status],
      render: (row) => (
        <div className="space-y-1">
          <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
          {row.status === 'EXCLUDED' && row.excludedReason && <p className="line-clamp-2 max-w-xs text-xs text-muted-foreground">{row.excludedReason}</p>}
        </div>
      ),
    },
    {
      key: 'translations',
      header: 'Translations',
      csv: (row) => row.translations.map((t) => t.language).join(' '),
      render: (row) => <LanguageChips row={row} overview={overview} />,
    },
    { key: 'author', header: 'Author', csv: (row) => row.author, render: (row) => row.author ?? '—' },
    { key: 'source', header: 'Source', csv: (row) => row.sourceName, defaultHidden: true, render: (row) => row.sourceName ?? '—' },
    { key: 'order', header: 'Order', sort: 'sortOrder', csv: (row) => row.sortOrder, defaultHidden: true, render: (row) => row.sortOrder },
    {
      key: 'edited',
      header: 'Edited by hand',
      csv: (row) => (row.isEdited ? 'Yes' : 'No'),
      defaultHidden: true,
      render: (row) => (row.isEdited ? <Badge variant="outline">Edited</Badge> : '—'),
    },
    { key: 'updated', header: 'Updated', sort: 'updatedAt', csv: (row) => row.updatedAt, defaultHidden: true, render: (row) => formatDateOnly(row.updatedAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Row actions" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onOpen(row.id)}>
              <Pencil className="mr-2 h-4 w-4" />
              Open
            </DropdownMenuItem>
            {row.status === 'DRAFT' && (
              <DropdownMenuItem onClick={() => setStatus([row], 'PUBLISHED')}>
                <Send className="mr-2 h-4 w-4" />
                Publish
              </DropdownMenuItem>
            )}
            {row.status === 'PUBLISHED' && (
              <DropdownMenuItem onClick={() => setStatus([row], 'DRAFT')}>
                <EyeOff className="mr-2 h-4 w-4" />
                Hold back as a draft
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <DataTable
      table={table}
      columns={columns}
      exportName="devotee-etiquette"
      searchPlaceholder="Search title or wording…"
      onRowClick={(row) => onOpen(row.id)}
      rowClassName={(row) => (row.status === 'EXCLUDED' ? 'bg-destructive/5' : undefined)}
      filters={
        <>
          <FilterSelect table={table} name="category" label="All categories" options={overview.categories.map((c) => ({ value: c.id, label: c.name }))} className="w-44" />
          <FilterSelect table={table} name="status" label="Any status" options={overview.statuses.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} className="w-36" />
          <FilterSelect table={table} name="language" label="Missing in…" options={overview.languages.map((l) => ({ value: l.code, label: `Missing in ${l.name}` }))} className="w-48" />
        </>
      }
      bulkActions={(rows) => (
        <>
          <Button variant="outline" size="sm" onClick={() => setStatus(rows, 'PUBLISHED')}>
            <Send className="h-4 w-4" />
            Publish
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStatus(rows, 'DRAFT')}>
            <EyeOff className="h-4 w-4" />
            Hold back
          </Button>
        </>
      )}
    />
  );
}

/** Which languages an item has: a code each, plain for an AI draft, outlined for one edited by hand, struck out when hidden. */
function LanguageChips({ row, overview }: { row: EtiquetteRow; overview: EtiquetteOverview }) {
  if (row.translations.length === 0) return <span className="text-xs text-muted-foreground">None</span>;
  const total = overview.languages.length;
  return (
    <div className="flex max-w-[16rem] flex-wrap items-center gap-1">
      {row.translations.map((t) => (
        <span
          key={t.language}
          title={`${overview.languages.find((l) => l.code === t.language)?.name ?? t.language}${t.isEdited ? ' · edited by hand' : ' · AI draft'}${t.isPublished ? '' : ' · hidden'}`}
          className={cn(
            'rounded border px-1 text-[11px] font-medium uppercase',
            t.isEdited ? 'border-primary/40 bg-primary/10' : 'bg-muted text-muted-foreground',
            !t.isPublished && 'line-through opacity-60'
          )}
        >
          {t.language}
        </span>
      ))}
      {row.translations.length < total && <span className="text-[11px] text-muted-foreground">{row.translations.length}/{total}</span>}
    </div>
  );
}

// ── Translations ─────────────────────────────────────────────────────────────────────────────────────

function Coverage({ overview, canTranslate, onTranslate }: { overview: EtiquetteOverview; canTranslate: boolean; onTranslate: (language: string) => void }) {
  const total = overview.publishedTotal;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">
        Languages <span className="font-normal text-muted-foreground">· of the {total} etiquette items shown to readers</span>
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
                      {language.translated} of {total} translated
                      {language.edited > 0 && <> · {language.edited} edited by hand</>}
                    </p>
                  </div>
                  {canTranslate && (
                    <Button size="sm" variant="outline" disabled={live || done} onClick={() => onTranslate(language.code)} title={live ? 'A run for this language is already going' : done ? 'Every shown item is translated' : undefined}>
                      <Languages /> {live ? 'Running' : language.translated > 0 && !done ? 'Finish' : 'Translate'}
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
        A translation is an AI draft until someone reads it; one saved by hand is never overwritten by a run. Open an item to edit or delete its translation in a language.
      </p>
    </section>
  );
}

function Queue({ runs, canTranslate }: { runs: EtiquetteRun[]; canTranslate: boolean }) {
  const cancel = useCancelEtiquette();
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

function History({ onOpen }: { onOpen: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const runs = useEtiquetteRuns(page, true);
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
                  <TableHead>Items</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Tokens in / out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.data.items.map((run: EtiquetteRun) => (
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
                    <TableCell className="font-mono text-xs">{run.model}</TableCell>
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
              <span className="text-muted-foreground">
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
  const run = useEtiquetteRun(id);
  if (!run.data) return <Skeleton className="h-48 w-full" />;
  return <EtiquetteRunPanel run={run.data.run} feedHeight="max-h-80" />;
}
