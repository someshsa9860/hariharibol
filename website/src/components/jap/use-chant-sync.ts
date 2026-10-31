'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { api } from '@/lib/api/client';
import { currentSession } from '@/lib/auth/session-store';
import { addGuestRounds } from '@/lib/jap-store';

/**
 * Keeps the account's record of a sitting up to date while the counter runs. Signed in, the first bead opens a session
 * and progress is sent as it goes (the API only ever moves counts forward); signed out, finished rounds are added to
 * the day's total kept in this browser. Failures are quiet — the count on screen is never lost to a bad connection,
 * and the next update carries the totals.
 */
export function useChantSync(mantraId: string) {
  const sessionId = useRef<string | null>(null);
  const opening = useRef<Promise<string | null> | null>(null);
  const latest = useRef({ rounds: 0, beads: 0 });
  const sentRounds = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(async () => {
    if (sessionId.current) return sessionId.current;
    opening.current ??= api<{ session: { id: string } } | { id: string }>('/sadhana/chant/session', { method: 'POST', auth: 'required', body: { mantraId } })
      .then((result) => {
        const id = 'session' in result ? result.session.id : result.id;
        sessionId.current = id;
        return id;
      })
      .catch(() => null)
      .finally(() => { opening.current = null; });
    return opening.current;
  }, [mantraId]);

  const push = useCallback(async (finish = false) => {
    if (!currentSession()) return;
    const id = await open();
    if (!id) return;
    const { rounds, beads } = latest.current;
    await api(`/sadhana/chant/session/${id}`, { method: 'PATCH', auth: 'required', body: { rounds, beads, ...(finish ? { finish: true } : {}) } }).catch(() => undefined);
    if (finish) sessionId.current = null;
  }, [open]);

  const update = useCallback((rounds: number, beads: number, roundJustFinished: boolean) => {
    latest.current = { rounds, beads };
    if (!currentSession()) {
      if (roundJustFinished) addGuestRounds(1);
      return;
    }
    if (roundJustFinished) {
      sentRounds.current = rounds;
      // Cleared *and* emptied: a stale id left here would stop the `??=` below from ever scheduling again.
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      void push();
      return;
    }
    // Between rounds, send at most every few seconds.
    timer.current ??= setTimeout(() => { timer.current = null; void push(); }, 4000);
  }, [push]);

  const finish = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (sessionId.current || latest.current.beads > 0 || latest.current.rounds > 0) await push(true);
  }, [push]);

  // Closing the tab or leaving the page ends the sitting.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void push(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      void finish();
    };
  }, [push, finish]);

  return useMemo(() => ({ update, finish }), [update, finish]);
}
