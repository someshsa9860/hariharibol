'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Heart, Share2 } from 'lucide-react';
import api from '@/lib/api';
import { useAppStore } from '@/lib/store';

const FONT_SIZE_MAP: Record<string, string> = { sm: '1rem', md: '1.25rem', lg: '1.5rem' };

function VerseBlock({ verse, index = 0 }: { verse: any; index?: number }) {
  const [favorited, setFavorited] = useState(false);
  const fontSize = useAppStore((s) => s.fontSize);
  const sanskritSize = FONT_SIZE_MAP[fontSize] || '1.25rem';

  const handleShare = () => {
    const text = [verse.verseText, verse.transliteration, verse.translation]
      .filter(Boolean)
      .join('\n\n');
    if (navigator.share) {
      navigator.share({ text });
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div
      className="verse-card mb-6 animate-fade-in"
      id={`v-${verse.id}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Verse number + action buttons */}
      <div className="flex items-center justify-between mb-4">
        <span
          className="flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
          style={{ width: 32, height: 32, background: 'var(--accent)', color: '#fff' }}
        >
          {verse.verseNumber || '—'}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setFavorited(!favorited)}
            className="btn-ghost p-2"
            style={{ color: favorited ? '#e53e3e' : 'var(--muted)' }}
            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart size={16} fill={favorited ? 'currentColor' : 'none'} />
          </button>
          <button className="btn-ghost p-2" onClick={handleShare} aria-label="Share verse">
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {/* Sanskrit */}
      {verse.verseText && (
        <p
          className="whitespace-pre-line mb-3"
          style={{
            fontFamily: "'Noto Sans Devanagari', serif",
            fontSize: sanskritSize,
            lineHeight: 2.1,
            color: 'var(--text)',
          }}
        >
          {verse.verseText}
        </p>
      )}

      {/* Transliteration */}
      {verse.transliteration && (
        <p
          className="whitespace-pre-line mb-4"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '1rem',
            fontStyle: 'italic',
            lineHeight: 1.9,
            color: 'var(--muted)',
          }}
        >
          {verse.transliteration}
        </p>
      )}

      {/* Word meanings */}
      {verse.wordMeanings?.length > 0 && (
        <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="word-table w-full">
            <tbody>
              {verse.wordMeanings.map((wm: any, i: number) => (
                <tr key={i}>
                  <td>{wm.word}</td>
                  <td>{wm.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Translation / Meaning */}
      {verse.translation && (
        <p
          className="leading-relaxed pt-4"
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '1rem',
            color: 'var(--text)',
            borderTop: '1px solid var(--border)',
          }}
        >
          {verse.translation}
        </p>
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
  const fontSize = useAppStore((s) => s.fontSize);
  const setFontSize = useAppStore((s) => s.setFontSize);

  useEffect(() => {
    Promise.all([
      api.get(`/books/${id}/chapters/${chapter}/verses?take=200`),
      api.get(`/books/${id}/chapters/${chapter}`),
      api.get(`/books/${id}/chapters?take=200`),
    ]).then(([vRes, cRes, allRes]) => {
      setVerses(vRes.data?.data || vRes.data || []);
      setChapterInfo(cRes.data?.chapter || cRes.data);
      setAllChapters(allRes.data?.data || allRes.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id, chapter]);

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(100, Math.round((window.scrollY / scrollable) * 100)) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const currentIdx = allChapters.findIndex((c: any) => c.id === chapter);
  const prevChapter = currentIdx > 0 ? allChapters[currentIdx - 1] : null;
  const nextChapter = currentIdx >= 0 && currentIdx < allChapters.length - 1 ? allChapters[currentIdx + 1] : null;

  const decreaseFontSize = () => {
    if (fontSize === 'lg') setFontSize('md');
    else if (fontSize === 'md') setFontSize('sm');
  };
  const increaseFontSize = () => {
    if (fontSize === 'sm') setFontSize('md');
    else if (fontSize === 'md') setFontSize('lg');
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Reading progress: thin saffron line fixed at very top */}
      <div className="fixed top-0 left-0 right-0 z-50" style={{ height: 3, background: 'var(--border)' }}>
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--saffron), var(--accent-2))',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Top bar */}
      <div
        className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
      >
        <Link href={`/books/${id}`} className="btn-ghost p-1.5" aria-label="Back to book">
          <ChevronLeft size={18} />
        </Link>
        <span
          className="font-bold text-sm flex-1 truncate"
          style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}
        >
          {chapterInfo?.title || (chapterInfo?.chapterNumber ? `Chapter ${chapterInfo.chapterNumber}` : 'Reading')}
        </span>

        {/* A- / A+ font size controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={decreaseFontSize}
            disabled={fontSize === 'sm'}
            className="flex items-center justify-center rounded-lg text-xs font-bold transition-all"
            style={{
              width: 32, height: 32,
              background: 'var(--surface-2)',
              color: fontSize === 'sm' ? 'var(--border)' : 'var(--muted)',
              cursor: fontSize === 'sm' ? 'not-allowed' : 'pointer',
            }}
            aria-label="Decrease font size"
          >
            A-
          </button>
          <button
            onClick={increaseFontSize}
            disabled={fontSize === 'lg'}
            className="flex items-center justify-center rounded-lg text-sm font-bold transition-all"
            style={{
              width: 32, height: 32,
              background: fontSize === 'lg' ? 'var(--accent)' : 'var(--surface-2)',
              color: fontSize === 'lg' ? '#fff' : 'var(--muted)',
              cursor: fontSize === 'lg' ? 'not-allowed' : 'pointer',
            }}
            aria-label="Increase font size"
          >
            A+
          </button>
        </div>
      </div>

      {/* Main reading area */}
      <div className="max-w-2xl mx-auto px-5 py-6 pb-32">
        {/* Chapter header */}
        {!loading && chapterInfo && (
          <div className="mb-8 text-center animate-fade-in">
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--accent)' }}
            >
              Chapter {chapterInfo.chapterNumber || ''}
            </span>
            {chapterInfo.title && (
              <h1
                className="mt-1.5 text-2xl font-black leading-snug"
                style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
              >
                {chapterInfo.title}
              </h1>
            )}
            <div
              className="mt-3 mx-auto rounded-full"
              style={{ width: 64, height: 3, background: 'var(--accent)' }}
            />
          </div>
        )}

        {/* Skeleton loading */}
        {loading ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="verse-card space-y-3">
                <div className="skeleton rounded-full" style={{ width: 32, height: 32 }} />
                <div className="skeleton h-6 w-full" />
                <div className="skeleton h-5 w-5/6" />
                <div className="skeleton h-4 w-4/5" />
                <div className="skeleton h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : verses.length === 0 ? (
          <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
            <div className="text-6xl mb-4 opacity-20 select-none" style={{ fontFamily: 'serif' }}>ॐ</div>
            <p className="text-sm">No verses found for this chapter.</p>
          </div>
        ) : (
          verses.map((v, idx) => (
            <div key={v.id}>
              <VerseBlock verse={v} index={idx} />
              {/* Thin saffron verse separator */}
              {idx < verses.length - 1 && (
                <div
                  className="my-2 mx-10 rounded-full"
                  style={{ height: 1, background: 'var(--accent)', opacity: 0.18 }}
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Fixed bottom navigation: prev / next in peacock */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-3"
        style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', backdropFilter: 'blur(8px)' }}
      >
        {prevChapter ? (
          <Link
            href={`/books/${id}/${prevChapter.id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: 'rgba(0,107,107,0.1)',
              color: 'var(--peacock)',
              border: '1px solid rgba(0,107,107,0.25)',
            }}
          >
            <ChevronLeft size={15} /> Prev
          </Link>
        ) : (
          <Link
            href={`/books/${id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            <ChevronLeft size={15} /> Contents
          </Link>
        )}

        <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--muted)' }}>
          {progress}%
        </span>

        {nextChapter ? (
          <Link
            href={`/books/${id}/${nextChapter.id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: 'rgba(0,107,107,0.1)',
              color: 'var(--peacock)',
              border: '1px solid rgba(0,107,107,0.25)',
            }}
          >
            Next <ChevronRight size={15} />
          </Link>
        ) : (
          <Link
            href={`/books/${id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
            style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            Finish
          </Link>
        )}
      </div>
    </div>
  );
}
