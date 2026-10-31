import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter, Noto_Serif_Devanagari } from 'next/font/google';
import { appStoreUrl, SITE_URL } from '@/lib/config';
import { readingLanguage } from '@/lib/prefs/server';
import { configScript } from '@/lib/runtime-config';
import { PrefsProvider } from '@/lib/prefs/prefs-provider';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { ReferralAttributor } from '@/components/share/referral-attributor';
import { ToastProvider } from '@/components/ui/toast';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { BottomTabs } from '@/components/layout/bottom-tabs';
import { AppBanner } from '@/components/layout/app-banner';
import '@/styles/index.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'HariHariBol — Learn. Chant. Remember.', template: '%s · HariHariBol' },
  description: 'Read the Bhagavad Gita and Srimad Bhagavatam with meaning, chant mantras with a counter, watch devotional reels and ask Sakha — a quiet place for verses, mantras and everyday devotion.',
  applicationName: 'HariHariBol',
  openGraph: { type: 'website', siteName: 'HariHariBol', url: SITE_URL, images: [{ url: '/img/logo.png' }] },
  twitter: { card: 'summary' },
  alternates: { canonical: '/' },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/icon-192.png', type: 'image/png', sizes: '192x192' }, { url: '/icon-512.png', type: 'image/png', sizes: '512x512' }],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf6ee' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1a18' },
  ],
  width: 'device-width',
  initialScale: 1,
};

// The three faces, downloaded at build time and served from this site (no request to Google from the reader's browser).
// Each sets a CSS variable that `--serif` / `--sans` / `--deva` in tokens.css start with. Fraunces keeps its optical-size
// axis, which Google only gives with the full weight range (it is the same file either way). Devanagari is not preloaded:
// most pages never draw it, and the browser fetches it the moment one does.
const fraunces = Fraunces({ subsets: ['latin'], axes: ['opsz'], variable: '--font-fraunces' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter' });
const devanagari = Noto_Serif_Devanagari({ subsets: ['devanagari'], weight: ['400', '500', '600'], preload: false, variable: '--font-deva' });

// Sets the theme and the "scripts are running" class before the first paint, so there is no flash of the wrong colours
// and the reveal animations only hide content that JavaScript can bring back.
const BOOT = `try{var d=document.documentElement;d.classList.add('js');var p=JSON.parse(localStorage.getItem('hhb.prefs')||'null');if(p&&p.theme&&p.theme!=='system')d.setAttribute('data-theme',p.theme)}catch(e){document.documentElement.classList.add('js')}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const language = await readingLanguage();
  const appStoreId = appStoreUrl().match(/id(\d{6,})/)?.[1];
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${devanagari.variable}`} suppressHydrationWarning>
      <head>
        {appStoreId && <meta name="apple-itunes-app" content={`app-id=${appStoreId}`} />}
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
        <script dangerouslySetInnerHTML={{ __html: configScript() }} />
      </head>
      <body>
        <PrefsProvider initialLanguage={language}>
          <AuthProvider>
            <ToastProvider>
              <ReferralAttributor />
              <a className="skip-link" href="#content">Skip to content</a>
              <SiteHeader />
              <main id="content" className="main">{children}</main>
              <SiteFooter />
              <BottomTabs />
              <AppBanner />
            </ToastProvider>
          </AuthProvider>
        </PrefsProvider>
      </body>
    </html>
  );
}
