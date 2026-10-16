import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { useDebounced } from '@/lib/use-debounced';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type PickableUser = { id: string; email: string; name: string | null; creatorProfile: { id: string } | null };

/**
 * Makes an existing user a creator. A creator is the same account with a profile
 * attached — their role is left alone — so this picks a user rather than
 * creating one. Pass `user` to skip the search (the Users page does).
 */
export function AddCreatorDialog({
  open,
  user: fixedUser,
  onClose,
  onDone,
}: {
  open: boolean;
  user?: PickableUser | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<PickableUser | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isVerified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const user = fixedUser ?? picked;
  const q = useDebounced(search.trim());
  const found = useResource<{ items?: PickableUser[] } | PickableUser[]>(
    ['creator-user-search', q],
    '/api/admin/users',
    { q, pageSize: 8 },
    { enabled: open && !fixedUser && q.length >= 2 }
  );
  const matches = Array.isArray(found.data) ? found.data : (found.data?.items ?? []);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setPicked(null);
    setBio('');
    setVerified(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    setDisplayName(user?.name || user?.email.split('@')[0] || '');
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/admin/creators', {
        userId: user.id,
        displayName: displayName.trim(),
        bio: bio.trim() || null,
        isVerified,
      });
      onDone(`${user.email} is now a creator.`);
      onClose();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a creator</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A creator is an ordinary user with a creator profile. Their role does not change, and an admin can be a creator
          too. The person must have signed in to the app once.
        </p>

        {!fixedUser && (
          <div>
            <Label htmlFor="creator-user">User</Label>
            {user ? (
              <div className="mt-1.5 flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>
                  {user.name || '—'} <span className="text-muted-foreground">{user.email}</span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="creator-user"
                  className="mt-1.5"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or email…"
                />
                <div className="mt-1.5 flex flex-col gap-1">
                  {matches.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      disabled={!!u.creatorProfile}
                      onClick={() => setPicked(u)}
                      className="rounded-md border px-3 py-1.5 text-left text-sm hover:bg-accent disabled:opacity-50"
                    >
                      {u.name || '—'} <span className="text-muted-foreground">{u.email}</span>
                      {u.creatorProfile && <span className="ml-2 text-xs">already a creator</span>}
                    </button>
                  ))}
                  {q.length >= 2 && !found.isLoading && matches.length === 0 && (
                    <p className="text-sm text-muted-foreground">No one matches.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {user && (
          <>
            <div>
              <Label htmlFor="creator-name">Public name</Label>
              <Input id="creator-name" className="mt-1.5" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="creator-bio">Bio (optional)</Label>
              <Textarea id="creator-bio" className="mt-1.5" value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isVerified} onChange={(e) => setVerified(e.target.checked)} />
              Verified
            </label>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!user || displayName.trim().length < 2 || busy} onClick={submit}>
            Make creator
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
