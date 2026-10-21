'use client';

import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/states';
import { useAuth } from '@/lib/auth/auth-provider';

/** Groups are private and made of accounts, so, like Sakha, they need a sign-in. */
export function GroupGate({ children }: { children: ReactNode }) {
  const { status, openSignIn } = useAuth();
  if (status === 'loading') return <div className="center-state"><Spinner /></div>;
  if (status === 'in') return <>{children}</>;

  return (
    <div className="page-narrow sakha-intro enter">
      <span className="welcome-art big" aria-hidden="true"><Icon name="chant" size={44} /></span>
      <p className="eyebrow">Chant together</p>
      <h1>A private circle to chant with.</h1>
      <p className="muted">
        Make a group for your family or satsang, invite people by email, and chant together by voice — right in the browser.
      </p>
      <button className="btn btn-primary btn-lg" onClick={() => openSignIn('Sign in to chant with your group.')}>Sign in to chant together</button>
    </div>
  );
}
