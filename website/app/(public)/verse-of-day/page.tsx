'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Calendar } from 'lucide-react';
import api from '@/lib/api';
import VerseCard from '@/components/VerseCard';
import { SkeletonVerse } from '@/components/SkeletonCard';
import { format } from 'date-fns';

export default function VerseOfDayPage() {
  const [today, setToday] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/verses/of-day/today'),
      api.get('/verses/of-day/history?limit=30').catch(() => ({ data: [] })),
    ]).then(([tRes, hRes]) => {
      setToday(tRes.data?.verse || tRes.data);
      setHistory(hRes.data?.history || hRes.data || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: 80 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }} className="py-16">
        <div className="container-site text-center">
          <div className="badge inline-flex items-center gap-1 mb-4">
            <Sparkles size={12} /> Daily Verse
          </div>
          <h1 className="text-4xl font-black mb-3" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
            Verse of the Day
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
      </div>

      {/* Today's verse */}
      <div className="container-site py-12">
        <div className="max-w-2xl mx-auto mb-16">
          {loading ? <SkeletonVerse /> : today ? (
            <VerseCard verse={today} showFavorite />
          ) : (
            <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
              <Sparkles size={40} className="mx-auto mb-3 opacity-25" />
              <p>No verse selected for today yet.</p>
            </div>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-8">
              <Calendar size={18} style={{ color: 'var(--accent)' }} />
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
                Recent Verses
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((item: any) => (
                <div key={item.id || item.date} className="card-hover p-4">
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>
                    {item.date ? format(new Date(item.date), 'MMM d') : '—'}
                  </p>
                  {item.verse?.verseText && (
                    <p className="verse-sanskrit text-sm line-clamp-2 mb-2">{item.verse.verseText}</p>
                  )}
                  {item.verse?.translation && (
                    <p className="text-xs line-clamp-2" style={{ color: 'var(--muted)' }}>{item.verse.translation}</p>
                  )}
                  <span className="badge text-xs mt-2 inline-block">
                    {item.verse?.bookName || ''} {item.verse?.verseNumber || ''}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
