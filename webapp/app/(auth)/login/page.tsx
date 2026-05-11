'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAppStore } from '@/lib/store';

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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3 inline-block" style={{ color: 'var(--accent)', fontFamily: 'Noto Sans Devanagari, serif' }}>ॐ</div>
          <h1 className="text-2xl font-black" style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}>
            HariHariBol
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Sign in to continue your practice</p>
        </div>

        <div className="card p-6">
          {error && (
            <div className="mb-4 p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171' }}>
              {error}
            </div>
          )}
          <button onClick={handleGoogle} disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-sm mb-3 transition-all"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>
          <button onClick={() => router.push('/home')} className="w-full btn-ghost text-sm justify-center mt-2">
            Continue without sign in
          </button>
        </div>
      </div>
    </div>
  );
}
