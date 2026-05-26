'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, BookOpen, Music2, Heart, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';

const FEATURES = [
  { icon: BookOpen, title: 'Sacred Texts', desc: 'Bhagavad Gita, Srimad Bhagavatam, and more' },
  { icon: Music2, title: 'Mantras & Chants', desc: 'Traditional mantras with Sanskrit pronunciation' },
  { icon: Heart, title: 'Daily Verses', desc: 'Curated spiritual verses for daily inspiration' },
  { icon: Sparkles, title: 'GuruDev AI', desc: 'AI-powered spiritual guidance and discussions' },
];

export default function PublicHome() {
  const { user } = useAppStore();
  const router = useRouter();

  useEffect(() => {
    // If authenticated, optionally redirect to app home
    // But only if user explicitly navigates here
    // Don't auto-redirect based on user state at page load
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        style={{
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-2) 100%)',
          padding: '2rem',
          textAlign: 'center',
          gap: '2rem',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 'clamp(2.5rem, 6vw, 4rem)',
              fontWeight: 900,
              color: 'var(--text)',
              marginBottom: '1rem',
              lineHeight: 1.2,
            }}
          >
            Discover Sacred <span style={{ color: 'var(--accent)' }}>Vedic Wisdom</span>
          </h1>
          <p
            style={{
              fontSize: '1.2rem',
              color: 'var(--text-2)',
              maxWidth: '600px',
              margin: '0 auto 2rem',
              lineHeight: 1.6,
            }}
          >
            Learn spiritual wisdom from ancient texts, practice mantras, and grow with AI-powered guidance
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn-primary" style={{ fontSize: '1.05rem', padding: '12px 32px' }}>
              Start Learning <ArrowRight size={18} />
            </Link>
            <Link
              href="#features"
              className="btn-secondary"
              style={{ fontSize: '1.05rem', padding: '12px 32px' }}
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{ background: 'var(--bg)', padding: '4rem 2rem' }}>
        <div className="container-site">
          <h2
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: '2.5rem',
              fontWeight: 700,
              color: 'var(--text)',
              textAlign: 'center',
              marginBottom: '3rem',
            }}
          >
            Why Choose <span style={{ color: 'var(--accent)' }}>HariHariBol</span>
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '2rem',
            }}
          >
            {FEATURES.map((f) => (
              <div key={f.title} className="card-hover" style={{ padding: '2rem', textAlign: 'center' }}>
                <f.icon
                  size={40}
                  style={{ margin: '0 auto 1rem', color: 'var(--accent)' }}
                />
                <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text)' }}>
                  {f.title}
                </h3>
                <p style={{ color: 'var(--text-2)', fontSize: '0.95rem' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        style={{
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
          padding: '4rem 2rem',
          textAlign: 'center',
          color: 'white',
        }}
      >
        <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: '2.5rem', marginBottom: '1rem' }}>
          Begin Your Spiritual Journey
        </h2>
        <p style={{ fontSize: '1.1rem', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem' }}>
          Join thousands of seekers exploring ancient wisdom and modern spirituality
        </p>
        <Link href="/login" className="btn-primary" style={{ background: 'white', color: 'var(--accent)' }}>
          Join Now <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
