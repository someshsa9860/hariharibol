'use client';

import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/states';
import { useAuth } from '@/lib/auth/auth-provider';
import { SakhaChat } from './sakha-chat';

/** Sakha is the one part of the site that needs an account — replies are written for, and paid from, a person's wallet. */
export function SakhaGate() {
  const { status, openSignIn } = useAuth();
  if (status === 'loading') return <div className="center-state"><Spinner /></div>;
  if (status === 'in') return <SakhaChat />;

  return (
    <div className="page-narrow sakha-intro enter">
      <span className="welcome-art big" aria-hidden="true"><Icon name="sakha" size={44} /></span>
      <p className="eyebrow">Ask Sakha</p>
      <h1>A friend to talk to about the path.</h1>
      <p className="muted">
        Sakha is a digital companion — not a person — that answers with warmth, one small step at a time. Ask about a verse, a practice, or whatever is on your heart. It can make mistakes, so check what matters with a teacher.
      </p>
      <ul className="intro-points">
        <li><Icon name="check" size={18} /> Welcomes every tradition and faith</li>
        <li><Icon name="check" size={18} /> No pressure, no pushing — you choose the pace</li>
        <li><Icon name="check" size={18} /> Free to try, with optional plans for more replies</li>
      </ul>
      <button className="btn btn-primary btn-lg" onClick={() => openSignIn('Sign in with Google or Apple to talk with Sakha.')}>Sign in to talk with Sakha</button>
      <p className="muted small-note">Everything else on the site — reading, chanting, reels — needs no account.</p>
    </div>
  );
}
