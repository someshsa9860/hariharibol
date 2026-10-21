'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ReelSlide } from './reel-slide';
import { Spinner, EmptyState } from '@/components/ui/states';
import { apiEnvelope, api, describeError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-provider';
import type { Reel } from '@/lib/types';

/** The reels feed: one reel fills the screen, scroll or press ↑ ↓ for the next. Only the reel in view plays. */
export function ReelFeed({ startId }: { startId?: string }) {
  const { status } = useAuth();
  const [reels, setReels] = useState<Reel[]>([]);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading');
  const [error, setError] = useState('');
  const page = useRef(0);
  const more = useRef(true);
  const loading = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (loading.current || !more.current) return;
    loading.current = true;
    try {
      const { data, meta } = await apiEnvelope<Reel[]>('/reels', { query: { page: page.current + 1 } });
      page.current += 1;
      more.current = Boolean(meta?.hasMore);
      setReels((current) => {
        const seen = new Set(current.map((r) => r.id));
        return [...current, ...data.filter((r) => !seen.has(r.id))];
      });
      setState((s) => (s === 'loading' ? (data.length ? 'ready' : 'empty') : s));
    } catch (failure) {
      setError(describeError(failure));
      setState((s) => (s === 'loading' ? 'error' : s));
    } finally {
      loading.current = false;
    }
  }, []);

  // The first reel can be a shared one; the feed carries on after it. Starts again when the account changes, since
  // what has been watched and liked differs.
  useEffect(() => {
    page.current = 0;
    more.current = true;
    setReels([]);
    setState('loading');
    (async () => {
      if (startId) {
        const first = await api<Reel>(`/reels/${startId}`).catch(() => null);
        if (first) setReels([first]);
      }
      await load();
    })();
  }, [startId, status, load]);

  // Which slide is on screen.
  useEffect(() => {
    const container = root.current;
    if (!container || state !== 'ready') return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          const index = Number((entry.target as HTMLElement).dataset.index);
          setActive(index);
        }
      }
    }, { root: container, threshold: [0.6] });
    container.querySelectorAll('.reel-item').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels.length, state]);

  useEffect(() => { if (reels.length - active <= 3) void load(); }, [active, reels.length, load]);

  // Keyboard: ↑ ↓ move, M mutes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input,textarea,select,[role="dialog"]')) return;
      const go = (to: number) => root.current?.querySelectorAll('.reel-item')[Math.max(0, Math.min(reels.length - 1, to))]?.scrollIntoView({ behavior: 'smooth' });
      if (event.key === 'ArrowDown' || event.key === 'j') { event.preventDefault(); go(active + 1); }
      if (event.key === 'ArrowUp' || event.key === 'k') { event.preventDefault(); go(active - 1); }
      if (event.key === 'm') setMuted((m) => !m);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, reels.length]);

  // Leaving the tab pauses everything.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (state === 'loading') return <div className="reels-root reels-center"><Spinner label="Loading reels" /></div>;
  if (state === 'error') return <div className="reels-root reels-center"><EmptyState title="Reels could not load" motif="conch" action={<button className="btn btn-ghost" onClick={() => { setState('loading'); void load(); }}>Try again</button>}>{error}</EmptyState></div>;
  if (state === 'empty') return <div className="reels-root reels-center"><EmptyState title="No reels yet" motif="flute">New devotional reels are on their way. Please check back soon.</EmptyState></div>;

  return (
    <div className="reels-root">
      <div className="reel-feed" ref={root}>
        {reels.map((reel, index) => (
          <div className="reel-item" data-index={index} key={reel.id}>
            {Math.abs(index - active) <= 1 && (
              <ReelSlide
                reel={reel}
                active={index === active && !hidden}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
                onChange={(next) => setReels((list) => list.map((r) => (r.id === next.id ? next : r)))}
              />
            )}
          </div>
        ))}
      </div>
      <div className="reel-nav" aria-hidden="true">
        <button className="icon-btn" tabIndex={-1} onClick={() => root.current?.querySelectorAll('.reel-item')[Math.max(0, active - 1)]?.scrollIntoView({ behavior: 'smooth' })}>↑</button>
        <button className="icon-btn" tabIndex={-1} onClick={() => root.current?.querySelectorAll('.reel-item')[Math.min(reels.length - 1, active + 1)]?.scrollIntoView({ behavior: 'smooth' })}>↓</button>
      </div>
    </div>
  );
}
