'use client';

import { useState } from 'react';
import { api, describeError } from '@/lib/api/client';

type State = 'ask' | 'busy' | 'off' | 'on' | 'missing';

/** The unsubscribe page: one tap switches marketing email off (a mail program's one-click does it without this page), and a second brings it back. */
export function UnsubscribeForm({ code }: { code: string }) {
  const [state, setState] = useState<State>('ask');
  const [error, setError] = useState('');
  const send = async (path: 'unsubscribe' | 'resubscribe', next: State) => {
    setState('busy'); setError('');
    try {
      await api(`/api/web/marketing/${path}/${encodeURIComponent(code)}`, { method: 'POST', auth: 'none' });
      setState(next);
    } catch (err) {
      const message = describeError(err);
      setError(message);
      setState(/not found|link/i.test(message) ? 'missing' : path === 'unsubscribe' ? 'ask' : 'off');
    }
  };
  return (
    <>
      {state === 'ask' && <><p className="muted" style={{ margin: 0 }}>Stop emails from HariHariBol about the app and its news? Messages about your account or purchases are separate and may still arrive.</p><button className="btn" onClick={() => send('unsubscribe', 'off')}>Unsubscribe</button></>}
      {state === 'busy' && <p className="muted" style={{ margin: 0 }}>One moment…</p>}
      {state === 'off' && <><p style={{ margin: 0 }}>You are unsubscribed. Hari Bol! We will not send you these emails.</p><button className="btn btn-ghost" onClick={() => send('resubscribe', 'on')}>I changed my mind</button></>}
      {state === 'on' && <p style={{ margin: 0 }}>Welcome back. You will hear from us again.</p>}
      {state === 'missing' && <p style={{ margin: 0 }}>This link is not valid any more. If you still get emails you do not want, reply to one and we will stop them.</p>}
      {error && state !== 'missing' && <p className="muted small" role="alert" style={{ margin: 0 }}>{error}</p>}
    </>
  );
}
