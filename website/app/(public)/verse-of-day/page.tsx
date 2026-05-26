'use client';

import Link from 'next/link';
import { Sparkles, Calendar, Moon, Sun, ChevronRight } from 'lucide-react';

export default function VerseOfDayPage() {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

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
        <Calendar size={64} style={{ color: 'var(--accent)' }} />
        <h1
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 900,
            color: 'var(--text)',
            marginBottom: '1rem',
          }}
        >
          Verse of the Day
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
          Receive daily spiritual inspiration through carefully selected verses from sacred Hindu texts. Start your day with timeless wisdom.
        </p>
        <div style={{ fontSize: '1rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          {dateStr}
        </div>
        <Link href="/app/verse-of-day" className="btn-primary" style={{ fontSize: '1rem' }}>
          View Today's Verse <ChevronRight size={18} />
        </Link>
      </section>

      {/* Benefits Section */}
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
            Why Daily Verses?
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '2rem',
            }}
          >
            <div className="card-hover" style={{ padding: '2rem', textAlign: 'center' }}>
              <Sun size={48} style={{ margin: '0 auto 1rem', color: 'var(--accent)' }} />
              <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
                Start Your Day Right
              </h3>
              <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
                Begin each morning with spiritual wisdom to guide your thoughts and actions throughout the day.
              </p>
            </div>
            <div className="card-hover" style={{ padding: '2rem', textAlign: 'center' }}>
              <Sparkles size={48} style={{ margin: '0 auto 1rem', color: 'var(--accent)' }} />
              <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
                Continuous Learning
              </h3>
              <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
                Gradually deepen your understanding of Vedic knowledge through consistent daily engagement.
              </p>
            </div>
            <div className="card-hover" style={{ padding: '2rem', textAlign: 'center' }}>
              <Moon size={48} style={{ margin: '0 auto 1rem', color: 'var(--accent)' }} />
              <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
                Peaceful Reflection
              </h3>
              <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
                Take time for quiet contemplation and inner peace with verses that inspire spiritual growth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
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
            What You'll Get
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '2rem',
            }}
          >
            {[
              { title: 'Sanskrit & Transliteration', desc: 'Original verse in Sanskrit with romanized IAST transliteration' },
              { title: 'English Translation', desc: 'Clear, devotional translation accessible to modern readers' },
              { title: 'Detailed Explanation', desc: 'Comprehensive commentary explaining the verse\'s spiritual significance' },
              { title: 'Historical Context', desc: 'Learn the background and source of each verse' },
              { title: 'Daily Reminders', desc: 'Optional notifications to ensure you never miss a verse' },
              { title: 'Archive Access', desc: 'Browse previous verses and build your personal spiritual library' },
            ].map((feature, i) => (
              <div key={i} className="card" style={{ padding: '1.5rem' }}>
                <h4 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent)' }}>
                  {feature.title}
                </h4>
                <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', lineHeight: 1.5 }}>
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
            Begin Your Daily Practice
          </h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem', opacity: 0.95 }}>
            Let sacred wisdom guide your daily journey. One verse a day keeps spiritual ignorance away.
          </p>
          <Link href="/app/verse-of-day" className="btn-primary" style={{ background: 'white', color: 'var(--accent)', fontSize: '1rem' }}>
            Start Your Journey <ChevronRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}
