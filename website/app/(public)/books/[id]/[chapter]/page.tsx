'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import api from '@/lib/api';
import { SkeletonVerse } from '@/components/SkeletonCard';

function VerseBlock({ verse, bookTitle }: { verse: any; bookTitle?: string }) {
  return (
    <div id={`v-${verse.id}`} className="scroll-mt-24">
      <div className="flex items-start gap-4">
        {/* Saffron verse number badge */}
        <div
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold mt-1"
          style={{ background: '#FF6B00', color: '#fff', boxShadow: '0 2px 8px rgba(255,107,0,0.35)' }}
        >
          {verse.verseNumber || '—'}
        </div>

        <div className="flex-1 min-w-0">
          {/* Sanskrit */}
          {verse.verseText && (
            <p
              className="mb-3 leading-loose"
              style={{
                fontFamily: "'Noto Sans Devanagari', sans-serif",
                fontSize: '1.25rem',
                color: 'var(--text)',
                lineHeight: 2.1,
              }}
            >
              {verse.verseText}
            </p>
          )}

          {/* Transliteration */}
          {verse.transliteration && (
            <p className="italic text-sm mb-3" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              {verse.transliteration}
            </p>
          )}

          {/* Meaning */}
          {(verse.translation || verse.meaning) && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {verse.translation || verse.meaning}
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div
        className="my-8 mx-auto"
        style={{
          width: 80,
          height: 1,
          background: 'linear-gradient(90deg, transparent, var(--border-2), transparent)',
        }}
      />
    </div>
  );
}

export default function ReadingPage() {
  const { id, chapter } = useParams<{ id: string; chapter: string }>();
  const [verses, setVerses] = useState<any[]>([]);
  const [chapterInfo, setChapterInfo] = useState<any>(null);
  const [allChapters, setAllChapters] = useState<any[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      api.get(`/books/${id}/chapters/${chapter}/verses?take=200`),
      api.get(`/books/${id}/chapters/${chapter}`),
      api.get(`/books/${id}/chapters?take=200`),
    ])
      .then(([vRes, cRes, allRes]) => {
        setVerses(vRes.data?.data || vRes.data || []);
        setChapterInfo(cRes.data?.chapter || cRes.data);
        setAllChapters(allRes.data?.data || allRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, chapter]);

  useEffect(() => {
    const onScroll = () => {
      const pct =
        window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      setProgress(Math.min(Math.round(pct * 100), 100));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const currentIdx = allChapters.findIndex((c: any) => c.id === chapter);
  const prevChapter = currentIdx > 0 ? allChapters[currentIdx - 1] : null;
  const nextChapter =
    currentIdx >= 0 && currentIdx < allChapters.length - 1
      ? allChapters[currentIdx + 1]
      : null;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50" style={{ height: 3, background: 'var(--border)' }}>
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #FF6B00, #C75A1A)',
            transition: 'width 0.1s linear',
          }}
        />
      </div>

      <div className="reading-layout pt-16" style={{ display: 'flex' }}>
        {/* ─ Left chapter sidebar ─ */}
        <aside
          className={`fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] overflow-y-auto z-40 transition-transform duration-300 lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{
            background: 'var(--bg-2)',
            borderRight: '1px solid var(--border)',
            width: 260,
            flexShrink: 0,
          }}
        >
          <div className="p-4">
            <Link
              href={`/books/${id}`}
              className="flex items-center gap-2 text-xs font-semibold mb-4 pb-4"
              style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}
            >
              <ChevronLeft size={14} /> Back to Book
            </Link>
            <p
              className="text-xs font-bold uppercase tracking-wider mb-3"
              style={{ color: 'var(--muted)' }}
            >
              Chapters
            </p>
            {allChapters.map((ch: any, idx: number) => (
              <Link
                key={ch.id}
                href={`/books/${id}/${ch.id}`}
                onClick={() => setNavOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs mb-1 transition-colors"
                style={{
                  background: ch.id === chapter ? 'rgba(0,107,107,0.12)' : 'transparent',
                  color: ch.id === chapter ? '#006B6B' : 'var(--muted)',
                  fontWeight: ch.id === chapter ? 700 : 400,
                }}
              >
                <span
                  className="w-5 h-5 rounded-lg flex-shrink-0 flex items-center justify-center text-xs"
                  style={{
                    background: ch.id === chapter ? '#006B6B' : 'var(--surface)',
                    color: ch.id === chapter ? '#fff' : 'var(--muted)',
                  }}
                >
                  {idx + 1}
                </span>
                <span className="truncate">
                  {ch.title || `Chapter ${ch.chapterNumber || idx + 1}`}
                </span>
              </Link>
            ))}
          </div>
        </aside>

        {/* ─ Main reading area ─ */}
        <div ref={mainRef} className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-4 md:px-8 py-10 pb-32">
            {/* Mobile sidebar toggle */}
            <button
              className="lg:hidden fixed bottom-20 left-4 z-50 rounded-full p-3 shadow-lg"
              style={{ background: '#006B6B', color: '#fff' }}
              onClick={() => setNavOpen(!navOpen)}
            >
              {navOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Chapter header */}
            <div className="mb-10 pb-8" style={{ borderBottom: '1px solid var(--border)' }}>
              <Link href={`/books/${id}`} className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                ← Back to book
              </Link>
              <h1
                className="text-2xl md:text-3xl font-black mt-3 mb-2"
                style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
              >
                {chapterInfo?.title || `Chapter ${chapterInfo?.chapterNumber || ''}`}
              </h1>
              {chapterInfo?.description && (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                  {chapterInfo.description}
                </p>
              )}
            </div>

            {/* Verses */}
            {loading ? (
              <div className="space-y-8">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonVerse key={i} />
                ))}
              </div>
            ) : verses.length > 0 ? (
              <div>
                {verses.map((v: any) => (
                  <VerseBlock
                    key={v.id}
                    verse={v}
                    bookTitle={chapterInfo?.bookTitle}
                  />
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--muted)' }}>No verses found for this chapter.</p>
            )}
          </div>
        </div>

        {/* ─ Right verse quick-jump sidebar ─ */}
        <aside
          className="hidden lg:block py-8 px-4 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto flex-shrink-0"
          style={{ borderLeft: '1px solid var(--border)', width: 200 }}
        >
          <p
            className="text-xs font-bold uppercase tracking-wider mb-4"
            style={{ color: 'var(--muted)' }}
          >
            In this chapter
          </p>
          {verses.map((v: any) => (
            <a
              key={v.id}
              href={`#v-${v.id}`}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-0.5 transition-colors text-xs hover:bg-[var(--surface)]"
              style={{ color: 'var(--muted)' }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                style={{ background: 'rgba(255,107,0,0.12)', color: '#FF6B00', fontWeight: 700 }}
              >
                {v.verseNumber || '·'}
              </span>
              <span className="truncate">Verse {v.verseNumber || '—'}</span>
            </a>
          ))}
          {verses.length === 0 && !loading && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>No verses</p>
          )}
        </aside>
      </div>

      {/* ─ Fixed bottom prev/next bar ─ */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40"
        style={{
          background: '#006B6B',
          borderTop: '1px solid rgba(255,255,255,0.15)',
          padding: '0.75rem 1.5rem',
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {prevChapter ? (
            <Link
              href={`/books/${id}/${prevChapter.id}`}
              className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: '#fff' }}
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">
                {prevChapter.title || `Chapter ${prevChapter.chapterNumber || ''}`}
              </span>
              <span className="sm:hidden">Previous</span>
            </Link>
          ) : (
            <Link
              href={`/books/${id}`}
              className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              <ChevronLeft size={16} /> Back to Book
            </Link>
          )}

          {/* Progress indicator */}
          <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {progress}%
          </span>

          {nextChapter ? (
            <Link
              href={`/books/${id}/${nextChapter.id}`}
              className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: '#fff' }}
            >
              <span className="hidden sm:inline">
                {nextChapter.title || `Chapter ${nextChapter.chapterNumber || ''}`}
              </span>
              <span className="sm:hidden">Next</span>
              <ChevronRight size={16} />
            </Link>
          ) : (
            <Link
              href={`/books/${id}`}
              className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              Finish <ChevronRight size={16} />
            </Link>
          )}
        </div>
      </div>

      {/* Mobile nav overlay */}
      {navOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setNavOpen(false)}
        />
      )}
    </div>
  );
}
