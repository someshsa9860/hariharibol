'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import api from '@/lib/api';

function SkeletonSampradayaCard() {
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      <div className="h-52 w-full animate-pulse" style={{ background: 'var(--surface-2)' }} />
    </div>
  );
}

function SampradayaCard({ s }: { s: any }) {
  return (
    <Link href={`/sampradayas/${s.id}`} className="card-hover block overflow-hidden rounded-xl group">
      <div
        className="w-full h-56 flex items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #6366F1, #818CF8)' }}
      >
        {(s.thumbnailUrl || s.heroImageUrl) ? (
          <img
            src={s.thumbnailUrl || s.heroImageUrl}
            alt={s.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="text-6xl opacity-30 select-none">ॐ</span>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%)' }} />

        {s.followerCount != null && (
          <div
            className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}
          >
            <Users size={12} />
            {s.followerCount.toLocaleString()}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
          <h3 className="font-bold text-lg leading-tight text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
            {s.name || s.slug || 'Tradition'}
          </h3>
          {s.description && (
            <p className="text-sm text-white/80 mt-2 line-clamp-2">{s.description}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function SampradayasPage() {
  const [list, setList] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string | null>(null);

  useEffect(() => {
    api.get('/sampradayas?take=50')
      .then(r => {
        const data = r.data?.data || r.data || [];
        setList(data);
        setFiltered(data);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  const types = [...new Set(list.map((s: any) => s.type).filter(Boolean))] as string[];

  useEffect(() => {
    if (!activeType) { setFiltered(list); return; }
    setFiltered(list.filter((s: any) => s.type === activeType));
  }, [activeType, list]);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: 80 }}>
      {/* Hero */}
      <div className="py-12 md:py-20" style={{ background: 'var(--bg-2)' }}>
        <div className="container-site text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
            Spiritual Traditions
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-2)' }}>
            Explore the great Vaishnava sampradayas and their sacred lineages
          </p>
        </div>
      </div>

      <div className="container-site py-10">
        {/* Category filter pills */}
        {types.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setActiveType(null)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: !activeType ? '#C75A1A' : 'var(--surface-2)',
                color: !activeType ? 'white' : 'var(--muted)',
              }}
            >
              All
            </button>
            {types.map(t => (
              <button
                key={t}
                onClick={() => setActiveType(t === activeType ? null : t)}
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
                style={{
                  background: activeType === t ? '#C75A1A' : 'var(--surface-2)',
                  color: activeType === t ? 'white' : 'var(--muted)',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonSampradayaCard key={i} />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((s: any) => <SampradayaCard key={s.id} s={s} />)}
          </div>
        ) : (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
            <div className="text-5xl mb-4 opacity-30 select-none">🪷</div>
            <p className="text-lg font-medium mt-4">No traditions available yet.</p>
            <p className="text-sm mt-2">Check back later as traditions are added.</p>
          </div>
        )}
      </div>
    </div>
  );
}
