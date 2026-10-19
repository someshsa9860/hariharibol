/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, ErrorState, PageLoading } from '@/components/ui/states';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-provider';
import { compactCount } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import type { Reel } from '@/lib/types';

interface Creator { id: string; displayName: string; bio: string | null; avatarUrl: string | null; isVerified: boolean; followerCount: number; reelCount: number; totalViews: number; isFollowing: boolean; isMe: boolean }

export function CreatorView({ id }: { id: string }) {
  const { requireSignIn } = useAuth();
  const creator = useApi<Creator>(`/creators/${id}`);
  const reels = useApi<Reel[]>(`/creators/${id}/reels`);
  if (creator.loading) return <PageLoading />;
  const c = creator.data;
  if (!c) return <ErrorState message="This creator could not be found." onRetry={creator.reload} />;

  const toggle = async () => {
    if (!requireSignIn('Sign in to follow creators.')) return;
    const on = !c.isFollowing;
    creator.setData({ ...c, isFollowing: on, followerCount: c.followerCount + (on ? 1 : -1) });
    api(`/creators/${id}/follow`, { method: on ? 'POST' : 'DELETE', auth: 'required' }).catch(() => creator.setData(c));
  };

  return (
    <div className="page-narrow">
      <header className="profile card" style={{ marginTop: 28 }}>
        <Avatar name={c.displayName} url={c.avatarUrl} size={72} />
        <div><h1 style={{ fontSize: '1.8rem' }}>{c.displayName}{c.isVerified && ' ✓'}</h1>{c.bio && <p className="muted">{c.bio}</p>}
          <p className="muted small-note">{compactCount(c.followerCount)} followers · {c.reelCount} reels · {compactCount(c.totalViews)} views</p></div>
        {!c.isMe && <button className={c.isFollowing ? 'btn btn-ghost' : 'btn btn-primary'} onClick={toggle}>{c.isFollowing ? 'Following' : 'Follow'}</button>}
      </header>
      <h2 className="subhead">Reels</h2>
      {reels.data?.length === 0 && <EmptyState title="No reels yet" motif="flute" />}
      <ul className="creator-grid">
        {reels.data?.map((r) => (
          <li key={r.id}><Link href={`/reels/${r.id}`} className="card card-hover creator-reel">
            {(r.thumbnailUrl || r.media[0]?.imageUrl) ? <img src={(r.thumbnailUrl ?? r.media[0].imageUrl)} alt="" loading="lazy" /> : <span className="reel-blank" />}
            <small>{r.caption?.slice(0, 50)}</small>
          </Link></li>
        ))}
      </ul>
    </div>
  );
}
