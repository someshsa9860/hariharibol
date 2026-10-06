import { useEffect, useState } from 'react';
import { Eye, EyeOff, Languages, MoreHorizontal, Plus, Send, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { FilterSelect, FlagFilter } from '@/components/table-filters';
import { DetailDialog } from '@/components/detail-dialog';
import { MantraTranslations } from '@/components/mantra-translations';
import { useResourceMutation } from '@/lib/use-resource';
import { useDataTable } from '@/lib/use-table';
import { api, ApiRequestError } from '@/lib/api';
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
import { formatDateOnly } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

type Mantra = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sanskrit: string;
  transliteration: string | null;
  category: string;
  sampradaya: string;
  audioPath: string | null;
  durationMs: number | null;
  standardRounds: number | null;
  standardCount: number | null;
  displayOrder: number;
  isPublished: boolean;
  createdAt: string;
  deity: { name: string } | null;
  guru: { name: string } | null;
  _count: { translations: number };
};

// Category is free text on the model; these are the ones the seed and the app's
// chant screen know about. The form lets you type a new one.
const CATEGORIES = ['mahamantra', 'beej', 'name', 'gayatri'];
const EMPTY_FORM = { slug: '', name: '', category: '', sanskrit: '', transliteration: '', description: '', displayOrder: '' };

const formatDuration = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

