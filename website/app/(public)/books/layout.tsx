import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sacred Books',
  description:
    'Browse the Bhagavad Gita, Srimad Bhagavatam, Upanishads, and other sacred Vedic texts. Read verses in Sanskrit with transliteration and English translation.',
  alternates: { canonical: '/books' },
  openGraph: {
    title: 'Sacred Books | HariHariBol',
    description:
      'Browse the Bhagavad Gita, Srimad Bhagavatam, Upanishads, and other sacred Vedic texts. Read verses in Sanskrit with transliteration and English translation.',
  },
};

export default function BooksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
