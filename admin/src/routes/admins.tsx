import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { FilterSelect } from '@/components/table-filters';
import { AddUserDialog } from '@/components/add-user-dialog';
import { useResource } from '@/lib/use-resource';
import { useDataTable } from '@/lib/use-table';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDate, formatDateOnly } from '@/lib/utils';

type Admin = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  authProvider: string | null;
  isBanned: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  role: { slug: string; name: string };
};

type Role = { id: string; slug: string; name: string; permissions: unknown[] };

export function AdminsPage() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  const myId = auth.status === 'signed-in' ? auth.user.id : undefined;
  const [adding, setAdding] = useState(false);
  const [roleTarget, setRoleTarget] = useState<Admin | null>(null);

  const roles = useResource<Role[]>(['roles'], '/api/admin/roles');
  const adminRoles = (roles.data ?? []).filter((r) => r.permissions.length > 0);

  const table = useDataTable<Admin>({
    id: 'admins',
    path: '/api/admin/users',
    params: { staff: true },
    filters: ['role'],
    defaultSort: { key: 'createdAt', dir: 'desc' },
  });

  const setRole = (a: Admin, roleSlug: string, label: string) =>
    table.runBulk([a], label, (row) => api.patch(`/api/admin/users/${row.id}/role`, { roleSlug }));

  const columns: Column<Admin>[] = [
    {
      key: 'admin',
      header: 'Admin',
      sort: 'name',
      fixed: true,
      csv: (a) => a.name,
      render: (a) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7">
            <AvatarImage src={a.avatarUrl ?? undefined} />
            <AvatarFallback className="text-[10px]">{(a.name || a.email)[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium leading-tight">{a.name || '—'}</p>
            <p className="text-xs leading-tight text-muted-foreground">{a.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Email', csv: (a) => a.email, defaultHidden: true, render: (a) => a.email },
    { key: 'role', header: 'Role', sort: 'role', csv: (a) => a.role.name, render: (a) => <Badge variant="outline">{a.role.name}</Badge> },
    {
      key: 'status',
      header: 'Status',
      csv: (a) => (a.isBanned ? 'Banned' : a.authProvider === 'LEGACY' ? 'Invited' : 'Active'),
      render: (a) =>
        a.isBanned ? (
          <Badge variant="destructive">Banned</Badge>
        ) : a.authProvider === 'LEGACY' ? (
          <Badge variant="warning">Invited — not signed in yet</Badge>
        ) : (
          <Badge variant="success">Active</Badge>
        ),
    },
    { key: 'added', header: 'Added', sort: 'createdAt', csv: (a) => a.createdAt, render: (a) => formatDateOnly(a.createdAt) },
    {
      key: 'lastActive',
      header: 'Last active',
      sort: 'lastActiveAt',
      csv: (a) => a.lastActiveAt,
      render: (a) => (a.lastActiveAt ? formatDate(a.lastActiveAt) : <span className="text-muted-foreground">Never</span>),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (a) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Row actions" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setRoleTarget(a)}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Change role
            </DropdownMenuItem>
            {a.id !== myId && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (confirm(`Remove admin access for ${a.email}? They stay a normal user.`)) setRole(a, 'user', 'Removed admin access for');
                }}
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                Remove admin access
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
        title="Admins"
        description="Everyone whose role gives them access to this panel — admins, moderators, book auditors. Only a super admin sees this page."
        actions={
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" />
            Add admin
          </Button>
        }
      />

      <DataTable
        table={table}
        columns={columns}
        exportName="admins"
        searchPlaceholder="Search name or email…"
        filters={
          <FilterSelect table={table} name="role" label="All roles" options={adminRoles.map((r) => ({ value: r.slug, label: r.name }))} />
        }
      />

      <AddUserDialog
        admin
        open={adding}
        onClose={() => setAdding(false)}
        onDone={(text) => {
          table.setNotice({ tone: 'success', text });
          void queryClient.invalidateQueries({ queryKey: [table.id] });
        }}
      />

      <Dialog open={!!roleTarget} onOpenChange={(o) => !o && setRoleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role for {roleTarget?.email}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {adminRoles.map((r) => (
              <Button
                key={r.slug}
                variant={roleTarget?.role.slug === r.slug ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => {
                  setRole(roleTarget!, r.slug, 'Changed role for');
                  setRoleTarget(null);
                }}
              >
                {r.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
