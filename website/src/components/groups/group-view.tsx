'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { ErrorState, PageLoading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { api, describeError } from '@/lib/api/client';
import { ApiError } from '@/lib/api/core';
import { useAuth } from '@/lib/auth/auth-provider';
import { onSocketEvent } from '@/lib/socket';
import { useApi } from '@/lib/use-api';
import { isAdmin, type Group, type GroupMember, type GroupRole } from '@/lib/groups/types';
import { GroupGate } from './group-gate';
import { LivePanel } from './live-panel';

const ROLE_LABEL: Record<GroupRole, string> = { OWNER: 'Owner', ADMIN: 'Admin', MEMBER: 'Member' };

export function GroupView({ id }: { id: string }) {
  return (
    <GroupGate>
      <GroupDetail id={id} />
    </GroupGate>
  );
}

function GroupDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { data: group, error, loading, reload } = useApi<Group>(`/groups/${id}`);

  // Members arriving, roles changing, the room opening or closing — and being removed, which sends this person away.
  useEffect(() => {
    const stop = onSocketEvent('group.changed', (payload) => {
      const change = payload as { groupId: string; what: string };
      if (change.groupId !== id) return;
      if (change.what === 'deleted' || change.what === 'removed') {
        toast(change.what === 'deleted' ? 'This group was deleted.' : 'You were removed from this group.');
        router.replace('/groups');
      } else reload();
    });
    const stopLive = onSocketEvent('group.live', (payload) => (payload as { groupId: string }).groupId === id && reload());
    return () => { stop(); stopLive(); };
  }, [id, reload, router, toast]);

  if (loading && !group) return <PageLoading />;
  if (error instanceof ApiError && error.status === 404) {
    return <ErrorState message="This group does not exist, or you are not in it." onRetry={() => router.replace('/groups')} />;
  }
  if (error && !group) return <ErrorState message={describeError(error)} onRetry={reload} />;
  if (!group || !user) return null;

  const admin = isAdmin(group.myRole);

  async function run(action: () => Promise<unknown>, done?: string) {
    try {
      await action();
      if (done) toast(done);
      reload();
    } catch (failure) {
      toast(describeError(failure));
    }
  }

  async function leave() {
    if (!window.confirm('Leave this group?')) return;
    try {
      await api(`/groups/${id}/leave`, { method: 'POST', auth: 'required' });
      router.replace('/groups');
    } catch (failure) {
      toast(describeError(failure));
    }
  }

  async function destroy() {
    if (!window.confirm(`Delete “${group!.name}” for everyone? This cannot be undone.`)) return;
    try {
      await api(`/groups/${id}`, { method: 'DELETE', auth: 'required' });
      router.replace('/groups');
    } catch (failure) {
      toast(describeError(failure));
    }
  }

  const members = group.members ?? [];
  const active = members.filter((m) => m.status === 'ACTIVE');
  const invited = members.filter((m) => m.status === 'INVITED');

  return (
    <div className="page-narrow group-page enter">
      <Link href="/groups" className="back-link"><Icon name="left" size={16} /> Groups</Link>
      <h1>{group.name}</h1>
      {group.description && <p className="muted">{group.description}</p>}
      {group.mantra && <p className="group-mantra"><Icon name="chant" size={16} /> {group.mantra.name}</p>}

      <LivePanel group={group} me={user.id} onChange={reload} />

      <section aria-label="Members">
        <h2 className="group-h2">People · {active.length}</h2>
        {admin && <InviteForm groupId={id} onInvited={reload} />}
        <ul className="member-list">
          {active.map((member) => (
            <MemberRow key={member.id} member={member} mine={group.myRole} me={user.id} run={run} groupId={id} />
          ))}
        </ul>
        {invited.length > 0 && (
          <>
            <h3 className="group-h3">Waiting to answer</h3>
            <ul className="member-list">
              {invited.map((member) => (
                <MemberRow key={member.id} member={member} mine={group.myRole} me={user.id} run={run} groupId={id} />
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="group-danger">
        {group.myRole === 'OWNER' ? (
          <button className="btn btn-danger" onClick={destroy}><Icon name="trash" size={18} /> Delete group</button>
        ) : (
          <button className="btn btn-ghost" onClick={leave}><Icon name="logout" size={18} /> Leave group</button>
        )}
        {group.myRole !== 'OWNER' && <small className="muted">Only the person who made the group can delete it.</small>}
      </div>
    </div>
  );
}

function InviteForm({ groupId, onInvited }: { groupId: string; onInvited: () => void }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/groups/${groupId}/invite`, { method: 'POST', auth: 'required', body: { email } });
      toast('Invitation sent.');
      setEmail('');
      onInvited();
    } catch (failure) {
      toast(failure instanceof ApiError && failure.status === 404 ? 'No one has signed up with that email yet.' : describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="invite-form" onSubmit={submit}>
      <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Invite by email" aria-label="Email to invite" required />
      <button className="btn btn-primary" disabled={busy || !email}>Invite</button>
    </form>
  );
}

function MemberRow({ member, mine, me, groupId, run }: {
  member: GroupMember;
  mine: GroupRole;
  me: string;
  groupId: string;
  run: (action: () => Promise<unknown>, done?: string) => Promise<void>;
}) {
  const self = member.id === me;
  const waiting = member.status === 'INVITED';
  // An admin may remove an ordinary member or cancel an invitation; only the owner touches an admin. Nobody touches the owner.
  const canRemove = !self && member.role !== 'OWNER' && isAdmin(mine) && (member.role !== 'ADMIN' || mine === 'OWNER');
  const canPromote = !self && !waiting && member.role === 'MEMBER' && isAdmin(mine);
  const canDemote = !self && member.role === 'ADMIN' && mine === 'OWNER';
  const setRole = (role: 'ADMIN' | 'MEMBER') => run(() => api(`/groups/${groupId}/members/${member.id}/role`, { method: 'PUT', auth: 'required', body: { role } }));

  return (
    <li className="member">
      <Avatar name={member.name} url={member.avatarUrl} size={38} />
      <span className="member-name">
        <strong>{member.name ?? 'Devotee'}{self ? ' (you)' : ''}</strong>
        <small className="muted">{waiting ? 'Invited' : ROLE_LABEL[member.role]}</small>
      </span>
      {canPromote && <button className="btn btn-quiet btn-sm" onClick={() => setRole('ADMIN')}>Make admin</button>}
      {canDemote && <button className="btn btn-quiet btn-sm" onClick={() => setRole('MEMBER')}>Remove admin</button>}
      {canRemove && (
        <button
          className="icon-btn"
          aria-label={waiting ? `Cancel invitation for ${member.name ?? 'this person'}` : `Remove ${member.name ?? 'this person'}`}
          onClick={() => window.confirm(waiting ? 'Cancel this invitation?' : `Remove ${member.name ?? 'this person'} from the group?`) && run(() => api(`/groups/${groupId}/members/${member.id}`, { method: 'DELETE', auth: 'required' }))}
        >
          <Icon name="x" size={18} />
        </button>
      )}
    </li>
  );
}
