'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import SampradayaCard from '@/components/SampradayaCard';
import { SkeletonGrid } from '@/components/SkeletonCard';

export default function SampradayasPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/sampradayas?take=50')
      .then(r => setList(r.data?.data || r.data || []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: 80 }}>
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }} className="py-16">
        <div className="container-site text-center">
          <h1 className="text-4xl font-black mb-4" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
            Spiritual Traditions
          </h1>
          <p className="text-base" style={{ color: 'var(--muted)' }}>
            Explore the great Vaishnava sampradayas and their sacred lineages
          </p>
        </div>
      </div>

      <div className="container-site py-12">
        {loading ? <SkeletonGrid count={6} /> : list.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {list.map((s) => <SampradayaCard key={s.id} s={s} />)}
          </div>
        ) : (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
            <span style={{ fontSize: '3rem' }}>🪷</span>
            <p className="mt-4">No traditions available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
