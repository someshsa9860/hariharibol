import { useState } from 'react';
import { useResource } from '@/lib/use-resource';
import { useDebounced } from '@/lib/use-debounced';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type PickedUser = { id: string; email: string; name: string | null };

/** Search users by name or email and choose one. */
export function UserPicker({ value, onChange }: { value: PickedUser | null; onChange: (user: PickedUser | null) => void }) {
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const found = useResource<{ items?: PickedUser[] } | PickedUser[]>(
    ['user-picker', q],
    '/api/admin/users',
    { q, pageSize: 8 },
    { enabled: !value && q.length >= 2 }
  );
  const matches = Array.isArray(found.data) ? found.data : (found.data?.items ?? []);

  if (value) {
    return (
      <div className="mt-1 flex w-80 items-center justify-between rounded-md border px-3 py-2 text-sm">
        <span>
          {value.name || '—'} <span className="text-muted-foreground">{value.email}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="w-80">
      <Input className="mt-1" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" />
      <div className="mt-1.5 flex flex-col gap-1">
        {matches.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => onChange(u)}
            className="rounded-md border px-3 py-1.5 text-left text-sm hover:bg-accent"
          >
            {u.name || '—'} <span className="text-muted-foreground">{u.email}</span>
          </button>
        ))}
        {q.length >= 2 && !found.isLoading && matches.length === 0 && <p className="text-sm text-muted-foreground">No one matches.</p>}
      </div>
    </div>
  );
}
