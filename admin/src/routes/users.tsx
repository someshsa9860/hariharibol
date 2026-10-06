import { useState } from 'react';
import { Ban, CheckCircle2, Eye, MoreHorizontal, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { FilterSelect, FlagFilter } from '@/components/table-filters';
import { DetailDialog } from '@/components/detail-dialog';
import { useResource } from '@/lib/use-resource';
import { useDataTable } from '@/lib/use-table';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate, formatDateOnly } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

type User = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  authProvider: string | null;
  role: { slug: string; name: string };
  isPremium: boolean;
  premiumUntil: string | null;
  isBanned: boolean;
  createdAt: string;
  lastActiveAt: string | null;
};

type Role = { id: string; slug: string; name: string };

export function UsersPage() {
  const { hasPermission } = useAuth();
  const [banTargets, setBanTargets] = useState<User[]>([]);
  const [banReason, setBanReason] = useState('');
  const [roleTargets, setRoleTargets] = useState<User[]>([]);
  const [viewing, setViewing] = useState<User | null>(null);

  const roles = useResource<Role[]>(['roles'], '/api/admin/roles');
  const table = useDataTable<User>({
    id: 'users',
    path: '/api/admin/users',
    filters: ['role', 'isPremium', 'isBanned'],
    defaultSort: { key: 'createdAt', dir: 'desc' },
  });

  const canBan = hasPermission('user.ban');
  const canChangeRole = hasPermission('role.manage');
  const canDelete = hasPermission('user.delete');

  const ban = (users: User[], reason: string) =>
    table.runBulk(users.filter((u) => !u.isBanned), 'Banned', (u) =>
      api.post(`/api/admin/users/${u.id}/ban`, { reason })
    );
  const unban = (users: User[]) =>
    table.runBulk(users.filter((u) => u.isBanned), 'Unbanned', (u) => api.post(`/api/admin/users/${u.id}/unban`, {}));
  const setRole = (users: User[], roleSlug: string) =>
    table.runBulk(users, 'Changed role for', (u) => api.patch(`/api/admin/users/${u.id}/role`, { roleSlug }));

  const columns: Column<User>[] = [
    {
      key: 'user',
      header: 'User',
      sort: 'name',
      fixed: true,
      csv: (u) => u.name,
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="h-7 w-7">
            <AvatarImage src={u.avatarUrl ?? undefined} />
            <AvatarFallback className="text-[10px]">{(u.name || u.email)[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium leading-tight">{u.name || '—'}</p>
            <p className="text-xs leading-tight text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    // Email is already in the User cell; this column exists so the CSV has it on its own.
    { key: 'email', header: 'Email', csv: (u) => u.email, defaultHidden: true, render: (u) => u.email },
    { key: 'role', header: 'Role', sort: 'role', csv: (u) => u.role.name, render: (u) => <Badge variant="outline">{u.role.name}</Badge> },
    {
      key: 'status',
      header: 'Status',
      csv: (u) => [u.isPremium && 'Premium', u.isBanned && 'Banned'].filter(Boolean).join(' + ') || 'Free',
      render: (u) => (
        <div className="flex gap-1.5">
          {u.isPremium && <Badge variant="success">Premium</Badge>}
          {u.isBanned && <Badge variant="destructive">Banned</Badge>}
        </div>
      ),
    },
    { key: 'provider', header: 'Sign-in', csv: (u) => u.authProvider, defaultHidden: true, render: (u) => u.authProvider ?? '—' },
    {
      key: 'premiumUntil',
      header: 'Premium until',
      csv: (u) => u.premiumUntil,
      defaultHidden: true,
      render: (u) => (u.premiumUntil ? formatDateOnly(u.premiumUntil) : '—'),
    },
    { key: 'joined', header: 'Joined', sort: 'createdAt', csv: (u) => u.createdAt, render: (u) => formatDateOnly(u.createdAt) },
    {
      key: 'lastActive',
      header: 'Last active',
      sort: 'lastActiveAt',
      csv: (u) => u.lastActiveAt,
      render: (u) => (u.lastActiveAt ? formatDate(u.lastActiveAt) : <span className="text-muted-foreground">Never</span>),
    },
    { key: 'id', header: 'ID', csv: (u) => u.id, defaultHidden: true, render: (u) => <span className="font-mono text-xs">{u.id}</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Row actions" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setViewing(u)}>
              <Eye className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            {canChangeRole && (
              <DropdownMenuItem onClick={() => setRoleTargets([u])}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Change role
              </DropdownMenuItem>
            )}
            {canBan &&
              (u.isBanned ? (
                <DropdownMenuItem onClick={() => unban([u])}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Unban
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setBanTargets([u])}>
                  <Ban className="mr-2 h-4 w-4" />
                  Ban
                </DropdownMenuItem>
              ))}
            {canDelete && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (confirm(`Delete ${u.email}? This cannot be undone.`)) {
                    table.runBulk([u], 'Deleted', (row) => api.delete(`/api/admin/users/${row.id}`));
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
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
      <PageHeader title="Users" description="Search, inspect, promote and ban." />

      <DataTable
        table={table}
        columns={columns}
        exportName="users"
        searchPlaceholder="Search name or email…"
        onRowClick={setViewing}
        rowClassName={(u) => (u.isBanned ? 'text-muted-foreground' : undefined)}
        filters={
          <>
            <FilterSelect
              table={table}
              name="role"
              label="All roles"
              options={(roles.data ?? []).map((r) => ({ value: r.slug, label: r.name }))}
            />
            <FlagFilter table={table} name="isPremium" label="Any plan" yes="Premium" no="Not premium" />
            <FlagFilter table={table} name="isBanned" label="Any standing" yes="Banned" no="Not banned" />
          </>
        }
        bulkActions={
          canBan || canChangeRole
            ? (users) => (
                <>
                  {canBan && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setBanTargets(users)}>
                        <Ban className="h-4 w-4" />
                        Ban
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => unban(users)}>
                        <CheckCircle2 className="h-4 w-4" />
                        Unban
                      </Button>
                    </>
                  )}
                  {canChangeRole && (
                    <Button variant="outline" size="sm" onClick={() => setRoleTargets(users)}>
                      <ShieldCheck className="h-4 w-4" />
                      Change role
                    </Button>
                  )}
                </>
              )
            : undefined
        }
      />

      <Dialog open={banTargets.length > 0} onOpenChange={(open) => !open && setBanTargets([])}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{banTargets.length === 1 ? `Ban ${banTargets[0].email}` : `Ban ${banTargets.length} users`}</DialogTitle>
          </DialogHeader>
          {banTargets.length > 1 && (
            <p className="text-sm text-muted-foreground">
              Anyone already banned is skipped. The same reason is recorded for each account.
            </p>
          )}
          <Label htmlFor="ban-reason">Reason</Label>
          <Textarea
            id="ban-reason"
            className="mt-1.5"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Why is this account being banned?"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTargets([])}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={banReason.trim().length < 3}
              onClick={() => {
                ban(banTargets, banReason);
                setBanTargets([]);
                setBanReason('');
              }}
            >
              {banTargets.length === 1 ? 'Ban user' : `Ban ${banTargets.length} users`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roleTargets.length > 0} onOpenChange={(open) => !open && setRoleTargets([])}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {roleTargets.length === 1 ? `Change role for ${roleTargets[0].email}` : `Change role for ${roleTargets.length} users`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {roles.data?.map((r) => (
              <Button
                key={r.slug}
                variant={roleTargets.length === 1 && roleTargets[0].role.slug === r.slug ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => {
                  setRole(roleTargets, r.slug);
                  setRoleTargets([]);
                }}
              >
                {r.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <DetailDialog
        open={!!viewing}
        onOpenChange={(open) => !open && setViewing(null)}
        title={viewing?.name || viewing?.email}
        fields={
          viewing
            ? [
                { label: 'Email', value: viewing.email },
                { label: 'Name', value: viewing.name || '—' },
                { label: 'Role', value: <Badge variant="outline">{viewing.role.name}</Badge> },
                {
                  label: 'Status',
                  value: (
                    <div className="flex gap-1.5">
                      {viewing.isPremium && <Badge variant="success">Premium</Badge>}
                      {viewing.isBanned && <Badge variant="destructive">Banned</Badge>}
                      {!viewing.isPremium && !viewing.isBanned && '—'}
                    </div>
                  ),
                },
                { label: 'Premium until', value: viewing.premiumUntil ? formatDateOnly(viewing.premiumUntil) : '—' },
                { label: 'Sign-in', value: viewing.authProvider ?? '—' },
                { label: 'Joined', value: formatDate(viewing.createdAt) },
                { label: 'Last active', value: viewing.lastActiveAt ? formatDate(viewing.lastActiveAt) : 'Never' },
                { label: 'User ID', value: <span className="font-mono text-xs">{viewing.id}</span> },
              ]
            : []
        }
      />
    </div>
  );
}
