'use client';

import Link from 'next/link';
import { Music2, Volume2, Heart, Zap, ChevronRight } from 'lucide-react';

const MANTRAS = [
  {
    name: 'Hare Krishna Mantra',
    desc: 'The maha-mantra for devotion and divine connection',
    text: 'Hare Krishna, Hare Krishna, Krishna Krishna, Hare Hare / Hare Rama, Hare Rama, Rama Rama, Hare Hare',
    benefits: 'Purification, devotion, peace',
  },
  {
    name: 'Om Namah Shivaya',
    desc: 'Salutation to Lord Shiva, the supreme consciousness',
    text: 'ॐ नमः शिवाय',
    benefits: 'Meditation, liberation, inner peace',
  },
  {
    name: 'Gayatri Mantra',
    desc: 'Universal mantra illuminating the intellect',
    text: 'ॐ भूर्भुवः स्वः तत्सवितुर्वरेण्यम्',
    benefits: 'Wisdom, enlightenment, divine grace',
  },
  {
    name: 'Mahamantra',
    desc: 'The greatest mantra for spiritual advancement',
    text: 'Hare Krishna, Hare Krishna, Krishna Krishna, Hare Hare',
    benefits: 'Supreme realization, bhakti, salvation',
  },
];

export default function MantrasPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-2) 100%)',
          padding: '2rem',
          textAlign: 'center',
          gap: '1.5rem',
        }}
      >
        <Music2 size={64} style={{ color: 'var(--accent)' }} />
        <h1
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 900,
            color: 'var(--text)',
            marginBottom: '1rem',
          }}
        >
          Sacred Mantras
        </h1>
        <p
          style={{
            fontSize: '1.1rem',
            color: 'var(--text-2)',
            maxWidth: '600px',
            lineHeight: 1.6,
          }}
        >
          Chant powerful mantras to transform consciousness, purify the mind, and connect with divine energy.
        </p>
        <Link href="/app/mantras" className="btn-primary" style={{ fontSize: '1rem', marginTop: '1rem' }}>
          Learn Mantras <ChevronRight size={18} />
        </Link>
      </section>

      {/* Mantras List */}
      <section style={{ background: 'var(--bg)', padding: '4rem 2rem' }}>
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
            Popular Mantras
          </h2>
          <div style={{ display: 'grid', gap: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            {MANTRAS.map((mantra, i) => (
              <Link href="/app/mantras" key={i} style={{ textDecoration: 'none' }}>
                <div className="card-hover" style={{ padding: '2rem', cursor: 'pointer' }}>
                  <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)', fontSize: '1.3rem' }}>
                    {mantra.name}
                  </h3>
                  <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', marginBottom: '1rem' }}>
                    {mantra.desc}
                  </p>
                  <div
                    style={{
                      background: 'var(--surface)',
                      padding: '1.5rem',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      fontFamily: 'Noto Sans Devanagari, serif',
                      fontSize: '1.1rem',
                      color: 'var(--text)',
                      lineHeight: 1.8,
                    }}
                  >
                    {mantra.text}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: 'var(--accent)',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                    }}
                  >
                    <Heart size={16} />
                    Benefits: {mantra.benefits}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section
        style={{
          background: 'linear-gradient(135deg, var(--bg-2) 0%, var(--bg) 100%)',
          padding: '4rem 2rem',
        }}
      >
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
            Power of Mantra Chanting
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '2rem',
            }}
          >
            {[
              { icon: Volume2, title: 'Sound Vibration', desc: 'Divine vibrations heal body and mind' },
              { icon: Heart, title: 'Emotional Balance', desc: 'Calm the mind and reduce stress' },
              { icon: Zap, title: 'Spiritual Energy', desc: 'Awaken dormant spiritual potential' },
              { icon: Music2, title: 'Consciousness', desc: 'Elevate awareness to higher planes' },
            ].map((item, i) => {
              const IconComponent = item.icon;
              return (
                <div key={i} className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                  <IconComponent size={40} style={{ margin: '0 auto 1rem', color: 'var(--accent)' }} />
                  <h4 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
                    {item.title}
                  </h4>
                  <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        style={{
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
          padding: '4rem 2rem',
          color: 'white',
          textAlign: 'center',
        }}
      >
        <div className="container-site">
          <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: '2rem', marginBottom: '1.5rem' }}>
            Start Chanting Today
          </h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '2rem', maxValue: '600px', opacity: 0.95 }}>
            Experience the transformative power of sacred mantras. Let the divine vibrations guide you on your spiritual journey.
          </p>
          <Link href="/app/mantras" className="btn-primary" style={{ background: 'white', color: 'var(--accent)', fontSize: '1rem' }}>
            Explore Mantras <ChevronRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
