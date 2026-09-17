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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';

type Field = { key: string; label: string; multiline?: boolean; required?: boolean };

type Item = Record<string, unknown> & { id: string };

type ResourceConfig = {
  key: string;
  path: string;
  label: string;
  permission: string;
  idField: string; // slug | code | key
  titleField: string; // which field to show as the row title
  activeField?: string; // isPublished | isActive
  fields: Field[]; // editable text fields (identifier field always included first)
};

const CONFIGS: ResourceConfig[] = [
  {
    key: 'deities', path: '/api/admin/reference/deities', label: 'Deities', permission: 'reference.manage',
    idField: 'slug', titleField: 'name', activeField: 'isPublished',
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'description', label: 'Description', multiline: true }, { key: 'sampradaya', label: 'Sampradaya' }],
  },
  {
    key: 'gurus', path: '/api/admin/reference/gurus', label: 'Gurus', permission: 'reference.manage',
    idField: 'slug', titleField: 'name', activeField: 'isPublished',
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'description', label: 'Description', multiline: true }, { key: 'sampradaya', label: 'Sampradaya' }],
  },
  {
    key: 'translators', path: '/api/admin/reference/translators', label: 'Translators', permission: 'translator.manage',
    idField: 'slug', titleField: 'name', activeField: 'isPublished',
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'bio', label: 'Bio', multiline: true }, { key: 'sampradaya', label: 'Sampradaya' }],
  },
  {
    key: 'languages', path: '/api/admin/reference/languages', label: 'Languages', permission: 'reference.manage',
    idField: 'code', titleField: 'englishName', activeField: 'isActive',
    fields: [
      { key: 'englishName', label: 'English name', required: true },
      { key: 'nativeName', label: 'Native name', required: true },
    ],
  },
  {
    key: 'issues', path: '/api/admin/reference/issues', label: 'Issues', permission: 'reference.manage',
    idField: 'slug', titleField: 'name', activeField: 'isPublished',
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'category', label: 'Category (VIKARA/PRACTICE/OTHER)', required: true }, { key: 'description', label: 'Description', multiline: true }],
  },
  {
    key: 'topics', path: '/api/admin/reference/topics', label: 'Notification topics', permission: 'notification.send',
    idField: 'key', titleField: 'name', activeField: 'isActive',
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'description', label: 'Description', multiline: true }],
  },
];

function ResourceTab({ config }: { config: ResourceConfig }) {
  const { hasPermission } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [viewing, setViewing] = useState<Item | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const canWrite = hasPermission(config.permission);
  const debouncedQ = useDebounced(q);
  const list = useResourceList<Item>(config.key, config.path, { page, pageSize: 20, q: debouncedQ || undefined });
  const mutate = useResourceMutation(config.key);

  useEffect(() => {
    if (editing === 'new') {
      setForm({ [config.idField]: '' });
    } else if (editing) {
      const next: Record<string, string> = { [config.idField]: String(editing[config.idField] ?? '') };
      for (const f of config.fields) next[f.key] = String(editing[f.key] ?? '');
      setForm(next);
    }
  }, [editing, config]);

  function save() {
    const body: Record<string, string> = { ...form };
    if (editing === 'new') {
      mutate.mutate({ path: config.path, method: 'post', body });
    } else if (editing) {
      const { [config.idField]: _drop, ...rest } = body;
      mutate.mutate({ path: `${config.path}/${editing.id}`, method: 'patch', body: rest });
    }
    setEditing(null);
  }

  const columns: Column<Item>[] = [
    {
      key: 'title',
      header: config.label.slice(0, -1),
      render: (item) => (
        <div>
          <p className="font-medium">{String(item[config.titleField] ?? '')}</p>
          <p className="text-xs text-muted-foreground">{String(item[config.idField] ?? '')}</p>
        </div>
      ),
    },
    ...(config.activeField
      ? [
          {
            key: 'active',
            header: 'Status',
            render: (item: Item) => (
              <Badge variant={item[config.activeField!] ? 'success' : 'secondary'}>
                {item[config.activeField!] ? 'Active' : 'Inactive'}
              </Badge>
            ),
          } satisfies Column<Item>,
        ]
      : []),
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setViewing(item)}>
              <Eye className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            {canWrite && <DropdownMenuItem onClick={() => setEditing(item)}>Edit</DropdownMenuItem>}
            {canWrite && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (confirm(`Delete "${item[config.titleField]}"?`)) {
                    mutate.mutate({ path: `${config.path}/${item.id}`, method: 'delete' });
                  }
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
      <div className="mb-4 flex items-center justify-between">
        <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder={`Search ${config.label.toLowerCase()}…`} />
        {canWrite && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        )}
      </div>

      <DataTable columns={columns} page={list.data} isLoading={list.isLoading} isError={list.isError} onPageChange={setPage} />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? `New ${config.label.slice(0, -1).toLowerCase()}` : `Edit`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="capitalize">{config.idField}</Label>
              <Input
                className="mt-1"
                value={form[config.idField] ?? ''}
                disabled={editing !== 'new'}
                onChange={(e) => setForm({ ...form, [config.idField]: e.target.value })}
              />
            </div>
            {config.fields.map((f) =>
              f.multiline ? (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Textarea className="mt-1" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                </div>
              ) : (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input className="mt-1" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                </div>
              )
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={!form[config.idField] || config.fields.some((f) => f.required && !form[f.key])}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DetailDialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing ? String(viewing[config.titleField] ?? '') : ''}
        description={viewing ? String(viewing[config.idField] ?? '') : ''}
        fields={
          viewing
            ? [
                ...config.fields.map((f) => ({
                  label: f.label,
                  value: String(viewing[f.key] ?? '') || '—',
                  full: f.multiline,
                })),
                ...(config.activeField
                  ? [
                      {
                        label: 'Status',
                        value: (
                          <Badge variant={viewing[config.activeField] ? 'success' : 'secondary'}>
                            {viewing[config.activeField] ? 'Active' : 'Inactive'}
                          </Badge>
                        ),
                      },
                    ]
                  : []),
                { label: 'ID', value: <span className="font-mono text-xs">{viewing.id}</span> },
              ]
            : []
        }
      />
    </div>
  );
}

export function ReferencePage() {
  return (
    <div>
      <PageHeader title="Reference data" description="Deities, gurus, translators, languages, issues and notification topics." />
      <Tabs defaultValue={CONFIGS[0].key}>
        <TabsList>
          {CONFIGS.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {CONFIGS.map((c) => (
          <TabsContent key={c.key} value={c.key}>
            <ResourceTab config={c} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
