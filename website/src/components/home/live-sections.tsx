'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/states';
import { BookCard } from './book-card';
import { MantraCard } from './mantra-card';
import { SlokaCard } from './sloka-card';
import { PersonalPanel } from './personal-panel';
import { api } from '@/lib/api/client';
import { fallbackVerseId } from '@/lib/daily-verse';
import { usePrefs } from '@/lib/prefs/prefs-provider';
import { useApi } from '@/lib/use-api';
import type { HomeData, Verse } from '@/lib/types';
import { useEffect, useState } from 'react';

/** Today's verse, the library and the mantras, loaded in the browser — used when the server could not reach the API. */
export function LiveSections() {
  const { readingLanguage } = usePrefs();
  const home = useApi<HomeData>('/home');
  const [verse, setVerse] = useState<Verse | null>(null);

  useEffect(() => {
    if (home.loading) return;
    if (home.data?.slokaOfTheDay) { setVerse(home.data.slokaOfTheDay.verse); return; }
    api<Verse>(`/verses/${fallbackVerseId()}`).then(setVerse).catch(() => undefined);
  }, [home.loading, home.data, readingLanguage]);

  return (
    <>
      <section className="page today-band" aria-label="Today">
        <div className="today-grid">
          {verse ? <SlokaCard verse={verse} /> : home.loading ? <div className="sloka-card"><Spinner /></div> : null}
          <PersonalPanel />
        </div>
      </section>
      {home.data && home.data.books.length > 0 && (
        <section className="section page">
          <div className="row-head"><h2>The library</h2><Link href="/read" className="text-link">All books <Icon name="arrow" size={16} /></Link></div>
          <div className="h-scroll">{home.data.books.map((b) => <BookCard key={b.id} book={b} />)}</div>
        </section>
      )}
      {home.data && home.data.mantras.length > 0 && (
        <section className="page mantra-band">
          <div className="row-head"><h2>Mantras to chant</h2><Link href="/jap" className="text-link">All mantras <Icon name="arrow" size={16} /></Link></div>
          <div className="h-scroll">{home.data.mantras.map((m) => <MantraCard key={m.id} mantra={m} />)}</div>
        </section>
      )}
      {home.error != null && (
        <div className="page"><div className="notice notice-error">The library could not be loaded. <button className="link-btn" onClick={home.reload}>Try again</button></div></div>
      )}
    </>
  );
}
