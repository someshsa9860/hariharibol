'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Heart, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';
import { useAppStore } from '@/lib/store';

function VerseBlock({ verse }: { verse: any }) {
  const [purportOpen, setPurportOpen] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const fontSize = useAppStore((s) => s.fontSize);
  const fontSizeMap = { sm: '1rem', md: '1.1rem', lg: '1.25rem' };

  return (
    <div className="verse-card mb-5 animate-slide-up" id={`v-${verse.id}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="badge">{verse.verseNumber || '—'}</span>
        <div className="flex gap-2">
          <button onClick={() => setFavorited(!favorited)} className="btn-ghost p-1.5"
            style={{ color: favorited ? '#e53e3e' : 'var(--muted)' }}>
            <Heart size={14} fill={favorited ? 'currentColor' : 'none'} />
          </button>
          <button className="btn-ghost p-1.5" onClick={() => {
            const t = `${verse.verseText || ''}\n— ${verse.bookName || ''} ${verse.verseNumber || ''}`;
            navigator.share ? navigator.share({ text: t }) : navigator.clipboard.writeText(t);
          }}>
            <Share2 size={14} />
          </button>
        </div>
      </div>
      {verse.verseText && (
        <p className="verse-sanskrit mb-2 whitespace-pre-line" style={{ fontSize: fontSizeMap[fontSize] }}>
          {verse.verseText}
        </p>
      )}
      {verse.transliteration && (
        <p className="verse-iast text-sm mb-3 whitespace-pre-line">{verse.transliteration}</p>
      )}
      {verse.wordMeanings?.length > 0 && (
        <div className="mb-3 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="word-table w-full"><tbody>
            {verse.wordMeanings.map((wm: any, i: number) => (
              <tr key={i}><td>{wm.word}</td><td>{wm.meaning}</td></tr>
            ))}
          </tbody></table>
        </div>
      )}
      {verse.translation && <p className="verse-translation text-sm">{verse.translation}</p>}
      {verse.commentary && (
        <div className="mt-3">
          <button onClick={() => setPurportOpen(!purportOpen)}
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: 'var(--accent)' }}>
            {purportOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {purportOpen ? 'Hide Purport' : 'Read Purport'}
          </button>
          {purportOpen && (
            <p className="mt-2 text-sm leading-relaxed p-3 rounded-xl animate-fade-in"
              style={{ background: 'var(--surface)', color: 'var(--text-2)', borderLeft: '3px solid var(--accent-2)' }}>
              {verse.commentary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppReadingPage() {
  const { id, chapter } = useParams<{ id: string; chapter: string }>();
  const [verses, setVerses] = useState<any[]>([]);
  const [chapterInfo, setChapterInfo] = useState<any>(null);
  const [allChapters, setAllChapters] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useAppStore((s) => [s.fontSize, s.setFontSize]);

  useEffect(() => {
    Promise.all([
      api.get(`/books/${id}/chapters/${chapter}/verses?take=200`),
      api.get(`/books/${id}/chapters/${chapter}`),
      api.get(`/books/${id}/chapters?take=200`),
    ]).then(([vRes, cRes, allRes]) => {
      setVerses(vRes.data?.data || vRes.data || []);
      setChapterInfo(cRes.data?.chapter || cRes.data);
      setAllChapters(allRes.data?.data || allRes.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id, chapter]);

  useEffect(() => {
    const onScroll = () => {
      const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      setProgress(Math.round(pct * 100));
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const currentIdx = allChapters.findIndex((c: any) => c.id === chapter);
  const prevChapter = currentIdx > 0 ? allChapters[currentIdx - 1] : null;
  const nextChapter = currentIdx >= 0 && currentIdx < allChapters.length - 1 ? allChapters[currentIdx + 1] : null;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Progress */}
      <div className="progress-bar fixed top-0 left-0 right-0 z-50">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <Link href={`/books/${id}`} className="btn-ghost p-1"><ChevronLeft size={18} /></Link>
        <span className="font-bold text-sm flex-1 truncate" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
          {chapterInfo?.title || `Chapter ${chapterInfo?.chapterNumber || ''}`}
        </span>
        {/* Font size */}
        <div className="flex gap-1">
          {(['sm', 'md', 'lg'] as const).map((s) => (
            <button key={s} onClick={() => setFontSize(s)}
              className="w-7 h-7 rounded-lg text-xs font-bold transition-all"
              style={{ background: fontSize === s ? 'var(--accent)' : 'var(--surface-2)', color: fontSize === s ? '#fff' : 'var(--muted)' }}>
              {s === 'sm' ? 'A' : s === 'md' ? 'A' : 'A'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-5">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="verse-card space-y-2">
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-6 w-full" />
                <div className="skeleton h-4 w-4/5" />
              </div>
            ))}
          </div>
        ) : (
          verses.map((v) => <VerseBlock key={v.id} verse={v} />)
        )}

        {/* Prev / Next */}
        <div className="flex justify-between mt-8 mb-16">
          {prevChapter ? (
            <Link href={`/books/${id}/${prevChapter.id}`} className="btn-secondary text-sm">
              <ChevronLeft size={14} /> Prev
            </Link>
          ) : <div />}
          {nextChapter ? (
            <Link href={`/books/${id}/${nextChapter.id}`} className="btn-primary text-sm">
              Next <ChevronRight size={14} />
            </Link>
          ) : (
            <Link href={`/books/${id}`} className="btn-secondary text-sm">Back to Book</Link>
          )}
        </div>
      </div>
    </div>
  );
}
