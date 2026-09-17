import { useState } from 'react';
import { Ban, CheckCircle2, Eye, MoreHorizontal, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { DataTable, type Column } from '@/components/data-table';
import { DetailDialog } from '@/components/detail-dialog';
import { useResourceList, useResourceMutation, useResource } from '@/lib/use-resource';
import { useDebounced } from '@/lib/use-debounced';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, Label, Textarea } from '@/components/ui/input';
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
  role: { slug: string; name: string };
  isPremium: boolean;
  isBanned: boolean;
  createdAt: string;
};

type Role = { id: string; slug: string; name: string };

export function UsersPage() {
  const { hasPermission } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState('');
  const [roleTarget, setRoleTarget] = useState<User | null>(null);
  const [viewing, setViewing] = useState<User | null>(null);

  const debouncedQ = useDebounced(q);
  const roles = useResource<Role[]>(['roles'], '/api/admin/roles');
  const list = useResourceList<User>('users', '/api/admin/users', {
    page,
    pageSize: 20,
    q: debouncedQ || undefined,
    role: role || undefined,
  });
  const mutate = useResourceMutation('users');

  const columns: Column<User>[] = [
    {
      key: 'user',
      header: 'User',
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
    { key: 'role', header: 'Role', render: (u) => <Badge variant="outline">{u.role.name}</Badge> },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <div className="flex gap-1.5">
          {u.isPremium && <Badge variant="success">Premium</Badge>}
          {u.isBanned && <Badge variant="destructive">Banned</Badge>}
        </div>
      ),
    },
    { key: 'joined', header: 'Joined', render: (u) => formatDateOnly(u.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (u) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setViewing(u)}>
              <Eye className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
            {hasPermission('role.manage') && (
              <DropdownMenuItem onClick={() => setRoleTarget(u)}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Change role
              </DropdownMenuItem>
            )}
            {hasPermission('user.ban') &&
              (u.isBanned ? (
                <DropdownMenuItem
                  onClick={() => mutate.mutate({ path: `/api/admin/users/${u.id}/unban`, method: 'post', body: {} })}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Unban
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setBanTarget(u)}>
                  <Ban className="mr-2 h-4 w-4" />
                  Ban
                </DropdownMenuItem>
              ))}
            {hasPermission('user.delete') && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (confirm(`Delete ${u.email}? This cannot be undone.`)) {
                    mutate.mutate({ path: `/api/admin/users/${u.id}`, method: 'delete' });
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Search name or email…" />
        <Select value={role} onChange={(e) => (setRole(e.target.value), setPage(1))} className="w-40">
          <option value="">All roles</option>
          {roles.data?.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>

      <DataTable columns={columns} page={list.data} isLoading={list.isLoading} isError={list.isError} onPageChange={setPage} />

      <Dialog open={!!banTarget} onOpenChange={(open) => !open && setBanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban {banTarget?.email}</DialogTitle>
          </DialogHeader>
          <Label htmlFor="ban-reason">Reason</Label>
          <Textarea
            id="ban-reason"
            className="mt-1.5"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Why is this account being banned?"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={banReason.trim().length < 3}
              onClick={() => {
                if (!banTarget) return;
                mutate.mutate({
                  path: `/api/admin/users/${banTarget.id}/ban`,
                  method: 'post',
                  body: { reason: banReason },
                });
                setBanTarget(null);
                setBanReason('');
              }}
            >
              Ban user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!roleTarget} onOpenChange={(open) => !open && setRoleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role for {roleTarget?.email}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {roles.data?.map((r) => (
              <Button
                key={r.slug}
                variant={roleTarget?.role.slug === r.slug ? 'default' : 'outline'}
                className="justify-start"
                onClick={() => {
                  if (!roleTarget) return;
                  mutate.mutate({
                    path: `/api/admin/users/${roleTarget.id}/role`,
                    method: 'patch',
                    body: { roleSlug: r.slug },
                  });
                  setRoleTarget(null);
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
                { label: 'Joined', value: formatDate(viewing.createdAt) },
                { label: 'User ID', value: <span className="font-mono text-xs">{viewing.id}</span> },
              ]
            : []
        }
      />
    </div>
  );
}
