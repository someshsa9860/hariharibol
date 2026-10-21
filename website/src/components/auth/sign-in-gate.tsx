'use client';

import type { ReactNode } from 'react';
import { Spinner } from '@/components/ui/states';
import { useAuth } from '@/lib/auth/auth-provider';

/** Shows its children to a signed-in reader, and an invitation to everyone else. */
export function SignInGate({ reason, children }: { reason: string; children: ReactNode }) {
  const { status, openSignIn } = useAuth();
  if (status === 'loading') return <div className="center-state"><Spinner /></div>;
  if (status === 'out') return <div className="center-state"><p>{reason}</p><button className="btn btn-primary" onClick={() => openSignIn(reason)}>Sign in</button></div>;
  return <>{children}</>;
}
