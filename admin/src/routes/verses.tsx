import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { DataTable, type Column } from '@/components/data-table';
import { useResource, useResourceList } from '@/lib/use-resource';
import { useDebounced } from '@/lib/use-debounced';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

type Verse = {
  verseId: string;
  type: string;
  isSlokaEligible: boolean;
  book: { slug: string; title: string };
  _count: { translations: number; explanations: number; narrations: number; issueLinks: number };
};

type VerseDetail = Verse & {
  sanskrit: string | null;
  transliteration: string | null;
  translations: { id: string; languageCode: string; type: string; meaning: string; translator: { name: string } }[];
  explanations: { id: string; languageCode: string; text: string }[];
};

type Book = { id: string; slug: string; title: string };

export function VersesPage() {
  const [q, setQ] = useState('');
  const [bookId, setBookId] = useState('');
  const [untranslated, setUntranslated] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const debouncedQ = useDebounced(q);
  const books = useResource<Book[]>(['books-all'], '/api/admin/books', { page: 1, pageSize: 100 });
  const list = useResourceList<Verse>('verses', '/api/admin/verses', {
    page,
    pageSize: 25,
    q: debouncedQ || undefined,
    bookId: bookId || undefined,
    untranslated: untranslated || undefined,
  });
  const detail = useResource<VerseDetail>(['verse', open], `/api/admin/verses/${open}`, undefined, { enabled: !!open });

  const columns: Column<Verse>[] = [
    { key: 'id', header: 'Verse', render: (v) => <span className="font-mono text-xs">{v.verseId}</span> },
    { key: 'book', header: 'Book', render: (v) => v.book.title },
    { key: 'type', header: 'Type', render: (v) => <Badge variant="outline">{v.type}</Badge> },
    {
      key: 'translations',
      header: 'Translations',
      render: (v) => (v._count.translations === 0 ? <Badge variant="warning">None</Badge> : v._count.translations),
    },
    { key: 'sloka', header: 'Sloka eligible', render: (v) => (v.isSlokaEligible ? <Badge variant="success">Yes</Badge> : '—') },
  ];

  return (
    <div>
      <PageHeader title="Verses" description="Sanskrit text, translations, explanations and narrations." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Search verse id…" />
        <Select value={bookId} onChange={(e) => (setBookId(e.target.value), setPage(1))} className="w-48">
          <option value="">All books</option>
          {books.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={untranslated} onChange={(e) => (setUntranslated(e.target.checked), setPage(1))} />
          Untranslated only
        </label>
      </div>

      <DataTable
        columns={columns}
        page={list.data}
        isLoading={list.isLoading}
        isError={list.isError}
        onPageChange={setPage}
        getRowKey={(v) => v.verseId}
        onRowClick={(v) => setOpen(v.verseId)}
        emptyMessage="No verses match."
      />

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{open}</DialogTitle>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
