import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home',
  description:
    'Your personal spiritual learning hub. Today's verse of the day, recommended mantras, and curated content from sacred Vedic traditions.',
  alternates: { canonical: '/home' },
  openGraph: {
    title: 'Home | HariHariBol',
    description:
      'Your personal spiritual learning hub. Today's verse of the day, recommended mantras, and curated content from sacred Vedic traditions.',
  },
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
