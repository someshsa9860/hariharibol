'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Music2, Star, ChevronRight, Sparkles, Heart } from 'lucide-react';
import api from '@/lib/api';
import BookCard from '@/components/BookCard';
import SampradayaCard from '@/components/SampradayaCard';
import VerseCard from '@/components/VerseCard';

const SAMPLE_VOD = {
  id: 'sample',
  verseText: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥',
  transliteration: 'karmaṇy-evādhikāras te mā phaleṣu kadācana\nmā karma-phala-hetur bhūr mā te saṅgo \'stv akarmaṇi',
  translation: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions. Never consider yourself the cause of the results of your activities, and never be attached to not doing your duty.',
  verseNumber: '2.47',
  bookName: 'Bhagavad Gita',
};

const FEATURES = [
  { icon: <BookOpen size={22} />, title: 'Read Sacred Texts', desc: 'Bhagavad Gita, Srimad Bhagavatam, and more — verse by verse with meanings.' },
  { icon: <Music2 size={22} />, title: 'Chant Mantras', desc: 'Sacred mantras with transliteration, meaning, and audio guidance.' },
  { icon: <Star size={22} />, title: 'Daily Verse', desc: 'AI-curated Verse of the Day personalized to your spiritual journey.' },
  { icon: <Heart size={22} />, title: 'Save & Revisit', desc: 'Bookmark your favourite verses and build a personal sacred library.' },
];

export default function HomePage() {
  const [vod, setVod] = useState<typeof SAMPLE_VOD | null>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [sampradayas, setSampradayas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/verses/of-day/today').then(r => setVod(r.data?.verse || SAMPLE_VOD)).catch(() => setVod(SAMPLE_VOD)),
      api.get('/books?take=6').then(r => setBooks(r.data?.data || r.data || [])).catch(() => setBooks([])),
      api.get('/sampradayas?take=6').then(r => setSampradayas(r.data?.data || r.data || [])).catch(() => setSampradayas([])),
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: 'var(--bg)' }}>
        {/* Lotus SVG bg */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
          <svg width="700" height="700" viewBox="0 0 200 200" fill="none">
            <g stroke="#C75A1A" strokeWidth="1" fill="none">
              {Array.from({ length: 8 }).map((_, i) => (
                <g key={i} transform={`rotate(${i * 45} 100 100)`}>
                  <ellipse cx="100" cy="50" rx="18" ry="55" />
                </g>
              ))}
              <circle cx="100" cy="100" r="18" />
              <circle cx="100" cy="100" r="45" />
              <circle cx="100" cy="100" r="75" />
            </g>
          </svg>
        </div>

        <div className="container-site text-center relative z-10 pt-24 pb-20">
          {/* Om symbol */}
          <div
            className="text-6xl mb-6 animate-float inline-block"
            style={{ color: 'var(--accent)', fontFamily: 'Noto Sans Devanagari, serif' }}
          >
            ॐ
          </div>

          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight"
            style={{ fontFamily: 'Playfair Display, Georgia, serif', color: 'var(--text)' }}
          >
            Discover the{' '}
            <span className="gradient-text">Wisdom</span>
            <br />of the Vedas
          </h1>

          <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto" style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
            Explore sacred verses, mantras, and teachings from the great spiritual traditions of India — in Sanskrit, transliteration, and your language.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/books" className="btn-primary text-base px-8 py-4">
              <BookOpen size={18} /> Start Reading
            </Link>
            <Link href="/verse-of-day" className="btn-secondary text-base px-8 py-4">
              <Sparkles size={18} /> Today&apos;s Verse
            </Link>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 max-w-sm mx-auto gap-4">
            {[['10,000+', 'Verses'], ['50+', 'Languages'], ['8', 'Traditions']].map(([n, l]) => (
              <div key={l} className="text-center">
                <div className="text-2xl font-black gradient-text">{n}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce" style={{ color: 'var(--muted)' }}>
          <ChevronRight size={20} className="rotate-90" />
        </div>
      </section>

      {/* ── Verse of Day ── */}
      <section className="py-20" style={{ background: 'var(--bg-2)' }}>
        <div className="container-site">
          <div className="text-center mb-10">
            <div className="badge inline-block mb-3">
              <Sparkles size={12} className="inline mr-1" /> Verse of the Day
            </div>
            <h2 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
              Today&apos;s Sacred Teaching
            </h2>
          </div>
          <div className="max-w-2xl mx-auto">
            {vod && <VerseCard verse={vod} showFavorite />}
          </div>
          <div className="text-center mt-8">
            <Link href="/verse-of-day" className="btn-ghost text-sm">
              View history <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20" style={{ background: 'var(--bg)' }}>
        <div className="container-site">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
              Your Spiritual Companion
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
              Everything you need for Vedic study, chanting practice, and daily devotion.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6 text-center">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}
                >
                  {f.icon}
                </div>
                <h3 className="font-bold mb-2" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Books ── */}
      <section className="py-20" style={{ background: 'var(--bg-2)' }}>
        <div className="container-site">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
                Sacred Texts
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Ancient wisdom in modern reading experience</p>
            </div>
            <Link href="/books" className="btn-ghost text-sm">View all <ChevronRight size={14} /></Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card p-5 space-y-3">
                  <div className="skeleton h-40 w-full" />
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : books.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {books.slice(0, 6).map((b) => <BookCard key={b.id} book={b} />)}
            </div>
          ) : (
            <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
              <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p>Books will appear once the backend is running.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Sampradayas ── */}
      {(sampradayas.length > 0 || loading) && (
        <section className="py-20" style={{ background: 'var(--bg)' }}>
          <div className="container-site">
            <div className="flex items-end justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
                  Spiritual Traditions
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Explore the great Vaishnava sampradayas</p>
              </div>
              <Link href="/sampradayas" className="btn-ghost text-sm">View all <ChevronRight size={14} /></Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sampradayas.slice(0, 6).map((s) => <SampradayaCard key={s.id} s={s} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="py-20" style={{ background: 'var(--bg-2)' }}>
        <div className="container-site text-center">
          <div className="text-5xl mb-6" style={{ fontFamily: 'Noto Sans Devanagari, serif', color: 'var(--accent)' }}>
            हरि हरि बोल
          </div>
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
            Begin Your Journey Today
          </h2>
          <p className="text-base mb-8 max-w-md mx-auto" style={{ color: 'var(--muted)' }}>
            Join thousands of devotees reading, chanting, and growing in spiritual wisdom every day.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login" className="btn-primary text-base px-8 py-4">Create Free Account</Link>
            <Link href="/books" className="btn-secondary text-base px-8 py-4">Browse Books</Link>
          </div>
        </div>
      </section>
    </>
  );
}
