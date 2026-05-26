import './globals.css';
import type { Metadata } from 'next';
import { Inter, Playfair_Display, Noto_Sans_Devanagari } from 'next/font/google';
import ErrorBoundary from '@/components/ErrorBoundary';
import Toaster from '@/components/Toaster';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '600', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hariharibol.com';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'HariHariBol — Sacred Vedic Wisdom & Spiritual Learning',
    template: '%s | HariHariBol',
  },
  description:
    'Explore sacred Vedic texts, mantras, and spiritual guidance from the Bhagavad Gita, Srimad Bhagavatam, and more. Daily verse of the day, AI-powered GuruDev chatbot.',
  keywords: [
    'bhagavad gita',
    'srimad bhagavatam',
    'vedic wisdom',
    'spiritual learning',
    'mantras',
    'sampradayas',
    'sanskrit verses',
    'spiritual guidance',
    'hinduism',
    'vedic texts',
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'HariHariBol',
    title: 'HariHariBol — Sacred Vedic Wisdom & Spiritual Learning',
    description:
      'Explore sacred Vedic texts, mantras, and spiritual guidance from the Bhagavad Gita, Srimad Bhagavatam, and more. Daily verse of the day, AI-powered GuruDev chatbot.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'HariHariBol — Sacred Vedic Wisdom' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HariHariBol — Sacred Vedic Wisdom & Spiritual Learning',
    description:
      'Explore sacred Vedic texts, mantras, and spiritual guidance from the Bhagavad Gita, Srimad Bhagavatam, and more.',
    images: [OG_IMAGE],
  },
};

// Reads persisted Zustand store key 'hhb-app-store' and applies .dark before hydration to prevent flash.
const darkModeScript = `(function(){try{var s=JSON.parse(localStorage.getItem('hhb-app-store')||'{}');if(s&&s.state&&s.state.darkMode)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${playfair.variable} ${notoDevanagari.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
      </head>
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
