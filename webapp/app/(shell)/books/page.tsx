'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, BookOpen } from 'lucide-react';
import api from '@/lib/api';
import TopBar from '@/components/TopBar';

const GRADIENTS = [
  'linear-gradient(135deg, #C75A1A 0%, #8B2FC9 100%)',
  'linear-gradient(135deg, #1A6BC7 0%, #0D9488 100%)',
  'linear-gradient(135deg, #C7891A 0%, #C72B1A 100%)',
  'linear-gradient(135deg, #1AC77B 0%, #1A4FC7 100%)',
];

export default function AppBooksPage() {
  const [books, setBooks] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/books?take=50')
      .then(r => { const d = r.data?.data || r.data || []; setBooks(d); setFiltered(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(books); return; }
    const q = search.toLowerCase();
    setFiltered(books.filter((b) => b.title?.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q)));
  }, [search, books]);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <TopBar title="Sacred Texts" />

      {/* Sticky glass search bar */}
      <div
        className="sticky top-0 z-10 px-4 py-3"
        style={{
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          background: 'rgba(15, 7, 3, 0.82)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="relative max-w-5xl mx-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            className="input-field pl-9 text-sm w-full"
            placeholder="Search sacred texts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden animate-pulse" style={{ background: 'var(--surface)' }}>
                <div className="h-40 w-full" style={{ background: 'var(--surface-2)' }} />
                <div className="p-4 space-y-2">
                  <div className="h-4 rounded w-3/4" style={{ background: 'var(--surface-2)' }} />
                  <div className="h-3 rounded w-1/2" style={{ background: 'var(--surface-2)' }} />
                  <div className="h-3 rounded w-1/3" style={{ background: 'var(--surface-2)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((b, idx) => (
              <Link key={b.id} href={`/books/${b.id}`} className="block">
                <div className="card-hover rounded-2xl overflow-hidden flex flex-col h-full" style={{ background: 'var(--surface)' }}>
                  {/* Gradient / image cover */}
                  <div
                    className="h-40 w-full flex items-center justify-center relative overflow-hidden"
                    style={{ background: b.thumbnailUrl ? undefined : GRADIENTS[idx % GRADIENTS.length] }}
                  >
                    {b.thumbnailUrl
                      ? <img src={b.thumbnailUrl} alt={b.title} className="w-full h-full object-cover" />
                      : <BookOpen size={40} style={{ color: 'rgba(255,255,255,0.55)' }} />}
                  </div>

                  {/* Card content */}
                  <div className="p-4 flex-1 flex flex-col">
                    <h3
                      className="font-bold text-sm leading-snug mb-1"
                      style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}
                    >
                      {b.title}
                    </h3>
                    {b.author && (
                      <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>{b.author}</p>
                    )}
                    {b.description && (
                      <p className="text-xs line-clamp-2 flex-1 leading-relaxed" style={{ color: 'var(--muted)' }}>
                        {b.description}
                      </p>
                    )}
                    <div className="flex gap-3 mt-3 text-xs font-semibold flex-wrap">
                      {b.chapterCount != null && (
                        <span style={{ color: '#C75A1A' }}>{b.chapterCount} chapters</span>
                      )}
                      {b.verseCount != null && (
                        <span style={{ color: '#0D9488' }}>{b.verseCount} verses</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24" style={{ color: 'var(--muted)' }}>
            <div className="text-7xl mb-4 opacity-25 select-none" style={{ fontFamily: 'serif' }}>ॐ</div>
            <p className="text-sm">
              {search ? 'No results found.' : 'Backend not running — start it to see books.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
