import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { cache } from 'react';
import { VerseCard } from '@/components/read/verse-card';
import { Icon } from '@/components/ui/icon';
import { serverGetOrNull } from '@/lib/api/server';
import { readingLanguage } from '@/lib/prefs/server';
import { excerpt, verseCitation } from '@/lib/format';
import { verseHref, verseReadHref } from '@/lib/links';
import { SITE_URL } from '@/lib/config';
import type { Verse, WebVerse } from '@/lib/types';

type Props = { params: Promise<{ verseId: string }> };

// `cache` (per request) so the metadata and the page share one fetch.
const load = cache((verseId: string, lang: string) => serverGetOrNull<WebVerse>(`/api/web/content/verses/${verseId}`, { query: { lang }, revalidate: 600 }));

// In the reader's language like the page (a crawler has no cookie, so it still gets English).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { verseId } = await params;
  const verse = await load(verseId, await readingLanguage()).catch(() => null);
  if (!verse) return { title: 'Verse not found' };
  const title = verseCitation(verse);
  const meaning = verse.translation?.meaning ?? verse.translations.find((t) => t.languageCode === 'en')?.meaning;
  const description = excerpt(`${verse.sanskrit ?? ''} — ${meaning ?? ''}`, 200);
  return { title, description, alternates: { canonical: verseHref(verseId) }, openGraph: { title, description, url: `${SITE_URL}${verseHref(verseId)}`, type: 'article' } };
}

export default async function VersePage({ params }: Props) {
  const { verseId } = await params;
  const lang = await readingLanguage();
  // The related list needs only the id, so it is fetched alongside the verse rather than after it.
  const [verse, related] = await Promise.all([
    load(verseId, lang),
    serverGetOrNull<{ relation: string; note: string | null; verse: Verse }[]>(`/api/app/verses/${verseId}/related`, { revalidate: 600 }).catch(() => null).then((list) => list ?? []),
  ]);
  if (!verse) notFound();
  const citation = verseCitation(verse);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Quotation',
    name: citation,
    text: verse.sanskrit ?? undefined,
    inLanguage: 'sa',
    url: `${SITE_URL}${verseHref(verseId)}`,
    isPartOf: { '@type': 'Book', name: verse.book?.title },
  };

  return (
    <div className="page-narrow">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/read">Read</Link><Icon name="right" size={14} />
        {verse.book && <><Link href={`/read/${verse.book.slug}`}>{verse.book.title}</Link><Icon name="right" size={14} /></>}
        <span>{citation}</span>
      </nav>
      <header className="chapter-head">
        <p className="eyebrow">One verse</p>
        <h1>{citation}</h1>
      </header>

      <div className="verse-list"><VerseCard verse={verse} expanded /></div>

      <div className="verse-page-actions">
        <Link className="btn btn-primary" href={verseReadHref(verse)}>Read it in the chapter <Icon name="arrow" size={16} /></Link>
      </div>

      {related.length > 0 && (
        <section className="related" aria-labelledby="related-title">
          <h2 id="related-title">Related verses</h2>
          {related.map((r) => (
            <Link key={r.verse.id} href={verseHref(r.verse.verseId)} className="card card-hover result">
              <span className="eyebrow">{r.relation.replace(/_/g, ' ').toLowerCase()}</span>
              <strong>{verseCitation(r.verse)}</strong>
              <span className="snippet">{r.note ?? r.verse.translation?.meaning}</span>
            </Link>
          ))}
        </section>
      )}

      <nav className="chapter-nav" aria-label="Neighbouring verses">
        {verse.previousVerseId ? <Link className="card card-hover" href={verseHref(verse.previousVerseId)} rel="prev"><small><Icon name="left" size={14} /> Previous verse</small><strong>{verse.previousVerseId}</strong></Link> : <span />}
        {verse.nextVerseId ? <Link className="card card-hover next" href={verseHref(verse.nextVerseId)} rel="next"><small>Next verse <Icon name="right" size={14} /></small><strong>{verse.nextVerseId}</strong></Link> : <span />}
      </nav>
    </div>
  );
}
