'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth/auth-provider';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/core';
import { forgetReferral, recallReferral } from '@/lib/referral-store';

/**
 * Once someone is signed in, hands the invitation code they arrived with to the server. Renders nothing. The server
 * is the judge: a code that cannot count (their own, an old account, a second invitation) is answered 409 and is
 * dropped here too, so it is never retried; a network failure keeps the code for next time.
 */
export function ReferralClaimer() {
  const { status } = useAuth();
  const tried = useRef(false);

  useEffect(() => {
    if (status !== 'in' || tried.current) return;
    const code = recallReferral();
    if (!code) return;
    tried.current = true;
    api('/referral/claim', { method: 'POST', body: { code }, auth: 'required' })
      .then(forgetReferral)
      .catch((error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) forgetReferral();
        else tried.current = false;
      });
  }, [status]);

  return null;
}
