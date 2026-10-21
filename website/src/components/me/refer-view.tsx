'use client';

import { useState } from 'react';
import { SignInGate } from '@/components/auth/sign-in-gate';
import { Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { Icon } from '@/components/ui/icon';
import { api, describeError } from '@/lib/api/client';
import { useApi } from '@/lib/use-api';
import { copyText, share } from '@/lib/share';

interface Summary {
  code: string;
  url: string;
  totals: { invited: number; pending: number; successful: number; rewardsEarned: number };
  rewardActiveUntil: string | null;
  rules: { rewardDays: number; qualifyRounds: number; qualifyWithinDays: number; attributionWindowDays: number; limitPerYear: number; remainingThisYear: number };
  history: { id: string; name: string; status: 'PENDING' | 'QUALIFIED' | 'REJECTED' | 'REVERSED'; invitedAt: string; qualifiedAt: string | null; reason: string | null; reward: { startsAt: string; endsAt: string; revoked: boolean } | null }[];
  page: { page: number; hasMore: boolean };
}

const STATUS: Record<Summary['history'][number]['status'], string> = {
  PENDING: 'Waiting for their first round', QUALIFIED: 'Rewarded', REJECTED: 'Not eligible', REVERSED: 'Reward withdrawn',
};
const REFUSED: Record<string, string> = {
  invalid_code: 'That code was not found. Check it and try again.',
  own_code: 'That is your own code.',
  already_referred: 'You have already used an invitation.',
  not_new: 'Invitations are for people who are new to HariHariBol.',
  window_passed: 'That code can only be used in your first week.',
  same_person: 'That invitation cannot be used on this account.',
  referrer_unavailable: 'That invitation is not available.',
  referrer_busy: 'That invitation is not available right now.',
};
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function ReferView() {
  return (
    <div className="page-narrow">
      <header className="chapter-head">
        <p className="eyebrow">Satsang</p>
        <h1>Refer and earn</h1>
      </header>
      <SignInGate reason="Sign in to get your invitation link.">
        <ReferBody />
      </SignInGate>
    </div>
  );
}

function ReferBody() {
  const toast = useToast();
  const summary = useApi<Summary>('/referral/me', { auth: 'required' });
  const mine = useApi<{ status: string; referrerName: string | null } | null>('/referral/mine', { auth: 'required' });
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  if (summary.loading) return <div className="center-state"><Spinner /></div>;
  const s = summary.data;
  if (!s) return <div className="center-state"><p>{describeError(summary.error, 'Your invitation could not be loaded.')}</p><button className="btn btn-ghost" onClick={summary.reload}>Try again</button></div>;

  const text = `Join me on HariHariBol — verses, mantras and daily devotion. ${s.url}`;
  const onShare = async () => {
    const result = await share({ title: 'Join me on HariHariBol', text: 'Join me on HariHariBol — verses, mantras and daily devotion.', url: s.url });
    if (result === 'copied') toast('Link copied');
    if (result === 'failed') toast('Could not share. Copy the link instead.');
  };
  const submit = async () => {
    setBusy(true);
    try {
      const result = await api<{ attributed: boolean; reason?: string }>('/referral/attribute', { method: 'POST', auth: 'required', body: { code: typed, source: 'CODE' } });
      toast(result.attributed ? 'Invitation accepted — thank you' : REFUSED[result.reason ?? ''] ?? 'That invitation could not be used');
      if (result.attributed) { setTyped(''); mine.reload(); }
    } catch (error) { toast(describeError(error)); } finally { setBusy(false); }
  };

  return (
    <div className="refer-grid">
      <section className="card" style={{ padding: 22, display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0 }}>Invite a friend</h2>
        <p className="muted" style={{ margin: 0 }}>
          When someone you invite finishes {s.rules.qualifyRounds === 1 ? 'a round' : `${s.rules.qualifyRounds} rounds`} of chanting, you receive {s.rules.rewardDays} days of Ārta.
        </p>
        <div><span className="refer-code" aria-label={`Your code ${s.code.split('').join(' ')}`}>{s.code}</span></div>
        <p className="muted small" style={{ wordBreak: 'break-all', margin: 0 }}>{s.url}</p>
        <div className="studio-actions">
          <button className="btn btn-primary" onClick={onShare}><Icon name="share" size={16} /> Share link</button>
          <button className="btn btn-ghost" onClick={() => copyText(s.url).then((ok) => toast(ok ? 'Link copied' : 'Could not copy'))}><Icon name="copy" size={16} /> Copy link</button>
          <button className="btn btn-ghost" onClick={() => copyText(s.code).then((ok) => toast(ok ? 'Code copied' : 'Could not copy'))}>Copy code</button>
          <a className="btn btn-quiet" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener">WhatsApp</a>
        </div>
        {s.rewardActiveUntil && <p style={{ margin: 0 }}><strong>Ārta from your invitations is active until {date(s.rewardActiveUntil)}.</strong></p>}
      </section>

      <section className="card" style={{ padding: 22, display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0 }}>Your invitations</h2>
        <div className="refer-stats">
          <div><strong>{s.totals.invited}</strong><small>invited</small></div>
          <div><strong>{s.totals.pending}</strong><small>waiting</small></div>
          <div><strong>{s.totals.successful}</strong><small>rewarded</small></div>
        </div>
        {s.history.length === 0
          ? <p className="muted" style={{ margin: 0 }}>No one has used your link yet.</p>
          : (
            <ul className="refer-history">
              {s.history.map((h) => (
                <li key={h.id}>
                  <span><strong>{h.name}</strong><br /><small className="muted">Invited {date(h.invitedAt)}</small></span>
                  <span style={{ textAlign: 'right' }}>{STATUS[h.status]}{h.reward && !h.reward.revoked && <><br /><small className="muted">{date(h.reward.startsAt)} – {date(h.reward.endsAt)}</small></>}</span>
                </li>
              ))}
            </ul>
          )}
      </section>

      {mine.data === null && !mine.loading && (
        <section className="card" style={{ padding: 22, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Were you invited?</h2>
          <p className="muted" style={{ margin: 0 }}>If a friend gave you a code, enter it here. This works in your first {s.rules.attributionWindowDays} days.</p>
          <div className="studio-row">
            <input className="input" style={{ flex: 1, minWidth: 160, textTransform: 'uppercase' }} value={typed} maxLength={14} onChange={(e) => setTyped(e.target.value)} aria-label="Invitation code" placeholder="ABCD2345" />
            <button className="btn btn-primary" disabled={busy || typed.trim().length < 6} onClick={submit}>Use code</button>
          </div>
        </section>
      )}
      {mine.data && <section className="card" style={{ padding: 22 }}><p style={{ margin: 0 }}>{mine.data.referrerName ?? 'A friend'} invited you.</p></section>}

      <section className="card" style={{ padding: 22, display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>How it works</h2>
        <ol className="muted" style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
          <li>Share your link or code. Opening the link alone earns nothing.</li>
          <li>Your friend signs in as a new member and uses it within their first {s.rules.attributionWindowDays} days.</li>
          <li>When they finish {s.rules.qualifyRounds === 1 ? 'a round' : `${s.rules.qualifyRounds} rounds`} of chanting within {s.rules.qualifyWithinDays} days, you receive {s.rules.rewardDays} days of Ārta.</li>
        </ol>
        <details>
          <summary>Terms</summary>
          <ul className="muted small" style={{ display: 'grid', gap: 4 }}>
            <li>A person can be invited once, by the first valid code they use. You cannot use your own code or invite another account of yours.</li>
            <li>Only new members qualify. People who have already subscribed or paid are not new.</li>
            <li>Up to {s.rules.limitPerYear} rewards a year ({s.rules.remainingThisYear} left for you now). Rewards add to your time; they never replace or shorten a paid subscription.</li>
            <li>The reward is access given by us, not a store subscription. It can be withdrawn if the invitation turns out to be misuse.</li>
            <li>We keep only what is needed to run this: who invited whom, and when.</li>
          </ul>
        </details>
      </section>
    </div>
  );
}
