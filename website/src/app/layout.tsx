import type { Metadata, Viewport } from 'next';
import { SITE_URL } from '@/lib/config';
import { readingLanguage } from '@/lib/prefs/server';
import { configScript } from '@/lib/runtime-config';
import { PrefsProvider } from '@/lib/prefs/prefs-provider';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { ReferralAttributor } from '@/components/share/referral-attributor';
import { ToastProvider } from '@/components/ui/toast';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { BottomTabs } from '@/components/layout/bottom-tabs';
import '@/styles/index.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'HariHariBol — Learn. Chant. Remember.', template: '%s · HariHariBol' },
  description: 'Read the Bhagavad Gita and Srimad Bhagavatam with meaning, chant mantras with a counter, watch devotional reels and ask Sakha — a quiet place for verses, mantras and everyday devotion.',
  applicationName: 'HariHariBol',
  openGraph: { type: 'website', siteName: 'HariHariBol', url: SITE_URL, images: [{ url: '/img/logo.png' }] },
  twitter: { card: 'summary' },
  alternates: { canonical: '/' },
  icons: { icon: '/img/logo.png', apple: '/img/logo.png' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf6ee' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1a18' },
  ],
  width: 'device-width',
  initialScale: 1,
};

// Sets the theme and the "scripts are running" class before the first paint, so there is no flash of the wrong colours
// and the reveal animations only hide content that JavaScript can bring back.
const BOOT = `try{var d=document.documentElement;d.classList.add('js');var p=JSON.parse(localStorage.getItem('hhb.prefs')||'null');if(p&&p.theme&&p.theme!=='system')d.setAttribute('data-theme',p.theme)}catch(e){document.documentElement.classList.add('js')}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const language = await readingLanguage();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=Noto+Serif+Devanagari:wght@400;500;600&display=swap"
        />
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
            </ToastProvider>
          </AuthProvider>
        </PrefsProvider>
      </body>
    </html>
  );
}
