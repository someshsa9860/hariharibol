'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const KEY = 'hhb.appBanner';
const QUIET_DAYS = 14;

/**
 * The "Use the app" prompt on phones. The button goes to /get-app, which already sends an Android phone to Google Play
 * and an iPhone to the App Store (and shows both when a store isn't set up); a phone that has the app is offered
 * "Open" by the store. Not shown on a desktop (CSS), inside the app's own web view, in an installed web app, on the
 * pages that are about the app already, or for two weeks after it was closed. Starts hidden so server and browser
 * render the same thing.
 */
export function AppBanner() {
  const path = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const phone = /Android|iPhone|iPad|iPod/i.test(ua);
    const webview = /; wv\)|\bwv\b/i.test(ua) || (/iPhone|iPad|iPod/i.test(ua) && !/Safari\//i.test(ua)) || /HariHariBol/i.test(ua);
    const installed = window.matchMedia?.('(display-mode: standalone)').matches;
    let quiet = false;
    try { quiet = Date.now() - Number(localStorage.getItem(KEY) || 0) < QUIET_DAYS * 864e5; } catch { /* storage blocked */ }
    setShow(phone && !webview && !installed && !quiet);
  }, []);

  if (!show || path.startsWith('/get-app') || path.startsWith('/reels') || path.startsWith('/sakha')) return null;

  const close = () => {
    setShow(false);
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* storage blocked */ }
  };

  return (
    <aside className="app-banner" aria-label="Use the app">
      <Image src="/icon-192.png" alt="" width={44} height={44} />
      <div className="app-banner-text">
        <strong>HariHariBol</strong>
        <small>Read, chant and ask Sakha — better in the app</small>
      </div>
      <a className="btn btn-primary" href="/get-app" onClick={close}>Use app</a>
      <button type="button" className="app-banner-close" aria-label="Close" onClick={close}>×</button>
    </aside>
  );
}
