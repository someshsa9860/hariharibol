'use client';

import Link from 'next/link';
import { Sparkles, BookOpen, Music2, Heart, Brain, Users, Shield, Zap, ArrowRight, CheckCircle } from 'lucide-react';

const CORE_FEATURES = [
  {
    icon: BookOpen,
    title: 'Sacred Texts Library',
    desc: 'Access Bhagavad Gita, Srimad Bhagavatam, Upanishads, and classical commentaries',
    highlight: '1000+ verses',
  },
  {
    icon: Music2,
    title: 'Mantra & Chanting',
    desc: 'Learn authentic mantras with Sanskrit transliteration and proper pronunciation',
    highlight: 'Guided practice',
  },
  {
    icon: Heart,
    title: 'Daily Verses',
    desc: 'Receive carefully selected verses daily with deep explanations and context',
    highlight: 'Personalized feed',
  },
  {
    icon: Brain,
    title: 'GuruDev AI Assistant',
    desc: 'Ask spiritual questions and receive AI-powered guidance based on scriptures',
    highlight: 'Instant answers',
  },
];

const BENEFITS = [
  'Complete Sanskrit verses with IAST transliteration',
  'Expert commentaries from devotional scholars',
  'Audio pronunciation guides for mantras',
  'Verse of the day with daily insights',
  'AI-powered spiritual guidance',
  'Offline access to sacred texts',
  'Save favorite verses and mantras',
  'Track your spiritual progress',
];

const STATS = [
  { number: '10K+', label: 'Verses Available', icon: BookOpen },
  { number: '50+', label: 'Sacred Traditions', icon: Heart },
  { number: '100+', label: 'Classical Texts', icon: Users },
  { number: '500K+', label: 'Active Learners', icon: Sparkles },
];

