import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SharedGone, SharedPage } from '@/components/share/shared-page';
import { loadShared } from '@/lib/shared';
import { excerpt } from '@/lib/format';
import { SITE_URL } from '@/lib/config';

type Props = { params: Promise<{ code: string }> };
const ROUTE = 'naam' as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const result = await loadShared(ROUTE, code);
  if (result.state !== 'ok') return { title: 'Link not available', robots: { index: false } };
  const { content } = result;
  const description = excerpt([content.sanskrit, content.text].filter(Boolean).join(' — '), 200) || 'Shared from HariHariBol';
  const url = `${SITE_URL}/${ROUTE}/${code}`;
  const image = content.imageUrl ?? `${SITE_URL}/img/logo.png`;
  return {
    title: content.title,
    description,
    // Many personal links, one page: search engines are pointed at the page itself.
    alternates: { canonical: content.continuePath },
    robots: { index: false, follow: true },
    openGraph: { title: content.title, description, url, type: 'article', siteName: 'HariHariBol', images: [{ url: image }] },
    twitter: { card: content.imageUrl ? 'summary_large_image' : 'summary', title: content.title, description, images: [image] },
  };
}

export default async function Page({ params }: Props) {
  const { code } = await params;
  const result = await loadShared(ROUTE, code);
  if (result.state === 'missing') notFound();
  if (result.state !== 'ok') return <SharedGone result={result} />;
  return <SharedPage content={result.content} route={ROUTE} />;
}
