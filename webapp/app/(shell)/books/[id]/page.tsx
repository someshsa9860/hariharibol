'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/lib/api';

export default function AppBookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<any>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [openCanto, setOpenCanto] = useState<string | null>('1');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/books/${id}`),
      api.get(`/books/${id}/chapters?take=200`),
    ]).then(([bRes, cRes]) => {
      setBook(bRes.data?.book || bRes.data);
      setChapters(cRes.data?.data || cRes.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="p-4 space-y-3">
        <div className="skeleton h-5 w-1/2" />
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-32 w-full rounded-xl" />
      </div>
    </div>
  );

  const cantos = Array.from(new Set(chapters.map((c: any) => String(c.cantoNumber || c.part || '1'))));

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <Link href="/books" className="btn-ghost p-1"><ChevronLeft size={18} /></Link>
        <span className="font-bold text-sm truncate" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
          {book?.title || 'Book'}
        </span>
      </div>

      <div className="p-4 max-w-xl mx-auto">
        {/* Book info */}
        <div className="flex gap-4 mb-6">
          <div className="w-20 h-28 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)' }}>
            <BookOpen size={28} style={{ color: 'var(--accent)', opacity: 0.5 }} />
          </div>
          <div>
            <h1 className="font-black text-xl mb-1 leading-tight" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
              {book?.title}
            </h1>
            {book?.author && <p className="text-xs font-semibold mb-2" style={{ color: 'var(--accent)' }}>{book.author}</p>}
            {book?.description && <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--muted)' }}>{book.description}</p>}
            {chapters.length > 0 && (
              <Link href={`/books/${id}/${chapters[0].id}`} className="btn-primary mt-3 inline-flex text-xs py-2 px-4">
                Start Reading
              </Link>
            )}
          </div>
        </div>

        {/* Chapters */}
        <h2 className="font-bold text-sm mb-3" style={{ color: 'var(--text)' }}>Contents</h2>
        {cantos.map((canto) => {
          const cc = chapters.filter((c: any) => String(c.cantoNumber || c.part || '1') === canto);
          const isOpen = openCanto === canto;
          return (
            <div key={canto} className="mb-2 card overflow-hidden">
              <button className="w-full flex items-center justify-between p-3 text-sm font-semibold"
                onClick={() => setOpenCanto(isOpen ? null : canto)}
                style={{ color: 'var(--text)' }}>
                {cantos.length > 1 ? `Canto ${canto}` : 'Chapters'}
                <span className="flex items-center gap-1 text-xs font-normal" style={{ color: 'var(--muted)' }}>
                  {cc.length} chapters
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>
              {isOpen && cc.map((ch: any, idx: number) => (
                <Link key={ch.id} href={`/books/${id}/${ch.id}`}
                  className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-[var(--surface)]"
                  style={{ borderTop: '1px solid var(--border)', color: 'var(--text)' }}>
                  <span>{ch.title || `Chapter ${ch.chapterNumber || idx + 1}`}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>{ch.verseCount || ''}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
