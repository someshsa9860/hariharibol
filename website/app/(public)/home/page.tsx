'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Globe, Users, Music2, ChevronRight, Sparkles } from 'lucide-react';
import api from '@/lib/api';

const SAMPLE_VOD = {
  id: 'sample',
  verseText: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥',
  transliteration: "karmaṇy-evādhikāras te mā phaleṣu kadācana\nmā karma-phala-hetur bhūr mā te saṅgo 'stv akarmaṇi",
  translation:
    'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions. Never consider yourself the cause of the results of your activities, and never be attached to not doing your duty.',
  verseNumber: '2.47',
  bookName: 'Bhagavad Gita',
};

const STATS = [
  { Icon: BookOpen, value: '10,000+', label: 'Verses' },
  { Icon: Globe,    value: '50+',     label: 'Languages' },
  { Icon: Users,    value: '25+',     label: 'Sampradayas' },
  { Icon: Music2,   value: '500+',    label: 'Mantras' },
];

const BORDER_COLORS = ['#FF6B00', '#006B6B', '#7B1C1C', '#2D5A27'];

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

  const displayVod = vod || SAMPLE_VOD;

  return (
    <>
      {/* ── Hero ── */}
      <section
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #C75A1A 45%, #7B1C1C 100%)' }}
      >
        <style>{`
          @keyframes radial-pulse {
            0%, 100% { opacity: 0.25; transform: translate(-50%, -50%) scale(1); }
            50%       { opacity: 0.50; transform: translate(-50%, -50%) scale(1.18); }
          }
          .hero-glow {
            position: absolute;
            top: 40%;
            left: 50%;
            width: 640px;
            height: 640px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,210,120,0.35) 0%, transparent 68%);
            pointer-events: none;
            animation: radial-pulse 5s ease-in-out infinite;
          }
          .hero-cta-primary:hover  { opacity: 0.9; transform: translateY(-2px); }
          .hero-cta-outline:hover  { background: rgba(255,255,255,0.1); transform: translateY(-2px); }
          .hero-cta-primary, .hero-cta-outline { transition: all 0.2s ease; }
        `}</style>

        {/* Animated radial glow */}
        <div className="hero-glow" />

        {/* Om symbol — top-right decorative */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '4rem',
            right: '3rem',
            fontFamily: "'Noto Sans Devanagari', serif",
            fontSize: 'clamp(6rem, 12vw, 10rem)',
            color: 'rgba(255,255,255,0.10)',
            lineHeight: 1,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          ॐ
        </div>

        <div className="container-site relative z-10 text-center py-20 md:py-32">
          <h1
            className="text-5xl md:text-7xl font-black mb-5 leading-tight"
            style={{ fontFamily: "'Noto Sans Devanagari', serif", color: '#fff' }}
          >
            हरि हरि बोल
          </h1>

          <p
            className="text-xl md:text-2xl mb-10 max-w-xl mx-auto"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', color: 'rgba(255,255,255,0.9)' }}
          >
            Your gateway to Vedic wisdom
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/books"
              className="hero-cta-primary inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base"
              style={{ background: '#fff', color: '#FF6B00', textDecoration: 'none' }}
            >
              <BookOpen size={18} /> Explore Sacred Texts
            </Link>
            <Link
              href="/verse-of-day"
              className="hero-cta-outline inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base"
              style={{ border: '2px solid #fff', color: '#fff', textDecoration: 'none' }}
            >
              <Sparkles size={18} /> Verse of the Day
            </Link>
          </div>
        </div>

        {/* Scroll hint */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          <ChevronRight size={22} className="rotate-90" />
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section style={{ background: '#111', padding: '1.75rem 0' }}>
        <div className="container-site">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {STATS.map(({ Icon, value, label }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon size={24} style={{ color: '#006B6B', flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.2 }}>{value}</div>
                  <div style={{ color: '#aaa', fontSize: '0.78rem', marginTop: '2px' }}>{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Verse of the Day Spotlight ── */}
      <section className="py-20" style={{ background: 'var(--bg)' }}>
        <div className="container-site">
          <div className="text-center mb-10">
            <div className="badge inline-block mb-3">
              <Sparkles size={12} className="inline mr-1" /> Verse of the Day
            </div>
            <h2
              className="text-3xl font-bold"
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}
            >
              Today&apos;s Sacred Teaching
            </h2>
          </div>

          <div
            className="max-w-2xl mx-auto relative"
            style={{
              background: '#C4A882',
              borderRadius: '20px',
              padding: '2.5rem 2rem 2rem',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
          >
            {/* Decorative large quote mark */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '0.75rem',
                left: '1.25rem',
                fontFamily: 'Georgia, serif',
                fontSize: '7rem',
                lineHeight: 0.8,
                color: '#FF6B00',
                opacity: 0.75,
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              &ldquo;
            </div>

            <div style={{ paddingTop: '2.5rem' }}>
              {displayVod.verseNumber && (
                <span
                  className="badge inline-block mb-4"
                  style={{ background: 'rgba(255,107,0,0.15)', borderColor: 'rgba(255,107,0,0.3)', color: '#7B1C1C' }}
                >
                  {displayVod.bookName} {displayVod.verseNumber}
                </span>
              )}

              <p
                className="mb-4 whitespace-pre-line"
                style={{ fontFamily: "'Noto Sans Devanagari', serif", fontSize: '1.2rem', lineHeight: 2, color: '#1A0A00' }}
              >
                {displayVod.verseText}
              </p>

              {displayVod.transliteration && (
                <p
                  className="mb-4 whitespace-pre-line"
                  style={{ fontStyle: 'italic', color: '#4A2800', fontSize: '0.9rem', lineHeight: 1.9 }}
                >
                  {displayVod.transliteration}
                </p>
              )}

              {displayVod.translation && (
                <p className="mb-5" style={{ color: '#3A2000', fontSize: '1rem', lineHeight: 1.8 }}>
                  {displayVod.translation}
                </p>
              )}

              <Link
                href="/verse-of-day"
                style={{ color: '#FF6B00', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Read More <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sacred Texts ── */}
      <section className="py-20" style={{ background: 'var(--bg-2)' }}>
        <div className="container-site">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2
                className="gradient-text text-3xl font-bold"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Sacred Texts
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Ancient wisdom in modern reading experience
              </p>
            </div>
            <Link href="/books" className="btn-ghost text-sm">
              View all <ChevronRight size={14} />
            </Link>
          </div>

          {/* Horizontal scroll on mobile, 3-col grid on md+ */}
          <div className="overflow-x-auto pb-2 -mx-6 px-6 md:mx-0 md:px-0 md:overflow-visible">
            <div className="flex gap-5 md:grid md:grid-cols-3">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="card p-5 space-y-3 min-w-[280px] md:min-w-0">
                      <div className="skeleton h-40 w-full" />
                      <div className="skeleton h-4 w-3/4" />
                      <div className="skeleton h-3 w-1/2" />
                    </div>
                  ))
                : books.length > 0
                ? books.slice(0, 6).map((b: any, idx) => {
                    const borderColor = BORDER_COLORS[idx % BORDER_COLORS.length];
                    return (
                      <Link
                        key={b.id}
                        href={`/books/${b.id}`}
                        className="card-hover block p-5 group min-w-[280px] md:min-w-0"
                        style={{ borderLeft: `4px solid ${borderColor}`, textDecoration: 'none' }}
                      >
                        <div
                          className="w-full h-40 rounded-xl mb-4 flex items-center justify-center overflow-hidden"
                          style={{ background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface) 100%)', border: '1px solid var(--border)' }}
                        >
                          {b.thumbnailUrl ? (
                            <img
                              src={b.thumbnailUrl}
                              alt={b.title}
                              className="w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <BookOpen size={40} style={{ color: borderColor, opacity: 0.55 }} />
                          )}
                        </div>
                        <h3
                          className="font-bold text-base mb-1 leading-tight"
                          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}
                        >
                          {b.title || 'Untitled'}
                        </h3>
                        {b.author && (
                          <p className="text-xs mb-1 font-semibold" style={{ color: borderColor }}>
                            {b.author}
                          </p>
                        )}
                        {b.description && (
                          <p className="text-xs leading-relaxed line-clamp-2 mt-1" style={{ color: 'var(--muted)' }}>
                            {b.description}
                          </p>
                        )}
                      </Link>
                    );
                  })
                : (
                  <div className="col-span-3 text-center py-16" style={{ color: 'var(--muted)' }}>
                    <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
                    <p>Books will appear once the backend is running.</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Sampradayas ── */}
      <section className="py-20" style={{ background: 'var(--bg)' }}>
        <div className="container-site">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2
                className="text-3xl font-bold"
                style={{ fontFamily: "'Playfair Display', serif", color: '#006B6B' }}
              >
                Spiritual Traditions
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                Explore the great Vaishnava sampradayas
              </p>
            </div>
            <Link href="/sampradayas" className="btn-ghost text-sm">
              View all <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="card overflow-hidden">
                    <div className="skeleton h-36 w-full" />
                    <div className="p-4 space-y-2">
                      <div className="skeleton h-4 w-2/3" />
                      <div className="skeleton h-3 w-full" />
                    </div>
                  </div>
                ))
              : sampradayas.slice(0, 6).map((s: any) => (
                  <Link
                    key={s.id}
                    href={`/sampradayas/${s.id}`}
                    className="card-hover block overflow-hidden group"
                    style={{ textDecoration: 'none' }}
                  >
                    {/* Image with gradient overlay */}
                    <div
                      className="w-full h-36 relative overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #006B6B 0%, #003F3F 100%)' }}
                    >
                      {s.thumbnailUrl && (
                        <img
                          src={s.thumbnailUrl}
                          alt={s.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                      {/* Gradient overlay */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(to top, rgba(0,50,50,0.72) 0%, transparent 55%)',
                        }}
                      />
                      {!s.thumbnailUrl && (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '3rem',
                            opacity: 0.4,
                          }}
                        >
                          🪷
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <h3
                        className="font-bold text-base mb-1"
                        style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}
                      >
                        {s.name || s.slug || 'Sampraday'}
                      </h3>
                      {s.description && (
                        <p className="text-xs leading-relaxed line-clamp-2 mb-2" style={{ color: 'var(--muted)' }}>
                          {s.description}
                        </p>
                      )}
                      {s.followerCount != null && (
                        <div
                          className="flex items-center gap-1 text-xs font-semibold mt-1"
                          style={{ color: '#006B6B' }}
                        >
                          <Users size={12} /> {s.followerCount.toLocaleString()} followers
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* ── Footer CTA Banner ── */}
      <section
        style={{ background: 'linear-gradient(135deg, #FF6B00 0%, #C75A1A 45%, #7B1C1C 100%)', padding: '4rem 0' }}
      >
        <div className="container-site text-center">
          <div
            style={{
              fontFamily: "'Noto Sans Devanagari', serif",
              fontSize: '2.5rem',
              color: 'rgba(255,255,255,0.85)',
              marginBottom: '1rem',
            }}
          >
            हरे कृष्ण हरे राम
          </div>
          <h2
            className="text-3xl font-bold mb-4"
            style={{ fontFamily: "'Playfair Display', serif", color: '#fff' }}
          >
            Begin Your Journey Today
          </h2>
          <p
            className="text-base mb-8 max-w-md mx-auto"
            style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.8 }}
          >
            Join thousands of devotees reading, chanting, and growing in spiritual wisdom every day.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base"
              style={{ background: '#fff', color: '#FF6B00', textDecoration: 'none', transition: 'opacity 0.2s ease' }}
            >
              Join Free Today
            </Link>
            <Link
              href="/books"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base"
              style={{
                border: '2px solid rgba(255,255,255,0.65)',
                color: '#fff',
                textDecoration: 'none',
                transition: 'background 0.2s ease',
              }}
            >
              Browse Books
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
