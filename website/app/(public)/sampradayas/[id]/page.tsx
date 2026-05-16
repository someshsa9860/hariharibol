'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Users, Heart, Home, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import BookCard from '@/components/BookCard';

export default function SampradayaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [s, setS] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/sampradayas/${id}`),
      api.get(`/books?sampradayaId=${id}&take=12`).catch(() => ({ data: [] })),
    ]).then(([sRes, bRes]) => {
      setS(sRes.data?.sampraday || sRes.data);
      setBooks(bRes.data?.data || bRes.data || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ paddingTop: 80, background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="h-72 w-full animate-pulse" style={{ background: 'var(--surface-2)' }} />
      <div className="container-site py-10 space-y-4">
        <div className="h-4 w-48 animate-pulse rounded" style={{ background: 'var(--surface-2)' }} />
        <div className="h-6 w-1/2 animate-pulse rounded" style={{ background: 'var(--surface-2)' }} />
        <div className="h-4 w-3/4 animate-pulse rounded" style={{ background: 'var(--surface-2)' }} />
      </div>
    </div>
  );

  if (!s) return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: 'var(--bg)' }} className="container-site py-20 text-center">
      <p style={{ color: 'var(--muted)' }}>Tradition not found.</p>
      <Link href="/sampradayas" className="btn-primary mt-6 inline-flex">Back</Link>
    </div>
  );

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: 80 }}>
      {/* Full-width hero banner */}
      <div
        className="w-full h-72 flex items-end relative overflow-hidden"
        style={{ background: s.heroImageUrl ? undefined : 'linear-gradient(135deg, #7B1C1C, #FF6B00)' }}
      >
        {s.heroImageUrl && (
          <img src={s.heroImageUrl} alt={s.name} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }} />
        <div className="container-site relative z-10 pb-8">
          <h1 className="text-4xl font-black text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
            {s.name || s.slug}
          </h1>
          {s.founder && (
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Founded by {s.founder}</p>
          )}
        </div>
      </div>

      <div className="container-site py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs mb-8" style={{ color: 'var(--muted)' }}>
          <Link href="/" className="flex items-center gap-1 hover:opacity-80 transition-opacity">
            <Home size={12} /> Home
          </Link>
          <ChevronRight size={12} />
          <Link href="/sampradayas" className="hover:opacity-80 transition-opacity">Sampradayas</Link>
          <ChevronRight size={12} />
          <span style={{ color: 'var(--text)' }}>{s.name || s.slug}</span>
        </nav>

        {/* Follower count + follow button */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          {s.followerCount != null && (
            <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--muted)' }}>
              <Users size={14} /> {s.followerCount.toLocaleString()} followers
            </div>
          )}
          <button
            onClick={() => setFollowing(!following)}
            className={following ? 'btn-primary' : 'btn-secondary'}
          >
            <Heart size={15} fill={following ? 'currentColor' : 'none'} />
            {following ? 'Following' : 'Follow'}
          </button>
        </div>

        {/* About section — sandstone bg, peacock left border */}
        {s.description && (
          <div
            className="p-6 rounded-2xl mb-10"
            style={{ background: '#C4A882', borderLeft: '4px solid #006B6B' }}
          >
            <h2 className="text-lg font-bold mb-3" style={{ fontFamily: 'Playfair Display, serif', color: '#1A1410' }}>
              About
            </h2>
            <p className="text-base leading-relaxed" style={{ color: '#2D1A0A' }}>{s.description}</p>
          </div>
        )}

        {/* Linked texts — saffron section heading */}
        {books.length > 0 && (
          <>
            <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Playfair Display, serif', color: '#FF6B00' }}>
              Sacred Texts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {books.map((b) => <BookCard key={b.id} book={b} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
