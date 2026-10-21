import type { Metadata } from 'next';
import { SearchView } from '@/components/read/search-view';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search verses, mantras and books by Sanskrit, transliteration or meaning — or jump to a verse like “BG 2.47”.',
  alternates: { canonical: '/search' },
  robots: { index: false },
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <SearchView initialQuery={q ?? ''} />;
}
