'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Users, ChevronLeft, Heart } from 'lucide-react';
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
      <div className="container-site py-12 space-y-4">
        <div className="skeleton h-64 w-full rounded-2xl" />
        <div className="skeleton h-6 w-1/2" />
        <div className="skeleton h-4 w-3/4" />
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
      {/* Hero */}
      <div
        className="w-full h-64 flex items-end relative overflow-hidden"
        style={{ background: s.heroImageUrl ? undefined : 'linear-gradient(135deg, var(--surface-2), var(--bg-2))' }}
      >
        {s.heroImageUrl && (
          <img src={s.heroImageUrl} alt={s.name} className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
        <div className="container-site relative z-10 pb-6">
          <Link href="/sampradayas" className="flex items-center gap-1 text-xs mb-3 text-white/70">
            <ChevronLeft size={14} /> Traditions
          </Link>
          <h1 className="text-3xl font-black text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
            {s.name || s.slug}
          </h1>
        </div>
      </div>

      <div className="container-site py-10">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            {s.founder && <p className="text-sm" style={{ color: 'var(--muted)' }}>Founded by <strong style={{ color: 'var(--text)' }}>{s.founder}</strong></p>}
            {s.followerCount != null && (
              <p className="flex items-center gap-1 text-sm mt-1" style={{ color: 'var(--muted)' }}>
                <Users size={13} /> {s.followerCount.toLocaleString()} followers
              </p>
            )}
          </div>
          <button
            onClick={() => setFollowing(!following)}
            className={following ? 'btn-primary' : 'btn-secondary'}
          >
            <Heart size={15} fill={following ? 'currentColor' : 'none'} />
            {following ? 'Following' : 'Follow'}
          </button>
        </div>

        {s.description && (
          <p className="text-base leading-relaxed mb-10" style={{ color: 'var(--text-2)', maxWidth: 720 }}>{s.description}</p>
        )}

        {books.length > 0 && (
          <>
            <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
              Associated Texts
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
