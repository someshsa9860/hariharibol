'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useSiteStore } from '@/lib/store';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useSiteStore((s) => s.setUser);
  const setToken = useSiteStore((s) => s.setToken);
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
      setError(e?.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      {/* Background lotus */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
        <svg width="600" height="600" viewBox="0 0 200 200" fill="none">
          <g stroke="#C75A1A" strokeWidth="1" fill="none">
            {Array.from({ length: 8 }).map((_, i) => (
              <g key={i} transform={`rotate(${i * 45} 100 100)`}>
                <ellipse cx="100" cy="50" rx="18" ry="55" />
              </g>
            ))}
            <circle cx="100" cy="100" r="18" />
            <circle cx="100" cy="100" r="45" />
          </g>
        </svg>
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3 animate-float inline-block" style={{ color: 'var(--accent)', fontFamily: 'Noto Sans Devanagari, serif' }}>
            ॐ
          </div>
          <h1 className="text-2xl font-black" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
            HariHariBol
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Sign in to your spiritual journey</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-6 text-center" style={{ color: 'var(--text)', fontFamily: 'Playfair Display, serif' }}>
            Welcome Back
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-semibold text-sm mb-3 transition-all"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          {/* Apple */}
          <button
            disabled
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-semibold text-sm mb-6 opacity-50 cursor-not-allowed"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border-2)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Continue with Apple (coming soon)
          </button>

          <div className="divider-om text-xs mb-6">or</div>

          <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
            By continuing, you agree to our{' '}
            <Link href="/terms" className="underline" style={{ color: 'var(--accent)' }}>Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" className="underline" style={{ color: 'var(--accent)' }}>Privacy Policy</Link>.
          </p>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--muted)' }}>
          <Link href="/home" style={{ color: 'var(--accent)' }}>← Continue without account</Link>
        </p>
      </div>
    </div>
  );
}
