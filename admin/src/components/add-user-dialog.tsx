import { useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useResource } from '@/lib/use-resource';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type RoleRow = { slug: string; name: string; description: string | null; permissions: unknown[] };

/**
 * Adds a person by email before they have signed in. The account is a placeholder that their
 * first Google or Apple sign-in with the same address takes over, keeping the role chosen here.
 * `admin` mode offers the roles that carry permissions; otherwise the person is an ordinary user.
 */
export function AddUserDialog({
  open,
  admin = false,
  onClose,
  onDone,
}: {
  open: boolean;
  admin?: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleSlug, setRoleSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const roles = useResource<RoleRow[]>(['roles'], '/api/admin/roles', undefined, { enabled: open && admin });
  const adminRoles = (roles.data ?? []).filter((r) => r.permissions.length > 0);

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setName('');
    setRoleSlug('');
    setError(null);
  }, [open]);

  const role = roleSlug || adminRoles[0]?.slug || '';
  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && (!admin || role !== '');
  const noun = admin ? 'admin' : 'user';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/admin/users', {
        email: email.trim(),
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(admin ? { roleSlug: role } : {}),
      });
      onDone(`${email.trim().toLowerCase()} added as ${noun}. They get access when they sign in with that email.`);
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
          <DialogTitle>Add {admin ? 'an admin' : 'a user'}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Use the email of their Google or Apple account. The account is ready now; the first time they sign in with that
          address they land in it{admin ? ' with this role' : ''}.
        </p>
        <div>
          <Label htmlFor="add-user-email">Email</Label>
          <Input id="add-user-email" type="email" className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="add-user-name">Name (optional)</Label>
          <Input id="add-user-name" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {admin && (
          <div>
            <Label htmlFor="add-user-role">Role</Label>
            <Select id="add-user-role" className="mt-1.5" value={role} onChange={(e) => setRoleSlug(e.target.value)}>
              {adminRoles.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || busy} onClick={submit}>
            Add {noun}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
