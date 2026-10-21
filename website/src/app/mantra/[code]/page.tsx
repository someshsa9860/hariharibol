import type { Metadata } from 'next';
import { ShareLanding, shareMetadata } from '@/components/share/share-landing';

type Props = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  return shareMetadata((await params).code, 'MANTRA', await searchParams);
}

export default async function Page({ params, searchParams }: Props) {
  return <ShareLanding code={(await params).code} kind="MANTRA" searchParams={await searchParams} />;
}
