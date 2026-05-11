'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import api from '@/lib/api';
import VerseCard from '@/components/VerseCard';
import { SkeletonVerse } from '@/components/SkeletonCard';

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
    ]).then(([vRes, cRes, allRes]) => {
      setVerses(vRes.data?.data || vRes.data || []);
      setChapterInfo(cRes.data?.chapter || cRes.data);
      setAllChapters(allRes.data?.data || allRes.data || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id, chapter]);

  useEffect(() => {
    const onScroll = () => {
      const el = mainRef.current;
      if (!el) return;
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
      {/* Reading progress */}
      <div className="progress-bar fixed top-0 left-0 right-0 z-50">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="reading-layout pt-16">
        {/* ─ Left nav sidebar ─ */}
        <aside
          className={`fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] overflow-y-auto z-40 transition-transform duration-300 lg:translate-x-0 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}
          style={{ background: 'var(--bg-2)', borderRight: '1px solid var(--border)', width: 260 }}
        >
          <div className="p-4">
            <Link href={`/books/${id}`} className="flex items-center gap-2 text-xs font-semibold mb-4 pb-4" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
              <ChevronLeft size={14} /> Back to Book
            </Link>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>Chapters</p>
            {allChapters.map((ch: any, idx: number) => (
              <Link
                key={ch.id}
                href={`/books/${id}/${ch.id}`}
                onClick={() => setNavOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs mb-1 transition-colors"
                style={{
                  background: ch.id === chapter ? 'var(--surface-2)' : 'transparent',
                  color: ch.id === chapter ? 'var(--accent)' : 'var(--muted)',
                  fontWeight: ch.id === chapter ? 700 : 400,
                }}
              >
                <span className="w-5 h-5 rounded-lg flex-shrink-0 flex items-center justify-center text-xs"
                  style={{ background: ch.id === chapter ? 'var(--accent)' : 'var(--surface)', color: ch.id === chapter ? '#fff' : 'var(--muted)' }}>
                  {idx + 1}
                </span>
                <span className="truncate">{ch.title || `Chapter ${ch.chapterNumber || idx + 1}`}</span>
              </Link>
            ))}
          </div>
        </aside>

        {/* ─ Main content ─ */}
        <div ref={mainRef} className="max-w-2xl mx-auto px-4 py-8">
          {/* Mobile nav toggle */}
          <button
            className="lg:hidden fixed bottom-6 left-4 z-50 btn-primary rounded-full p-3"
            onClick={() => setNavOpen(!navOpen)}
          >
            {navOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Chapter header */}
          <div className="mb-8 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
            <Link href={`/books/${id}`} className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              ← Back to book
            </Link>
            <h1 className="text-2xl font-black mt-3 mb-1" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
              {chapterInfo?.title || `Chapter ${chapterInfo?.chapterNumber || ''}`}
            </h1>
            {chapterInfo?.description && (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{chapterInfo.description}</p>
            )}
          </div>

          {/* Verses */}
          {loading ? (
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonVerse key={i} />)}
            </div>
          ) : verses.length > 0 ? (
            <div className="space-y-6">
              {verses.map((v: any) => (
                <VerseCard key={v.id} verse={{ ...v, bookName: chapterInfo?.bookTitle }} showFavorite />
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--muted)' }}>No verses found for this chapter.</p>
          )}

          {/* Chapter navigation */}
          <div className="flex items-center justify-between mt-12 pt-8" style={{ borderTop: '1px solid var(--border)' }}>
            {prevChapter ? (
              <Link href={`/books/${id}/${prevChapter.id}`} className="btn-secondary text-sm flex items-center gap-2">
                <ChevronLeft size={15} /> Previous
              </Link>
            ) : <div />}
            {nextChapter ? (
              <Link href={`/books/${id}/${nextChapter.id}`} className="btn-primary text-sm flex items-center gap-2">
                Next <ChevronRight size={15} />
              </Link>
            ) : (
              <Link href={`/books/${id}`} className="btn-secondary text-sm">Back to Book</Link>
            )}
          </div>
        </div>

        {/* ─ Right sidebar ─ */}
        <aside className="hidden lg:block py-8 px-4 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto" style={{ borderLeft: '1px solid var(--border)' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>In this chapter</p>
          {verses.slice(0, 12).map((v: any) => (
            <a key={v.id} href={`#v-${v.id}`} className="block text-xs py-1 px-2 rounded-lg mb-1 transition-colors hover:bg-[var(--surface)]" style={{ color: 'var(--muted)' }}>
              Verse {v.verseNumber || '—'}
            </a>
          ))}
          {verses.length > 12 && (
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>+{verses.length - 12} more</p>
          )}
        </aside>
      </div>

      {/* Overlay for mobile nav */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setNavOpen(false)} />
      )}
    </div>
  );
}
