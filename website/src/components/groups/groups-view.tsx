'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState, ErrorState, PageLoading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, describeError } from '@/lib/api/client';
import { onSocketEvent } from '@/lib/socket';
import { useApi } from '@/lib/use-api';
import type { GroupList } from '@/lib/groups/types';
import { GroupGate } from './group-gate';

export function GroupsView() {
  return (
    <GroupGate>
      <GroupsList />
    </GroupGate>
  );
}

function GroupsList() {
  const { data, error, loading, reload } = useApi<GroupList>('/groups');
  const [making, setMaking] = useState(false);
  const toast = useToast();

  // An invitation, a room opening or a group changing elsewhere: read the list again.
  useEffect(() => {
    const stops = ['group.invited', 'group.live', 'group.changed'].map((event) => onSocketEvent(event, reload));
    return () => stops.forEach((stop) => stop());
  }, [reload]);

  async function answer(groupId: string, how: 'accept' | 'decline') {
    try {
      await api(`/groups/${groupId}/${how}`, { method: 'POST', auth: 'required' });
      reload();
    } catch (failure) {
      toast(describeError(failure));
    }
  }

  if (loading && !data) return <PageLoading />;
  if (error && !data) return <ErrorState message={describeError(error)} onRetry={reload} />;
  const { groups = [], invitations = [] } = data ?? {};

  return (
    <div className="page-narrow groups-page enter">
      <div className="row-head">
        <div>
          <p className="eyebrow">Chant together</p>
          <h1>Your groups</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setMaking(true)}><Icon name="plus" size={18} /> New group</button>
      </div>

      {invitations.length > 0 && (
        <section className="group-invites" aria-label="Invitations">
          {invitations.map((invite) => (
            <div key={invite.groupId} className="card group-invite">
              <div>
                <strong>{invite.name}</strong>
                <small className="muted">{invite.invitedBy?.name ? `${invite.invitedBy.name} invited you` : 'You are invited'}</small>
              </div>
              <div className="group-invite-actions">
                <button className="btn btn-primary btn-sm" onClick={() => answer(invite.groupId, 'accept')}>Join</button>
                <button className="btn btn-ghost btn-sm" onClick={() => answer(invite.groupId, 'decline')}>Decline</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {groups.length === 0 ? (
        <EmptyState title="No groups yet" action={<button className="btn btn-primary" onClick={() => setMaking(true)}>Make your first group</button>}>
          A group is private — only people you invite can see it or join its chanting room.
        </EmptyState>
      ) : (
        <ul className="group-list">
          {groups.map((group) => (
            <li key={group.id}>
              <Link href={`/groups/${group.id}`} className="card card-hover group-card">
                <span className="group-card-icon" aria-hidden="true"><Icon name="chant" size={22} /></span>
                <span className="group-card-body">
                  <strong>{group.name}</strong>
                  <small className="muted">
                    {group.memberCount} {group.memberCount === 1 ? 'person' : 'people'}
                    {group.mantra ? ` · ${group.mantra.name}` : ''}
                  </small>
                </span>
                {group.live && (
                  <span className="live-badge">
                    <i aria-hidden="true" /> Chanting · {group.live.participants.length}
                  </span>
                )}
                <Icon name="right" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {making && <NewGroupSheet onClose={() => setMaking(false)} onMade={() => { setMaking(false); reload(); }} />}
    </div>
  );
}

function NewGroupSheet({ onClose, onMade }: { onClose: () => void; onMade: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/groups', { method: 'POST', auth: 'required', body: { name, description: description || undefined } });
      onMade();
    } catch (failure) {
      toast(describeError(failure));
      setBusy(false);
    }
  }

  return (
    <Sheet title="New group" onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label>
          <span>Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} minLength={2} required autoFocus placeholder="Morning japa" />
        </label>
        <label>
          <span>About (optional)</span>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} />
        </label>
        <p className="muted small-note">You will be the group’s owner. Only you can delete it; you can make others admins.</p>
        <button className="btn btn-primary" disabled={busy || name.trim().length < 2}>Create group</button>
      </form>
    </Sheet>
  );
}

