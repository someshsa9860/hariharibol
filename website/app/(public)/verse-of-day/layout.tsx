import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verse of the Day',
  description:
    "Start your day with a sacred verse from the Bhagavad Gita or Srimad Bhagavatam. Today's AI-curated spiritual insight with Sanskrit, transliteration, and explanation.",
  alternates: { canonical: '/verse-of-day' },
  openGraph: {
    title: 'Verse of the Day | HariHariBol',
    description:
      "Start your day with a sacred verse from the Bhagavad Gita or Srimad Bhagavatam. Today's AI-curated spiritual insight with Sanskrit, transliteration, and explanation.",
  },
};

export default function VerseOfDayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
