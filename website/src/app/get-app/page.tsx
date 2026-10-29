import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Qr } from '@/components/share/qr';
import { appStoreUrl, PLAY_STORE_URL, SITE_URL } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Get the app',
  description: 'Download HariHariBol for Android or iPhone — read, chant, watch reels and ask Sakha.',
  alternates: { canonical: `${SITE_URL}/get-app` },
};

/**
 * "Get the app". On an Android phone this goes straight to Google Play, and on an iPhone or iPad to the App Store
 * (once that listing is configured); everywhere else — and on a phone whose store is not configured — it shows the
 * store buttons and a QR code. The QR code points at this same page, so scanning it lands a phone in the right store.
 * `?stay=1` shows the page on a phone too. The system is read from the User-Agent on the server: a hint, not proof,
 * which is why the page always offers both stores.
 */
export default async function GetAppPage({ searchParams }: { searchParams: Promise<{ stay?: string }> }) {
  const { stay } = await searchParams;
  const appStore = appStoreUrl();
  if (!stay) {
    const ua = (await headers()).get('user-agent') ?? '';
    if (/android/i.test(ua) && PLAY_STORE_URL) redirect(PLAY_STORE_URL);
    if (/iphone|ipad|ipod/i.test(ua) && appStore) redirect(appStore);
  }

  return (
    <div className="page-narrow share-page">
      <aside className="card share-get" aria-labelledby="get-app-title">
        <div className="share-brand">
          <Image src="/img/logo-128.png" alt="" width={44} height={44} />
          <div>
            <h1 id="get-app-title" style={{ fontSize: '1.5rem', margin: 0 }}>Get the app</h1>
            <small className="muted">HariHariBol — learn, chant, remember</small>
          </div>
        </div>
        <p className="muted" style={{ margin: 0 }}>Read the Gita and Bhagavatam with meaning, chant with a counter, watch devotional reels and talk with Sakha — free.</p>

        <div className="share-badges">
          <a className="share-badge" href={PLAY_STORE_URL} rel="noopener">
            <span aria-hidden>▶</span><span><small>GET IT ON</small>Google Play</span>
          </a>
          {appStore && (
            <a className="share-badge" href={appStore} rel="noopener">
              <span aria-hidden></span><span><small>Download on the</small>App Store</span>
            </a>
          )}
        </div>
        {!appStore && <p className="muted small" style={{ margin: 0 }}>The iPhone app is on its way. Everything also works on the website.</p>}

        <div className="share-qr">
          <Qr value={`${SITE_URL}/get-app`} label="QR code. Scan it with your phone to get the app." />
          <small className="muted">On a computer? Scan with your phone’s camera — it opens the right store for your phone.</small>
        </div>
        <Link className="btn btn-ghost" href="/" style={{ justifySelf: 'start' }}>Continue on the website</Link>
      </aside>
    </div>
  );
}
