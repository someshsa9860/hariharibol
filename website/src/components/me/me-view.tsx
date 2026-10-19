'use client';

import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { ThemeSwitch } from '@/components/layout/settings-menu';
import { PracticeReport } from './practice-report';
import { MantraCard } from '@/components/home/mantra-card';
import { useAuth } from '@/lib/auth/auth-provider';
import { api, describeError } from '@/lib/api/client';
import { useApi } from '@/lib/use-api';
import { chapterHref, verseHref } from '@/lib/links';
import { verseCitation } from '@/lib/format';
import { FALLBACK_LANGUAGES } from '@/lib/languages';
import { usePrefs } from '@/lib/prefs/prefs-provider';
import type { Book, Language, Mantra, Verse } from '@/lib/types';

interface Summary { chantingDays: number; totalRounds: number; tasksCompleted: number; favorites: number; slokasRead: number }
interface Progress { id: string; book: Book; verseId: string | null; cantoNumber: number | null; chapterNumber: number | null; verseNumber: number | null; percent: number }
interface Favorite { id: string; type: 'verse' | 'mantra' | 'book' | 'reel'; verse: Verse | null; mantra: Mantra | null; book: Book | null; reel: { id: string; caption: string | null; thumbnailUrl: string | null } | null }

export function MeView() {
  const { status, user, openSignIn, signOut, updateUser } = useAuth();
  const toast = useToast();
  const { readingLanguage, setReadingLanguage } = usePrefs();
  const signedIn = status === 'in';
  const summary = useApi<Summary>(signedIn ? '/me/summary' : null, { auth: 'required' });
  const progress = useApi<Progress[]>(signedIn ? '/progress' : null, { auth: 'required' });
  const favorites = useApi<Favorite[]>(signedIn ? '/favorites' : null, { auth: 'required' });
  const languages = useApi<Language[]>('/reference/languages', { auth: 'none' });
  const [tab, setTab] = useState<'verse' | 'mantra' | 'reel' | 'book'>('verse');
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === 'loading') return <div className="center-state"><Spinner /></div>;

  const list = languages.data ?? (FALLBACK_LANGUAGES.map((l) => ({ ...l, isRtl: false, isAppLanguage: true, isMantraLanguage: true, isReadingLanguage: true })) as Language[]);
  const readingOptions = list.filter((l) => l.isReadingLanguage);

  const changeReading = (code: string) => {
    setReadingLanguage(code);
    updateUser({ readingLanguage: code });
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api('/auth/account', { method: 'DELETE', auth: 'required' });
      await signOut();
      setDeleting(false);
      toast('Your account was deleted');
    } catch (failure) {
      toast(describeError(failure));
    }
    setBusy(false);
  };

  const shown = favorites.data?.filter((f) => f.type === tab) ?? [];
  const tabs = [{ v: 'verse', l: 'Verses' }, { v: 'mantra', l: 'Mantras' }, { v: 'reel', l: 'Reels' }, { v: 'book', l: 'Books' }] as const;

  return (
    <div className="page-narrow me">
      <header className="page-title"><p className="eyebrow">Your page</p><h1>{user ? (user.name ?? 'Welcome') : 'Settings'}</h1></header>

      {user ? (
        <section className="profile card">
          <Avatar name={user.name ?? user.email} url={user.avatarUrl} size={64} />
          <div><strong>{user.name ?? 'Devotee'}</strong><p className="muted">{user.email}</p><span className="badge">{user.isPremium ? 'Plan active' : 'Free plan'}</span></div>
          <Link href="/notifications" className="btn btn-ghost btn-sm">Notifications</Link>
          <Link href="/plans" className="btn btn-ghost btn-sm">Plans</Link>
        </section>
      ) : (
        <section className="profile card">
          <div><strong>You are reading as a guest</strong><p className="muted">Everything works without an account. Sign in to keep your progress, favourites and routine on every device, and to talk with Sakha.</p></div>
          <button className="btn btn-primary" onClick={() => openSignIn()}>Sign in</button>
        </section>
      )}

      {user && summary.data && (
        <section className="stat-grid" aria-label="Your practice">
          <div className="card"><strong>{summary.data.totalRounds}</strong><small>rounds chanted</small></div>
          <div className="card"><strong>{summary.data.chantingDays}</strong><small>days of chanting</small></div>
          <div className="card"><strong>{summary.data.slokasRead}</strong><small>verses of the day read</small></div>
          <div className="card"><strong>{summary.data.favorites}</strong><small>favourites</small></div>
        </section>
      )}

      {user && <PracticeReport />}

      {user && progress.data && progress.data.length > 0 && (
        <section className="me-section">
          <h2>Continue reading</h2>
          <ul className="progress-list">
            {progress.data.map((p) => (
              <li key={p.id}>
                <Link className="card card-hover progress-row" href={p.chapterNumber ? chapterHref(p.book.slug, p.cantoNumber, p.chapterNumber, p.verseNumber ?? undefined) : `/read/${p.book.slug}`}>
                  <span><strong>{p.book.title}</strong><small className="muted">{[p.cantoNumber && `Canto ${p.cantoNumber}`, p.chapterNumber && `Chapter ${p.chapterNumber}`, p.verseNumber && `Verse ${p.verseNumber}`].filter(Boolean).join(' · ')}</small></span>
                  <span className="bar" aria-label={`${p.percent}% read`}><i style={{ width: `${p.percent}%` }} /></span>
                  <span className="muted pct">{p.percent}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="me-section">
        <h2>Language and appearance</h2>
        <div className="card settings-card">
          <div><label className="field-label" htmlFor="me-lang">Read verses and meanings in</label>
            <select id="me-lang" className="select" value={readingLanguage} onChange={(e) => changeReading(e.target.value)}>
              {readingOptions.map((l) => <option key={l.code} value={l.code}>{l.nativeName} · {l.englishName}</option>)}
            </select>
            <p className="muted small-note">The website itself is in English; verses, meanings and mantras follow your choice.</p>
          </div>
          <div><span className="field-label">Appearance</span><ThemeSwitch /></div>
        </div>
      </section>

      {user && (
        <section className="me-section">
          <h2>Favourites</h2>
          <div className="chip-row" role="tablist">{tabs.map((t) => <button key={t.v} role="tab" className="chip" aria-selected={tab === t.v} onClick={() => setTab(t.v)}>{t.l}</button>)}</div>
          {favorites.loading && <div className="center-state"><Spinner /></div>}
          {!favorites.loading && shown.length === 0 && <p className="muted">Nothing saved here yet. Tap the heart on a verse, mantra or reel to keep it.</p>}
          <ul className={clsx('fav-list', tab === 'mantra' && 'mantras')}>
            {shown.map((f) => (
              <li key={f.id}>
                {f.verse && <Link href={verseHref(f.verse.verseId)} className="card card-hover fav"><strong>{verseCitation(f.verse)}</strong>{f.verse.sanskrit && <span className="deva">{f.verse.sanskrit.split('\n')[0]}</span>}<span className="muted">{f.verse.translation?.meaning}</span></Link>}
                {f.mantra && <MantraCard mantra={f.mantra} />}
                {f.book && <Link href={`/read/${f.book.slug}`} className="card card-hover fav"><strong>{f.book.title}</strong></Link>}
                {f.reel && <Link href={`/reels/${f.reel.id}`} className="card card-hover fav"><Icon name="reels" /><strong>{f.reel.caption?.slice(0, 80) || 'A saved reel'}</strong></Link>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {user && (
        <section className="me-section danger-zone">
          <div className="settings-actions">
            <button className="btn btn-ghost" onClick={() => signOut()}><Icon name="logout" size={16} /> Sign out</button>
            <button className="btn btn-danger" onClick={() => setDeleting(true)}>Delete my account</button>
          </div>
        </section>
      )}

      {deleting && (
        <Sheet title="Delete your account?" onClose={() => setDeleting(false)}>
          <p className="muted">This permanently removes your account and everything attached to it — practice history, favourites, routine, and your chat with Sakha. It cannot be undone.</p>
          <div className="confirm-row">
            <button className="btn btn-ghost" onClick={() => setDeleting(false)}>Keep my account</button>
            <button className="btn btn-danger" disabled={busy} onClick={deleteAccount}>{busy ? 'Deleting…' : 'Delete everything'}</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
