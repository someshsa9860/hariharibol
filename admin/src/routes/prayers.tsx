import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { EyeOff, MoreHorizontal, Pencil, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { FilterSelect } from '@/components/table-filters';
import { PrayerDialog } from '@/components/prayer-dialog';
import { PrayerTranslations } from '@/components/prayer-translation-section';
import { formatCount } from '@/components/translation-bits';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  STATUS_LABEL, STATUS_VARIANT, TABLE_ID, categoriesOf, categoryName, keys, languageName, usePrayerOverview, usePrayersLive,
  type PrayerOverview, type PrayerRow,
} from '@/lib/prayers';
import { useDataTable } from '@/lib/use-table';
import { formatDateOnly } from '@/lib/utils';

// The page keeps no state of its own that matters: the tab, the open prayer and the run being read live in the URL, and
// everything else is the server's. A refresh, a shared link or a second tab shows the same thing.

const ROOT = '/api/admin/prayers';

export function PrayersPage() {
  const { hasPermission } = useAuth();
  const canTranslate = hasPermission('prayer.translate');
  const [params, setParams] = useSearchParams();
  const overview = usePrayerOverview();
  const data = overview.data;
  usePrayersLive();

  // The Translations tab is drawn only for someone who may use it; a pasted `?tab=translations` falls back to the list.
  const tab = canTranslate && params.get('tab') === 'translations' ? 'translations' : 'items';
  const item = params.get('item');

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
        title="Prayers"
        description="Stotras, aartis and prayers readers read in the app in their own script, one verse at a time. A prayer is written once in its original script with an English title and meaning; its other languages are the spelling of the verses in another script (by a rule, or written by a run) and the translated title, summary and meanings. Translation runs work on the server — closing this page never stops one."
        actions={
          <Button onClick={() => update({ item: 'new' })} disabled={!data}>
            <Plus /> New prayer
          </Button>
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
            <p className="text-sm text-destructive">The Prayers page could not be loaded.</p>
            <Button size="sm" variant="outline" onClick={() => overview.refetch()}>
              <RefreshCw /> Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-6">
          <Counts data={data} />

          {canTranslate ? (
            <Tabs value={tab} onValueChange={(value) => update({ tab: value === 'translations' ? 'translations' : null })}>
              <TabsList>
                <TabsTrigger value="items">Prayers</TabsTrigger>
                <TabsTrigger value="translations">
                  Translations
                  {data.active.length > 0 && <Badge className="ml-2 px-1.5 py-0">{data.active.length}</Badge>}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="items">
                <Items overview={data} onOpen={(id) => update({ item: id })} />
              </TabsContent>
              <TabsContent value="translations">
                <PrayerTranslations canTranslate />
              </TabsContent>
            </Tabs>
          ) : (
            <Items overview={data} onOpen={(id) => update({ item: id })} />
          )}
        </div>
      )}

      {data && (
        <PrayerDialog
          target={item}
          onTarget={(target) => update({ item: target })}
          overview={data}
          canTranslate={canTranslate}
          onTranslate={(language) => update({ item: null, tab: 'translations', translate: language })}
        />
      )}
    </div>
  );
}

// ── Numbers ──────────────────────────────────────────────────────────────────────────────────────

function Counts({ data }: { data: PrayerOverview }) {
  const { counts } = data;
  const cells = [
    { label: 'Shown to readers', value: counts.published, hint: 'Published — in the app, and translated by a run' },
    { label: 'Drafts', value: counts.draft, hint: 'Held back — not shown, and skipped by a run, until published' },
    { label: 'Verses', value: counts.verses, hint: 'Across every prayer, drafts included' },
  ];
  const withPrayers = data.categories.filter((c) => c.total > 0);
  return (
    <div className="space-y-3">
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
      {withPrayers.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {withPrayers.map((c) => (
            <span key={c.id}>
              {c.name} <span className="tabular-nums text-foreground">{c.published}</span>
              {c.total > c.published && <span className="tabular-nums"> of {c.total}</span>}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

// ── Prayers ────────────────────────────────────────────────────────────────────────────────────

function Items({ overview, onOpen }: { overview: PrayerOverview; onOpen: (id: string) => void }) {
  const queryClient = useQueryClient();
  const table = useDataTable<PrayerRow>({
    id: TABLE_ID,
    path: `${ROOT}/items`,
    filters: ['category', 'status'],
    defaultSort: { key: 'sortOrder', dir: 'asc' },
  });
  const languageTotal = overview.languages.filter((l) => l.code !== 'en').length;

  // The table refreshes itself after a bulk run; the counts above it and the coverage cards are the overview's, so ask for those too.
  const run = async (rows: PrayerRow[], label: string, action: (row: PrayerRow) => Promise<unknown>) => {
    await table.runBulk(rows, label, action);
    void queryClient.invalidateQueries({ queryKey: keys.overview });
  };
  const setStatus = (rows: PrayerRow[], status: 'PUBLISHED' | 'DRAFT') => {
    const movable = rows.filter((row) => row.status !== status);
    if (movable.length === 0) return;
    void run(movable, status === 'PUBLISHED' ? 'Published' : 'Held back', (row) => api.post(`${ROOT}/items/${row.id}/status`, { status }));
  };
  const doDelete = (row: PrayerRow) => {
    if (!confirm(`Delete “${row.title}” with its ${row.verseCount} verse${row.verseCount === 1 ? '' : 's'} and every translation? This cannot be undone.`)) return;
    void run([row], 'Deleted', (r) => api.delete(`${ROOT}/items/${r.id}`));
  };

  const columns: Column<PrayerRow>[] = [
    {
      key: 'title',
      header: 'Prayer',
      sort: 'title',
      fixed: true,
      csv: (row) => row.title,
      render: (row) => (
        <div className="max-w-md">
          <p className="font-medium">{row.title}</p>
          {row.summary && <p className="line-clamp-2 text-xs text-muted-foreground">{row.summary}</p>}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sort: 'category',
      csv: (row) => row.category,
      render: (row) => <Badge variant="outline">{categoryName(row.category, overview)}</Badge>,
    },
    { key: 'status', header: 'Status', sort: 'status', csv: (row) => STATUS_LABEL[row.status], render: (row) => <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge> },
    { key: 'verses', header: 'Verses', csv: (row) => row.verseCount, render: (row) => <span className="tabular-nums">{row.verseCount}</span> },
    {
      key: 'languages',
      header: 'Translated',
      csv: (row) => row.translatedLanguages,
      render: (row) => (
        <span className="text-sm tabular-nums" title="Languages with a translated title">
          {row.translatedLanguages}
          {languageTotal > 0 && <span className="text-muted-foreground"> / {languageTotal}</span>}
        </span>
      ),
    },
    { key: 'written', header: 'Written in', csv: (row) => row.originalLanguage, defaultHidden: true, render: (row) => languageName(row.originalLanguage) },
    { key: 'order', header: 'Order', sort: 'sortOrder', csv: (row) => row.sortOrder, defaultHidden: true, render: (row) => row.sortOrder },
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
            <DropdownMenuItem className="text-destructive" onClick={() => doDelete(row)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <DataTable
      table={table}
      columns={columns}
      exportName="prayers"
      searchPlaceholder="Search title or summary…"
      onRowClick={(row) => onOpen(row.id)}
      filters={
        <>
          <FilterSelect table={table} name="category" label="All categories" options={categoriesOf(overview).map((c) => ({ value: c.id, label: c.name }))} className="w-48" />
          <FilterSelect table={table} name="status" label="Any status" options={(['PUBLISHED', 'DRAFT'] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }))} className="w-36" />
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
