'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Music2, Sparkles, ChevronRight, RefreshCw, Bookmark, Share2, Star } from 'lucide-react';
import api from '@/lib/api';
import { useAppStore } from '@/lib/store';

const BG_VERSE = {
  id: 'bg-2-47',
  verseText: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥',
  transliteration: 'karmaṇy-evādhikāras te mā phaleṣu kadācana',
  translation: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.',
  verseNumber: '2.47',
  bookName: 'Bhagavad Gita',
};

const BOOK_GRADIENTS = [
  'linear-gradient(135deg, #FF6B00, #D4A055)',
  'linear-gradient(135deg, #006B6B, #2D5A27)',
  'linear-gradient(135deg, #7B1C1C, #E8A0A0)',
  'linear-gradient(135deg, #D4A055, #C75A1A)',
];

function getTimeOfDay(): 'morning' | 'evening' | 'night' {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 19) return 'evening';
  return 'night';
}

const TIME_CONFIG = {
  morning: {
    gradient: 'linear-gradient(135deg, #D4A055 0%, #FF6B00 55%, #C75A1A 100%)',
    greeting: 'सुप्रभातम्',
    sub: 'Good Morning',
  },
  evening: {
    gradient: 'linear-gradient(135deg, #7B1C1C 0%, #A52626 45%, #006B6B 100%)',
    greeting: 'नमस्ते',
    sub: 'Good Afternoon',
  },
  night: {
    gradient: 'linear-gradient(135deg, #006B6B 0%, #008B8B 35%, #2D5A27 100%)',
    greeting: 'शुभ रात्रि',
    sub: 'Good Evening',
  },
} as const;

const QUICK_ACTIONS = [
  {
    href: '/books',
    icon: <BookOpen size={20} />,
    label: 'Read Scriptures',
    iconBg: 'rgba(255,107,0,0.14)',
    iconColor: 'var(--saffron)',
  },
  {
    href: '/mantras',
    icon: <Music2 size={20} />,
    label: 'Chant Mantras',
    iconBg: 'rgba(0,107,107,0.14)',
    iconColor: 'var(--peacock)',
  },
  {
    href: '/chanting',
    icon: (
      <span style={{ fontSize: 20, fontFamily: 'Noto Sans Devanagari', lineHeight: 1 }}>ॐ</span>
    ),
    label: 'Japa Counter',
    iconBg: 'rgba(212,160,85,0.14)',
    iconColor: 'var(--accent-2)',
  },
  {
    href: '/gurudev',
    icon: <Sparkles size={20} />,
    label: 'Ask GuruDev',
    iconBg: 'rgba(123,28,28,0.14)',
    iconColor: 'var(--maroon)',
  },
];

