'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth/auth-provider';
import { api, describeError } from '@/lib/api/client';
import { useApi } from '@/lib/use-api';
import { copyText, share } from '@/lib/share';

interface Referral {
  code: string; url: string;
  rules: { rewardDays: number; plan: string; maxPerYear: number };
  totals: { pending: number; rewarded: number; rejected: number };
  rewards: { id: string; startsAt: string; endsAt: string; grantedAt: string }[];
  history: { id: string; name: string | null; status: 'PENDING' | 'REWARDED' | 'REJECTED'; claimedAt: string; qualifiedAt: string | null }[];
  historyTotal: number;
  referredBy: { status: string; claimedAt: string } | null;
}

const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const STATUS = { PENDING: 'Joined — settling in', REWARDED: 'Reward earned', REJECTED: 'Not eligible' } as const;

export function ReferView() {
  const { status, openSignIn } = useAuth();
  const toast = useToast();
  const data = useApi<Referral>(status === 'in' ? '/referral/me' : null, { auth: 'required' });
  const [entering, setEntering] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'loading') return <div className="center-state"><Spinner /></div>;
  if (status === 'out') {
    return (
      <div className="page-narrow center-state">
        <h1>Refer &amp; Earn</h1>
        <p className="muted">Sign in to get your invitation link.</p>
        <button className="btn btn-primary" onClick={() => openSignIn('Sign in to get your invitation link')}>Sign in</button>
      </div>
    );
  }
  if (data.loading && !data.data) return <div className="center-state"><Spinner /></div>;
  if (!data.data) return <div className="center-state"><p>{describeError(data.error)}</p><button className="btn btn-ghost" onClick={data.reload}>Try again</button></div>;

  const d = data.data;
  const message = `Join me on HariHariBol — verses, mantras and Sakha, free. ${d.url}`;

  const claim = async () => {
    setBusy(true);
    try {
      await api('/referral/claim', { method: 'POST', body: { code: entering.trim() }, auth: 'required' });
      toast('Thank you — your invitation is noted');
      setEntering('');
      data.reload();
    } catch (error) {
      toast(describeError(error, 'That code could not be used'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-narrow refer">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/me">Me</Link><Icon name="right" size={14} /><span>Refer &amp; Earn</span></nav>
      <h1>Refer &amp; Earn</h1>
      <p className="muted">Invite a friend. When they join and settle in, you receive {d.rules.rewardDays} days of the Ārta plan — Sakha’s extra replies — with our thanks.</p>

      <section className="card refer-box" aria-label="Your invitation link">
        <code className="refer-link">{d.url}</code>
        <p className="muted small">Your code: <strong>{d.code}</strong></p>
        <div className="share-actions">
          <button className="btn btn-primary" onClick={async () => { const r = await share({ title: 'Join me on HariHariBol', text: message, url: d.url }); if (r === 'copied') toast('Link copied'); if (r === 'failed') toast('Could not share'); }}><Icon name="share" size={18} /> Share</button>
          <button className="btn btn-ghost" onClick={async () => toast((await copyText(d.url)) ? 'Link copied' : 'Could not copy')}>Copy link</button>
        </div>
      </section>

      <section className="refer-stats" aria-label="Your referrals">
        <div className="card"><strong>{d.totals.pending}</strong><span>Settling in</span></div>
        <div className="card"><strong>{d.totals.rewarded}</strong><span>Rewards earned</span></div>
      </section>

      <section>
        <h2>How it works</h2>
        <ol className="refer-steps">
          <li>Share your link. Opening a shared verse or reel never counts — only your invitation does.</li>
          <li>Your friend signs in as a <em>new</em> member within a week of opening the link, using your link or your code.</li>
          <li>After a day, once they have chanted, read or kept a sadhana day, you receive {d.rules.rewardDays} days of Ārta. If you already hold Ārta or better, it begins when that ends.</li>
          <li>Up to {d.rules.maxPerYear} months a year. You cannot refer yourself.</li>
        </ol>
      </section>

      {d.rewards.length > 0 && (
        <section>
          <h2>Your rewards</h2>
          <ul className="refer-list">{d.rewards.map((r) => <li key={r.id} className="card"><strong>{d.rules.rewardDays} days of Ārta</strong><span className="muted">{date(r.startsAt)} → {date(r.endsAt)}</span></li>)}</ul>
        </section>
      )}

      {d.history.length > 0 && (
        <section>
          <h2>History</h2>
          <ul className="refer-list">{d.history.map((h) => <li key={h.id} className="card"><strong>{h.name ?? 'A friend'}</strong><span className="muted">{STATUS[h.status]} · {date(h.claimedAt)}</span></li>)}</ul>
        </section>
      )}

      {!d.referredBy && (
        <section className="card refer-box">
          <h2>Were you invited?</h2>
          <p className="muted small">Enter your friend’s code (new members only, within a week of joining).</p>
          <div className="share-actions">
            <input className="input" value={entering} onChange={(e) => setEntering(e.target.value.toUpperCase())} placeholder="Code" aria-label="Invitation code" maxLength={20} />
            <button className="btn btn-ghost" disabled={busy || entering.trim().length < 4} onClick={claim}>Use code</button>
          </div>
        </section>
      )}

      <p className="muted small">Terms: one reward per invited person, granted by us as extra plan time and not a store purchase; we may withhold rewards for misuse. Rewards end on the date shown and do not renew by themselves.</p>
    </div>
  );
}
