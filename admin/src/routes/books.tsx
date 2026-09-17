import { useEffect, useState } from 'react';
import { Eye, MoreHorizontal, Plus } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { DataTable, type Column } from '@/components/data-table';
import { DetailDialog } from '@/components/detail-dialog';
import { useResourceList, useResourceMutation } from '@/lib/use-resource';
import { useDebounced } from '@/lib/use-debounced';
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
import { useAuth } from '@/lib/auth';

type Book = {
  id: string;
  slug: string;
  title: string;
  type: string;
  bookNumber: number;
  isPublished: boolean;
  displayOrder: number;
  deity: { slug: string; name: string } | null;
};

const TYPES = ['SCRIPTURE', 'STOTRA', 'AARTI', 'PRAYER', 'POEM', 'TEXT'];

export function BooksPage() {
  const { hasPermission } = useAuth();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Book | 'new' | null>(null);
  const [viewing, setViewing] = useState<Book | null>(null);
  const [form, setForm] = useState({ slug: '', title: '', type: 'SCRIPTURE', bookNumber: '', description: '' });

  const debouncedQ = useDebounced(q);
  const list = useResourceList<Book>('books', '/api/admin/books', { page, pageSize: 20, q: debouncedQ || undefined, type: type || undefined });
  const mutate = useResourceMutation('books');

  useEffect(() => {
    if (editing === 'new') setForm({ slug: '', title: '', type: 'SCRIPTURE', bookNumber: '', description: '' });
    else if (editing) setForm({ slug: editing.slug, title: editing.title, type: editing.type, bookNumber: String(editing.bookNumber), description: '' });
  }, [editing]);

  function save() {
    const body: Record<string, unknown> = { slug: form.slug, title: form.title, type: form.type, description: form.description || undefined };
    if (editing === 'new') {
      mutate.mutate({ path: '/api/admin/books', method: 'post', body: { ...body, bookNumber: Number(form.bookNumber) } });
    } else if (editing) {
      mutate.mutate({ path: `/api/admin/books/${editing.id}`, method: 'patch', body });
    }
    setEditing(null);
  }

  const columns: Column<Book>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (b) => (
        <div>
          <p className="font-medium">{b.title}</p>
          <p className="text-xs text-muted-foreground">{b.slug}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (b) => <Badge variant="outline">{b.type}</Badge> },
    { key: 'deity', header: 'Deity', render: (b) => b.deity?.name ?? '—' },
    { key: 'status', header: 'Status', render: (b) => <Badge variant={b.isPublished ? 'success' : 'secondary'}>{b.isPublished ? 'Published' : 'Draft'}</Badge> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (b) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setViewing(b)}>
              <Eye className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            {hasPermission('book.write') && <DropdownMenuItem onClick={() => setEditing(b)}>Edit</DropdownMenuItem>}
            {hasPermission('book.publish') && (
              <DropdownMenuItem
                onClick={() =>
                  mutate.mutate({ path: `/api/admin/books/${b.id}/publish`, method: 'post', body: { isPublished: !b.isPublished } })
                }
              >
                {b.isPublished ? 'Unpublish' : 'Publish'}
              </DropdownMenuItem>
            )}
            {hasPermission('book.delete') && !b.isPublished && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (confirm(`Delete "${b.title}"?`)) mutate.mutate({ path: `/api/admin/books/${b.id}`, method: 'delete' });
                }}
              >
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
      <PageHeader
        title="Books"
        description="Scriptures, stotras, aartis, prayers and poems."
        actions={
          hasPermission('book.write') && (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" />
              New book
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Search title or slug…" />
        <Select value={type} onChange={(e) => (setType(e.target.value), setPage(1))} className="w-40">
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>

      <DataTable columns={columns} page={list.data} isLoading={list.isLoading} isError={list.isError} onPageChange={setPage} emptyMessage="No books yet." />

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
              <Label>Description</Label>
              <Textarea className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!form.title || !form.slug}>
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
                { label: 'Display order', value: viewing.displayOrder },
                { label: 'Book ID', value: <span className="font-mono text-xs">{viewing.id}</span> },
              ]
            : []
        }
      />
    </div>
  );
}
