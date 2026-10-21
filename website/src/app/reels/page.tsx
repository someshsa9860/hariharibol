import type { Metadata } from 'next';
import { ReelFeed } from '@/components/reels/reel-feed';

export const metadata: Metadata = {
  title: 'Reels — a minute of devotion',
  description: 'Short devotional reels: verses, mantras and stories to watch in a minute. Like, save and share them.',
  alternates: { canonical: '/reels' },
};

export default function ReelsPage() {
  return <ReelFeed />;
}
