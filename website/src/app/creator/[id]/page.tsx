import type { Metadata } from 'next';
import { CreatorView } from '@/components/reels/creator-view';

export const metadata: Metadata = { title: 'Creator', robots: { index: false } };

export default async function CreatorPage({ params }: { params: Promise<{ id: string }> }) {
  return <CreatorView id={(await params).id} />;
}
