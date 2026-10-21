import type { Metadata } from 'next';
import Link from 'next/link';
import { GetTheApp } from '@/components/share/get-the-app';
import { InviteActions } from '@/components/share/invite-actions';
import { loadInvitation } from '@/lib/shared';
import { SITE_URL } from '@/lib/config';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const invitation = await loadInvitation(code);
  const title = invitation?.referrerName ? `${invitation.referrerName} invites you to HariHariBol` : 'You are invited to HariHariBol';
  const description = 'Read the Gita, chant mantras and ask Sakha — a quiet place for daily devotion.';
  return {
    title, description,
    robots: { index: false, follow: false },
    openGraph: { title, description, url: `${SITE_URL}/satsang/${code}`, siteName: 'HariHariBol', images: [{ url: `${SITE_URL}/img/logo.png` }] },
    twitter: { card: 'summary', title, description },
  };
}

export default async function SatsangPage({ params }: Props) {
  const { code } = await params;
  const invitation = await loadInvitation(code);

  if (!invitation) {
    return (
      <div className="page share-gone">
        <h1>We couldn’t find that invitation</h1>
        <p className="muted">The code may have been copied incompletely. You can still read and chant on HariHariBol.</p>
        <Link className="btn btn-primary" href="/">Go to HariHariBol</Link>
      </div>
    );
  }

  const who = invitation.referrerName ?? 'A friend';
  return (
    <div className="page share-page">
      <div className="share-hero">
        <article className="card share-card">
          <span className="eyebrow">Satsang</span>
          <h1 style={{ margin: 0 }}>{who} invites you to HariHariBol</h1>
          <p className="meaning">Verses with their meaning, a mantra counter, devotional reels and Sakha to talk with. Begin a round of chanting and {who} receives a month of Ārta as thanks.</p>
          <InviteActions code={invitation.code} />
          <p className="muted small">Your invitation code: <strong className="refer-code" style={{ fontSize: '1.1rem', padding: '4px 10px' }}>{invitation.code}</strong><br />If the app asks for it after you install, type it in.</p>
        </article>
        <GetTheApp url={`${SITE_URL}/satsang/${invitation.code}`} appPath={`satsang/${invitation.code}`} heading="Get the app" note="Install it, sign in, and the invitation is remembered." />
      </div>
    </div>
  );
}
