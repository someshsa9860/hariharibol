import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sacred Mantras',
  description:
    'Discover and chant sacred Vedic mantras from various sampradayas. Learn the meaning, pronunciation, and spiritual significance of each mantra.',
  alternates: { canonical: '/mantras' },
  openGraph: {
    title: 'Sacred Mantras | HariHariBol',
    description:
      'Discover and chant sacred Vedic mantras from various sampradayas. Learn the meaning, pronunciation, and spiritual significance of each mantra.',
  },
};

export default function MantrasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
