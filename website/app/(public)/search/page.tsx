'use client';

import Link from 'next/link';
import { Search as SearchIcon, BookOpen, Music2, Users, ChevronRight } from 'lucide-react';

export default function SearchPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        style={{
          minHeight: '70vh',
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
        <SearchIcon size={64} style={{ color: 'var(--accent)' }} />
        <h1
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 900,
            color: 'var(--text)',
            marginBottom: '1rem',
          }}
        >
          Search Sacred Knowledge
        </h1>
        <p
          style={{
            fontSize: '1.1rem',
            color: 'var(--text-2)',
            maxWidth: '600px',
            lineHeight: 1.6,
            marginBottom: '1rem',
          }}
        >
          Find verses, mantras, and spiritual wisdom with our powerful search tool. Explore thousands of sacred texts instantly.
        </p>
        <Link href="/app/search" className="btn-primary" style={{ fontSize: '1rem' }}>
          Go to Search <ChevronRight size={18} />
        </Link>
      </section>

      {/* Search Categories */}
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
            Search by Category
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '2rem',
            }}
          >
            {[
              {
                icon: BookOpen,
                title: 'Sacred Texts',
                desc: 'Search through Bhagavad Gita, Srimad Bhagavatam, Upanishads, and more',
                query: 'books',
              },
              {
                icon: Music2,
                title: 'Mantras',
                desc: 'Find powerful mantras by name, benefit, or Sanskrit transliteration',
                query: 'mantras',
              },
              {
                icon: Users,
                title: 'Traditions',
                desc: 'Explore different spiritual traditions and their philosophies',
                query: 'traditions',
              },
              {
                icon: SearchIcon,
                title: 'Keywords',
                desc: 'Search by topic - Bhakti, Karma, Dharma, Krishna, and more',
                query: 'keywords',
              },
            ].map((cat, i) => {
              const IconComponent = cat.icon;
              return (
                <Link href="/app/search" key={i} style={{ textDecoration: 'none' }}>
                  <div className="card-hover" style={{ padding: '2rem', textAlign: 'center', cursor: 'pointer', height: '100%' }}>
                    <IconComponent size={48} style={{ margin: '0 auto 1rem', color: 'var(--accent)' }} />
                    <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)', fontSize: '1.2rem' }}>
                      {cat.title}
                    </h3>
                    <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
                      {cat.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Popular Searches */}
      <section style={{ background: 'var(--bg-2)', padding: '4rem 2rem' }}>
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
            Popular Searches
          </h2>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              justifyContent: 'center',
              marginBottom: '3rem',
            }}
          >
            {[
              'Krishna',
              'Bhakti',
              'Karma',
              'Dharma',
              'Yoga',
              'Meditation',
              'Liberation',
              'Devotion',
              'Guru',
              'Moksha',
            ].map((term) => (
              <Link key={term} href="/app/search">
                <div
                  className="btn-secondary"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                  }}
                >
                  {term}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        style={{
          background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-2) 100%)',
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
            Search Features
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '2rem',
            }}
          >
            {[
              { title: 'Full-Text Search', desc: 'Search across entire verses and translations' },
              { title: 'Filter by Source', desc: 'Narrow results by sacred text or tradition' },
              { title: 'Advanced Filters', desc: 'Filter by chapter, verse number, or topic' },
              { title: 'Favorites', desc: 'Save and organize your favorite verses' },
              { title: 'Quick Results', desc: 'Find what you need instantly' },
              { title: 'Detailed View', desc: 'See full context with translations and commentary' },
            ].map((feature, i) => (
              <div key={i} className="card" style={{ padding: '1.5rem' }}>
                <h4 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent)' }}>
                  {feature.title}
                </h4>
                <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {feature.desc}
                </p>
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
          color: 'white',
          textAlign: 'center',
        }}
      >
        <div className="container-site">
          <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: '2rem', marginBottom: '1.5rem' }}>
            Start Exploring
          </h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem', opacity: 0.95 }}>
            Discover the wisdom you're looking for. Our comprehensive database makes it easy to find spiritual knowledge.
          </p>
          <Link href="/app/search" className="btn-primary" style={{ background: 'white', color: 'var(--accent)', fontSize: '1rem' }}>
            Start Searching <ChevronRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
