'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Globe, Users, Music2, ChevronRight, Sparkles, ArrowRight } from 'lucide-react';
import api from '@/lib/api';

const SAMPLE_VOD = {
  id: 'sample',
  verseText: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।',
  transliteration: "karmaṇy-evādhikāras te mā phaleṣu kadācana",
  translation: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.',
  verseNumber: '2.47',
  bookName: 'Bhagavad Gita',
};

const STATS = [
  { Icon: BookOpen, value: '10,000+', label: 'Verses' },
  { Icon: Globe, value: '50+', label: 'Languages' },
  { Icon: Users, value: '25+', label: 'Traditions' },
  { Icon: Music2, value: '500+', label: 'Mantras' },
];

export default function HomePage() {
  const [vod, setVod] = useState<typeof SAMPLE_VOD | null>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [sampradayas, setSampradayas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      api.get('/verses/of-day/today').then(r => setVod(r.data?.verse || SAMPLE_VOD)).catch(() => setVod(SAMPLE_VOD)),
      api.get('/books?take=6').then(r => setBooks(r.data?.data || r.data || [])).catch(() => setBooks([])),
      api.get('/sampradayas?take=6').then(r => setSampradayas(r.data?.data || r.data || [])).catch(() => setSampradayas([])),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStatsVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const displayVod = vod || SAMPLE_VOD;

  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24">
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute top-20 right-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl animate-pulse"
            style={{ background: 'var(--accent)' }}
          />
          <div
            className="absolute bottom-20 left-1/3 w-80 h-80 rounded-full opacity-15 blur-3xl animate-pulse"
            style={{ background: 'var(--accent-2)', animationDelay: '1s' }}
          />
        </div>

        <div className="container-site relative z-10">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <Sparkles size={16} style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>Welcome to Spiritual Learning</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight" style={{ color: 'var(--text)' }}>
              Discover Vedic <span style={{ color: 'var(--accent)' }}>Wisdom</span>
            </h1>

            <p className="text-lg md:text-xl mb-10 leading-relaxed" style={{ color: 'var(--text-2)' }}>
              Explore sacred verses, ancient mantras, and spiritual teachings from the world's oldest wisdom traditions in 50+ languages.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link
                href="/books"
                className="btn-primary group flex items-center gap-2 px-8 py-4 text-base"
              >
                <BookOpen size={18} />
                Explore Texts
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/verse-of-day"
                className="btn-secondary flex items-center gap-2 px-8 py-4 text-base"
              >
                <Sparkles size={18} />
                Daily Verse
              </Link>
            </div>

            {/* Scroll indicator */}
            <div className="flex justify-center">
              <div className="animate-bounce" style={{ color: 'var(--muted)' }}>
                <ChevronRight size={24} className="rotate-90" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 md:py-24" style={{ background: 'var(--bg-2)' }}>
        <div className="container-site">
          <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(({ Icon, value, label }, idx) => (
              <div
                key={label}
                className="text-center"
                style={{
                  opacity: statsVisible ? 1 : 0,
                  animation: statsVisible ? `fadeIn 0.6s ease-out ${idx * 0.1}s forwards` : undefined,
                }}
              >
                <div
                  className="inline-flex items-center justify-center w-14 h-14 rounded-lg mb-4"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <Icon size={24} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--text)' }}>
                  {value}
                </div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verse of the Day */}
      <section className="py-16 md:py-24">
        <div className="container-site">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <Sparkles size={14} style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>Featured</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold" style={{ color: 'var(--text)' }}>
              Verse of the Day
            </h2>
          </div>

          <div className="max-w-2xl mx-auto card p-8 md:p-12 animate-scale-in">
            <div className="mb-6">
              <div className="text-sm font-semibold mb-3 opacity-70" style={{ color: 'var(--accent)' }}>
                {displayVod.bookName} • {displayVod.verseNumber}
              </div>
              <p className="text-2xl md:text-3xl font-bold leading-relaxed mb-8" style={{ fontFamily: "'Noto Sans Devanagari', serif", color: 'var(--text)' }}>
                {displayVod.verseText}
              </p>
              <p className="text-lg italic mb-6" style={{ color: 'var(--text-2)' }}>
                "{displayVod.translation}"
              </p>
            </div>
            <Link href="/verse-of-day" className="btn-primary inline-flex items-center gap-2">
              Read More <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Collections */}
      <section className="py-16 md:py-24" style={{ background: 'var(--bg-2)' }}>
        <div className="container-site">
          <div className="mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-3" style={{ color: 'var(--text)' }}>
              Explore Collections
            </h2>
            <p className="text-lg" style={{ color: 'var(--text-2)' }}>
              Browse sacred texts and spiritual traditions
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Books */}
            <div className="card p-8 card-hover">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>Sacred Texts</h3>
                  <p style={{ color: 'var(--text-2)' }}>Vedas, Upanishads & more</p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                  <BookOpen size={24} style={{ color: 'var(--accent)' }} />
                </div>
              </div>
              <div className="space-y-3 mb-6">
                {books.slice(0, 3).map((book, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                    {book.name || book.title}
                  </div>
                ))}
              </div>
              <Link href="/books" className="btn-secondary w-full justify-center">
                View All Books
              </Link>
            </div>

            {/* Sampradayas */}
            <div className="card p-8 card-hover">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>Traditions</h3>
                  <p style={{ color: 'var(--text-2)' }}>Different spiritual lineages</p>
                </div>
                <div className="p-3 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                  <Users size={24} style={{ color: 'var(--accent)' }} />
                </div>
              </div>
              <div className="space-y-3 mb-6">
                {sampradayas.slice(0, 3).map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                    {s.name}
                  </div>
                ))}
              </div>
              <Link href="/sampradayas" className="btn-secondary w-full justify-center">
                Explore Traditions
              </Link>
            </div>
          </div>

          <div className="text-center">
            <Link href="/mantras" className="inline-flex items-center gap-2" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              <Music2 size={18} />
              Explore Mantras & Chants
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute inset-0 opacity-5"
            style={{
              background: 'radial-gradient(circle at 50% 50%, var(--accent) 0%, transparent 70%)',
            }}
          />
        </div>

        <div className="container-site text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: 'var(--text)' }}>
            Ready to begin your journey?
          </h2>
          <p className="text-lg mb-10 max-w-2xl mx-auto" style={{ color: 'var(--text-2)' }}>
            Join thousands exploring ancient wisdom and spiritual teachings personalized for you.
          </p>
          <Link href="/login" className="btn-primary px-10 py-4 text-base">
            Get Started
          </Link>
        </div>
      </section>
    </>
  );
}
