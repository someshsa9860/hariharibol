import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { EmptyState } from '@/components/ui/states';
import { ChapterReader } from './chapter-reader';
import type { Verse } from '@/lib/types';

/** A stotra, aarti or prayer: no chapters, the verses are the page. */
export function ShortWorkReader({ book, verses }: { book: { slug: string; title: string; description: string | null }; verses: Verse[] }) {
  return (
    <div className="page-narrow">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/read">Read</Link><Icon name="right" size={14} /><span>{book.title}</span></nav>
      <header className="chapter-head">
        <h1>{book.title}</h1>
        {book.description && <p className="muted">{book.description}</p>}
      </header>
      {verses.length === 0 ? (
        <EmptyState title="No verses yet">This work is still being prepared.</EmptyState>
      ) : (
        <ChapterReader verses={verses} bookSlug={book.slug} bookTitle={book.title} cantoNumber={null} chapterNumber={null} />
      )}
    </div>
  );
}
