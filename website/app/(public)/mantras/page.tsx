'use client';

import { useEffect, useState } from 'react';
import { Search, Music2 } from 'lucide-react';
import api from '@/lib/api';
import MantraCard from '@/components/MantraCard';
import { SkeletonGrid } from '@/components/SkeletonCard';

export default function MantrasPage() {
  const [mantras, setMantras] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCat, setSelectedCat] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/mantras?take=100')
      .then(r => {
        const data = r.data?.data || r.data || [];
        setMantras(data);
        setFiltered(data);
        const cats = Array.from(new Set(data.map((m: any) => m.category).filter(Boolean))) as string[];
        setCategories(cats);
      })
      .catch(() => setMantras([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = mantras;
    if (selectedCat !== 'All') result = result.filter((m) => m.category === selectedCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((m) => m.name?.toLowerCase().includes(q) || m.text?.toLowerCase().includes(q));
    }
    setFiltered(result);
  }, [search, selectedCat, mantras]);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: 80 }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }} className="py-16">
        <div className="container-site text-center">
          <h1 className="text-4xl font-black mb-4" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
            Sacred Mantras
          </h1>
          <p className="text-base mb-8" style={{ color: 'var(--muted)' }}>
            Chants and invocations with Sanskrit, transliteration, and meaning
          </p>
          <div className="relative max-w-md mx-auto">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
            <input
              className="input-field pl-10"
              placeholder="Search mantras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="container-site py-8">
        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {['All', ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: selectedCat === cat ? 'var(--accent)' : 'var(--surface-2)',
                  color: selectedCat === cat ? '#fff' : 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading ? <SkeletonGrid count={6} /> : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((m) => <MantraCard key={m.id} mantra={m} />)}
          </div>
        ) : (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
            <Music2 size={48} className="mx-auto mb-4 opacity-25" />
            <p>{search || selectedCat !== 'All' ? 'No mantras match your filter.' : 'No mantras available yet.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
