'use client';

import { useEffect, useState } from 'react';
import { Search, BookOpen } from 'lucide-react';
import api from '@/lib/api';
import BookCard from '@/components/BookCard';
import { SkeletonGrid } from '@/components/SkeletonCard';

export default function BooksPage() {
  const [books, setBooks] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
      {/* Header */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }} className="py-16">
        <div className="container-site text-center">
          <h1 className="text-4xl font-black mb-4" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
            Sacred Texts
          </h1>
          <p className="text-base mb-8" style={{ color: 'var(--muted)' }}>
            Vedic scriptures with Sanskrit, transliteration, translation, and commentary
          </p>
          <div className="relative max-w-md mx-auto">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
            <input
              className="input-field pl-10"
              placeholder="Search books, authors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="container-site py-12">
        {loading ? (
          <SkeletonGrid count={6} />
        ) : filtered.length > 0 ? (
          <>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{filtered.length} book{filtered.length !== 1 ? 's' : ''}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filtered.map((b) => <BookCard key={b.id} book={b} />)}
            </div>
          </>
        ) : (
          <div className="text-center py-24" style={{ color: 'var(--muted)' }}>
            <BookOpen size={48} className="mx-auto mb-4 opacity-25" />
            <p className="text-lg font-medium mb-2">{search ? 'No books match your search' : 'No books yet'}</p>
            <p className="text-sm">{search ? 'Try a different term.' : 'Books will appear once the backend is running.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
