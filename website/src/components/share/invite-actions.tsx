'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { rememberReferral } from '@/lib/share-link';

/**
 * Keeps the invitation until the person has an account, then ReferralAttributor presents it. Opening this page rewards
 * nobody; the reward waits for the first round of chanting.
 */
export function InviteActions({ code }: { code: string }) {
  const { status, openSignIn } = useAuth();
  useEffect(() => { rememberReferral(code); }, [code]);
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
      {status === 'in'
        ? <Link className="btn btn-primary" href="/jap">Begin chanting</Link>
        : <button className="btn btn-primary" onClick={() => openSignIn('Sign in to accept the invitation')}>Join on the website</button>}
      <Link className="btn btn-ghost" href="/">Continue on the website</Link>
    </div>
  );
}
