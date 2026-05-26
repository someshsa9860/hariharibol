'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

type Sampradaya = {
  id: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  heroImageUrl?: string;
  followerCount: number;
  isFollowing?: boolean;
};

function SkeletonCard() {
  return (
    <div
      className="animate-pulse rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)' }}
    >
      <div style={{ height: 180, background: 'var(--surface-2)' }} />
      <div className="p-4">
        <div className="h-5 rounded w-2/3 mb-2" style={{ background: 'var(--surface-2)' }} />
        <div className="h-4 rounded w-1/3 mb-3" style={{ background: 'var(--surface-2)' }} />
        <div className="h-8 rounded-full w-24" style={{ background: 'var(--surface-2)' }} />
      </div>
    </div>
  );
}

function SampradayaCard({
  item,
  onToggle,
}: {
  item: Sampradaya;
  onToggle: (id: string, following: boolean) => void;
}) {
  const [toggling, setToggling] = useState(false);

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setToggling(true);
    try {
      if (item.isFollowing) {
        await api.delete(`/sampradayas/${item.id}/follow`);
      } else {
        await api.post(`/sampradayas/${item.id}/follow`);
      }
      onToggle(item.id, !item.isFollowing);
    } catch {}
    setToggling(false);
  };

  const coverImg = item.heroImageUrl || item.thumbnailUrl;

  return (
    <Link href={`/sampradayas/${item.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        className="card-hover rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface)' }}
      >
        {/* Image with gradient overlay */}
        <div className="relative" style={{ height: 180 }}>
          {coverImg ? (
            <img
              src={coverImg}
              alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, #7B1C1C 0%, #FF6B00 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'Noto Sans Devanagari, serif',
                  fontSize: 52,
                  color: 'rgba(255,255,255,0.55)',
                  lineHeight: 1,
                }}
              >
                ॐ
              </span>
            </div>
          )}
          {/* Gradient overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.12) 55%, transparent 100%)',
            }}
          />
          {/* Follower badge */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: 'rgba(212,160,85,0.92)',
              backdropFilter: 'blur(8px)',
              borderRadius: 20,
              padding: '3px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 700,
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          >
            <Users size={11} />
            {(item.followerCount ?? 0).toLocaleString()}
          </div>
        </div>

        {/* Card body */}
        <div className="p-4">
          <h3
            style={{
              fontFamily: 'Playfair Display, serif',
              fontWeight: 700,
              fontSize: '1.05rem',
              color: 'var(--text)',
              lineHeight: 1.3,
              marginBottom: 6,
            }}
          >
            {item.name}
          </h3>
          {item.description && (
            <p
              style={{
                fontSize: 12,
                color: 'var(--muted)',
                lineHeight: 1.55,
                marginBottom: 12,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.description}
            </p>
          )}
          <div className="flex items-center justify-between">
            <button
              onClick={handleFollow}
              disabled={toggling}
              className="text-xs font-bold px-4 py-2 rounded-full transition-all"
              style={{
                background: item.isFollowing ? 'var(--surface-2)' : 'var(--saffron)',
                color: item.isFollowing ? 'var(--muted)' : '#fff',
                border: item.isFollowing ? '1px solid var(--border-2)' : 'none',
                opacity: toggling ? 0.55 : 1,
                cursor: toggling ? 'not-allowed' : 'pointer',
              }}
            >
              {item.isFollowing ? 'Following' : 'Follow'}
            </button>
            <span
              style={{
                fontSize: 12,
                color: 'var(--peacock)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              Explore <ChevronRight size={13} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function SampradayasPage() {
  const [items, setItems] = useState<Sampradaya[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'followed'>('all');

  const fetchSampradayas = useCallback(async () => {
    try {
      const r = await api.get('/sampradayas?take=60');
      setItems(r.data?.data || r.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSampradayas();
  }, [fetchSampradayas]);

  const handleToggle = (id: string, following: boolean) => {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, isFollowing: following } : s)));
  };

  const displayed = filter === 'followed' ? items.filter((s) => s.isFollowing) : items;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 88 }}>
      {/* Page hero */}
      <div
        style={{
          background: 'linear-gradient(135deg, #7B1C1C 0%, #A52626 45%, #FF6B00 100%)',
          padding: '40px 24px 44px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -40,
            left: -40,
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', maxWidth: 640, margin: '0 auto' }}>
          <p
            style={{
              fontFamily: 'Noto Sans Devanagari, serif',
              fontSize: 14,
              color: 'rgba(255,255,255,0.72)',
              letterSpacing: '0.06em',
              marginBottom: 8,
            }}
          >
            सम्प्रदाय
          </p>
          <h1
            style={{
              fontFamily: 'Playfair Display, serif',
              fontWeight: 900,
              fontSize: 'clamp(2rem, 8vw, 3.2rem)',
              color: '#fff',
              lineHeight: 1.15,
              textShadow: '0 2px 14px rgba(0,0,0,0.28)',
              marginBottom: 10,
            }}
          >
            Sampradayas
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.72)',
              fontStyle: 'italic',
              lineHeight: 1.6,
            }}
          >
            Explore sacred traditions and lineages of Vedic wisdom
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-2)',
        }}
      >
        <div className="flex gap-2" style={{ maxWidth: 720, margin: '0 auto' }}>
          {(['all', 'followed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-5 py-1.5 rounded-full text-sm font-semibold transition-all"
              style={{
                background: filter === f ? 'var(--maroon)' : 'var(--surface-2)',
                color: filter === f ? '#fff' : 'var(--muted)',
                border: filter === f ? 'none' : '1px solid var(--border)',
              }}
            >
              {f === 'all' ? 'All Traditions' : 'Followed'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="p-5" style={{ maxWidth: 1100, margin: '0 auto' }}>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : displayed.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayed.map((s) => (
              <SampradayaCard key={s.id} item={s} onToggle={handleToggle} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24" style={{ color: 'var(--muted)' }}>
            <div
              style={{
                fontFamily: 'Noto Sans Devanagari, serif',
                fontSize: 64,
                lineHeight: 1,
                opacity: 0.18,
                marginBottom: 20,
                color: 'var(--maroon)',
              }}
            >
              ॐ
            </div>
            <p
              className="font-bold text-lg mb-2"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
            >
              {filter === 'followed' ? 'No followed traditions yet' : 'No sampradayas found'}
            </p>
            <p className="text-sm">
              {filter === 'followed'
                ? 'Follow a tradition to see it here'
                : 'Sacred traditions will appear here'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
