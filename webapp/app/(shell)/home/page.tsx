'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Music2, Star, Sparkles, ChevronRight, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useAppStore } from '@/lib/store';

const BG_VERSE = {
  id: 'bg-2-47',
  verseText: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥',
  transliteration: 'karmaṇy-evādhikāras te mā phaleṣu kadācana',
  translation: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.',
  verseNumber: '2.47', bookName: 'Bhagavad Gita',
};

export default function AppHomePage() {
  const user = useAppStore((s) => s.user);
  const [vod, setVod] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [randomVerse, setRandomVerse] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchRandom = () => {
    api.get('/verses/random').then(r => setRandomVerse(r.data)).catch(() => setRandomVerse(BG_VERSE));
  };

  useEffect(() => {
    Promise.all([
      api.get('/verses/of-day/today').then(r => setVod(r.data?.verse || r.data)).catch(() => setVod(BG_VERSE)),
      api.get('/books?take=4').then(r => setBooks(r.data?.data || r.data || [])).catch(() => setBooks([])),
    ]).finally(() => setLoading(false));
    fetchRandom();
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-5 h-14" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Welcome back</p>
          <h2 className="font-bold text-base" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
            {user?.displayName || 'Devotee'}
          </h2>
        </div>
        <div className="text-2xl" style={{ color: 'var(--accent)', fontFamily: 'Noto Sans Devanagari, serif' }}>ॐ</div>
      </div>

      <div className="p-5 space-y-6 max-w-2xl mx-auto">
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/books',    icon: <BookOpen size={20} />, label: 'Read Scriptures', color: 'var(--accent)' },
            { href: '/mantras',  icon: <Music2 size={20} />,   label: 'Chant Mantras',  color: '#8B5CF6' },
            { href: '/chanting', icon: <span style={{ fontSize: 18, fontFamily: 'Noto Sans Devanagari' }}>ॐ</span>, label: 'Japa Counter', color: '#059669' },
            { href: '/gurudev',  icon: <Sparkles size={20} />, label: 'Ask GuruDev',    color: '#D4A055' },
          ].map((a) => (
            <Link key={a.href} href={a.href}
              className="card-hover flex items-center gap-3 p-4"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${a.color}22`, color: a.color }}>
                {a.icon}
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{a.label}</span>
            </Link>
          ))}
        </div>

        {/* Verse of Day */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
              <Star size={14} className="inline mr-1" style={{ color: 'var(--accent)' }} />
              Verse of the Day
            </h2>
            <Link href="/verse-of-day" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              View all <ChevronRight size={12} className="inline" />
            </Link>
          </div>
          {loading ? (
            <div className="verse-card space-y-2">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          ) : vod ? (
            <div className="verse-card">
              {vod.verseText && <p className="verse-sanskrit text-base mb-2 whitespace-pre-line">{vod.verseText}</p>}
              {vod.transliteration && <p className="verse-iast text-sm mb-3">{vod.transliteration}</p>}
              {vod.translation && <p className="verse-translation text-sm">{vod.translation}</p>}
              <div className="flex items-center justify-between mt-3">
                <span className="badge">{vod.bookName} {vod.verseNumber}</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Recent books */}
        {books.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
                <BookOpen size={14} className="inline mr-1" style={{ color: 'var(--accent)' }} />
                Sacred Texts
              </h2>
              <Link href="/books" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                View all <ChevronRight size={12} className="inline" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {books.slice(0, 4).map((b: any) => (
                <Link key={b.id} href={`/books/${b.id}`} className="card-hover p-3">
                  <div className="w-full h-20 rounded-lg mb-2 flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
                    <BookOpen size={24} style={{ color: 'var(--accent)', opacity: 0.5 }} />
                  </div>
                  <p className="text-xs font-bold leading-tight" style={{ color: 'var(--text)' }}>{b.title}</p>
                  {b.author && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{b.author}</p>}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Random verse */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
              Random Verse
            </h2>
            <button onClick={fetchRandom} className="btn-ghost text-xs p-2">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {randomVerse && (
            <div className="verse-card">
              {randomVerse.verseText && <p className="verse-sanskrit text-sm mb-2 whitespace-pre-line">{randomVerse.verseText}</p>}
              {randomVerse.translation && <p className="verse-translation text-sm">{randomVerse.translation}</p>}
              <span className="badge mt-2 inline-block">{randomVerse.bookName} {randomVerse.verseNumber}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
