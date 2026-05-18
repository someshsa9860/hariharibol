'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, BookOpen, Home } from 'lucide-react';
import api from '@/lib/api';

const GRADIENTS = [
  'linear-gradient(160deg, #C75A1A 0%, #8B2FC9 100%)',
  'linear-gradient(160deg, #1A6BC7 0%, #0D9488 100%)',
  'linear-gradient(160deg, #C7891A 0%, #C72B1A 100%)',
  'linear-gradient(160deg, #1AC77B 0%, #1A4FC7 100%)',
];

export default function AppBookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [openCanto, setOpenCanto] = useState<string | null>('1');
  const [loading, setLoading] = useState(true);
  const [heroIdx] = useState(() => Math.floor(Math.random() * GRADIENTS.length));

  useEffect(() => {
    Promise.all([
      api.get(`/books/${id}`),
      api.get(`/books/${id}/chapters?take=200`),
    ]).then(([bRes, cRes]) => {
      setBook(bRes.data?.book || bRes.data);
      const chList: any[] = cRes.data?.data || cRes.data || [];
      setChapters(chList);
      if (chList.length > 0) {
        setOpenCanto(String(chList[0].cantoNumber || chList[0].part || '1'));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="skeleton w-full rounded-none" style={{ height: 260 }} />
      <div className="p-5 space-y-4 max-w-2xl mx-auto">
        <div className="skeleton h-5 w-1/2" />
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-28 w-full rounded-2xl" />
        <div className="skeleton h-12 w-full rounded-2xl" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );

  const cantos = Array.from(new Set(chapters.map((c: any) => String(c.cantoNumber || c.part || '1'))));
  const hasMultipleCantos = cantos.length > 1;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Hero */}
      <div className="relative w-full overflow-hidden" style={{ height: 280 }}>
        {book?.thumbnailUrl
          ? <Image src={book.thumbnailUrl} alt={book?.title ?? ''} fill className="object-cover" />
          : <div className="absolute inset-0" style={{ background: GRADIENTS[heroIdx] }} />
        }
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.22) 55%, transparent 100%)' }} />

        {/* Back button */}
        <Link
          href="/books"
          className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: 'rgba(0,0,0,0.38)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
        >
          <ChevronLeft size={13} /> Books
        </Link>

        {/* Book info over hero */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
          <h1
            style={{
              fontFamily: 'Playfair Display, serif',
              color: '#fff',
              fontSize: '2rem',
              fontWeight: 900,
              lineHeight: 1.15,
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            {book?.title}
          </h1>
          {(book?.author || book?.translator) && (
            <p className="mt-1.5 text-sm font-semibold" style={{ color: '#D4A055' }}>
              {[book.author, book.translator && `Tr. ${book.translator}`].filter(Boolean).join(' · ')}
            </p>
          )}
          {chapters.length > 0 && (
            <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {chapters.length} chapter{chapters.length !== 1 ? 's' : ''}
              {chapters.reduce((acc: number, c: any) => acc + (c.verseCount || 0), 0) > 0
                ? ` · ${chapters.reduce((acc: number, c: any) => acc + (c.verseCount || 0), 0)} verses`
                : ''}
            </p>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 px-5 py-3 text-xs" style={{ color: 'var(--muted)' }} aria-label="Breadcrumb">
        <Link href="/home" className="flex items-center gap-1 hover:underline">
          <Home size={11} /> Home
        </Link>
        <span>/</span>
        <Link href="/books" className="hover:underline">Books</Link>
        <span>/</span>
        <span className="truncate max-w-[180px] font-semibold" style={{ color: 'var(--accent)' }}>{book?.title}</span>
      </nav>

      <div className="px-4 pb-24 max-w-2xl mx-auto">
        {/* About */}
        {book?.description && (
          <div
            className="mb-5 p-4 rounded-2xl"
            style={{ background: 'rgba(196,168,130,0.12)', border: '1px solid rgba(196,168,130,0.28)' }}
          >
            <h2
              className="text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: 'var(--sandstone)' }}
            >
              About
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{book.description}</p>
          </div>
        )}

        {/* Start Reading CTA */}
        {chapters.length > 0 && (
          <Link href={`/books/${id}/${chapters[0].id}`} className="btn-primary w-full mb-6 justify-center">
            <BookOpen size={15} /> Start Reading
          </Link>
        )}

        {/* Chapter / Canto list heading */}
        <h2
          className="font-bold text-base mb-3"
          style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
        >
          {hasMultipleCantos ? 'Cantos' : 'Chapters'}
        </h2>

        {cantos.map((canto) => {
          const cc = chapters.filter((c: any) => String(c.cantoNumber || c.part || '1') === canto);
          const isOpen = openCanto === canto;

          return (
            <div key={canto} className="mb-3 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {/* Canto accordion header (only when multiple cantos) */}
              {hasMultipleCantos && (
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--surface)]"
                  onClick={() => setOpenCanto(isOpen ? null : canto)}
                  style={{ background: 'var(--bg-2)' }}
                >
                  <span
                    className="font-bold text-sm"
                    style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
                  >
                    Canto {canto}
                  </span>
                  <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                    {cc.length} ch.
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>
              )}

              {/* Chapter rows */}
              {(isOpen || !hasMultipleCantos) && cc.map((ch: any, idx: number) => (
                <Link
                  key={ch.id}
                  href={`/books/${id}/${ch.id}`}
                  className="flex items-center gap-3 px-4 py-3 group transition-colors hover:bg-[var(--surface)]"
                  style={{ borderTop: (hasMultipleCantos || idx > 0) ? '1px solid var(--border)' : 'none' }}
                >
                  {/* Saffron circle badge with chapter number */}
                  <span
                    className="flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold"
                    style={{ width: 32, height: 32, background: 'var(--accent)', color: '#fff' }}
                  >
                    {ch.chapterNumber || idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {ch.title || `Chapter ${ch.chapterNumber || idx + 1}`}
                    </p>
                    {ch.verseCount != null && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                        {ch.verseCount} verse{ch.verseCount !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  <ChevronRight
                    size={14}
                    className="flex-shrink-0 opacity-25 group-hover:opacity-60 transition-opacity"
                    style={{ color: 'var(--accent)' }}
                  />
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
