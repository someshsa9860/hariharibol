import { useEffect, useState } from 'react';
import { Plus, Trash2, Users as UsersIcon, Lock } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useResource, useResourceMutation } from '@/lib/use-resource';
import { ApiRequestError } from '@/lib/api';

type Role = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: { slug: string; name: string; group: string }[];
};

type PermissionCatalogue = { groups: Record<string, { id: string; slug: string; name: string; description: string }[]>; total: number };

export function RolesPage() {
  const roles = useResource<Role[]>(['roles'], '/api/admin/roles');
  const catalogue = useResource<PermissionCatalogue>(['permissions'], '/api/admin/permissions');
  const mutate = useResourceMutation('roles');

  const [editing, setEditing] = useState<Role | 'new' | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setFormError('');
    if (editing === 'new') {
      setName('');
      setSlug('');
      setDescription('');
      setSelected(new Set());
    } else if (editing) {
      setName(editing.name);
      setSlug(editing.slug);
      setDescription(editing.description ?? '');
      setSelected(new Set(editing.permissions.map((p) => p.slug)));
    }
  }, [editing]);

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  // Tick or clear a whole group at once — there are dozens of permissions and a
  // role like "content editor" is most of two groups.
  function toggleGroup(slugs: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const all = slugs.every((slug) => next.has(slug));
      for (const slug of slugs) all ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  async function save() {
    const permissions = [...selected];
    setSaving(true);
    setFormError('');
    try {
      if (editing === 'new') {
        await mutate.mutateAsync({ path: '/api/admin/roles', method: 'post', body: { slug, name, description, permissions } });
      } else if (editing) {
        await mutate.mutateAsync({ path: `/api/admin/roles/${editing.id}`, method: 'patch', body: { name, description, permissions } });
      }
      setEditing(null);
    } catch (error) {
      setFormError(error instanceof ApiRequestError ? error.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(role: Role) {
    if (!confirm(`Delete role "${role.name}"?`)) return;
    setMessage('');
    try {
      await mutate.mutateAsync({ path: `/api/admin/roles/${role.id}`, method: 'delete' });
    } catch (error) {
      setMessage(error instanceof ApiRequestError ? error.message : 'Could not delete the role.');
    }
  }

  const needle = q.trim().toLowerCase();
  const visible = (roles.data ?? []).filter((role) => {
    if (kind === 'system' && !role.isSystem) return false;
    if (kind === 'custom' && role.isSystem) return false;
    if (!needle) return true;
    return (
      role.name.toLowerCase().includes(needle) ||
      role.slug.toLowerCase().includes(needle) ||
      (role.description ?? '').toLowerCase().includes(needle) ||
      // "who can refund?" — search by what a role is allowed to do.
      role.permissions.some((p) => p.slug.toLowerCase().includes(needle) || p.name.toLowerCase().includes(needle))
    );
  });

  return (
    <div>
      <PageHeader
        title="Roles & permissions"
        description="Every admin is a user whose role grants these — reaching the panel isn't enough on its own."
        actions={
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            New role
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search roles or permissions…" />
        <Select aria-label="Kind" className="w-40" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All roles</option>
          <option value="system">Built-in</option>
          <option value="custom">Custom</option>
        </Select>
        {roles.data && (
          <span className="text-sm text-muted-foreground">
            {visible.length} of {roles.data.length}
          </span>
        )}
      </div>

      {message && (
        <p role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message}
        </p>
      )}

      {roles.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.length === 0 && (
            <p className="text-sm text-muted-foreground md:col-span-2">No roles match.</p>
          )}
          {visible.map((role) => (
            <Card key={role.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium">{role.name}</p>
                      {role.isSystem && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{role.description || role.slug}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UsersIcon className="h-3.5 w-3.5" />
                    {role.userCount}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {role.permissions.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No permissions</span>
                  ) : (
                    <Badge variant="secondary">{role.permissions.length} permissions</Badge>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(role)}>
                    Edit
                  </Button>
                  {!role.isSystem && role.userCount === 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      aria-label={`Delete ${role.name}`}
                      onClick={() => remove(role)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'New role' : `Edit ${(editing as Role)?.name}`}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {editing === 'new' && (
              <div>
                <Label>Slug</Label>
                <Input className="mt-1" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="content_editor" />
              </div>
            )}
          </div>

          <div className="mt-3">
            <Label>Description</Label>
            <Textarea className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="mt-4 max-h-72 space-y-4 overflow-y-auto rounded-md border border-border p-3">
            {catalogue.data &&
              Object.entries(catalogue.data.groups).map(([group, perms]) => (
                <div key={group}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group}</p>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      onClick={() => toggleGroup(perms.map((p) => p.slug))}
                    >
                      {perms.every((p) => selected.has(p.slug)) ? 'Clear' : 'Select all'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {perms.map((p) => (
                      <label key={p.slug} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={selected.has(p.slug)} onChange={() => toggle(p.slug)} />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          <p className="text-xs text-muted-foreground">{selected.size} permissions selected</p>
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !name || (editing === 'new' && !slug)}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
