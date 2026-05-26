'use client';

import Link from 'next/link';
import { BookOpen, ChevronRight, Sparkles } from 'lucide-react';

const BOOKS = [
  {
    id: 'bg',
    title: 'Bhagavad Gita',
    desc: 'The sacred dialogue between Lord Krishna and Arjuna on the battlefield of Kurukshetra',
    chapters: 18,
    verses: 700,
    gradient: 'linear-gradient(135deg, #FF6B00 0%, #D4A055 100%)',
  },
  {
    id: 'sb',
    title: 'Srimad Bhagavatam',
    desc: 'The comprehensive narrative of Lord Krishna\'s life and divine pastimes',
    chapters: 335,
    verses: 12000,
    gradient: 'linear-gradient(135deg, #006B6B 0%, #2D5A27 100%)',
  },
  {
    id: 'upanishads',
    title: 'Upanishads',
    desc: 'Ancient philosophical texts exploring the nature of Brahman and Atman',
    chapters: 200,
    verses: 1500,
    gradient: 'linear-gradient(135deg, #7B1C1C 0%, #E8A0A0 100%)',
  },
  {
    id: 'brahma-sutras',
    title: 'Brahma Sutras',
    desc: 'Aphorisms by Vyasa on the nature of Brahman and liberation',
    chapters: 4,
    verses: 555,
    gradient: 'linear-gradient(135deg, #8B2FC9 0%, #D4A055 100%)',
  },
];

export default function BooksPage() {
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
        <BookOpen size={64} style={{ color: 'var(--accent)' }} />
        <h1
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 900,
            color: 'var(--text)',
            marginBottom: '1rem',
          }}
        >
          Sacred Vedic Texts
        </h1>
        <p
          style={{
            fontSize: '1.1rem',
            color: 'var(--text-2)',
            maxWidth: '600px',
            lineHeight: 1.6,
          }}
        >
          Explore the timeless wisdom of the Vedas, Upanishads, and other sacred Hindu scriptures with detailed verse-by-verse explanations.
        </p>
        <Link href="/app/books" className="btn-primary" style={{ fontSize: '1rem', marginTop: '1rem' }}>
          Read Sacred Texts <ChevronRight size={18} />
        </Link>
      </section>

      {/* Books Grid */}
      <section style={{ background: 'var(--bg)', padding: '4rem 2rem' }}>
        <div className="container-site">
          <h2
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: '2.5rem',
              fontWeight: 700,
              color: 'var(--text)',
              textAlign: 'center',
              marginBottom: '1rem',
            }}
          >
            Featured Sacred Texts
          </h2>
          <p style={{ textAlign: 'center', color: 'var(--text-2)', marginBottom: '3rem', fontSize: '0.95rem' }}>
            Explore our collection powered by Callvcal Technology
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '2rem',
            }}
          >
            {BOOKS.map((book) => (
              <Link href="/app/books" key={book.id} style={{ textDecoration: 'none' }}>
                <div className="card-hover" style={{ height: '100%', overflow: 'hidden', cursor: 'pointer' }}>
                  <div
                    style={{
                      height: '120px',
                      background: book.gradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      marginBottom: '1.5rem',
                    }}
                  >
                    <BookOpen size={48} />
                  </div>
                  <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)', fontSize: '1.2rem' }}>
                    {book.title}
                  </h3>
                  <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                    {book.desc}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      gap: '2rem',
                      fontSize: '0.9rem',
                      color: 'var(--muted)',
                      paddingTop: '1rem',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{book.chapters}</div>
                      <div>Chapters</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{book.verses.toLocaleString()}</div>
                      <div>Verses</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
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
            Learn with Advanced Features
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '2rem',
              marginBottom: '2rem',
            }}
          >
            <div>
              <Sparkles size={32} style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Sanskrit & Transliteration</h3>
              <p style={{ opacity: 0.9 }}>Original Sanskrit with IAST transliteration</p>
            </div>
            <div>
              <BookOpen size={32} style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Expert Commentary</h3>
              <p style={{ opacity: 0.9 }}>Detailed explanations by spiritual scholars</p>
            </div>
            <div>
              <ChevronRight size={32} style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Easy Navigation</h3>
              <p style={{ opacity: 0.9 }}>Browse chapters and verses seamlessly</p>
            </div>
          </div>
          <Link href="/app/books" className="btn-primary" style={{ background: 'white', color: 'var(--accent)', fontSize: '1rem' }}>
            Start Reading <ChevronRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
