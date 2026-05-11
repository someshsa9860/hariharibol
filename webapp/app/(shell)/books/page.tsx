'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, BookOpen } from 'lucide-react';
import api from '@/lib/api';
import TopBar from '@/components/TopBar';

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
      <div className="p-4 max-w-2xl mx-auto">
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input className="input-field pl-9 text-sm" placeholder="Search books…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card flex gap-3 p-3">
                <div className="skeleton w-14 h-20 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((b) => (
              <Link key={b.id} href={`/books/${b.id}`} className="card-hover flex gap-3 p-3">
                <div className="w-14 h-20 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)' }}>
                  {b.thumbnailUrl
                    ? <img src={b.thumbnailUrl} alt={b.title} className="w-full h-full object-cover rounded-lg" />
                    : <BookOpen size={20} style={{ color: 'var(--accent)', opacity: 0.5 }} />}
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-tight mb-1" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
                    {b.title}
                  </h3>
                  {b.author && <p className="text-xs mb-1" style={{ color: 'var(--accent)' }}>{b.author}</p>}
                  {b.description && <p className="text-xs line-clamp-2" style={{ color: 'var(--muted)' }}>{b.description}</p>}
                  <div className="flex gap-2 mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                    {b.chapterCount != null && <span>{b.chapterCount} ch</span>}
                    {b.verseCount != null && <span>{b.verseCount} verses</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
            <BookOpen size={40} className="mx-auto mb-3 opacity-25" />
            <p className="text-sm">{search ? 'No results.' : 'Backend not running — start it to see books.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
