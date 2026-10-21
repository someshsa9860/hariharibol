import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { QrCode } from '@/components/share/qr-code';
import { RememberReferral } from '@/components/share/remember-referral';
import { StoreButtons } from '@/components/share/store-buttons';
import { ApiError } from '@/lib/api/core';
import { serverGet } from '@/lib/api/server';
import { SITE_URL } from '@/lib/config';

type Props = { params: Promise<{ code: string }> };
interface Invite { code: string; firstName: string | null; url: string; stores: { play: string | null; appStore: string | null } }

async function load(code: string): Promise<Invite | null | 'error'> {
  try {
    return await serverGet<Invite>(`/api/app/referral/inviter/${encodeURIComponent(code)}`, { revalidate: 300 });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    return 'error';
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const invite = await load(code);
  const who = invite && invite !== 'error' && invite.firstName ? `${invite.firstName} invites you` : 'You are invited';
  return {
    title: who,
    description: 'Join HariHariBol — read the Gita and Bhagavatam with meaning, chant, and talk with Sakha.',
    alternates: { canonical: `${SITE_URL}/satsang/${code}` },
    robots: { index: false, follow: true },
  };
}

export default async function SatsangPage({ params }: Props) {
  const { code } = await params;
  const invite = await load(code);
  if (invite === null) notFound();

  if (!invite || invite === 'error') {
    return (
      <div className="page-narrow share-landing">
        <div className="card share-card center-state">
          <h1>{invite === 'error' ? 'Something went wrong' : 'We could not find this invitation'}</h1>
          <p className="muted">{invite === 'error' ? 'Please try again in a moment.' : 'The link may be incomplete. You are welcome to explore HariHariBol anyway.'}</p>
          <Link href="/" className="btn btn-primary">Go to HariHariBol</Link>
        </div>
      </div>
    );
  }

  const pageUrl = `${SITE_URL}/satsang/${invite.code}`;
  return (
    <div className="page-narrow share-landing">
      <RememberReferral code={invite.code} />
      <article className="card share-card">
        <p className="eyebrow">Satsang</p>
        <h1>{invite.firstName ? `${invite.firstName} invites you to HariHariBol` : 'You are invited to HariHariBol'}</h1>
        <p className="share-meaning">A quiet place for verses, mantras and everyday devotion — free to use. Sign in with Google or Apple to begin, and your invitation is remembered.</p>
        <div className="share-actions">
          <Link className="btn btn-primary" href="/">Continue on the website</Link>
          <Link className="btn btn-ghost" href="/read">Start reading</Link>
        </div>
        <p className="muted small">
          Installing the app? Open it after installing and enter the code <strong>{invite.code}</strong> in Refer &amp; Earn if it does not
          appear on its own.
        </p>
      </article>
      <section className="card share-download" aria-labelledby="dl-title">
        <div>
          <h2 id="dl-title">Get the app</h2>
          <StoreButtons stores={invite.stores} />
        </div>
        <div className="share-qr">
          <QrCode value={pageUrl} label="QR code that opens this invitation on your phone" />
          <small className="muted">Scan with your phone</small>
        </div>
      </section>
    </div>
  );
}
