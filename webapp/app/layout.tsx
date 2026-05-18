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

export const metadata: Metadata = {
  title: {
    default: 'HariHariBol — Sacred Vedic Wisdom',
    template: '%s | HariHariBol',
  },
  description: 'Read sacred verses, chant mantras, and deepen your Vedic practice with HariHariBol.',
  openGraph: {
    title: 'HariHariBol — Sacred Vedic Wisdom',
    description: 'Read sacred verses, chant mantras, and deepen your Vedic practice.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'HariHariBol' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${notoDevanagari.variable}`}>
      <head>
        {/* Prevents dark-mode flash by applying class before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem('hhb-app-store')||'{}');if(s.state&&s.state.darkMode){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
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
