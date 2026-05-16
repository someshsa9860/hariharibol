'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, BookOpen, LayoutGrid, List } from 'lucide-react';
import api from '@/lib/api';

const COVER_GRADIENTS = [
  'linear-gradient(135deg, #FF6B00, #7B1C1C)',
  'linear-gradient(135deg, #006B6B, #2D5A27)',
  'linear-gradient(135deg, #D4A055, #FF6B00)',
  'linear-gradient(135deg, #7B1C1C, #E8A0A0)',
];

function SkeletonBookCard() {
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      <div className="h-48 w-full animate-pulse" style={{ background: 'var(--surface-2)' }} />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 animate-pulse rounded" style={{ background: 'var(--surface-2)' }} />
        <div className="h-3 w-1/2 animate-pulse rounded" style={{ background: 'var(--surface-2)' }} />
        <div className="h-3 w-full animate-pulse rounded" style={{ background: 'var(--surface-2)' }} />
        <div className="flex gap-2">
          <div className="h-5 w-20 animate-pulse rounded-full" style={{ background: 'var(--surface-2)' }} />
          <div className="h-5 w-16 animate-pulse rounded-full" style={{ background: 'var(--surface-2)' }} />
        </div>
      </div>
    </div>
  );
}

function BookCard({ book, index, view }: { book: any; index: number; view: 'grid' | 'list' }) {
  const gradient = COVER_GRADIENTS[index % 4];

  if (view === 'list') {
    return (
      <Link href={`/books/${book.id}`} className="card-hover flex gap-4 p-4 rounded-2xl">
        <div
          className="w-16 h-20 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{ background: gradient }}
        >
          {book.thumbnailUrl ? (
            <img src={book.thumbnailUrl} alt={book.title} className="w-full h-full object-cover rounded-xl" />
          ) : (
            <BookOpen size={24} className="text-white/70" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base leading-tight mb-1 truncate" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
            {book.title || 'Untitled'}
          </h3>
          {book.author && (
            <p className="text-xs font-semibold mb-2" style={{ color: '#FF6B00' }}>{book.author}</p>
          )}
          {book.description && (
            <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--muted)' }}>{book.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {book.chapterCount != null && (
              <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: '#006B6B' }}>
                {book.chapterCount} ch
              </span>
            )}
            {book.verseCount != null && (
              <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: '#006B6B' }}>
                {book.verseCount} verses
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/books/${book.id}`} className="card-hover block rounded-2xl overflow-hidden group">
      <div
        className="w-full h-48 flex items-center justify-center overflow-hidden"
        style={{ background: gradient }}
      >
        {book.thumbnailUrl ? (
          <img src={book.thumbnailUrl} alt={book.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <BookOpen size={40} className="text-white/60" />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-bold text-base mb-1 leading-tight" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
          {book.title || 'Untitled'}
        </h3>
        {book.author && (
          <p className="text-xs mb-2 font-semibold" style={{ color: '#FF6B00' }}>{book.author}</p>
        )}
        {book.description && (
          <p className="text-xs leading-relaxed line-clamp-2 mb-3" style={{ color: 'var(--muted)' }}>{book.description}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {book.chapterCount != null && (
            <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: '#006B6B' }}>
              {book.chapterCount} chapters
            </span>
          )}
          {book.verseCount != null && (
            <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: '#006B6B' }}>
              {book.verseCount} verses
            </span>
          )}
          {book.language && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
              {book.language}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function BooksPage() {
  const [books, setBooks] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    api.get('/books?take=50')
      .then(r => {
        const data = r.data?.data || r.data || [];
        setBooks(data);
        setFiltered(data);
      })
      .catch(() => setBooks([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(books); return; }
    const q = search.toLowerCase();
    setFiltered(books.filter((b) =>
      b.title?.toLowerCase().includes(q) ||
      b.author?.toLowerCase().includes(q) ||
      b.description?.toLowerCase().includes(q)
    ));
  }, [search, books]);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: 80 }}>
      {/* Hero */}
      <div className="py-16" style={{ background: '#C4A882' }}>
        <div className="container-site text-center">
          <h1 className="text-4xl font-black mb-3" style={{ fontFamily: 'Playfair Display, serif', color: '#1A1410' }}>
            Sacred Texts
          </h1>
          <p className="text-base mb-8" style={{ color: 'rgba(26,20,16,0.6)' }}>
            Vedic scriptures with Sanskrit, transliteration, translation, and commentary
          </p>
          <div className="relative max-w-md mx-auto">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'rgba(26,20,16,0.45)' }} />
            <input
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none border"
              style={{
                background: 'rgba(255,255,255,0.55)',
                borderColor: 'rgba(26,20,16,0.2)',
                color: '#1A1410',
              }}
              placeholder="Search books, authors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="container-site py-10">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {loading ? 'Loading…' : `${filtered.length} book${filtered.length !== 1 ? 's' : ''}`}
          </p>
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--surface-2)' }}>
            <button
              onClick={() => setView('grid')}
              className="p-1.5 rounded-md transition-colors"
              style={{
                background: view === 'grid' ? 'var(--bg)' : 'transparent',
                color: view === 'grid' ? 'var(--accent)' : 'var(--muted)',
              }}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setView('list')}
              className="p-1.5 rounded-md transition-colors"
              style={{
                background: view === 'list' ? 'var(--bg)' : 'transparent',
                color: view === 'list' ? 'var(--accent)' : 'var(--muted)',
              }}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'flex flex-col gap-3'}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonBookCard key={i} />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'flex flex-col gap-3'}>
            {filtered.map((b, i) => <BookCard key={b.id} book={b} index={i} view={view} />)}
          </div>
        ) : (
          <div className="text-center py-24" style={{ color: 'var(--muted)' }}>
            <div className="text-6xl mb-4 opacity-30 select-none" style={{ fontFamily: 'serif' }}>ॐ</div>
            <p className="text-lg font-medium mb-2">{search ? 'No books match your search' : 'No books yet'}</p>
            <p className="text-sm">{search ? 'Try a different term.' : 'Books will appear once the backend is running.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
