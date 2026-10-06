import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Eye, MoreHorizontal, Plus, Trash2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { DetailDialog } from '@/components/detail-dialog';
import { useResourceMutation } from '@/lib/use-resource';
import { useDataTable } from '@/lib/use-table';
import { api, ApiRequestError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';

type Field = { key: string; label: string; multiline?: boolean; required?: boolean; options?: string[] };
type Flag = { key: string; label: string };

type Item = Record<string, unknown> & { id: string };

type ResourceConfig = {
  key: string;
  path: string;
  label: string;
  singular: string;
  permission: string;
  idField: string; // slug | code | key
  titleField: string; // which field to show as the row title
  activeField?: string; // isPublished | isActive
  hasOrder?: boolean; // has a displayOrder column
  fields: Field[]; // editable text fields (identifier field always included first)
  flags?: Flag[]; // extra yes/no columns, edited as checkboxes
  usage?: { label: string; value: (item: Item) => number | undefined }; // how much of the app leans on this row
};

const count = (item: Item, name: string) => (item._count as Record<string, number> | undefined)?.[name];

const CONFIGS: ResourceConfig[] = [
  {
    key: 'deities', path: '/api/admin/reference/deities', label: 'Deities', singular: 'deity', permission: 'reference.manage',
    idField: 'slug', titleField: 'name', activeField: 'isPublished', hasOrder: true,
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'description', label: 'Description', multiline: true }, { key: 'sampradaya', label: 'Sampradaya' }],
  },
  {
    key: 'gurus', path: '/api/admin/reference/gurus', label: 'Gurus', singular: 'guru', permission: 'reference.manage',
    idField: 'slug', titleField: 'name', activeField: 'isPublished', hasOrder: true,
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'description', label: 'Description', multiline: true }, { key: 'sampradaya', label: 'Sampradaya' }],
  },
  {
    key: 'translators', path: '/api/admin/reference/translators', label: 'Translators', singular: 'translator', permission: 'translator.manage',
    idField: 'slug', titleField: 'name', activeField: 'isPublished', hasOrder: true,
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'bio', label: 'Bio', multiline: true }, { key: 'sampradaya', label: 'Sampradaya' }],
    usage: { label: 'Translations', value: (item) => count(item, 'translations') },
  },
  {
    key: 'languages', path: '/api/admin/reference/languages', label: 'Languages', singular: 'language', permission: 'reference.manage',
    idField: 'code', titleField: 'englishName', activeField: 'isActive', hasOrder: true,
    fields: [
      { key: 'englishName', label: 'English name', required: true },
      { key: 'nativeName', label: 'Native name', required: true },
    ],
    flags: [
      { key: 'isAppLanguage', label: 'App' },
      { key: 'isMantraLanguage', label: 'Mantra' },
      { key: 'isReadingLanguage', label: 'Reading' },
      { key: 'isRtl', label: 'Right-to-left' },
    ],
  },
  {
    key: 'issues', path: '/api/admin/reference/issues', label: 'Issues', singular: 'issue', permission: 'reference.manage',
    idField: 'slug', titleField: 'name', activeField: 'isPublished', hasOrder: true,
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'category', label: 'Category', required: true, options: ['VIKARA', 'PRACTICE', 'OTHER'] },
      { key: 'description', label: 'Description', multiline: true },
    ],
    usage: { label: 'Verses', value: (item) => count(item, 'verseLinks') },
  },
  {
    key: 'topics', path: '/api/admin/reference/topics', label: 'Notification topics', singular: 'topic', permission: 'notification.send',
    idField: 'key', titleField: 'name', activeField: 'isActive',
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'description', label: 'Description', multiline: true }],
    usage: { label: 'Subscribers', value: (item) => count(item, 'subscriptions') },
  },
];

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));

type Form = Record<string, string | boolean>;

