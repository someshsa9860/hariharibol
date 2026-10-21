'use client';

import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/states';
import { useAuth } from '@/lib/auth/auth-provider';
import { appleEnabled, googleEnabled, renderGoogleButton, signInWithApple } from '@/lib/auth/social';
import { describeError } from '@/lib/api/client';
import { LEGAL_LINKS } from '@/lib/config';

export function AuthDialog({ reason, onClose }: { reason?: string; onClose: () => void }) {
  const { signInWithToken } = useAuth();
  const googleSlot = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasGoogle = googleEnabled();
  const hasApple = appleEnabled();

  useEffect(() => {
    if (!hasGoogle || !googleSlot.current) return;
    renderGoogleButton(googleSlot.current, async (idToken) => {
      setBusy(true);
      setError(null);
      try {
        await signInWithToken('GOOGLE', idToken);
      } catch (failure) {
        setError(describeError(failure, 'We could not sign you in with Google. Please try again.'));
        setBusy(false);
      }
    }).catch(() => setError('Google sign-in could not load. Check your connection and try again.'));
  }, [hasGoogle, signInWithToken]);

  const apple = async () => {
    setBusy(true);
    setError(null);
    try {
      const { idToken, name } = await signInWithApple();
      await signInWithToken('APPLE', idToken, name);
    } catch (failure) {
      // Closing Apple's popup is a choice, not a failure.
      const closed = typeof failure === 'object' && failure !== null && 'error' in failure && (failure as { error: string }).error === 'popup_closed_by_user';
      if (!closed) setError(describeError(failure, 'We could not sign you in with Apple. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <Sheet title="Welcome" onClose={onClose}>
      <div className="auth-body">
        <div className="auth-art" aria-hidden="true"><Icon name="sakha" size={28} /></div>
        <p className="auth-reason">{reason ?? 'Sign in to keep your progress and to talk with Sakha.'}</p>
        <p className="muted auth-sub">Reading, mantras and reels never need an account.</p>

        {error && <div className="notice notice-error" role="alert">{error}</div>}

        <div className="auth-buttons" aria-busy={busy}>
          {hasGoogle && <div ref={googleSlot} className="google-slot" />}
          {hasApple && (
            <button className="btn btn-block apple-btn" onClick={apple} disabled={busy}>
              <Icon name="apple" size={18} /> Continue with Apple
            </button>
          )}
          {!hasGoogle && !hasApple && (
            <div className="notice">Sign-in is not set up on this site yet (WEBSITE_GOOGLE_CLIENT_ID is missing).</div>
          )}
          {busy && <div className="auth-busy"><Spinner label="Signing in" /></div>}
        </div>

        <p className="auth-legal">
          By continuing you agree to the <a href={LEGAL_LINKS[1].href} rel="noopener" target="_blank">Terms</a> and{' '}
          <a href={LEGAL_LINKS[0].href} rel="noopener" target="_blank">Privacy Policy</a>.
        </p>
      </div>
    </Sheet>
  );
}
