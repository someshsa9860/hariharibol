'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { ArrowLeft, BookOpen, ChevronRight, Mic2 } from 'lucide-react';

interface Verse {
  id: string;
  verseNumber: number | string;
  sanskrit?: string;
  transliteration?: string;
  translations?: { languageCode: string; status: string }[];
  narrations?: { id: string }[];
}

const LANG_BADGES = ['en', 'hi', 'sa', 'gu', 'mr'];

function LangBadge({ code, covered }: { code: string; covered: boolean }) {
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
      style={{
        background: covered ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)',
        color: covered ? '#4ade80' : 'var(--muted)',
        border: `1px solid ${covered ? 'rgba(74,222,128,0.25)' : 'var(--border)'}`,
      }}>
      {code.toUpperCase()}
    </span>
  );
}

export default function ChapterVersesPage() {
  const params = useParams();
  const bookId = params.id as string;
  const chapterNum = params.num as string;

  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [chapterTitle, setChapterTitle] = useState('');

  useEffect(() => { fetchVerses(); }, [bookId, chapterNum]);

  const fetchVerses = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/books/${bookId}/chapters/${chapterNum}/verses`);
      const d = r.data;
      setVerses(Array.isArray(d) ? d : d?.data || []);
      setChapterTitle(d?.chapterTitle || '');
    } catch { } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <header className="px-8 py-4 flex items-center gap-3 sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <Link href={`/books/${bookId}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}>
            <ArrowLeft size={14} />
          </Link>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <BookOpen size={15} style={{ color: '#60a5fa' }} />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <Link href="/books" className="hover:opacity-80">Books</Link>
              <ChevronRight size={10} />
              <Link href={`/books/${bookId}`} className="hover:opacity-80">Book</Link>
              <ChevronRight size={10} />
              <span>Chapter {chapterNum}</span>
            </div>
            <h1 className="text-xl font-black text-theme">
              Chapter {chapterNum}{chapterTitle ? ` — ${chapterTitle}` : ''}
            </h1>
          </div>
        </header>

        <div className="p-8 max-w-5xl mx-auto">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="font-bold text-theme text-sm">Verses</span>
              {!loading && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                  {verses.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-5 space-y-3">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
            ) : verses.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm" style={{ color: 'var(--muted)' }}>No verses in this chapter</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="table-header w-16">Verse</th>
                    <th className="table-header">Sanskrit Preview</th>
                    <th className="table-header">Translation Coverage</th>
                    <th className="table-header">Narrations</th>
                    <th className="table-header"></th>
                  </tr>
                </thead>
                <tbody>
                  {verses.map((v) => {
                    const coveredLangs = (v.translations || []).map(t => t.languageCode);
                    return (
                      <tr key={v.id} className="table-row">
                        <td className="table-cell">
                          <span className="font-bold text-theme">{v.verseNumber}</span>
                        </td>
                        <td className="table-cell max-w-xs">
                          <p className="text-sm font-medium truncate" style={{ fontFamily: 'serif', color: 'var(--text)' }}>
                            {v.sanskrit || v.transliteration || '—'}
                          </p>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1">
                            {LANG_BADGES.map(code => (
                              <LangBadge key={code} code={code} covered={coveredLangs.includes(code)} />
                            ))}
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            <Mic2 size={13} style={{ color: 'var(--muted)' }} />
                            <span className="text-sm font-semibold text-theme">{v.narrations?.length ?? 0}</span>
                          </div>
                        </td>
                        <td className="table-cell">
                          <Link
                            href={`/books/${bookId}/chapters/${chapterNum}/verses/${v.verseNumber}`}
                            className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
                            style={{ color: '#60a5fa' }}>
                            Edit <ChevronRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
