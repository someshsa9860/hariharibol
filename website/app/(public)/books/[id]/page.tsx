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
    ]).then(([bRes, cRes]) => {
      setBook(bRes.data?.book || bRes.data);
      const cData = cRes.data?.data || cRes.data || [];
      setChapters(Array.isArray(cData) ? cData : []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

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

  if (!book) return (
    <div style={{ paddingTop: 80, minHeight: '100vh', background: 'var(--bg)' }} className="container-site py-20 text-center">
      <p style={{ color: 'var(--muted)' }}>Book not found.</p>
      <Link href="/books" className="btn-primary mt-6 inline-flex">Back to Books</Link>
    </div>
  );

  const cantos = Array.from(new Set(chapters.map((c: any) => c.cantoNumber || c.part || '1')));

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingTop: 80 }}>
      {/* Hero */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }} className="py-16">
        <div className="container-site">
          <nav className="flex items-center gap-2 text-xs mb-6" style={{ color: 'var(--muted)' }}>
            <Link href="/books" className="hover:text-saffron-500">Books</Link>
            <ChevronRight size={12} />
            <span style={{ color: 'var(--text)' }}>{book.title}</span>
          </nav>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div
              className="w-32 h-44 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              {book.thumbnailUrl ? (
                <img src={book.thumbnailUrl} alt={book.title} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <BookOpen size={40} style={{ color: 'var(--accent)', opacity: 0.5 }} />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-black mb-2" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
                {book.title}
              </h1>
              {book.author && <p className="text-sm font-semibold mb-3" style={{ color: 'var(--accent)' }}>{book.author}</p>}
              {book.description && <p className="text-sm leading-relaxed mb-4 max-w-2xl" style={{ color: 'var(--muted)' }}>{book.description}</p>}
              <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--muted)' }}>
                {book.chapterCount != null && <span>{book.chapterCount} chapters</span>}
                {book.verseCount != null && <span>{book.verseCount} verses</span>}
              </div>
              {chapters.length > 0 && (
                <Link
                  href={`/books/${id}/${chapters[0].id}`}
                  className="btn-primary mt-6 inline-flex"
                >
                  Start Reading
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chapters accordion */}
      <div className="container-site py-12">
        <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
          Table of Contents
        </h2>
        {cantos.map((canto) => {
          const cantoChapters = chapters.filter((c: any) => (c.cantoNumber || c.part || '1') === canto);
          const isOpen = openCanto === canto;
          return (
            <div key={String(canto)} className="mb-3 card overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 text-left"
                onClick={() => setOpenCanto(isOpen ? null : String(canto))}
              >
                <span className="font-semibold" style={{ color: 'var(--text)' }}>
                  {cantos.length > 1 ? `Canto ${canto}` : 'Chapters'}
                  <span className="text-xs ml-2 font-normal" style={{ color: 'var(--muted)' }}>
                    ({cantoChapters.length} chapters)
                  </span>
                </span>
                {isOpen ? <ChevronUp size={16} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--muted)' }} />}
              </button>
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {cantoChapters.map((ch: any, idx: number) => (
                    <Link
                      key={ch.id}
                      href={`/books/${id}/${ch.id}`}
                      className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--surface)]"
                      style={{ borderBottom: idx < cantoChapters.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <span className="text-sm" style={{ color: 'var(--text)' }}>
                        Chapter {ch.chapterNumber || idx + 1}{ch.title ? ` — ${ch.title}` : ''}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        {ch.verseCount || ''}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {chapters.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No chapters available yet.</p>
        )}
      </div>
    </div>
  );
}
