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
    <Link href={`/sampradayas/${s.id}`} className="card-hover block overflow-hidden rounded-2xl group relative">
      <div
        className="w-full h-52 flex items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #7B1C1C, #FF6B00)' }}
      >
        {(s.thumbnailUrl || s.heroImageUrl) ? (
          <img
            src={s.thumbnailUrl || s.heroImageUrl}
            alt={s.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="text-5xl opacity-40 select-none">🪷</span>
        )}
        {/* Hover gradient overlay */}
        <div
          className="absolute inset-0 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
          style={{ background: 'linear-gradient(to top, rgba(123,28,28,0.7), transparent)' }}
        />
        {/* Base gradient for legible text */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 55%)' }} />
        {/* Follower badge */}
        {s.followerCount != null && (
          <div
            className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ background: '#D4A055', color: '#1A1410' }}
          >
            <Users size={10} />
            {s.followerCount.toLocaleString()}
          </div>
        )}
        {/* Tradition name and description overlaid */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          <h3 className="font-bold text-xl leading-tight text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
            {s.name || s.slug || 'Sampraday'}
          </h3>
          {s.description && (
            <p className="text-xs text-white/70 mt-1 line-clamp-2">{s.description}</p>
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
      <div
        className="py-20"
        style={{ background: 'linear-gradient(135deg, #7B1C1C 0%, #A52626 40%, #FF6B00 100%)' }}
      >
        <div className="container-site text-center">
          <h1 className="text-4xl font-black mb-3 text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
            Spiritual Traditions
          </h1>
          <p className="text-base text-white/80">
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
