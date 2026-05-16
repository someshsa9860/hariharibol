'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [openCanto, setOpenCanto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/books/${id}`),
      api.get(`/books/${id}/chapters?take=100`),
    ])
      .then(([bRes, cRes]) => {
        setBook(bRes.data?.book || bRes.data);
        const cData = cRes.data?.data || cRes.data || [];
        setChapters(Array.isArray(cData) ? cData : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (chapters.length > 0) {
      const firstCanto = String(chapters[0].cantoNumber || chapters[0].part || '1');
      setOpenCanto(firstCanto);
    }
  }, [chapters]);

  if (loading) {
    return (
      <div style={{ paddingTop: 80, background: 'var(--bg)', minHeight: '100vh' }}>
        <div className="container-site py-12 space-y-4">
          <div className="skeleton h-8 w-1/2" />
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div
        style={{ paddingTop: 80, minHeight: '100vh', background: 'var(--bg)' }}
        className="container-site py-20 text-center"
      >
        <p style={{ color: 'var(--muted)' }}>Book not found.</p>
        <Link href="/books" className="btn-primary mt-6 inline-flex">
          Back to Books
        </Link>
      </div>
    );
  }

  const cantos = Array.from(
    new Set(chapters.map((c: any) => String(c.cantoNumber || c.part || '1')))
  );

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: 80 }}>
      {/* ── Hero with gradient ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #2D1B00 0%, #7B3A10 60%, #C75A1A 100%)',
          paddingTop: '4rem',
          paddingBottom: '4rem',
        }}
      >
        <div className="container-site">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Link href="/books" className="hover:text-white transition-colors">
              Books
            </Link>
            <ChevronRight size={12} />
            <span style={{ color: 'rgba(255,255,255,0.9)' }}>{book.title}</span>
          </nav>

          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Cover image */}
            <div
              className="w-36 h-48 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
              }}
            >
              {book.thumbnailUrl ? (
                <img
                  src={book.thumbnailUrl}
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <BookOpen size={44} style={{ color: 'rgba(255,255,255,0.5)' }} />
              )}
            </div>

            {/* Meta */}
            <div className="flex-1">
              <h1
                className="text-4xl md:text-5xl font-black mb-3 leading-tight"
                style={{ fontFamily: 'Playfair Display, serif', color: '#fff' }}
              >
                {book.title}
              </h1>
              {book.author && (
                <p className="text-sm font-semibold mb-4" style={{ color: 'rgba(212,160,85,1)' }}>
                  {book.author}
                </p>
              )}
              {book.description && (
                <p
                  className="text-sm leading-relaxed mb-5 max-w-2xl"
                  style={{ color: 'rgba(255,255,255,0.75)' }}
                >
                  {book.description}
                </p>
              )}
              <div className="flex items-center gap-5 text-sm mb-6" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {book.chapterCount != null && <span>{book.chapterCount} chapters</span>}
                {book.verseCount != null && <span>{book.verseCount} verses</span>}
              </div>
              {chapters.length > 0 && (
                <Link
                  href={`/books/${id}/${chapters[0].id}`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all"
                  style={{
                    background: '#FF6B00',
                    color: '#fff',
                    boxShadow: '0 4px 20px rgba(255,107,0,0.4)',
                  }}
                >
                  Start Reading
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Table of Contents ── */}
      <div className="container-site py-12">
        <h2
          className="text-2xl font-bold mb-8"
          style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
        >
          Table of Contents
        </h2>

        {cantos.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No chapters available yet.
          </p>
        )}

        <div className="space-y-3">
          {cantos.map((canto) => {
            const cantoChapters = chapters.filter(
              (c: any) => String(c.cantoNumber || c.part || '1') === canto
            );
            const isOpen = openCanto === canto;

            return (
              <div key={canto} className="card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-4 text-left transition-colors"
                  style={{ background: isOpen ? 'var(--surface-2)' : 'transparent' }}
                  onClick={() => setOpenCanto(isOpen ? null : canto)}
                >
                  <span className="font-semibold" style={{ color: 'var(--text)' }}>
                    {cantos.length > 1 ? `Canto ${canto}` : 'Chapters'}
                    <span className="text-xs ml-2 font-normal" style={{ color: 'var(--muted)' }}>
                      ({cantoChapters.length} chapters)
                    </span>
                  </span>
                  {isOpen ? (
                    <ChevronUp size={16} style={{ color: 'var(--muted)' }} />
                  ) : (
                    <ChevronDown size={16} style={{ color: 'var(--muted)' }} />
                  )}
                </button>

                {/* Accordion body */}
                <div
                  style={{
                    maxHeight: isOpen ? `${cantoChapters.length * 56}px` : '0px',
                    overflow: 'hidden',
                    transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)',
                  }}
                >
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {cantoChapters.map((ch: any, idx: number) => (
                      <Link
                        key={ch.id}
                        href={`/books/${id}/${ch.id}`}
                        className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--surface)]"
                        style={{
                          borderBottom:
                            idx < cantoChapters.length - 1 ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}
                          >
                            {ch.chapterNumber || idx + 1}
                          </span>
                          <span className="text-sm" style={{ color: 'var(--text)' }}>
                            {ch.title || `Chapter ${ch.chapterNumber || idx + 1}`}
                          </span>
                        </div>
                        {ch.verseCount != null && (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>
                            {ch.verseCount} verses
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
