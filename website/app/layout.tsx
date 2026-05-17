import './globals.css';
import type { Metadata } from 'next';

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

// Reads persisted Zustand store key 'hhb-site-store' and applies .dark before hydration to prevent flash.
const darkModeScript = `(function(){try{var s=JSON.parse(localStorage.getItem('hhb-site-store')||'{}');if(s&&s.state&&s.state.darkMode)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-inter: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            --font-playfair: 'Playfair Display', Georgia, serif;
            --font-noto: 'Noto Sans Devanagari', serif;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
