import './globals.css';
import type { Metadata } from 'next';

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
      <body>{children}</body>
    </html>
  );
}
