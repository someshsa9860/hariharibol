import './globals.css';
import type { Metadata } from 'next';
import ErrorBoundary from '@/components/ErrorBoundary';
import Toaster from '@/components/Toaster';

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
    <html lang="en">
      <head>
        {/* Prevents dark-mode flash by applying class before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem('hhb-app-store')||'{}');if(s.state&&s.state.darkMode){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap"
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
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
