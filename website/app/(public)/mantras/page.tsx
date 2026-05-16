'use client';

import { useEffect, useState } from 'react';
import { Search, Play, Check, Music2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { SkeletonGrid } from '@/components/SkeletonCard';

const DEITY: Record<string, { border: string; bg: string; pill: string; textColor: string }> = {
  All:     { border: '#D4A055', bg: '#D4A055',  pill: 'rgba(212,160,85,0.15)',   textColor: '#9B6E1A' },
  Vishnu:  { border: '#006B6B', bg: '#006B6B',  pill: 'rgba(0,107,107,0.12)',   textColor: '#006B6B' },
  Shiva:   { border: '#7B1C1C', bg: '#7B1C1C',  pill: 'rgba(123,28,28,0.12)',   textColor: '#7B1C1C' },
  Devi:    { border: '#B05070', bg: '#E8A0A0',  pill: 'rgba(184,80,112,0.12)',  textColor: '#B05070' },
  Ganesha: { border: '#C75A1A', bg: '#FF6B00',  pill: 'rgba(255,107,0,0.12)',   textColor: '#C75A1A' },
};

function deityStyle(category: string) {
  return DEITY[category] ?? { border: '#C75A1A', bg: '#C75A1A', pill: 'rgba(199,90,26,0.12)', textColor: '#C75A1A' };
}

function MantraCardExpand({ mantra }: { mantra: any }) {
  const [open, setOpen] = useState(false);
  const ds = deityStyle(mantra.category || '');

  return (
    <div
      className="card overflow-hidden transition-all duration-300"
      style={{ borderLeft: `4px solid ${ds.border}` }}
    >
      <div
        className="p-5 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3
              className="font-bold text-base leading-snug"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
            >
              {mantra.name || 'Mantra'}
            </h3>
            {mantra.category && (
              <span
                className="text-xs font-semibold mt-1 inline-block px-2 py-0.5 rounded-full"
                style={{ background: ds.pill, color: ds.textColor }}
              >
                {mantra.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => e.stopPropagation()}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:opacity-80"
              style={{ background: 'rgba(255,107,0,0.13)', color: '#FF6B00' }}
              aria-label="Play mantra"
            >
              <Play size={15} fill="#FF6B00" />
            </button>
            {open
              ? <ChevronUp size={16} style={{ color: 'var(--muted)' }} />
              : <ChevronDown size={16} style={{ color: 'var(--muted)' }} />}
          </div>
        </div>

        {mantra.text && (
          <p
            style={{
              fontFamily: "'Noto Sans Devanagari', sans-serif",
              color: 'var(--text)',
              fontSize: '1rem',
              lineHeight: 1.9,
            }}
          >
            {mantra.text}
          </p>
        )}
      </div>

      {/* Expandable body */}
      <div
        style={{
          maxHeight: open ? '600px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <div className="px-5 pb-5 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
          {mantra.transliteration && (
            <p className="italic text-sm pt-3" style={{ color: 'var(--muted)' }}>
              {mantra.transliteration}
            </p>
          )}
          {mantra.meaning && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {mantra.meaning}
            </p>
          )}
          {Array.isArray(mantra.benefits) && mantra.benefits.length > 0 && (
            <ul className="space-y-1.5 mt-2">
              {mantra.benefits.map((b: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#2D5A27' }} />
                  <span style={{ color: 'var(--text-2)' }}>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MantrasPage() {
  const [mantras, setMantras] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCat, setSelectedCat] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/mantras?take=100')
      .then((r) => {
        const data = r.data?.data || r.data || [];
        setMantras(data);
        setFiltered(data);
        const cats = Array.from(
          new Set(data.map((m: any) => m.category).filter(Boolean))
        ) as string[];
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
      result = result.filter(
        (m) => m.name?.toLowerCase().includes(q) || m.text?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, selectedCat, mantras]);

  /* pill styling helper */
  const pillStyle = (cat: string) => {
    const active = selectedCat === cat;
    const ds = deityStyle(cat);
    return active
      ? { background: ds.bg, color: '#fff', border: `1px solid ${ds.border}` }
      : { background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' };
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: 80 }}>
      {/* ── Hero ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #006B6B 0%, #2D5A27 100%)',
          paddingTop: '4rem',
          paddingBottom: '4rem',
        }}
      >
        <div className="container-site text-center">
          {/* Om symbol */}
          <div
            className="mx-auto mb-4 flex items-center justify-center"
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              fontSize: '2.5rem',
              lineHeight: 1,
              color: '#fff',
              fontFamily: "'Noto Sans Devanagari', sans-serif",
            }}
          >
            ॐ
          </div>
          <h1
            className="text-4xl font-black mb-3"
            style={{ fontFamily: 'Playfair Display, serif', color: '#fff' }}
          >
            Sacred Mantras
          </h1>
          <p className="text-base mb-8" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Chants and invocations with Sanskrit, transliteration, and meaning
          </p>
          <div className="relative max-w-md mx-auto">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            />
            <input
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff',
              }}
              placeholder="Search mantras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Category pills ── */}
      <div className="container-site pt-8 pb-2">
        <div className="flex flex-wrap gap-2 mb-8">
          {['All', ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={pillStyle(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cards grid ── */}
      <div className="container-site pb-16">
        {loading ? (
          <SkeletonGrid count={6} />
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((m) => (
              <MantraCardExpand key={m.id} mantra={m} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
            <Music2 size={48} className="mx-auto mb-4 opacity-25" />
            <p>
              {search || selectedCat !== 'All'
                ? 'No mantras match your filter.'
                : 'No mantras available yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
