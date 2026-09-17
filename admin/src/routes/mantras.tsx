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
import { Input, Label, Textarea } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';

type Mantra = {
  id: string;
  slug: string;
  name: string;
  category: string;
  isPublished: boolean;
  deity: { name: string } | null;
  guru: { name: string } | null;
  _count: { translations: number };
};

export function MantrasPage() {
  const { hasPermission } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Mantra | 'new' | null>(null);
  const [viewing, setViewing] = useState<Mantra | null>(null);
  const [form, setForm] = useState({ slug: '', name: '', category: '', sanskrit: '' });

  const debouncedQ = useDebounced(q);
  const list = useResourceList<Mantra>('mantras', '/api/admin/mantras', { page, pageSize: 20, q: debouncedQ || undefined });
  const mutate = useResourceMutation('mantras');

  useEffect(() => {
    if (editing === 'new') setForm({ slug: '', name: '', category: '', sanskrit: '' });
    else if (editing) setForm({ slug: editing.slug, name: editing.name, category: editing.category, sanskrit: '' });
  }, [editing]);

  function save() {
    if (editing === 'new') {
      mutate.mutate({ path: '/api/admin/mantras', method: 'post', body: form });
    } else if (editing) {
      mutate.mutate({ path: `/api/admin/mantras/${editing.id}`, method: 'patch', body: { name: form.name, category: form.category } });
    }
    setEditing(null);
  }

  const columns: Column<Mantra>[] = [
    {
      key: 'name',
      header: 'Mantra',
      render: (m) => (
        <div>
          <p className="font-medium">{m.name}</p>
          <p className="text-xs text-muted-foreground">{m.slug}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (m) => <Badge variant="outline">{m.category}</Badge> },
    { key: 'deity', header: 'Deity / Guru', render: (m) => m.deity?.name ?? m.guru?.name ?? '—' },
    {
      key: 'translations',
      header: 'Translations',
      render: (m) => (m._count.translations === 0 ? <Badge variant="warning">None</Badge> : m._count.translations),
    },
    { key: 'status', header: 'Status', render: (m) => <Badge variant={m.isPublished ? 'success' : 'secondary'}>{m.isPublished ? 'Published' : 'Draft'}</Badge> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (m) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setViewing(m)}>
              <Eye className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            {hasPermission('mantra.write') && <DropdownMenuItem onClick={() => setEditing(m)}>Edit</DropdownMenuItem>}
            {hasPermission('mantra.publish') && (
              <DropdownMenuItem
                onClick={() =>
                  mutate.mutate({ path: `/api/admin/mantras/${m.id}/publish`, method: 'post', body: { isPublished: !m.isPublished } })
                }
              >
                {m.isPublished ? 'Unpublish' : 'Publish'}
              </DropdownMenuItem>
            )}
            {hasPermission('mantra.delete') && !m.isPublished && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (confirm(`Delete "${m.name}"?`)) mutate.mutate({ path: `/api/admin/mantras/${m.id}`, method: 'delete' });
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
        title="Mantras"
        description="Publishing needs audio, duration and at least one translation."
        actions={
          hasPermission('mantra.write') && (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" />
              New mantra
            </Button>
          )
        }
      />

      <div className="mb-4">
        <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Search name or slug…" />
      </div>

      <DataTable columns={columns} page={list.data} isLoading={list.isLoading} isError={list.isError} onPageChange={setPage} />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'New mantra' : `Edit ${(editing as Mantra)?.name}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Slug</Label>
                <Input className="mt-1" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={editing !== 'new'} />
              </div>
              <div>
                <Label>Category</Label>
                <Input className="mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
            </div>
            {editing === 'new' && (
              <div>
                <Label>Sanskrit</Label>
                <Textarea className="mt-1" value={form.sanskrit} onChange={(e) => setForm({ ...form, sanskrit: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!form.name || (editing === 'new' && (!form.slug || !form.sanskrit))}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DetailDialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.name}
        description={viewing?.slug}
        fields={
          viewing
            ? [
                { label: 'Category', value: <Badge variant="outline">{viewing.category}</Badge> },
                { label: 'Deity / Guru', value: viewing.deity?.name ?? viewing.guru?.name ?? '—' },
                { label: 'Translations', value: viewing._count.translations },
                { label: 'Status', value: <Badge variant={viewing.isPublished ? 'success' : 'secondary'}>{viewing.isPublished ? 'Published' : 'Draft'}</Badge> },
                { label: 'Mantra ID', value: <span className="font-mono text-xs">{viewing.id}</span> },
              ]
            : []
        }
      />
    </div>
  );
}
