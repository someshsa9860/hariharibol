import type { Metadata } from 'next';
import { Library } from '@/components/read/library';
import { ErrorState } from '@/components/ui/states';
import { serverGet } from '@/lib/api/server';
import type { Book } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Read — Bhagavad Gita, Srimad Bhagavatam, stotras and more',
  description: 'Read the Bhagavad Gita, Srimad Bhagavatam, stotras, aartis and prayers with the Sanskrit, transliteration, word meanings and purports — free, without an account.',
  alternates: { canonical: '/read' },
};

export default async function ReadPage() {
  const books = await serverGet<Book[]>('/api/app/books', { query: { pageSize: 100 }, revalidate: 300 }).catch(() => null);

  return (
    <div className="page">
      <header className="page-title">
        <p className="eyebrow">The library</p>
        <h1>Read</h1>
        <p>Sacred texts with the Sanskrit, meaning and purport — in the language you read best. No account needed.</p>
      </header>
      {books ? <Library books={books} /> : <ErrorState message="The library could not be reached. Please try again in a moment." />}
    </div>
  );
}
