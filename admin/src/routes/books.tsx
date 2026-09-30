import { useEffect, useState } from 'react';
import { Eye, EyeOff, MoreHorizontal, Plus, Send, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { FilterSelect, FlagFilter } from '@/components/table-filters';
import { DetailDialog } from '@/components/detail-dialog';
import { useResourceMutation } from '@/lib/use-resource';
import { useDataTable } from '@/lib/use-table';
import { api, ApiRequestError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDateOnly } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

type Book = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: string;
  bookNumber: number;
  isPublished: boolean;
  displayOrder: number;
  sampradaya: string;
  sourceLanguage: string;
  totalCantos: number;
  totalChapters: number;
  totalVerses: number;
  createdAt: string;
  deity: { slug: string; name: string } | null;
};

const TYPES = ['SCRIPTURE', 'STOTRA', 'AARTI', 'PRAYER', 'POEM', 'TEXT'];
const EMPTY_FORM = { slug: '', title: '', type: 'SCRIPTURE', bookNumber: '', displayOrder: '', description: '' };

export function BooksPage() {
  const { hasPermission } = useAuth();
  const [editing, setEditing] = useState<Book | 'new' | null>(null);
  const [viewing, setViewing] = useState<Book | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const table = useDataTable<Book>({
    id: 'books',
    path: '/api/admin/books',
    filters: ['type', 'isPublished'],
  });
  const mutate = useResourceMutation('books');

  const canWrite = hasPermission('book.write');
  const canPublish = hasPermission('book.publish');
  const canDelete = hasPermission('book.delete');

  useEffect(() => {
    setFormError('');
    if (editing === 'new') setForm(EMPTY_FORM);
    else if (editing) {
      setForm({
        slug: editing.slug,
        title: editing.title,
        type: editing.type,
        bookNumber: String(editing.bookNumber),
        displayOrder: String(editing.displayOrder),
        description: editing.description ?? '',
      });
    }
  }, [editing]);

  async function save() {
    const body: Record<string, unknown> = {
      slug: form.slug,
      title: form.title,
      type: form.type,
      description: form.description || undefined,
      ...(form.displayOrder !== '' ? { displayOrder: Number(form.displayOrder) } : {}),
    };
    try {
      if (editing === 'new') {
        await mutate.mutateAsync({ path: '/api/admin/books', method: 'post', body: { ...body, bookNumber: Number(form.bookNumber) } });
      } else if (editing) {
        await mutate.mutateAsync({ path: `/api/admin/books/${editing.id}`, method: 'patch', body });
      }
      setEditing(null);
    } catch (error) {
      setFormError(error instanceof ApiRequestError ? error.message : 'Could not save this book.');
    }
  }

  const publish = (books: Book[], isPublished: boolean) =>
    table.runBulk(
      books.filter((b) => b.isPublished !== isPublished),
      isPublished ? 'Published' : 'Unpublished',
      (b) => api.post(`/api/admin/books/${b.id}/publish`, { isPublished })
    );

  const remove = (books: Book[]) => {
    // The API refuses to delete a published book; don't send what we know will fail.
    const deletable = books.filter((b) => !b.isPublished);
    if (deletable.length === 0) return;
    const skipped = books.length - deletable.length;
    const what = deletable.length === 1 ? `"${deletable[0].title}"` : `${deletable.length} books`;
    if (!confirm(`Delete ${what} and every canto, chapter and verse in ${deletable.length === 1 ? 'it' : 'them'}?${skipped ? ` (${skipped} published book${skipped === 1 ? ' is' : 's are'} skipped.)` : ''}`)) return;
    table.runBulk(deletable, 'Deleted', (b) => api.delete(`/api/admin/books/${b.id}`));
  };

  const columns: Column<Book>[] = [
    {
      key: 'title',
      header: 'Title',
      sort: 'title',
      fixed: true,
      csv: (b) => b.title,
      render: (b) => (
        <div>
          <p className="font-medium">{b.title}</p>
          <p className="text-xs text-muted-foreground">{b.slug}</p>
        </div>
      ),
    },
    { key: 'slug', header: 'Slug', csv: (b) => b.slug, defaultHidden: true, render: (b) => b.slug },
    { key: 'type', header: 'Type', sort: 'type', csv: (b) => b.type, render: (b) => <Badge variant="outline">{b.type}</Badge> },
    { key: 'number', header: 'Book #', sort: 'bookNumber', csv: (b) => b.bookNumber, defaultHidden: true, render: (b) => b.bookNumber },
    { key: 'deity', header: 'Deity', csv: (b) => b.deity?.name, render: (b) => b.deity?.name ?? '—' },
    {
      key: 'verses',
      header: 'Verses',
      csv: (b) => b.totalVerses,
      render: (b) => (b.totalVerses === 0 ? <Badge variant="warning">Empty</Badge> : b.totalVerses.toLocaleString()),
    },
    { key: 'chapters', header: 'Chapters', csv: (b) => b.totalChapters, defaultHidden: true, render: (b) => b.totalChapters },
    { key: 'sampradaya', header: 'Sampradaya', csv: (b) => b.sampradaya, defaultHidden: true, render: (b) => b.sampradaya },
    { key: 'language', header: 'Language', csv: (b) => b.sourceLanguage, defaultHidden: true, render: (b) => b.sourceLanguage },
    { key: 'order', header: 'Order', sort: 'displayOrder', csv: (b) => b.displayOrder, defaultHidden: true, render: (b) => b.displayOrder },
    {
      key: 'status',
      header: 'Status',
      sort: 'isPublished',
      csv: (b) => (b.isPublished ? 'Published' : 'Draft'),
      render: (b) => <Badge variant={b.isPublished ? 'success' : 'secondary'}>{b.isPublished ? 'Published' : 'Draft'}</Badge>,
    },
    { key: 'created', header: 'Created', sort: 'createdAt', csv: (b) => b.createdAt, defaultHidden: true, render: (b) => formatDateOnly(b.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (b) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Row actions" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setViewing(b)}>
              <Eye className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            {canWrite && <DropdownMenuItem onClick={() => setEditing(b)}>Edit</DropdownMenuItem>}
            {canPublish && (
              <DropdownMenuItem onClick={() => publish([b], !b.isPublished)}>{b.isPublished ? 'Unpublish' : 'Publish'}</DropdownMenuItem>
            )}
            {canDelete && !b.isPublished && (
              <DropdownMenuItem className="text-destructive" onClick={() => remove([b])}>
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Books" description="Scriptures, stotras, aartis, prayers and poems." />

      <DataTable
        table={table}
        columns={columns}
        exportName="books"
        searchPlaceholder="Search title or slug…"
        emptyMessage="No books yet."
        onRowClick={setViewing}
        filters={
          <>
            <FilterSelect table={table} name="type" label="All types" options={TYPES} />
            <FlagFilter table={table} name="isPublished" label="Any status" yes="Published" no="Draft" className="w-36" />
          </>
        }
        actions={
          canWrite && (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" />
              New book
            </Button>
          )
        }
        bulkActions={
          canPublish || canDelete
            ? (books) => (
                <>
                  {canPublish && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => publish(books, true)}>
                        <Send className="h-4 w-4" />
                        Publish
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => publish(books, false)}>
                        <EyeOff className="h-4 w-4" />
                        Unpublish
                      </Button>
                    </>
                  )}
                  {canDelete && (
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => remove(books)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </>
              )
            : undefined
        }
      />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'New book' : `Edit ${(editing as Book)?.title}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Slug</Label>
                <Input className="mt-1" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </div>
              <div>
                <Label>Type</Label>
                <Select className="mt-1 w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {editing === 'new' && (
                <div>
                  <Label>Book number</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    value={form.bookNumber}
                    onChange={(e) => setForm({ ...form, bookNumber: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Immutable once set.</p>
                </div>
              )}
              <div>
                <Label>Display order</Label>
                <Input
                  className="mt-1"
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!form.title || !form.slug || mutate.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DetailDialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.title}
        description={viewing?.slug}
        fields={
          viewing
            ? [
                { label: 'Type', value: <Badge variant="outline">{viewing.type}</Badge> },
                { label: 'Book number', value: viewing.bookNumber },
                { label: 'Deity', value: viewing.deity?.name ?? '—' },
                { label: 'Status', value: <Badge variant={viewing.isPublished ? 'success' : 'secondary'}>{viewing.isPublished ? 'Published' : 'Draft'}</Badge> },
                { label: 'Structure', value: `${viewing.totalCantos} cantos · ${viewing.totalChapters} chapters · ${viewing.totalVerses.toLocaleString()} verses` },
                { label: 'Sampradaya', value: viewing.sampradaya },
                { label: 'Source language', value: viewing.sourceLanguage },
                { label: 'Display order', value: viewing.displayOrder },
                { label: 'Created', value: formatDateOnly(viewing.createdAt) },
                ...(viewing.description ? [{ label: 'Description', value: viewing.description, full: true }] : []),
                { label: 'Book ID', value: <span className="font-mono text-xs">{viewing.id}</span> },
              ]
            : []
        }
      />
    </div>
  );
}
