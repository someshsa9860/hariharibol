/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { Hero } from '@/components/home/hero';
import { PersonalPanel } from '@/components/home/personal-panel';
import { QuickActions } from '@/components/home/quick-actions';
import { SlokaCard } from '@/components/home/sloka-card';
import { BookCard } from '@/components/home/book-card';
import { MantraCard } from '@/components/home/mantra-card';
import { Why } from '@/components/home/why';
import { Inside } from '@/components/home/inside';
import { Faq, FAQS } from '@/components/home/faq';
import { Start } from '@/components/home/start';
import { Reveal } from '@/components/ui/reveal';
import { Icon } from '@/components/ui/icon';
import { serverGetOrNull } from '@/lib/api/server';
import { LiveSections } from '@/components/home/live-sections';
import { fallbackVerseId } from '@/lib/daily-verse';
import { SITE_URL } from '@/lib/config';
import type { HomeData, Verse, WebVerse } from '@/lib/types';

export default async function HomePage() {
  const home = await serverGetOrNull<HomeData>('/api/app/home', { revalidate: 300 }).catch(() => null);

  // A verse is always shown: today's if one is set, else the day's pick from a short list of well-loved verses.
  let verse: Verse | WebVerse | null = home?.slokaOfTheDay?.verse ?? null;
  if (home && !verse) verse = await serverGetOrNull<WebVerse>(`/api/web/content/verses/${fallbackVerseId()}`, { revalidate: 3600 }).catch(() => null);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: 'HariHariBol', url: SITE_URL, potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/search?q={query}`, 'query-input': 'required name=query' } },
      { '@type': 'FAQPage', mainEntity: FAQS.map((faq) => ({ '@type': 'Question', name: faq.question, acceptedAnswer: { '@type': 'Answer', text: faq.answer } })) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero />

      {!home && <LiveSections />}
      {home && (
      <section className="page today-band" aria-label="Today">
        <div className="today-grid">
          {verse && <SlokaCard verse={verse} />}
          <PersonalPanel />
        </div>
      </section>
      )}

      <section className="page" aria-label="Where to go">
        <QuickActions />
      </section>

      {home && home.books.length > 0 && (
        <section className="section page" aria-labelledby="books-title">
          <Reveal className="row-head">
            <h2 id="books-title">The library</h2>
            <Link href="/read" className="text-link">All books <Icon name="arrow" size={16} /></Link>
          </Reveal>
          <div className="h-scroll">
            {home.books.map((book) => <BookCard key={book.id} book={book} />)}
          </div>
        </section>
      )}

      {home && home.mantras.length > 0 && (
        <section className="page mantra-band" aria-labelledby="mantras-title">
          <Reveal className="row-head">
            <h2 id="mantras-title">Mantras to chant</h2>
            <Link href="/jap" className="text-link">All mantras <Icon name="arrow" size={16} /></Link>
          </Reveal>
          <div className="h-scroll">
            {home.mantras.map((mantra) => <MantraCard key={mantra.id} mantra={mantra} />)}
          </div>
        </section>
      )}

      <section className="page" aria-label="A verse to begin with">
        <Reveal className="photo-band">
          <img src="/img/krishna.jpg" alt="Lord Krishna playing the flute" loading="lazy" />
          <div className="photo-band-text">
            <p className="eyebrow">From the Gita</p>
            <blockquote lang="sa">योगस्थः कुरु कर्माणि</blockquote>
            <p>Be steady in yoga, and then act. Begin the day with a verse, and let it travel with you.</p>
            <Link className="btn btn-light" href="/read/bhagavad-gita/2">Read chapter 2 <Icon name="arrow" size={16} /></Link>
          </div>
        </Reveal>
      </section>

      <Why />
      <Inside />
      <Faq />
      <Start />
    </>
  );
}
