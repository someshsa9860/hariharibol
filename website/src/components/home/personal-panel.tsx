'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { useAuth } from '@/lib/auth/auth-provider';
import { useApi } from '@/lib/use-api';
import { chapterHref } from '@/lib/links';
import type { HomeData } from '@/lib/types';

/** Signed in: today's practice and where the reader left off. Signed out: an invitation, never a wall. */
export function PersonalPanel() {
  const { status, user, openSignIn } = useAuth();
  const { data } = useApi<HomeData>(status === 'in' ? '/home' : null, { auth: 'required' });

  if (status === 'loading') return <div className="personal skeleton" style={{ minHeight: 120 }} aria-hidden="true" />;

  if (!user) {
    return (
      <div className="personal personal-guest card enter">
        <div>
          <strong>Keep your practice with you</strong>
          <p className="muted">Sign in to save your rounds, streak and place in each book — on every device.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openSignIn('Sign in to keep your practice and place in each book.')}>Sign in</button>
      </div>
    );
  }

  const today = data?.sadhana?.today;
  const target = today?.roundTarget ?? 0;
  const done = today?.roundsCompleted ?? 0;
  const percent = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const resume = data?.continueReading;
  const first = (user.name ?? '').split(' ')[0];

  return (
    <div className="personal card enter">
      <div className="personal-hello">
        <span className="eyebrow">Hari Bol{first ? `, ${first}` : ''}</span>
        <h2>Today’s practice</h2>
      </div>

      <div className="personal-stats">
        <div className="ring" style={{ '--p': percent } as React.CSSProperties} aria-label={`${done} of ${target} rounds`}>
          <span><strong>{done}</strong><small>{target ? `of ${target}` : 'rounds'}</small></span>
        </div>
        <div className="streak">
          <Icon name="flame" size={26} />
          <span><strong>{data?.sadhana?.streak ?? 0}</strong><small>day streak</small></span>
        </div>
      </div>

      <div className="personal-actions">
        <Link href="/jap" className="btn btn-primary">Chant now <Icon name="arrow" size={16} /></Link>
        {resume?.chapterNumber ? (
          <Link href={chapterHref(resume.book.slug, resume.cantoNumber, resume.chapterNumber, resume.verseNumber ?? undefined)} className="btn btn-ghost">
            Continue {resume.book.title}
          </Link>
        ) : (
          <Link href="/read" className="btn btn-ghost">Start reading</Link>
        )}
      </div>
    </div>
  );
}
