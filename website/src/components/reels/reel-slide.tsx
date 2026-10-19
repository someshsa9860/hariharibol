/* eslint-disable @next/next/no-img-element */
'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Icon } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { ReelMedia } from './reel-media';
import { CommentsSheet } from './comments-sheet';
import { useAuth } from '@/lib/auth/auth-provider';
import { api } from '@/lib/api/client';
import { SITE_URL } from '@/lib/config';
import { compactCount } from '@/lib/format';
import { share } from '@/lib/share';
import type { Reel } from '@/lib/types';

interface Props {
  reel: Reel;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onChange: (reel: Reel) => void;
}

export function ReelSlide({ reel, active, muted, onToggleMute, onChange }: Props) {
  const { requireSignIn, user } = useAuth();
  const toast = useToast();
  const [paused, setPaused] = useState(false);
  const [comments, setComments] = useState(false);
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);

  const like = async (forceOn = false) => {
    if (!requireSignIn('Sign in to like reels and keep them.')) return;
    const on = forceOn ? true : !reel.isLiked;
    if (on === reel.isLiked) return;
    onChange({ ...reel, isLiked: on, likeCount: Math.max(0, reel.likeCount + (on ? 1 : -1)) });
    try {
      await api(`/reels/${reel.id}/like`, { method: on ? 'POST' : 'DELETE', auth: 'required' });
    } catch { onChange(reel); toast('Could not update your like'); }
  };

  const save = async () => {
    if (!requireSignIn('Sign in to save reels.')) return;
    const on = !reel.isSaved;
    onChange({ ...reel, isSaved: on });
    try {
      if (on) await api('/favorites', { method: 'POST', auth: 'required', body: { reelId: reel.id } });
      else {
        const rows = await api<{ id: string; type: string; reel?: { id: string } | null }[]>('/favorites', { auth: 'required', query: { type: 'reel' } });
        const row = rows.find((r) => r.reel?.id === reel.id);
        if (row) await api(`/favorites/${row.id}`, { method: 'DELETE', auth: 'required' });
      }
      toast(on ? 'Saved' : 'Removed from saved');
    } catch { onChange(reel); toast('Could not update saved reels'); }
  };

  const follow = async () => {
    if (!reel.creator || !requireSignIn('Sign in to follow creators.')) return;
    const on = !reel.isFollowingCreator;
    onChange({ ...reel, isFollowingCreator: on });
    try { await api(`/creators/${reel.creator.id}/follow`, { method: on ? 'POST' : 'DELETE', auth: 'required' }); }
    catch { onChange(reel); }
  };

  const onShare = async () => {
    const result = await share({ title: reel.caption?.slice(0, 80) || 'A reel on HariHariBol', url: `${SITE_URL}/reels/${reel.id}` });
    if (result === 'copied') toast('Link copied');
    if (result !== 'failed') {
      onChange({ ...reel, shareCount: reel.shareCount + 1 });
      api(`/reels/${reel.id}/share`, { method: 'POST', auth: 'optional', body: { platform: result === 'copied' ? 'COPY_LINK' : 'OTHER' } }).catch(() => undefined);
    } else toast('Could not share this reel');
  };

  // One tap pauses; two quick taps like.
  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      setBurst((b) => b + 1);
      void like(true);
      return;
    }
    lastTap.current = now;
    setTimeout(() => { if (lastTap.current === now) { setPaused((p) => !p); lastTap.current = 0; } }, 310);
  };

  const onProgress = (watchedMs: number, durationMs: number) => {
    if (user && watchedMs >= 3000) api(`/reels/${reel.id}/view`, { method: 'POST', auth: 'required', body: { watchedMs: Math.round(watchedMs), durationMs: durationMs || undefined } }).catch(() => undefined);
  };

  return (
    <section className="reel-slide" data-reel={reel.id} aria-label={reel.caption?.slice(0, 80) ?? 'Reel'}>
      <div className="reel-stage">
        <div className="reel-tap" onClick={onTap} role="button" tabIndex={-1} aria-label={paused ? 'Play' : 'Pause'}>
          <ReelMedia reel={reel} active={active} muted={muted} paused={paused} onProgress={onProgress} />
          {paused && active && <span className="reel-paused" aria-hidden="true"><Icon name="play" size={44} /></span>}
          {burst > 0 && <span key={burst} className="reel-burst" aria-hidden="true"><Icon name="heart" size={96} solid /></span>}
        </div>

        <div className="reel-info">
          {reel.creator && (
            <div className="reel-creator">
              <Link href={`/creator/${reel.creator.id}`} aria-label={reel.creator.displayName}><Avatar name={reel.creator.displayName} url={reel.creator.avatarUrl} size={36} /></Link>
              <strong>{reel.creator.displayName}</strong>
              <button className={clsx('follow', reel.isFollowingCreator && 'is-on')} onClick={follow}>{reel.isFollowingCreator ? 'Following' : 'Follow'}</button>
            </div>
          )}
          {reel.caption && <p className="reel-caption">{reel.caption}</p>}
          <div className="reel-chips">
            {reel.verse && <Link href={`/verse/${reel.verse.verseId}`} className="reel-chip"><Icon name="book" size={14} /> {reel.verse.label ?? reel.verse.verseId}</Link>}
            {reel.mantra && <Link href={`/jap/${reel.mantra.slug}`} className="reel-chip"><Icon name="chant" size={14} /> {reel.mantra.name}</Link>}
            {reel.tags.filter((tag) => !tag.includes(':')).slice(0, 3).map((tag) => <span key={tag} className="reel-chip">#{tag}</span>)}
          </div>
        </div>

        <div className="reel-rail">
          <button onClick={() => like()} aria-pressed={reel.isLiked} aria-label={reel.isLiked ? 'Unlike' : 'Like'} className={clsx(reel.isLiked && 'is-on')}><Icon name="heart" size={28} solid={reel.isLiked} /><span>{compactCount(reel.likeCount)}</span></button>
          <button onClick={() => setComments(true)} aria-label="Comments"><Icon name="comment" size={28} /><span>{compactCount(reel.commentCount)}</span></button>
          <button onClick={save} aria-pressed={reel.isSaved} aria-label={reel.isSaved ? 'Remove from saved' : 'Save'} className={clsx(reel.isSaved && 'is-on')}><Icon name="bookmark" size={28} solid={reel.isSaved} /><span>Save</span></button>
          <button onClick={onShare} aria-label="Share"><Icon name="share" size={28} /><span>{compactCount(reel.shareCount)}</span></button>
          <button onClick={onToggleMute} aria-label={muted ? 'Turn sound on' : 'Mute'}><Icon name={muted ? 'mute' : 'volume'} size={28} /><span>{muted ? 'Muted' : 'Sound'}</span></button>
        </div>
      </div>
      {comments && <CommentsSheet reelId={reel.id} onClose={() => setComments(false)} onCount={(d) => onChange({ ...reel, commentCount: Math.max(0, reel.commentCount + d) })} />}
    </section>
  );
}
