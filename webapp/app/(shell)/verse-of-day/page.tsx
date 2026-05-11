'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import api from '@/lib/api';
import TopBar from '@/components/TopBar';
import { format } from 'date-fns';

export default function AppVODPage() {
  const [vod, setVod] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/verses/of-day/today')
      .then(r => setVod(r.data?.verse || r.data))
      .catch(() => setVod({
        verseText: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।',
        transliteration: 'karmaṇy-evādhikāras te mā phaleṣu kadācana',
        translation: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits.',
        verseNumber: '2.47', bookName: 'Bhagavad Gita',
      }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <TopBar title="Verse of the Day" />
      <div className="p-4 max-w-xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={14} style={{ color: 'var(--accent)' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>

        {loading ? (
          <div className="verse-card space-y-3">
            <div className="skeleton h-5 w-3/4" /> <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-2/3" /> <div className="skeleton h-3 w-full" />
          </div>
        ) : vod ? (
          <div className="verse-card animate-slide-up">
            {vod.verseText && <p className="verse-sanskrit mb-3 whitespace-pre-line">{vod.verseText}</p>}
            {vod.transliteration && <p className="verse-iast text-sm mb-4">{vod.transliteration}</p>}
            {vod.translation && <p className="verse-translation">{vod.translation}</p>}
            {vod.commentary && (
              <div className="mt-4 p-3 rounded-xl text-sm leading-relaxed"
                style={{ background: 'var(--surface)', color: 'var(--text-2)', borderLeft: '3px solid var(--accent-2)' }}>
                {vod.commentary}
              </div>
            )}
            <div className="flex items-center justify-between mt-4">
              <span className="badge">{vod.bookName} {vod.verseNumber}</span>
              <button className="btn-ghost text-xs p-2" onClick={() => {
                const t = `${vod.verseText}\n\n${vod.translation}\n— ${vod.bookName} ${vod.verseNumber}`;
                navigator.share ? navigator.share({ text: t }) : navigator.clipboard.writeText(t);
              }}>Share</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
