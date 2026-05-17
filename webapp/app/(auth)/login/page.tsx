'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAppStore } from '@/lib/store';

function LotusPattern() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 400 400"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      <g opacity="0.12" stroke="white" strokeWidth="0.8" fill="none">
        {Array.from({ length: 16 }).map((_, i) => (
          <g key={i} transform={`rotate(${i * 22.5} 200 200)`}>
            <ellipse cx="200" cy="90" rx="18" ry="60" />
          </g>
        ))}
        <circle cx="200" cy="200" r="25" />
        <circle cx="200" cy="200" r="65" />
        <circle cx="200" cy="200" r="110" />
        <circle cx="200" cy="200" r="155" />
      </g>
    </svg>
  );
}

export default function AppLoginPage() {
  const router = useRouter();
  const { setUser, setToken } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/google/mobile', { idToken: 'GOOGLE_OAUTH_TOKEN' });
      setUser(res.data.user);
      setToken(res.data.accessToken);
      router.push('/home');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* ── Left panel: gradient hero ── */}
      <div
        className="relative flex flex-col items-center justify-center px-10 py-14 md:w-80 lg:w-[420px] md:min-h-screen flex-shrink-0 overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #FF6B00 0%, #C75A1A 40%, #7B1C1C 100%)' }}
      >
        <LotusPattern />

        {/* Om symbol */}
        <div
          className="relative z-10 mb-4 animate-float"
          style={{
            fontSize: '6rem',
            lineHeight: 1,
            color: 'rgba(255,255,255,0.95)',
            fontFamily: 'Noto Sans Devanagari, serif',
            textShadow: '0 8px 32px rgba(0,0,0,0.35)',
            filter: 'drop-shadow(0 2px 8px rgba(255,255,255,0.2))',
          }}
        >
          ॐ
        </div>

        {/* App name */}
        <h1
          className="relative z-10 text-white text-center mb-1"
          style={{
            fontFamily: 'Playfair Display, serif',
            fontWeight: 700,
            fontSize: '2rem',
            textShadow: '0 2px 12px rgba(0,0,0,0.3)',
          }}
        >
          HariHariBol
        </h1>

        {/* Devanagari subtitle */}
        <p
          className="relative z-10 text-center mb-8"
          style={{
            fontFamily: 'Noto Sans Devanagari, serif',
            fontSize: '1.1rem',
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          हरि हरि बोल
        </p>

        <div className="relative z-10 w-12 h-px mb-8" style={{ background: 'rgba(255,255,255,0.3)' }} />

        {/* Bhagavad Gita quote */}
        <blockquote className="relative z-10 text-center max-w-[260px]">
          <p
            className="leading-relaxed mb-3"
            style={{
              fontFamily: 'Playfair Display, serif',
              fontStyle: 'italic',
              fontSize: '0.875rem',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            "The soul is never born nor dies at any time. It has not come into being,
            does not come into being, and will not come into being."
          </p>
          <cite style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
            — Bhagavad Gita 2.20
          </cite>
        </blockquote>
      </div>

      {/* ── Right panel: sign-in form ── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12"
        style={{ background: 'var(--bg)' }}
      >
        <div className="w-full max-w-sm">
          <h2
            className="font-black mb-2"
            style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.875rem', color: 'var(--text)' }}
          >
            Welcome Back
          </h2>
          <p className="mb-8 text-sm" style={{ color: 'var(--muted)' }}>
            Sign in to continue your spiritual practice.
          </p>

          {error && (
            <div
              className="mb-4 p-3 rounded-xl text-xs"
              style={{
                background: 'rgba(239,68,68,0.10)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              {error}
            </div>
          )}

          {/* Google sign-in */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-semibold text-sm mb-3 transition-all"
            style={{
              background: '#ffffff',
              color: '#3c4043',
              border: '1px solid #dadce0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          {/* Apple sign-in */}
          <button
            disabled
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-semibold text-sm mb-8 cursor-not-allowed"
            style={{ background: '#000000', color: '#ffffff', opacity: 0.55 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Continue with Apple (coming soon)
          </button>

          <p className="text-xs text-center mb-6" style={{ color: 'var(--muted)' }}>
            By continuing, you agree to our{' '}
            <a href="/terms" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Terms</a>
            {' '}and{' '}
            <a href="/privacy" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Privacy Policy</a>.
          </p>

          <div className="text-center">
            <button
              onClick={() => router.push('/home')}
              className="text-sm transition-colors"
              style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Continue as Guest →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
