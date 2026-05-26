'use client';

import Link from 'next/link';
import { Users, Heart, Flame, ChevronRight } from 'lucide-react';

const SAMPRADAYAS = [
  {
    id: 'gaudiya',
    name: 'Gaudiya Vaishnava',
    desc: 'Devotion to Lord Krishna through bhakti and kirtan, founded by Sri Chaitanya Mahaprabhu',
    icon: Users,
    followers: 'Millions worldwide',
    gradient: 'linear-gradient(135deg, #FF6B00 0%, #D4A055 100%)',
  },
  {
    id: 'sri-vaishnava',
    name: 'Sri Vaishnava',
    desc: 'The tradition of Ramanuja emphasizing Bhakti and Prapatti to Lord Narayana',
    icon: Heart,
    followers: 'Prominent in South India',
    gradient: 'linear-gradient(135deg, #8B2FC9 0%, #E8A0A0 100%)',
  },
  {
    id: 'advaita',
    name: 'Advaita Vedanta',
    desc: 'Non-dualistic philosophy of Adi Shankaracharya emphasizing Brahman realization',
    icon: Flame,
    followers: 'Influential philosophical school',
    gradient: 'linear-gradient(135deg, #006B6B 0%, #2D5A27 100%)',
  },
  {
    id: 'dasnami',
    name: 'Dashanami Order',
    desc: 'Monastic tradition of sannyas founded by Adi Shankaracharya for spiritual renunciation',
    icon: Users,
    followers: 'Monasteries across India',
    gradient: 'linear-gradient(135deg, #7B1C1C 0%, #A52626 100%)',
  },
];

export default function SampradayasPage() {
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
        <Users size={64} style={{ color: 'var(--accent)' }} />
        <h1
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 900,
            color: 'var(--text)',
            marginBottom: '1rem',
          }}
        >
          Spiritual Traditions
        </h1>
        <p
          style={{
            fontSize: '1.1rem',
            color: 'var(--text-2)',
            maxWidth: '600px',
            lineHeight: 1.6,
          }}
        >
          Explore different Hindu philosophical schools and devotional traditions, each with unique approaches to spiritual realization.
        </p>
        <Link href="/app/sampradayas" className="btn-primary" style={{ fontSize: '1rem', marginTop: '1rem' }}>
          Explore Traditions <ChevronRight size={18} />
        </Link>
      </section>

      {/* Sampradayas Grid */}
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
            Major Spiritual Traditions
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '2rem',
            }}
          >
            {SAMPRADAYAS.map((s) => {
              const IconComponent = s.icon;
              return (
                <Link href="/app/sampradayas" key={s.id} style={{ textDecoration: 'none' }}>
                  <div className="card-hover" style={{ height: '100%', overflow: 'hidden', cursor: 'pointer' }}>
                    <div
                      style={{
                        height: '100px',
                        background: s.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        marginBottom: '1.5rem',
                      }}
                    >
                      <IconComponent size={48} />
                    </div>
                    <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)', fontSize: '1.2rem' }}>
                      {s.name}
                    </h3>
                    <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                      {s.desc}
                    </p>
                    <div
                      style={{
                        fontSize: '0.9rem',
                        color: 'var(--accent)',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border)',
                        fontWeight: 600,
                      }}
                    >
                      {s.followers}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section
        style={{
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
          padding: '4rem 2rem',
          color: 'white',
          textAlign: 'center',
        }}
      >
        <div className="container-site">
          <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: '2rem', marginBottom: '2rem' }}>
            Find Your Spiritual Path
          </h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem', opacity: 0.95 }}>
            Each tradition offers unique wisdom and practices for spiritual growth. Discover the path that resonates with your soul.
          </p>
          <Link href="/app/sampradayas" className="btn-primary" style={{ background: 'white', color: 'var(--accent)', fontSize: '1rem' }}>
            Explore All Traditions <ChevronRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
