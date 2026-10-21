'use client';

import { useEffect } from 'react';
import { rememberReferral } from '@/lib/referral-store';

/** Keeps the invitation code for after sign-in. Renders nothing. */
export function RememberReferral({ code }: { code: string }) {
  useEffect(() => rememberReferral(code), [code]);
  return null;
}
