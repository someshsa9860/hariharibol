import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { GetTheApp } from './get-the-app';
import type { SharedContent, SharedResult } from '@/lib/shared';

const COPY = {
  VERSE: { eyebrow: 'A verse shared with you', cta: 'Continue reading on the website' },
  MANTRA: { eyebrow: 'A mantra shared with you', cta: 'Continue on the website' },
  REEL: { eyebrow: 'A reel shared with you', cta: 'Watch on the website' },
} as const;

export function SharedPage({ content, route }: { content: SharedContent; route: string }) {
  const copy = COPY[content.type];
  return (
    <div className="page share-page">
      <div className="share-hero">
        <article className="card share-card">
          <span className="eyebrow">{copy.eyebrow}</span>
          {content.imageUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img className="share-thumb" src={content.imageUrl} alt="" />}
          {content.sanskrit && <p className="sanskrit" lang="sa">{content.sanskrit}</p>}
          {content.transliteration && <p className="translit">{content.transliteration}</p>}
          {content.text && <p className="meaning">{content.text}</p>}
          <span className="ref">{content.reference ?? content.title}</span>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" href={content.continuePath}>{copy.cta} <Icon name="arrow" size={16} /></Link>
          </div>
        </article>
        <GetTheApp url={content.canonicalUrl} appPath={`${route}/${content.code}`} heading="Keep this in your pocket" note="Read, chant and ask Sakha — in the app, on any phone." />
      </div>
    </div>
  );
}

/** Missing, revoked or removed — said kindly, with a way on. */
export function SharedGone({ result }: { result: Exclude<SharedResult, { state: 'ok' }> }) {
  return (
    <div className="page share-gone">
      <h1>{result.state === 'gone' ? 'This link is no longer available' : 'We couldn’t find that link'}</h1>
      <p className="muted">
        {result.state === 'gone'
          ? 'The person who shared it, or the library, has taken it down.'
          : 'It may have been copied incompletely. Check the address, or ask the person who sent it to share it again.'}
      </p>
      <Link className="btn btn-primary" href="/">Go to HariHariBol</Link>
    </div>
  );
}
