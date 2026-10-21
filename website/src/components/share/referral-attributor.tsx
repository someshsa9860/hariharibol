'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-provider';
import { forgetReferral, pendingReferral } from '@/lib/share-link';

/**
 * Presents a remembered invitation code once the person is signed in. Whatever the answer, the code is forgotten: an
 * accepted one is done, a refused one will not become valid later, and a network failure is retried on the next
 * visit because the code is only dropped when the server answered.
 */
export function ReferralAttributor() {
  const { status } = useAuth();
  useEffect(() => {
    if (status !== 'in') return;
    const code = pendingReferral();
    if (!code) return;
    api('/referral/attribute', { method: 'POST', auth: 'required', body: { code, source: 'LINK' } }).then(forgetReferral, () => undefined);
  }, [status]);
  return null;
}
