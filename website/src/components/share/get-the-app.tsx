import Image from 'next/image';
import { Qr } from './qr';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/config';
import { OpenInApp } from './open-in-app';

/**
 * The install block on every public share page: open the app if it is there, otherwise the stores, and on a desktop a
 * code to scan. No script tries to guess whether the app is installed — a link opened on a phone that has it is
 * handed to it by the system (Android App Links, iOS Universal Links); the button below is for browsers that don't.
 */
export function GetTheApp({ url, appPath, heading, note }: { url: string; appPath: string; heading: string; note?: string }) {
  return (
    <aside className="card share-get" aria-labelledby="get-app-title">
      <div className="share-brand">
        <Image src="/img/logo.png" alt="" width={44} height={44} />
        <div>
          <h2 id="get-app-title" style={{ fontSize: '1.2rem', margin: 0 }}>{heading}</h2>
          <small className="muted">HariHariBol — learn, chant, remember</small>
        </div>
      </div>
      {note && <p className="muted" style={{ margin: 0 }}>{note}</p>}

      <div className="share-open-mobile">
        <OpenInApp path={appPath} />
      </div>

      <div className="share-badges">
        <a className="share-badge" href={PLAY_STORE_URL} rel="noopener">
          <span aria-hidden>▶</span><span><small>GET IT ON</small>Google Play</span>
        </a>
        {APP_STORE_URL && (
          <a className="share-badge" href={APP_STORE_URL} rel="noopener">
            <span aria-hidden></span><span><small>Download on the</small>App Store</span>
          </a>
        )}
      </div>

      <div className="share-qr">
        <Qr value={url} label="QR code. Scan it with your phone to open this page there." />
        <small className="muted">On a computer? Scan with your phone’s camera — it opens the app if you have it, or the store if you don’t.</small>
      </div>
    </aside>
  );
}
