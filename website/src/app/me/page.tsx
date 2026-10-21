import type { Metadata } from 'next';
import { MeView } from '@/components/me/me-view';

export const metadata: Metadata = {
  title: 'Your page',
  description: 'Your practice, favourites, reading progress, language and appearance.',
  robots: { index: false },
};

export default function MePage() {
  return <MeView />;
}
