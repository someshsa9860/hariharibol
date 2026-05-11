import Link from 'next/link';
import { BookOpen } from 'lucide-react';

interface Book {
  id: string;
  title?: string;
  author?: string;
  description?: string;
  verseCount?: number;
  chapterCount?: number;
  thumbnailUrl?: string;
  language?: string;
}

export default function BookCard({ book }: { book: Book }) {
  return (
    <Link href={`/books/${book.id}`} className="card-hover block p-5 group">
      {/* Cover */}
      <div
        className="w-full h-40 rounded-xl mb-4 flex items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface) 100%)', border: '1px solid var(--border)' }}
      >
        {book.thumbnailUrl ? (
          <img src={book.thumbnailUrl} alt={book.title} className="w-full h-full object-cover rounded-xl" />
        ) : (
          <BookOpen size={40} style={{ color: 'var(--accent)', opacity: 0.5 }} />
        )}
      </div>

      {/* Info */}
      <h3 className="font-bold text-base mb-1 leading-tight" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
        {book.title || 'Untitled'}
      </h3>
      {book.author && (
        <p className="text-xs mb-2 font-medium" style={{ color: 'var(--accent)' }}>{book.author}</p>
      )}
      {book.description && (
        <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: 'var(--muted)' }}>{book.description}</p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
        {book.chapterCount != null && <span>{book.chapterCount} chapters</span>}
        {book.verseCount != null && <span>{book.verseCount} verses</span>}
        {book.language && <span className="badge text-xs">{book.language}</span>}
      </div>
    </Link>
  );
}
