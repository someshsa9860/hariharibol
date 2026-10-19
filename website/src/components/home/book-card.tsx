/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { Motif } from '@/components/ui/motif';
import { plural } from '@/lib/format';
import type { Book } from '@/lib/types';

const TYPE_LABEL: Record<Book['type'], string> = {
  SCRIPTURE: 'Scripture', STOTRA: 'Stotra', AARTI: 'Aarti', PRAYER: 'Prayer', POEM: 'Poem', TEXT: 'Text',
};
const MOTIF = ['lotus', 'sun', 'conch', 'flute'] as const;

export function BookCard({ book }: { book: Book }) {
  const unit = book.totalChapters ? plural(book.totalChapters, 'chapter') : null;
  return (
    <Link href={`/read/${book.slug}`} className="book-card card card-hover">
      <div className="book-cover" data-tone={book.bookNumber % 4}>
        {book.coverImageUrl ? <img src={book.coverImageUrl} alt="" loading="lazy" /> : <Motif kind={MOTIF[book.bookNumber % MOTIF.length]} />}
      </div>
      <div className="book-card-body">
        <span className="badge">{TYPE_LABEL[book.type]}</span>
        <h3>{book.title}</h3>
        <p className="muted">{[unit, plural(book.totalVerses, 'verse')].filter(Boolean).join(' · ')}</p>
      </div>
    </Link>
  );
}
