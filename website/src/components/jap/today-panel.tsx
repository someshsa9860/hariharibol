'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@/lib/auth/auth-provider';
import { api } from '@/lib/api/client';
import { useApi } from '@/lib/use-api';
import { addGuestRounds, DEFAULT_TARGET, guestRoundsToday, guestTarget, setGuestTarget } from '@/lib/jap-store';
import { useToast } from '@/components/ui/toast';
import { ManualSheet } from './manual-sheet';
import type { Mantra } from '@/lib/types';

interface Today {
  day: { roundTarget: number; roundsCompleted: number };
  streak: number;
  favoriteMantra: { slug: string; name: string } | null;
  profile: { preferredMantra: { slug: string; name: string } | null } | null;
}

/** Today's rounds against the target, the streak, and a way to add rounds chanted on beads. */
export function TodayPanel({ mantras }: { mantras: Pick<Mantra, 'id' | 'slug' | 'name'>[] }) {
  const { status, user, openSignIn } = useAuth();
  const toast = useToast();
  const server = useApi<Today>(status === 'in' ? '/sadhana/today' : null, { auth: 'required' });
  const [guest, setGuest] = useState({ rounds: 0, target: DEFAULT_TARGET });
  const [manual, setManual] = useState(false);

  useEffect(() => { if (status === 'out') setGuest({ rounds: guestRoundsToday(), target: guestTarget() }); }, [status]);

  const rounds = user ? server.data?.day.roundsCompleted ?? 0 : guest.rounds;
  const target = user ? server.data?.day.roundTarget ?? DEFAULT_TARGET : guest.target;
  const percent = target > 0 ? Math.min(100, Math.round((rounds / target) * 100)) : 0;
  const quick = server.data?.profile?.preferredMantra ?? server.data?.favoriteMantra ?? mantras[0];

  const changeTarget = async (delta: number) => {
    const next = Math.max(1, Math.min(200, target + delta));
    if (user) {
      try {
        await api('/sadhana/today', { method: 'PATCH', auth: 'required', body: { roundTarget: next } });
        await api('/me/sadhana-profile', { method: 'PATCH', auth: 'required', body: { dailyRoundTarget: next } }).catch(() => undefined);
        server.reload();
      } catch { toast('Could not change the target'); }
    } else {
      setGuestTarget(next);
      setGuest((g) => ({ ...g, target: next }));
    }
  };

  const addManual = async (count: number, mantraId?: string) => {
    if (user) {
      await api('/sadhana/chant/manual', { method: 'POST', auth: 'required', body: { rounds: count, mantraId } });
      server.reload();
    } else {
      setGuest((g) => ({ ...g, rounds: addGuestRounds(count) }));
    }
    toast(`${count} ${count === 1 ? 'round' : 'rounds'} added. Hari Bol!`);
  };

  return (
    <section className="jap-today card" aria-label="Today’s practice">
      <div className="ring" style={{ '--p': percent } as React.CSSProperties} aria-label={`${rounds} of ${target} rounds`}>
        <span><strong>{rounds}</strong><small>of {target}</small></span>
      </div>
      <div className="jap-today-body">
        <span className="eyebrow">Today’s practice</span>
        <h2>{rounds >= target && target > 0 ? 'Target reached — Hari Bol!' : `${Math.max(0, target - rounds)} ${target - rounds === 1 ? 'round' : 'rounds'} to go`}</h2>
        <div className="target-row">
          <span className="muted">Daily target</span>
          <button className="icon-btn" aria-label="Lower the target" onClick={() => changeTarget(-1)}><Icon name="minus" size={16} /></button>
          <strong>{target}</strong>
          <button className="icon-btn" aria-label="Raise the target" onClick={() => changeTarget(1)}><Icon name="plus" size={16} /></button>
          {user && <span className="streak small"><Icon name="flame" size={18} /> {server.data?.streak ?? 0} day streak</span>}
        </div>
        <div className="jap-today-actions">
          {quick && <Link href={`/jap/${quick.slug}`} className="btn btn-primary">Chant {quick.name} <Icon name="arrow" size={16} /></Link>}
          <button className="btn btn-ghost" onClick={() => setManual(true)}>Add rounds from beads</button>
        </div>
        {!user && status === 'out' && (
          <p className="muted small-note">
            Rounds are kept in this browser. <button className="link-btn" onClick={() => openSignIn('Sign in to keep your rounds and streak on every device.')}>Sign in</button> to keep them everywhere.
          </p>
        )}
      </div>
      {manual && <ManualSheet mantras={mantras} onClose={() => setManual(false)} onSave={addManual} />}
    </section>
  );
}
