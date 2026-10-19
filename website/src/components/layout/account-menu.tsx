'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth/auth-provider';
import { Popover } from './popover';

export function AccountMenu() {
  const { status, user, openSignIn, signOut } = useAuth();

  if (status === 'loading') return <span className="icon-btn" aria-hidden="true" />;
  if (!user) {
    return (
      <button className="btn btn-ghost btn-sm" onClick={() => openSignIn()}>
        Sign in
      </button>
    );
  }

  return (
    <Popover label="Your account" trigger={<Avatar name={user.name ?? user.email} url={user.avatarUrl} size={32} />}>
      {(close) => (
        <div className="popover-body" onClick={(event) => (event.target as HTMLElement).closest('a,button') && close()}>
          <div className="account-who">
            <strong>{user.name ?? 'Devotee'}</strong>
            <small>{user.email}</small>
          </div>
          <Link className="menu-item" href="/me"><Icon name="user" size={18} /> Your page</Link>
          <Link className="menu-item" href="/routine"><Icon name="routine" size={18} /> Routine</Link>
          <Link className="menu-item" href="/plans"><Icon name="sakha" size={18} /> Plans</Link>
          <button className="menu-item" onClick={() => signOut()}><Icon name="logout" size={18} /> Sign out</button>
        </div>
      )}
    </Popover>
  );
}