export function MantrasPage() {
  const { hasPermission } = useAuth();
  const [editing, setEditing] = useState<Mantra | 'new' | null>(null);
  const [viewing, setViewing] = useState<Mantra | null>(null);
  const [translating, setTranslating] = useState<Mantra | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const table = useDataTable<Mantra>({
    id: 'mantras',
    path: '/api/admin/mantras',
    filters: ['category', 'isPublished'],
  });
  const mutate = useResourceMutation('mantras');

  const canWrite = hasPermission('mantra.write');
  const canPublish = hasPermission('mantra.publish');
  const canDelete = hasPermission('mantra.delete');

  useEffect(() => {
    setFormError('');
    if (editing === 'new') setForm(EMPTY_FORM);
    else if (editing) {
      setForm({
        slug: editing.slug,
        name: editing.name,
        category: editing.category,
        sanskrit: editing.sanskrit,
        transliteration: editing.transliteration ?? '',
        description: editing.description ?? '',
        displayOrder: String(editing.displayOrder),
      });
    }
  }, [editing]);

  async function save() {
    const body: Record<string, unknown> = {
      name: form.name,
      category: form.category,
      sanskrit: form.sanskrit,
      transliteration: form.transliteration || undefined,
      description: form.description || undefined,
      ...(form.displayOrder !== '' ? { displayOrder: Number(form.displayOrder) } : {}),
    };
    try {
      if (editing === 'new') {
        await mutate.mutateAsync({ path: '/api/admin/mantras', method: 'post', body: { ...body, slug: form.slug } });
      } else if (editing) {
        await mutate.mutateAsync({ path: `/api/admin/mantras/${editing.id}`, method: 'patch', body });
      }
      setEditing(null);
    } catch (error) {
      setFormError(error instanceof ApiRequestError ? error.message : 'Could not save this mantra.');
    }
  }

  // The API refuses to publish a mantra with no audio, duration or translation —
  // a bulk publish reports those as failures and leaves them selected.
  const publish = (mantras: Mantra[], isPublished: boolean) =>
    table.runBulk(
      mantras.filter((m) => m.isPublished !== isPublished),
      isPublished ? 'Published' : 'Unpublished',
      (m) => api.post(`/api/admin/mantras/${m.id}/publish`, { isPublished })
    );

  const remove = (mantras: Mantra[]) => {
    const deletable = mantras.filter((m) => !m.isPublished);
    if (deletable.length === 0) return;
    const skipped = mantras.length - deletable.length;
    const what = deletable.length === 1 ? `"${deletable[0].name}"` : `${deletable.length} mantras`;
    if (!confirm(`Delete ${what}?${skipped ? ` (${skipped} published mantra${skipped === 1 ? ' is' : 's are'} skipped.)` : ''}`)) return;
    table.runBulk(deletable, 'Deleted', (m) => api.delete(`/api/admin/mantras/${m.id}`));
  };

  const columns: Column<Mantra>[] = [
    {
      key: 'name',
      header: 'Mantra',
      sort: 'name',
      fixed: true,
      csv: (m) => m.name,
      render: (m) => (
        <div>
          <p className="font-medium">{m.name}</p>
          <p className="text-xs text-muted-foreground">{m.slug}</p>
        </div>
      ),
    },
    { key: 'slug', header: 'Slug', csv: (m) => m.slug, defaultHidden: true, render: (m) => m.slug },
    { key: 'category', header: 'Category', sort: 'category', csv: (m) => m.category, render: (m) => <Badge variant="outline">{m.category}</Badge> },
    { key: 'deity', header: 'Deity / Guru', csv: (m) => m.deity?.name ?? m.guru?.name, render: (m) => m.deity?.name ?? m.guru?.name ?? '—' },
    {
      key: 'translations',
      header: 'Translations',
      sort: 'translations',
      csv: (m) => m._count.translations,
      render: (m) => (
        <button
          type="button"
          className="rounded hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setTranslating(m);
          }}
        >
          {m._count.translations === 0 ? <Badge variant="warning">None</Badge> : `${m._count.translations} languages`}
        </button>
      ),
    },
    {
      key: 'audio',
      header: 'Audio',
      csv: (m) => (m.audioPath ? 'Yes' : 'No'),
      render: (m) => (m.audioPath ? <Badge variant="success">Yes</Badge> : <Badge variant="secondary">No</Badge>),
    },
    {
      key: 'duration',
      header: 'Duration',
      csv: (m) => m.durationMs,
      defaultHidden: true,
      render: (m) => (m.durationMs ? formatDuration(m.durationMs) : '—'),
    },
    {
      key: 'standard',
      header: 'Standard',
      csv: (m) => m.standardRounds ?? m.standardCount,
      defaultHidden: true,
      render: (m) => (m.standardRounds ? `${m.standardRounds} rounds` : m.standardCount ? `${m.standardCount}×` : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      sort: 'isPublished',
      csv: (m) => (m.isPublished ? 'Published' : 'Draft'),
      render: (m) => <Badge variant={m.isPublished ? 'success' : 'secondary'}>{m.isPublished ? 'Published' : 'Draft'}</Badge>,
    },
    { key: 'created', header: 'Created', sort: 'createdAt', csv: (m) => m.createdAt, defaultHidden: true, render: (m) => formatDateOnly(m.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (m) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Row actions" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setViewing(m)}>
              <Eye className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTranslating(m)}>
              <Languages className="mr-2 h-4 w-4" />
              Translations
            </DropdownMenuItem>
            {canWrite && <DropdownMenuItem onClick={() => setEditing(m)}>Edit</DropdownMenuItem>}
            {canPublish && (
              <DropdownMenuItem onClick={() => publish([m], !m.isPublished)}>{m.isPublished ? 'Unpublish' : 'Publish'}</DropdownMenuItem>
            )}
            {canDelete && !m.isPublished && (
              <DropdownMenuItem className="text-destructive" onClick={() => remove([m])}>
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
      <PageHeader title="Mantras" description="Publishing needs audio, duration and at least one translation." />

      <DataTable
        table={table}
        columns={columns}
        exportName="mantras"
        searchPlaceholder="Search name or slug…"
        onRowClick={setViewing}
        filters={
          <>
            <FilterSelect table={table} name="category" label="All categories" options={CATEGORIES} />
            <FlagFilter table={table} name="isPublished" label="Any status" yes="Published" no="Draft" className="w-36" />
          </>
        }
        actions={
          canWrite && (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" />
              New mantra
            </Button>
          )
        }
        bulkActions={
          canPublish || canDelete
            ? (mantras) => (
                <>
                  {canPublish && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => publish(mantras, true)}>
                        <Send className="h-4 w-4" />
                        Publish
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => publish(mantras, false)}>
                        <EyeOff className="h-4 w-4" />
                        Unpublish
                      </Button>
                    </>
                  )}
                  {canDelete && (
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => remove(mantras)}>
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
                <Input className="mt-1" list="mantra-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                <datalist id="mantra-categories">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
            <div>
              <Label>Sanskrit</Label>
              <Textarea className="mt-1" value={form.sanskrit} onChange={(e) => setForm({ ...form, sanskrit: e.target.value })} />
            </div>
            <div>
              <Label>Transliteration</Label>
              <Textarea className="mt-1" value={form.transliteration} onChange={(e) => setForm({ ...form, transliteration: e.target.value })} />
            </div>
            <div className="grid grid-cols-[1fr_8rem] gap-3">
              <div>
                <Label>Description</Label>
                <Input className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <Label>Order</Label>
                <Input className="mt-1" type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: e.target.value })} />
              </div>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={!form.name || !form.category || !form.sanskrit || (editing === 'new' && !form.slug) || mutate.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MantraTranslations mantra={translating} onClose={() => setTranslating(null)} canWrite={canWrite} canDelete={canDelete} />

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
                {
                  label: 'Translations',
                  value: (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTranslating(viewing);
                        setViewing(null);
                      }}
                    >
                      <Languages className="h-4 w-4" />
                      {viewing._count.translations} languages — view / edit
                    </Button>
                  ),
                },
                { label: 'Audio', value: viewing.audioPath ? 'Attached' : 'None' },
                { label: 'Duration', value: viewing.durationMs ? formatDuration(viewing.durationMs) : '—' },
                {
                  label: 'Standard count',
                  value: viewing.standardRounds ? `${viewing.standardRounds} rounds` : viewing.standardCount ? `${viewing.standardCount} repetitions` : '—',
                },
                { label: 'Status', value: <Badge variant={viewing.isPublished ? 'success' : 'secondary'}>{viewing.isPublished ? 'Published' : 'Draft'}</Badge> },
                { label: 'Created', value: formatDateOnly(viewing.createdAt) },
                { label: 'Sanskrit', value: <p className="whitespace-pre-line text-base leading-relaxed">{viewing.sanskrit}</p>, full: true },
                ...(viewing.transliteration
                  ? [{ label: 'Transliteration', value: <p className="whitespace-pre-line italic">{viewing.transliteration}</p>, full: true }]
                  : []),
                { label: 'Mantra ID', value: <span className="font-mono text-xs">{viewing.id}</span> },
              ]
            : []
        }
      />
    </div>
  );
}
