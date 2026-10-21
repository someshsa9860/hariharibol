import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { QrCode } from '@/components/share/qr-code';
import { StoreButtons } from '@/components/share/store-buttons';
import { APP_STORE_URL, PLAY_STORE_URL, SITE_URL } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Get the app',
  description: 'Download HariHariBol for Android or iPhone — read, chant, watch reels and ask Sakha.',
  alternates: { canonical: `${SITE_URL}/get-app` },
};

/**
 * "Get the app". On an Android phone this goes straight to Google Play, and on an iPhone or iPad to the App Store
 * (once that listing is configured); everywhere else, and for a phone whose store is not configured, it shows both
 * buttons and a QR code. The QR code points at this same page, so scanning it with a phone lands in the right store.
 * `?stay=1` shows the page on a phone too. The system is read from the User-Agent on the server — a hint, not proof,
 * which is why the page itself always offers both stores.
 */
export default async function GetAppPage({ searchParams }: { searchParams: Promise<{ stay?: string }> }) {
  const { stay } = await searchParams;
  if (!stay) {
    const ua = (await headers()).get('user-agent') ?? '';
    if (/android/i.test(ua) && PLAY_STORE_URL) redirect(PLAY_STORE_URL);
    if (/iphone|ipad|ipod/i.test(ua) && APP_STORE_URL) redirect(APP_STORE_URL);
  }

  return (
    <div className="page-narrow share-landing">
      <article className="card share-card">
        <p className="eyebrow">HariHariBol app</p>
        <h1>Get the app</h1>
        <p className="share-meaning">Read the Gita and Bhagavatam with meaning, chant with a counter, watch devotional reels and talk with Sakha — free.</p>
        <StoreButtons stores={{ play: PLAY_STORE_URL, appStore: APP_STORE_URL }} />
        {!APP_STORE_URL && <p className="muted small">The iPhone app is on its way. You can use everything on the website meanwhile.</p>}
      </article>
      <section className="card share-download" aria-labelledby="qr-title">
        <div>
          <h2 id="qr-title">On a computer?</h2>
          <p className="muted">Scan this with your phone’s camera. It opens the right store for your phone.</p>
          <Link className="btn btn-ghost" href="/">Continue on the website</Link>
        </div>
        <div className="share-qr">
          <QrCode value={`${SITE_URL}/get-app`} label="QR code that opens the app download page on your phone" size={184} />
        </div>
      </section>
    </div>
  );
}