function ResourceTab({ config }: { config: ResourceConfig }) {
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [viewing, setViewing] = useState<Item | null>(null);
  const [form, setForm] = useState<Form>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Nothing here is paged past what the API offers: these endpoints take a page
  // and a search term and nothing else, so there is no server-side sort or status filter.
  const table = useDataTable<Item>({ id: config.key, path: config.path });
  const mutate = useResourceMutation(config.key);

  const active = config.activeField;
  // Deities, gurus, translators and issues are published; languages and topics are active.
  const words =
    active === 'isPublished'
      ? { state: 'Published', on: 'Publish', off: 'Unpublish', done: 'Published', undone: 'Unpublished' }
      : { state: 'Active', on: 'Activate', off: 'Deactivate', done: 'Activated', undone: 'Deactivated' };

  function openEditor(target: Item | 'new') {
    const next: Form = { [config.idField]: target === 'new' ? '' : text(target[config.idField]) };
    for (const f of config.fields) next[f.key] = target === 'new' ? (f.options?.[0] ?? '') : text(target[f.key]);
    if (config.hasOrder) next.displayOrder = target === 'new' ? '' : text(target.displayOrder);
    for (const flag of config.flags ?? []) next[flag.key] = target === 'new' ? false : Boolean(target[flag.key]);
    if (active) next[active] = target === 'new' ? true : Boolean(target[active]);
    setForm(next);
    setFormError('');
    setEditing(target);
  }

  async function save() {
    if (!editing) return;
    const isNew = editing === 'new';
    const body: Record<string, string | number | boolean> = {};

    if (isNew) body[config.idField] = String(form[config.idField]).trim();
    for (const f of config.fields) {
      const value = String(form[f.key] ?? '').trim();
      // A blank single-line field is left out so the database default applies
      // (sampradaya defaults to "vaishnav") instead of being overwritten with "".
      // Long-text fields can be legitimately cleared, so those are always sent on edit.
      if (value !== '' || (!isNew && f.multiline)) body[f.key] = value;
    }
    if (config.hasOrder && String(form.displayOrder ?? '') !== '') body.displayOrder = Number(form.displayOrder);
    for (const flag of config.flags ?? []) body[flag.key] = Boolean(form[flag.key]);
    if (active) body[active] = Boolean(form[active]);

    setSaving(true);
    setFormError('');
    try {
      await mutate.mutateAsync(
        isNew
          ? { path: config.path, method: 'post', body }
          : { path: `${config.path}/${editing.id}`, method: 'patch', body }
      );
      setEditing(null);
      table.setNotice({ tone: 'success', text: isNew ? `Created the ${config.singular}.` : 'Saved.' });
    } catch (error) {
      setFormError(error instanceof ApiRequestError ? error.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  const setActive = (items: Item[], value: boolean) =>
    table.runBulk(items, value ? words.done : words.undone, (item) =>
      api.patch(`${config.path}/${item.id}`, { [active!]: value })
    );

  // A language somebody has selected must not vanish from under their profile, and
  // only the /force route checks for that — plain DELETE would happily remove it.
  const remove = (items: Item[]) => {
    const noun = items.length === 1 ? `"${text(items[0][config.titleField])}"` : `${items.length} ${config.label.toLowerCase()}`;
    if (!confirm(`Delete ${noun}? This cannot be undone.`)) return;
    table.runBulk(items, 'Deleted', (item) =>
      api.delete(config.key === 'languages' ? `${config.path}/${item.id}/force` : `${config.path}/${item.id}`)
    );
  };

  const columns: Column<Item>[] = [
    {
      key: 'title',
      header: config.singular[0].toUpperCase() + config.singular.slice(1),
      fixed: true,
      csv: (item) => text(item[config.titleField]),
      render: (item) => (
        <div>
          <p className="font-medium leading-tight">{text(item[config.titleField])}</p>
          <p className="text-xs leading-tight text-muted-foreground">{text(item[config.idField])}</p>
        </div>
      ),
    },
    // The identifier is already under the title; this column exists so the CSV has it on its own.
    { key: config.idField, header: config.idField[0].toUpperCase() + config.idField.slice(1), defaultHidden: true, csv: (item) => text(item[config.idField]), render: (item) => <span className="font-mono text-xs">{text(item[config.idField])}</span> },
    ...config.fields
      .filter((f) => f.key !== config.titleField)
      .map(
        (f): Column<Item> => ({
          key: f.key,
          header: f.label,
          defaultHidden: f.multiline,
          csv: (item) => text(item[f.key]),
          render: (item) =>
            f.multiline ? (
              <p className="max-w-sm truncate text-muted-foreground">{text(item[f.key]) || '—'}</p>
            ) : (
              text(item[f.key]) || '—'
            ),
        })
      ),
    ...(config.flags
      ? [
          {
            key: 'flags',
            header: 'Used for',
            csv: (item: Item) => config.flags!.filter((flag) => item[flag.key]).map((flag) => flag.label).join(' + '),
            render: (item: Item) => (
              <div className="flex flex-wrap gap-1">
                {config.flags!.filter((flag) => item[flag.key]).map((flag) => (
                  <Badge key={flag.key} variant="outline">{flag.label}</Badge>
                ))}
              </div>
            ),
          } satisfies Column<Item>,
        ]
      : []),
    ...(config.usage
      ? [
          {
            key: 'usage',
            header: config.usage.label,
            className: 'tabular-nums',
            csv: (item: Item) => config.usage!.value(item),
            render: (item: Item) => config.usage!.value(item) ?? '—',
          } satisfies Column<Item>,
        ]
      : []),
    ...(active
      ? [
          {
            key: 'active',
            header: 'Status',
            csv: (item: Item) => (item[active] ? words.state : 'Inactive'),
            render: (item: Item) => (
              <Badge variant={item[active] ? 'success' : 'secondary'}>{item[active] ? words.state : 'Inactive'}</Badge>
            ),
          } satisfies Column<Item>,
        ]
      : []),
    ...(config.hasOrder
      ? [
          {
            key: 'order',
            header: 'Order',
            defaultHidden: true,
            csv: (item: Item) => item.displayOrder,
            render: (item: Item) => text(item.displayOrder),
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
            <Button variant="ghost" size="icon" aria-label="Row actions" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setViewing(item)}>
              <Eye className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openEditor(item)}>Edit</DropdownMenuItem>
            {active && (
              <DropdownMenuItem onClick={() => setActive([item], !item[active])}>
                {item[active] ? (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    {words.off}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {words.on}
                  </>
                )}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive" onClick={() => remove([item])}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <DataTable
        table={table}
        columns={columns}
        exportName={config.key}
        searchPlaceholder={`Search ${config.label.toLowerCase()}…`}
        emptyMessage={`No ${config.label.toLowerCase()} yet.`}
        onRowClick={setViewing}
        actions={
          <Button size="sm" onClick={() => openEditor('new')}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        }
        bulkActions={(items) => (
          <>
            {active && (
              <>
                <Button variant="outline" size="sm" onClick={() => setActive(items, true)}>
                  <CheckCircle2 className="h-4 w-4" />
                  {words.on}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setActive(items, false)}>
                  <XCircle className="h-4 w-4" />
                  {words.off}
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => remove(items)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </>
        )}
      />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? `New ${config.singular}` : `Edit ${config.singular}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="capitalize">{config.idField}</Label>
              <Input
                className="mt-1"
                value={String(form[config.idField] ?? '')}
                disabled={editing !== 'new'}
                onChange={(e) => setForm({ ...form, [config.idField]: e.target.value })}
              />
              {editing === 'new' && (
                <p className="mt-1 text-xs text-muted-foreground">Fixed once created — pick it carefully.</p>
              )}
            </div>
            {config.fields.map((f) => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                {f.multiline ? (
                  <Textarea className="mt-1" value={String(form[f.key] ?? '')} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                ) : f.options ? (
                  <Select className="mt-1" value={String(form[f.key] ?? '')} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input className="mt-1" value={String(form[f.key] ?? '')} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                )}
              </div>
            ))}
            {config.hasOrder && (
              <div>
                <Label>Display order</Label>
                <Input
                  className="mt-1 w-32"
                  type="number"
                  value={String(form.displayOrder ?? '')}
                  onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                />
              </div>
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {config.flags?.map((flag) => (
                <label key={flag.key} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={Boolean(form[flag.key])} onChange={(e) => setForm({ ...form, [flag.key]: e.target.checked })} />
                  {flag.label}
                </label>
              ))}
              {active && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={Boolean(form[active])} onChange={(e) => setForm({ ...form, [active]: e.target.checked })} />
                  {words.state}
                </label>
              )}
            </div>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving || !String(form[config.idField] ?? '').trim() || config.fields.some((f) => f.required && !String(form[f.key] ?? '').trim())}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DetailDialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing ? text(viewing[config.titleField]) : ''}
        description={viewing ? text(viewing[config.idField]) : ''}
        fields={
          viewing
            ? [
                ...config.fields.map((f) => ({
                  label: f.label,
                  value: text(viewing[f.key]) || '—',
                  full: f.multiline,
                })),
                ...(config.flags
                  ? [{ label: 'Used for', value: config.flags.filter((flag) => viewing[flag.key]).map((flag) => flag.label).join(', ') || '—' }]
                  : []),
                ...(config.usage ? [{ label: config.usage.label, value: config.usage.value(viewing) ?? '—' }] : []),
                ...(active
                  ? [
                      {
                        label: 'Status',
                        value: (
                          <Badge variant={viewing[active] ? 'success' : 'secondary'}>{viewing[active] ? words.state : 'Inactive'}</Badge>
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
  const { hasPermission } = useAuth();
  const [params, setParams] = useSearchParams();

  // The API gates each resource on the same permission for reading and writing, so
  // a tab that shows is a tab you can edit; one you can't use isn't offered.
  const tabs = CONFIGS.filter((c) => hasPermission(c.permission));
  const requested = params.get('tab');
  const tab = tabs.find((c) => c.key === requested)?.key ?? tabs[0]?.key;

  return (
    <div>
      <PageHeader title="Reference data" description="Deities, gurus, translators, languages, issues and notification topics." />
      {!tab ? (
        <p className="text-sm text-muted-foreground">Your role can't manage any reference data.</p>
      ) : (
        // The tab lives in the URL, so a refresh keeps you on Languages instead of Deities.
        <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
          <TabsList>
            {tabs.map((c) => (
              <TabsTrigger key={c.key} value={c.key}>
                {c.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((c) => (
            <TabsContent key={c.key} value={c.key}>
              <ResourceTab config={c} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