export default function AppHomePage() {
  const user = useAppStore((s) => s.user);
  const [vod, setVod] = useState<any>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [randomVerse, setRandomVerse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'evening' | 'night'>('morning');
  const [continueBook, setContinueBook] = useState<any>(null);

  const fetchRandom = () => {
    api.get('/verses/random').then((r) => setRandomVerse(r.data)).catch(() => setRandomVerse(BG_VERSE));
  };

  useEffect(() => {
    setTimeOfDay(getTimeOfDay());
    try {
      const saved = localStorage.getItem('hhb_last_book');
      if (saved) setContinueBook(JSON.parse(saved));
    } catch {}
    Promise.all([
      api
        .get('/verses/of-day/today')
        .then((r) => setVod(r.data?.verse || r.data))
        .catch(() => setVod(BG_VERSE)),
      api
        .get('/books?take=6')
        .then((r) => setBooks(r.data?.data || r.data || []))
        .catch(() => setBooks([])),
    ]).finally(() => setLoading(false));
    fetchRandom();
  }, []);

  const tc = TIME_CONFIG[timeOfDay];
  const firstName = user?.displayName?.split(' ')[0] || 'Devotee';

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 88 }}>
      {/* Time-based Greeting Banner */}
      <div
        style={{
          background: tc.gradient,
          padding: '32px 24px 40px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -50,
            right: -50,
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -28,
            left: -28,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }}
        />
        <p
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.04em',
            marginBottom: 6,
          }}
        >
          {tc.sub}, {firstName} 🙏
        </p>
        <h1
          style={{
            fontFamily: 'Noto Sans Devanagari, serif',
            fontSize: 'clamp(1.9rem, 7vw, 3rem)',
            color: '#fff',
            fontWeight: 700,
            lineHeight: 1.25,
            marginBottom: 8,
            textShadow: '0 2px 10px rgba(0,0,0,0.22)',
          }}
        >
          {tc.greeting}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, fontStyle: 'italic' }}>
          Begin your spiritual journey today
        </p>
      </div>

      <div className="p-5 space-y-7 max-w-2xl mx-auto">
        {/* Quick Actions — 2×2 on mobile, 4×1 on desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="card-hover flex flex-col items-center gap-2.5 p-4 text-center"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: a.iconBg, color: a.iconColor }}
              >
                {a.icon}
              </div>
              <span className="text-xs font-semibold leading-tight" style={{ color: 'var(--text)' }}>
                {a.label}
              </span>
            </Link>
          ))}
        </div>

        {/* Verse of Day — premium sandstone card */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="font-bold text-base"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
            >
              <Star size={14} className="inline mr-1.5" style={{ color: 'var(--accent)' }} />
              Verse of the Day
            </h2>
            <Link href="/verse-of-day" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              View all <ChevronRight size={12} className="inline" />
            </Link>
          </div>

          {loading ? (
            <div
              style={{
                background: 'rgba(196,168,130,0.14)',
                borderRadius: 16,
                padding: '1.5rem',
              }}
            >
              <div className="skeleton h-6 w-3/4 mb-3" />
              <div className="skeleton h-4 w-full mb-2" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          ) : vod ? (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(196,168,130,0.12), rgba(196,168,130,0.22))',
                border: '1px solid rgba(196,168,130,0.35)',
                borderRadius: 16,
                padding: '1.5rem',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Decorative saffron quote mark */}
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 14,
                  fontFamily: 'Georgia, serif',
                  fontSize: 96,
                  lineHeight: 1,
                  color: 'var(--saffron)',
                  opacity: 0.13,
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              >
                "
              </div>
              {vod.verseText && (
                <p
                  style={{
                    fontFamily: 'Noto Sans Devanagari, serif',
                    fontSize: '1.1rem',
                    lineHeight: 2,
                    color: 'var(--text)',
                    marginBottom: 10,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {vod.verseText}
                </p>
              )}
              {vod.transliteration && (
                <p
                  style={{
                    fontStyle: 'italic',
                    color: 'var(--muted)',
                    fontSize: 13,
                    marginBottom: 10,
                    lineHeight: 1.8,
                  }}
                >
                  {vod.transliteration}
                </p>
              )}
              {vod.translation && (
                <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.8, marginBottom: 14 }}>
                  {vod.translation}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="badge">
                  {vod.bookName} {vod.verseNumber}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => setBookmarked((b) => !b)}
                    className="btn-ghost"
                    style={{
                      padding: '6px 10px',
                      color: bookmarked ? 'var(--accent)' : 'var(--muted)',
                    }}
                    title="Bookmark"
                  >
                    <Bookmark size={16} fill={bookmarked ? 'currentColor' : 'none'} />
                  </button>
                  <button className="btn-ghost" style={{ padding: '6px 10px' }} title="Share">
                    <Share2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Continue Reading — shown only when last-read book is stored */}
        {continueBook && (
          <div>
            <h2
              className="font-bold text-base mb-3"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
            >
              Continue Reading
            </h2>
            <Link href={`/books/${continueBook.id}`} className="card-hover flex items-center gap-4 p-4">
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  flexShrink: 0,
                  background: BOOK_GRADIENTS[0],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BookOpen size={22} style={{ color: '#fff' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                  {continueBook.title}
                </p>
                {continueBook.lastChapter && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Chapter {continueBook.lastChapter}
                  </p>
                )}
              </div>
              <ChevronRight size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            </Link>
          </div>
        )}

        {/* Recommended Books — horizontal scroll row */}
        {books.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2
                className="font-bold text-base"
                style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
              >
                <BookOpen size={14} className="inline mr-1.5" style={{ color: 'var(--peacock)' }} />
                Sacred Texts
              </h2>
              <Link href="/books" className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                View all <ChevronRight size={12} className="inline" />
              </Link>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 12,
                overflowX: 'auto',
                paddingBottom: 6,
                scrollbarWidth: 'none',
              }}
            >
              {books.map((b: any, i: number) => (
                <Link
                  key={b.id}
                  href={`/books/${b.id}`}
                  className="card-hover"
                  style={{ width: 120, flexShrink: 0, padding: 10 }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: 88,
                      borderRadius: 10,
                      marginBottom: 8,
                      background: BOOK_GRADIENTS[i % BOOK_GRADIENTS.length],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BookOpen size={24} style={{ color: '#fff', opacity: 0.9 }} />
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
                    {b.title}
                  </p>
                  {b.author && (
                    <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{b.author}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Random Verse — lotus/peacock theme */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="font-bold text-base"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
            >
              Random Verse
            </h2>
            <button
              onClick={fetchRandom}
              className="btn-ghost text-xs"
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px' }}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {randomVerse && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(0,107,107,0.07), rgba(45,90,39,0.11))',
                border: '1px solid rgba(0,107,107,0.2)',
                borderRadius: 16,
                padding: '1.5rem',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  bottom: -14,
                  right: -8,
                  fontSize: 72,
                  opacity: 0.07,
                  userSelect: 'none',
                  pointerEvents: 'none',
                  lineHeight: 1,
                }}
              >
                🪷
              </div>
              {randomVerse.verseText && (
                <p
                  style={{
                    fontFamily: 'Noto Sans Devanagari, serif',
                    fontSize: '1rem',
                    lineHeight: 2,
                    color: 'var(--text)',
                    marginBottom: 8,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {randomVerse.verseText}
                </p>
              )}
              {randomVerse.translation && (
                <p style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.8, marginBottom: 10 }}>
                  {randomVerse.translation}
                </p>
              )}
              <span
                className="badge"
                style={{
                  background: 'rgba(0,107,107,0.10)',
                  color: 'var(--peacock)',
                  borderColor: 'rgba(0,107,107,0.25)',
                }}
              >
                {randomVerse.bookName} {randomVerse.verseNumber}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
