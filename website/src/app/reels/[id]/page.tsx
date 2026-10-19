import type { Metadata } from 'next';
import { ReelFeed } from '@/components/reels/reel-feed';
import { serverGetOrNull } from '@/lib/api/server';
import { excerpt } from '@/lib/format';
import { SITE_URL } from '@/lib/config';
import type { Reel } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const reel = await serverGetOrNull<Reel>(`/api/app/reels/${id}`, { revalidate: 300 }).catch(() => null);
  if (!reel) return { title: 'Reel' };
  const description = excerpt(reel.caption) || 'A devotional reel on HariHariBol.';
  return {
    title: reel.verse?.label ? `Reel · ${reel.verse.label}` : 'Reel',
    description,
    alternates: { canonical: `/reels/${id}` },
    openGraph: { title: 'A reel on HariHariBol', description, url: `${SITE_URL}/reels/${id}`, images: reel.thumbnailUrl ? [reel.thumbnailUrl] : undefined },
  };
}

export default async function SharedReelPage({ params }: Props) {
  const { id } = await params;
  return <ReelFeed startId={id} />;
}