export default function PublicHome() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        style={{
          minHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FF6B00 0%, #D4A055 50%, #C75A1A 100%)',
          padding: '2rem',
          textAlign: 'center',
          gap: '2rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div
            style={{
              display: 'inline-block',
              paddingBottom: '1rem',
              marginBottom: '1rem',
            }}
          >
            <h2
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              by Callvcal Technology Pvt Ltd
            </h2>
          </div>

          <h1
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 'clamp(2.5rem, 7vw, 4.5rem)',
              fontWeight: 900,
              color: 'white',
              marginBottom: '1.5rem',
              lineHeight: 1.1,
              textShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
          >
            Hariharibol
          </h1>

          <p
            style={{
              fontSize: 'clamp(1.1rem, 2vw, 1.3rem)',
              color: 'rgba(255,255,255,0.95)',
              maxWidth: '700px',
              margin: '0 auto 2rem',
              lineHeight: 1.7,
              textShadow: '0 2px 10px rgba(0,0,0,0.15)',
            }}
          >
            Your gateway to authentic Vedic wisdom, sacred mantras, and spiritual guidance powered by AI
          </p>

          <div
            style={{
              display: 'flex',
              gap: '1.5rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: '2rem',
            }}
          >
            <Link
              href="/login"
              className="btn-primary"
              style={{
                fontSize: '1.05rem',
                padding: '14px 40px',
                background: 'white',
                color: '#FF6B00',
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              }}
            >
              Start Free <ArrowRight size={18} />
            </Link>
            <Link
              href="#features"
              className="btn-secondary"
              style={{
                fontSize: '1.05rem',
                padding: '14px 40px',
                background: 'rgba(255,255,255,0.15)',
                color: 'white',
                border: '2px solid white',
              }}
            >
              Explore More
            </Link>
          </div>

          <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.8)' }}>
            ✨ Join 500K+ spiritual seekers worldwide
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section style={{ background: 'var(--bg)', padding: '3rem 2rem' }}>
        <div className="container-site">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '2rem',
              textAlign: 'center',
            }}
          >
            {STATS.map((stat, i) => {
              const IconComponent = stat.icon;
              return (
                <div key={i} style={{ padding: '1.5rem' }}>
                  <IconComponent size={40} style={{ margin: '0 auto 1rem', color: 'var(--accent)' }} />
                  <div
                    style={{
                      fontSize: '2.5rem',
                      fontWeight: 900,
                      color: 'var(--accent)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {stat.number}
                  </div>
                  <p style={{ color: 'var(--text)', fontSize: '1rem', fontWeight: 600 }}>
                    {stat.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section id="features" style={{ background: 'var(--bg-2)', padding: '4rem 2rem' }}>
        <div className="container-site">
          <h2
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 900,
              color: 'var(--text)',
              textAlign: 'center',
              marginBottom: '0.5rem',
            }}
          >
            Everything You Need for <span style={{ color: 'var(--accent)' }}>Spiritual Growth</span>
          </h2>
          <p
            style={{
              textAlign: 'center',
              color: 'var(--text-2)',
              fontSize: '1.1rem',
              marginBottom: '3rem',
              maxWidth: '600px',
              margin: '0 auto 3rem',
            }}
          >
            Comprehensive tools to deepen your connection with sacred knowledge
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '2.5rem',
            }}
          >
            {CORE_FEATURES.map((feature, i) => {
              const IconComponent = feature.icon;
              return (
                <div key={i} className="card-hover" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column' }}>
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1.5rem',
                    }}
                  >
                    <IconComponent size={32} color="white" />
                  </div>
                  <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)', fontSize: '1.2rem' }}>
                    {feature.title}
                  </h3>
                  <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1rem', flex: 1 }}>
                    {feature.desc}
                  </p>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: 'var(--accent)',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                    }}
                  >
                    <CheckCircle size={18} />
                    {feature.highlight}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section style={{ background: 'var(--bg)', padding: '4rem 2rem' }}>
        <div className="container-site">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '4rem', alignItems: 'center' }}>
            <div>
              <h2
                style={{
                  fontFamily: 'Playfair Display, Georgia, serif',
                  fontSize: 'clamp(2rem, 5vw, 2.8rem)',
                  fontWeight: 900,
                  color: 'var(--text)',
                  marginBottom: '2rem',
                }}
              >
                Why Choose <span style={{ color: 'var(--accent)' }}>Hariharibol?</span>
              </h2>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {BENEFITS.map((benefit, i) => (
                  <li key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <CheckCircle size={24} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ color: 'var(--text)', fontSize: '1.05rem', lineHeight: 1.5 }}>
                      {benefit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: '-20px',
                  background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
                  borderRadius: '20px',
                  opacity: 0.1,
                }}
              />
              <div
                style={{
                  position: 'relative',
                  background: 'var(--bg-2)',
                  padding: '3rem',
                  borderRadius: '20px',
                  border: '2px solid var(--border)',
                  textAlign: 'center',
                }}
              >
                <Sparkles size={64} style={{ margin: '0 auto 2rem', color: 'var(--accent)' }} />
                <h3
                  style={{
                    fontFamily: 'Playfair Display, Georgia, serif',
                    fontSize: '1.8rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    marginBottom: '1rem',
                  }}
                >
                  Begin Today
                </h3>
                <p style={{ color: 'var(--text-2)', marginBottom: '2rem', lineHeight: 1.6 }}>
                  Access thousands of verses, mantras, and spiritual wisdom instantly. No credit card required.
                </p>
                <Link
                  href="/login"
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    gap: '0.5rem',
                    padding: '14px 32px',
                    fontSize: '1rem',
                  }}
                >
                  Start Learning <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section style={{ background: 'var(--bg-2)', padding: '4rem 2rem' }}>
        <div className="container-site">
          <h2
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 900,
              color: 'var(--text)',
              textAlign: 'center',
              marginBottom: '3rem',
            }}
          >
            How It Works
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '2rem',
            }}
          >
            {[
              { step: 1, title: 'Sign Up Free', desc: 'Create your account in seconds with email or social login' },
              { step: 2, title: 'Explore Content', desc: 'Browse thousands of verses, mantras, and traditions' },
              { step: 3, title: 'Learn & Practice', desc: 'Read, chant, and meditate with guided practices' },
              { step: 4, title: 'Track Progress', desc: 'Save favorites and monitor your spiritual journey' },
            ].map((item, i) => (
              <div key={i} className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div
                  style={{
                    width: '50px',
                    height: '50px',
                    background: 'var(--accent)',
                    color: 'white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 900,
                    margin: '0 auto 1.5rem',
                  }}
                >
                  {item.step}
                </div>
                <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
                  {item.title}
                </h3>
                <p style={{ color: 'var(--text-2)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial/Trust Section */}
      <section style={{ background: 'var(--bg)', padding: '4rem 2rem' }}>
        <div className="container-site" style={{ textAlign: 'center' }}>
          <h2
            style={{
              fontFamily: 'Playfair Display, Georgia, serif',
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 900,
              color: 'var(--text)',
              marginBottom: '3rem',
            }}
          >
            Trusted by Spiritual Seekers Worldwide
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2rem',
              marginBottom: '3rem',
            }}
          >
            {[
              { quote: 'A complete spiritual knowledge platform with authentic texts and expert guidance.', author: 'Devotional Scholar' },
              { quote: 'The AI-powered insights have deepened my understanding of ancient scriptures.', author: 'Spiritual Practitioner' },
              { quote: 'Perfect blend of traditional wisdom and modern technology for learning.', author: 'Yoga Instructor' },
            ].map((item, i) => (
              <div key={i} className="card" style={{ padding: '2rem', textAlign: 'left' }}>
                <p style={{ color: 'var(--text)', fontSize: '1rem', fontStyle: 'italic', marginBottom: '1rem', lineHeight: 1.7 }}>
                  "{item.quote}"
                </p>
                <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.95rem' }}>
                  — {item.author}
                </p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap', marginTop: '3rem', fontSize: '0.95rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)' }}>
              <Shield size={20} style={{ color: 'var(--accent)' }} />
              <span>Secure & Private</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)' }}>
              <Zap size={20} style={{ color: 'var(--accent)' }} />
              <span>Fast Loading</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text)' }}>
              <Users size={20} style={{ color: 'var(--accent)' }} />
              <span>Community Driven</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        style={{
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
          padding: '5rem 2rem',
          textAlign: 'center',
          color: 'white',
        }}
      >
        <h2
          style={{
            fontFamily: 'Playfair Display, Georgia, serif',
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 900,
            marginBottom: '1.5rem',
          }}
        >
          Begin Your Spiritual Awakening
        </h2>
        <p
          style={{
            fontSize: '1.2rem',
            marginBottom: '2.5rem',
            maxWidth: '600px',
            margin: '0 auto 2.5rem',
            opacity: 0.95,
          }}
        >
          Join thousands of seekers and unlock the wisdom of the ages with Hariharibol by Callvcal Technology
        </p>
        <Link
          href="/login"
          className="btn-primary"
          style={{
            background: 'white',
            color: 'var(--accent)',
            fontSize: '1.1rem',
            padding: '16px 48px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          }}
        >
          Start Free Today <ArrowRight size={20} />
        </Link>
      </section>
    </div>
  );
}
