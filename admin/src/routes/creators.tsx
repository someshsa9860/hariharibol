import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, MoreHorizontal, Pencil, Plus, Trash2, XCircle, PauseCircle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { DataTable, type Column } from '@/components/data-table';
import { FilterSelect } from '@/components/table-filters';
import { AddCreatorDialog } from '@/components/add-creator-dialog';
import { useDataTable } from '@/lib/use-table';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDateOnly } from '@/lib/utils';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

type Creator = {
  id: string;
  displayName: string;
  bio: string | null;
  status: Status;
  rejectionReason: string | null;
  isVerified: boolean;
  reelCount: number;
  followerCount: number;
  createdAt: string;
  user: { id: string; email: string; name: string | null; role: { slug: string; name: string } };
};

const STATUS_LABEL: Record<Status, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};
const STATUS_VARIANT: Record<Status, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
  SUSPENDED: 'destructive',
};

export function CreatorsPage() {
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Creator | null>(null);
  const [turnAway, setTurnAway] = useState<{ creator: Creator; status: 'REJECTED' | 'SUSPENDED' } | null>(null);
  const [form, setForm] = useState({ displayName: '', bio: '', isVerified: false });
  const [reason, setReason] = useState('');

  const table = useDataTable<Creator>({
    id: 'creators',
    path: '/api/admin/creators',
    filters: ['status'],
    defaultSort: { key: 'createdAt', dir: 'desc' },
  });

  const setStatus = (c: Creator, status: Status, rejectionReason?: string) =>
    table.runBulk([c], status === 'APPROVED' ? 'Approved' : 'Updated', (row) =>
      api.patch(`/api/admin/creators/${row.id}`, { status, ...(rejectionReason ? { rejectionReason } : {}) })
    );

  const openEdit = (c: Creator) => {
    setForm({ displayName: c.displayName, bio: c.bio ?? '', isVerified: c.isVerified });
    setEditing(c);
  };

  const columns: Column<Creator>[] = [
    {
      key: 'creator',
      header: 'Creator',
      sort: 'name',
      fixed: true,
      csv: (c) => c.displayName,
      render: (c) => (
        <div>
          <p className="font-medium leading-tight">
            {c.displayName}
            {c.isVerified && <span className="ml-1.5 text-xs text-primary">✓ verified</span>}
          </p>
          <p className="text-xs leading-tight text-muted-foreground">{c.user.email}</p>
        </div>
      ),
    },
    { key: 'role', header: 'Account role', csv: (c) => c.user.role.name, render: (c) => <Badge variant="outline">{c.user.role.name}</Badge> },
    {
      key: 'status',
      header: 'Status',
      sort: 'status',
      csv: (c) => c.status,
      render: (c) => (
        <div>
          <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
          {c.rejectionReason && <p className="mt-0.5 max-w-[16rem] truncate text-xs text-muted-foreground">{c.rejectionReason}</p>}
        </div>
      ),
    },
    { key: 'reels', header: 'Reels', sort: 'reels', csv: (c) => c.reelCount, render: (c) => c.reelCount },
    { key: 'followers', header: 'Followers', sort: 'followers', csv: (c) => c.followerCount, render: (c) => c.followerCount },
    { key: 'added', header: 'Added', sort: 'createdAt', csv: (c) => c.createdAt, render: (c) => formatDateOnly(c.createdAt) },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Row actions" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => openEdit(c)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {c.status !== 'APPROVED' && (
              <DropdownMenuItem onClick={() => setStatus(c, 'APPROVED')}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </DropdownMenuItem>
            )}
            {c.status === 'PENDING' && (
              <DropdownMenuItem onClick={() => setTurnAway({ creator: c, status: 'REJECTED' })}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </DropdownMenuItem>
            )}
            {c.status === 'APPROVED' && (
              <DropdownMenuItem onClick={() => setTurnAway({ creator: c, status: 'SUSPENDED' })}>
                <PauseCircle className="mr-2 h-4 w-4" />
                Suspend
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (confirm(`Remove ${c.displayName} as a creator? Their account stays.`)) {
                  table.runBulk([c], 'Removed', (row) => api.delete(`/api/admin/creators/${row.id}`));
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove creator
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Creators"
        description="People who can publish reels. A creator is an ordinary user with a creator profile — the same account and role."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Add creator
          </Button>
        }
      />

      <DataTable
        table={table}
        columns={columns}
        exportName="creators"
        searchPlaceholder="Search name or email…"
        onRowClick={openEdit}
        filters={
          <FilterSelect
            table={table}
            name="status"
            label="All statuses"
            options={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
        }
      />

      <AddCreatorDialog
        open={adding}
        onClose={() => setAdding(false)}
        onDone={(text) => {
          table.setNotice({ tone: 'success', text });
          void queryClient.invalidateQueries({ queryKey: [table.id] });
        }}
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent page>
          <DialogHeader>
            <DialogTitle>Edit {editing?.user.email}</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="ed-name">Public name</Label>
            <Input id="ed-name" className="mt-1.5" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="ed-bio">Bio</Label>
            <Textarea id="ed-bio" className="mt-1.5" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.isVerified} onChange={(e) => setForm({ ...form, isVerified: e.target.checked })} />
            Verified
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={form.displayName.trim().length < 2}
              onClick={() => {
                const c = editing!;
                setEditing(null);
                table.runBulk([c], 'Saved', (row) =>
                  api.patch(`/api/admin/creators/${row.id}`, {
                    displayName: form.displayName.trim(),
                    bio: form.bio.trim() || null,
                    isVerified: form.isVerified,
                  })
                );
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!turnAway} onOpenChange={(o) => !o && setTurnAway(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {turnAway?.status === 'SUSPENDED' ? 'Suspend' : 'Reject'} {turnAway?.creator.displayName}
            </DialogTitle>
          </DialogHeader>
          {turnAway?.status === 'SUSPENDED' && (
            <p className="text-sm text-muted-foreground">Their reels disappear from the app until they are approved again.</p>
          )}
          <Label htmlFor="turn-reason">Reason</Label>
          <Textarea id="turn-reason" className="mt-1.5" value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTurnAway(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3}
              onClick={() => {
                setStatus(turnAway!.creator, turnAway!.status, reason.trim());
                setTurnAway(null);
                setReason('');
              }}
            >
              {turnAway?.status === 'SUSPENDED' ? 'Suspend' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
