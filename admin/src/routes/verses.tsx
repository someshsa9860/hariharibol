import { useState } from 'react';
import { Sparkles, SparkleIcon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { FilterSelect, FlagFilter } from '@/components/table-filters';
import { useResource } from '@/lib/use-resource';
import { useDataTable } from '@/lib/use-table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateOnly } from '@/lib/utils';

type Verse = {
  id: string;
  verseId: string;
  type: string;
  cantoNumber: number | null;
  chapterNumber: number | null;
  sanskrit: string | null;
  isSlokaEligible: boolean;
  createdAt: string;
  book: { slug: string; title: string };
  _count: { translations: number; explanations: number; narrations: number; issueLinks: number };
};

type VerseDetail = Verse & {
  transliteration: string | null;
  translations: { id: string; languageCode: string; type: string; meaning: string; translator: { name: string } }[];
  explanations: { id: string; languageCode: string; text: string }[];
};

type Book = { id: string; slug: string; title: string };

export function VersesPage() {
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState<string | null>(null);

  const books = useResource<Book[]>(['books-all'], '/api/admin/books', { page: 1, pageSize: 100 });
  const table = useDataTable<Verse>({
    id: 'verses',
    path: '/api/admin/verses',
    filters: ['bookId', 'isSlokaEligible', 'untranslated'],
  });
  const detail = useResource<VerseDetail>(['verse', open], `/api/admin/verses/${open}`, undefined, { enabled: !!open });

  const canCurate = hasPermission('sloka.manage');

  const setEligible = (verses: Verse[], isSlokaEligible: boolean) =>
    table.runOnce(verses, isSlokaEligible ? 'Added to the sloka pool:' : 'Removed from the sloka pool:', () =>
      api.post('/api/admin/verses/sloka-eligibility', { verseIds: verses.map((v) => v.verseId), isSlokaEligible })
    );

  const columns: Column<Verse>[] = [
    { key: 'id', header: 'Verse', fixed: true, csv: (v) => v.verseId, render: (v) => <span className="font-mono text-xs">{v.verseId}</span> },
    { key: 'book', header: 'Book', csv: (v) => v.book.title, render: (v) => v.book.title },
    {
      key: 'sanskrit',
      header: 'Text',
      csv: (v) => v.sanskrit,
      render: (v) => (
        <p className="line-clamp-1 max-w-72 font-serif text-sm text-muted-foreground">{v.sanskrit || '—'}</p>
      ),
    },
    { key: 'type', header: 'Type', csv: (v) => v.type, render: (v) => <Badge variant="outline">{v.type}</Badge> },
    {
      key: 'translations',
      header: 'Translations',
      sort: 'translations',
      csv: (v) => v._count.translations,
      render: (v) => (v._count.translations === 0 ? <Badge variant="warning">None</Badge> : v._count.translations),
    },
    { key: 'explanations', header: 'Explanations', sort: 'explanations', csv: (v) => v._count.explanations, render: (v) => v._count.explanations || '—' },
    { key: 'narrations', header: 'Narrations', sort: 'narrations', csv: (v) => v._count.narrations, defaultHidden: true, render: (v) => v._count.narrations || '—' },
    {
      key: 'sloka',
      header: 'Sloka pool',
      csv: (v) => (v.isSlokaEligible ? 'Yes' : 'No'),
      render: (v) => (v.isSlokaEligible ? <Badge variant="success">Yes</Badge> : '—'),
    },
    { key: 'created', header: 'Added', sort: 'createdAt', csv: (v) => v.createdAt, defaultHidden: true, render: (v) => formatDateOnly(v.createdAt) },
  ];

  return (
    <div>
      <PageHeader title="Verses" description="Sanskrit text, translations, explanations and narrations." />

      <DataTable
        table={table}
        columns={columns}
        exportName="verses"
        searchPlaceholder="Search verse id or text…"
        emptyMessage="No verses match."
        onRowClick={(v) => setOpen(v.verseId)}
        filters={
          <>
            <FilterSelect
              table={table}
              name="bookId"
              label="All books"
              className="w-48"
              options={(books.data ?? []).map((b) => ({ value: b.id, label: b.title }))}
            />
            <FlagFilter table={table} name="isSlokaEligible" label="Any sloka status" yes="In sloka pool" no="Not in pool" className="w-44" />
            <FilterSelect
              table={table}
              name="untranslated"
              label="All verses"
              className="w-44"
              options={[{ value: 'true', label: 'Untranslated only' }]}
            />
          </>
        }
        bulkActions={
          canCurate
            ? (verses) => (
                <>
                  <Button variant="outline" size="sm" onClick={() => setEligible(verses, true)}>
                    <Sparkles className="h-4 w-4" />
                    Add to sloka pool
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEligible(verses, false)}>
                    <SparkleIcon className="h-4 w-4" />
                    Remove from pool
                  </Button>
                </>
              )
            : undefined
        }
      />

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{open}</DialogTitle>
            {detail.data && (
              <p className="text-sm text-muted-foreground">
                {detail.data.book.title} · <Badge variant="outline">{detail.data.type}</Badge>
                {detail.data.isSlokaEligible && (
                  <>
                    {' '}
                    <Badge variant="success">Sloka pool</Badge>
                  </>
                )}
              </p>
            )}
          </DialogHeader>
          {detail.isLoading || !detail.data ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-4 text-sm">
              {detail.data.sanskrit && (
                <p className="rounded-md bg-muted/60 p-3 font-serif text-base leading-relaxed">{detail.data.sanskrit}</p>
              )}
              {detail.data.transliteration && (
                <p className="italic text-muted-foreground">{detail.data.transliteration}</p>
              )}

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Translations ({detail.data.translations.length})
                </p>
                {detail.data.translations.length === 0 ? (
                  <p className="text-muted-foreground">None yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.data.translations.map((t) => (
                      <div key={t.id} className="rounded-md border border-border p-2.5">
                        <div className="mb-1 flex items-center gap-1.5">
                          <Badge variant="outline">{t.languageCode}</Badge>
                          <span className="text-xs text-muted-foreground">{t.translator.name} · {t.type}</span>
                        </div>
                        <p>{t.meaning}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detail.data.explanations.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Explanations ({detail.data.explanations.length})
                  </p>
                  <div className="space-y-2">
                    {detail.data.explanations.map((e) => (
                      <div key={e.id} className="rounded-md border border-border p-2.5">
                        <Badge variant="outline" className="mb-1">
                          {e.languageCode}
                        </Badge>
                        <p>{e.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
