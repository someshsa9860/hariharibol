'use client';

import { useEffect, useState } from 'react';
import { Music2, Play, ChevronDown, ChevronUp, Heart, Check } from 'lucide-react';
import api from '@/lib/api';
import TopBar from '@/components/TopBar';

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Ganesha:   { bg: '#FF8C00', text: '#fff' },
  Shiva:     { bg: '#4338CA', text: '#fff' },
  Vishnu:    { bg: '#D97706', text: '#fff' },
  Lakshmi:   { bg: '#DB2777', text: '#fff' },
  Saraswati: { bg: '#7C3AED', text: '#fff' },
  Durga:     { bg: '#DC2626', text: '#fff' },
  Hanuman:   { bg: '#EA580C', text: '#fff' },
  Krishna:   { bg: '#1D4ED8', text: '#fff' },
  Ram:       { bg: '#059669', text: '#fff' },
  General:   { bg: '#0D9488', text: '#fff' },
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || { bg: '#C75A1A', text: '#fff' };
}

function MantraCard({ m }: { m: any }) {
  const [expanded, setExpanded] = useState(false);
  const [faved, setFaved] = useState(false);
  const catColor = getCategoryColor(m.category || '');

  const benefits: string[] = m.benefits
    ? (Array.isArray(m.benefits) ? m.benefits : String(m.benefits).split('\n').filter(Boolean))
    : [];

  return (
    <div className="card-hover rounded-2xl p-4 mb-4" style={{ background: 'var(--surface)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3
            className="font-bold text-sm mb-1 leading-snug"
            style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
          >
            {m.name}
          </h3>
          {m.category && (
            <span
              className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-2"
              style={{ background: catColor.bg, color: catColor.text }}
            >
              {m.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setFaved(f => !f)}
            className="p-1.5 rounded-full transition-all"
            style={{ color: faved ? '#EF4444' : 'var(--muted)' }}
            aria-label="Favorite"
          >
            <Heart size={16} fill={faved ? '#EF4444' : 'none'} />
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-full"
            style={{ color: 'var(--muted)' }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Sanskrit Devanagari text */}
      {m.text && (
        <p className="verse-sanskrit text-base leading-relaxed mt-1 mb-2" style={{ color: 'var(--text)' }}>
          {m.text}
        </p>
      )}

      {/* Audio play button */}
      {m.audioUrl && (
        <button
          className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mt-1"
          style={{ background: 'rgba(199,90,26,0.12)', color: '#C75A1A' }}
        >
          <Play size={12} fill="#C75A1A" /> Play Audio
        </button>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 space-y-3 animate-fade-in">
          {m.transliteration && (
            <p className="verse-iast text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
              {m.transliteration}
            </p>
          )}
          {m.meaning && (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{m.meaning}</p>
          )}
          {benefits.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text)' }}>Benefits</p>
              <ul className="space-y-1">
                {benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                    <Check size={12} className="mt-0.5 flex-shrink-0" style={{ color: '#10B981' }} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppMantrasPage() {
  const [mantras, setMantras] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/mantras?take=100')
      .then(r => {
        const d = r.data?.data || r.data || [];
        setMantras(d);
        setFiltered(d);
        const cats = Array.from(new Set<string>(
          d.map((m: any) => m.category).filter(Boolean)
        ));
        setCategories(cats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeCategory === 'All') { setFiltered(mantras); return; }
    setFiltered(mantras.filter((m) => m.category === activeCategory));
  }, [activeCategory, mantras]);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <TopBar title="Mantras" />

      {/* Sticky category filter tabs */}
      <div
        className="sticky top-0 z-10"
        style={{
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          background: 'rgba(15, 7, 3, 0.82)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {['All', ...categories].map((cat) => {
            const active = cat === activeCategory;
            const col = cat === 'All' ? { bg: '#C75A1A', text: '#fff' } : getCategoryColor(cat);
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: active ? col.bg : 'var(--surface-2)',
                  color: active ? col.text : 'var(--muted)',
                  border: active ? 'none' : '1px solid var(--border)',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 max-w-xl mx-auto">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: 'var(--surface)' }}>
                <div className="h-4 rounded w-1/2 mb-2" style={{ background: 'var(--surface-2)' }} />
                <div className="h-3 rounded w-1/4 mb-3" style={{ background: 'var(--surface-2)' }} />
                <div className="h-10 rounded w-full" style={{ background: 'var(--surface-2)' }} />
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-0">
            {filtered.map((m) => <MantraCard key={m.id} m={m} />)}
          </div>
        ) : (
          <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
            <Music2 size={36} className="mx-auto mb-3 opacity-25" />
            <p className="text-sm">No mantras available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
