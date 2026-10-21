import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/ui/icon';
import { QrCode } from './qr-code';
import { StoreButtons } from './store-buttons';
import { continueHref, lookupShare, type ShareKind, type ShareLookup } from '@/lib/share-links';
import { SITE_URL } from '@/lib/config';
import { excerpt } from '@/lib/format';

const KIND_PATH: Record<ShareKind, string> = { SHLOKA: 'shloka', MANTRA: 'mantra', REEL: 'divya' };

type SearchParams = Record<string, string | string[] | undefined>;
const flat = (sp: SearchParams) => Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));

/** Metadata for a share page: public text only, canonical URL, and noindex for anything that is not live. */
export async function shareMetadata(code: string, kind: ShareKind, sp: SearchParams): Promise<Metadata> {
  const result = await lookupShare(code, kind, flat(sp));
  const canonical = `${SITE_URL}/${KIND_PATH[kind]}/${code}`;
  if (result.state !== 'ok') return { title: 'Not available', robots: { index: false, follow: false } };
  const { content } = result.data;
  const description = excerpt([content.sanskrit, content.meaning].filter(Boolean).join(' — '), 200) || 'Shared from HariHariBol';
  const images = content.imageUrl ? [{ url: content.imageUrl }] : [{ url: '/img/logo.png' }];
  return {
    title: content.title,
    description,
    alternates: { canonical },
    openGraph: { title: content.title, description, url: canonical, type: 'article', siteName: 'HariHariBol', images },
    twitter: { card: content.imageUrl ? 'summary_large_image' : 'summary', title: content.title, description, images: images.map((i) => i.url) },
  };
}

function Unavailable({ result }: { result: Exclude<ShareLookup, { state: 'ok' | 'missing' }> }) {
  const copy = {
    gone: ['This is no longer available', 'The person who shared it, or we, have taken it down.'],
    error: ['Something went wrong', 'The library could not be reached just now. Please try again in a moment.'],
  }[result.state];
  return (
    <div className="page-narrow share-landing">
      <div className="card share-card center-state">
        <h1>{copy[0]}</h1>
        <p className="muted">{copy[1]}</p>
        <Link href="/" className="btn btn-primary">Go to HariHariBol</Link>
      </div>
    </div>
  );
}

export async function ShareLanding({ code, kind, searchParams }: { code: string; kind: ShareKind; searchParams: SearchParams }) {
  const result = await lookupShare(code, kind, flat(searchParams));
  if (result.state === 'missing') notFound(); // a real 404, so search engines drop dead links
  if (result.state !== 'ok') return <Unavailable result={result} />;

  const { data } = result;
  const { content } = data;
  const pageUrl = `${SITE_URL}/${KIND_PATH[kind]}/${code}`;
  const cont = continueHref(data);

  return (
    <div className="page-narrow share-landing">
      <article className="card share-card">
        <p className="eyebrow">{kind === 'MANTRA' ? 'A mantra' : kind === 'REEL' ? 'A reel' : 'A verse'}</p>
        <h1>{content.title}</h1>
        {content.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a signed URL on the media host; next/image would need that host allow-listed
          <img className="share-image" src={content.imageUrl} alt="" />
        )}
        {content.sanskrit && <p className="share-sanskrit deva" lang="sa">{content.sanskrit}</p>}
        {content.transliteration && <p className="share-translit">{content.transliteration}</p>}
        {content.meaning && <p className="share-meaning">{content.meaning}</p>}

        <div className="share-actions">
          {/* The app opens by its own link when installed. A phone that has the app and follows an https link from
              elsewhere is handed to it by Android App Links / iOS Universal Links; this button is the explicit way. */}
          <a className="btn btn-primary" href={data.appUri}><Icon name="arrow" size={18} /> Open in the app</a>
          <Link className="btn btn-ghost" href={cont}>Continue on the website</Link>
        </div>
      </article>

      <section className="card share-download" aria-labelledby="dl-title">
        <div>
          <h2 id="dl-title">Keep it with you</h2>
          <p className="muted">HariHariBol is free: read the Gita and Bhagavatam with meaning, chant with a counter, watch devotional reels and talk with Sakha.</p>
          <StoreButtons stores={data.stores} />
          {!data.stores.play && !data.stores.appStore && <p className="muted">The app listing is on its way. You can read everything on the website meanwhile.</p>}
        </div>
        <div className="share-qr">
          <QrCode value={pageUrl} label="QR code that opens this page on your phone" />
          <small className="muted">On a computer? Scan this with your phone.</small>
        </div>
      </section>
    </div>
  );
}
