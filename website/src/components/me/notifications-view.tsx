'use client';

import { useEffect } from 'react';
import clsx from 'clsx';
import { EmptyState, Spinner } from '@/components/ui/states';
import { SignInGate } from '@/components/auth/sign-in-gate';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-provider';
import { useApi } from '@/lib/use-api';

interface Item { id: string; title: string; body: string; readAt: string | null; createdAt: string }

export function NotificationsView() {
  const { status } = useAuth();
  const list = useApi<Item[]>(status === 'in' ? '/notifications?pageSize=50' : null, { auth: 'required' });
  useEffect(() => { if (list.data?.some((n) => !n.readAt)) api('/notifications/read-all', { method: 'POST', auth: 'required' }).catch(() => undefined); }, [list.data]);
  return (
    <div className="page-narrow">
      <header className="page-title"><p className="eyebrow">Updates</p><h1>Notifications</h1></header>
      <SignInGate reason="Sign in to see your notifications.">
        {list.loading ? <div className="center-state"><Spinner /></div> : !list.data?.length ? <EmptyState title="You are all caught up" motif="sun">New verses and reminders will appear here.</EmptyState> : (
          <ul className="comment-list">
            {list.data.map((n) => (
              <li key={n.id} className={clsx('card note', !n.readAt && 'is-unread')}>
                <strong>{n.title}</strong><p className="muted">{n.body}</p>
                <small className="muted">{new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small>
              </li>
            ))}
          </ul>
        )}
      </SignInGate>
    </div>
  );
}
