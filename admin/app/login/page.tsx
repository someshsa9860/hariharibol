'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/lib/store';
import api from '@/lib/api';
import { Eye, EyeOff, ArrowRight, Mail, Lock, AlertCircle, Shield } from 'lucide-react';

export default function LoginPage() {
  const router   = useRouter();
  const setAdmin = useAdminStore((state) => state.setAdmin);
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [mounted,      setMounted]      = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/admin/login', { email, password });
      if (res.data.user) {
        setAdmin({ id: res.data.user.id, email: res.data.user.email });
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #3D0000 0%, #6B0000 20%, #8B1A1A 40%, #C0392B 65%, #E8521A 82%, #FF6B2B 100%)' }}>

      {/* Background glow orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{ background: 'radial-gradient(circle, rgba(139,26,26,0.6) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full translate-x-1/3 translate-y-1/3"
          style={{ background: 'radial-gradient(circle, rgba(255,107,43,0.35) 0%, transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{ background: 'radial-gradient(circle, rgba(245,200,66,0.06) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      {/* Floating Sanskrit symbols */}
      {mounted && [
        { s: 'ॐ', x: 8,  y: 12, size: 36, dur: 7,  del: 0 },
        { s: 'ॐ', x: 88, y: 8,  size: 22, dur: 9,  del: 1.5 },
        { s: '✦', x: 15, y: 78, size: 16, dur: 11, del: 0.8 },
        { s: 'ॐ', x: 92, y: 70, size: 20, dur: 8,  del: 2.2 },
        { s: '✦', x: 50, y: 90, size: 12, dur: 10, del: 3 },
        { s: '✦', x: 5,  y: 50, size: 10, dur: 13, del: 1 },
      ].map((p, i) => (
        <div key={i} className="absolute select-none pointer-events-none animate-float"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            fontSize: p.size, opacity: 0.12, color: '#fff',
            fontFamily: 'serif',
            animationDelay: `${p.del}s`,
            animationDuration: `${p.dur}s`,
          }}>
          {p.s}
        </div>
      ))}

      {/* Card */}
      <div className={`relative z-10 w-full max-w-md transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="rounded-3xl p-8"
          style={{
            background: 'rgba(13, 10, 14, 0.88)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
            backdropFilter: 'blur(28px)',
          }}>

          {/* Om Logo + Heading */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: 'linear-gradient(135deg, #FF6B2B 0%, #F5C842 100%)',
                boxShadow: '0 8px 32px rgba(255,107,43,0.55)',
              }}>
              <span className="text-[#0D0A0E] text-3xl font-black" style={{ fontFamily: 'serif' }}>ॐ</span>
            </div>
            <h1 className="text-2xl font-black text-white mb-1"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Admin Portal
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>HariHariBol · Secure Access</p>
          </div>

          {/* Secure badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(255,107,43,0.1)',
                border: '1px solid rgba(255,107,43,0.25)',
                color: '#FF6B2B',
              }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#FF6B2B' }} />
              <Shield size={11} />
              Secure Admin Access
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-3 p-4 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                style={{ color: 'rgba(255,255,255,0.5)' }}>
                Email Address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'rgba(255,255,255,0.28)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field pl-11"
                  placeholder="admin@hariharibol.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider"
                style={{ color: 'rgba(255,255,255,0.5)' }}>
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'rgba(255,255,255,0.28)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field pl-11 pr-12"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors duration-200"
                  style={{ color: 'rgba(255,255,255,0.28)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#FF6B2B')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.28)')}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Sign In button — saffron */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-base transition-all duration-300 flex items-center justify-center gap-2 mt-2"
              style={{
                background: loading
                  ? 'rgba(255,107,43,0.35)'
                  : 'linear-gradient(135deg, #FF6B2B 0%, #FF9933 100%)',
                color: loading ? 'rgba(255,255,255,0.5)' : '#fff',
                boxShadow: loading ? 'none' : '0 4px 22px rgba(255,107,43,0.55)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => {
                if (!loading) (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 32px rgba(255,107,43,0.75)';
              }}
              onMouseLeave={e => {
                if (!loading) (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 22px rgba(255,107,43,0.55)';
              }}>
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Authenticating...
                </>
              ) : (
                <>Sign In <ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
            © 2026 HariHariBol · Eternal wisdom, modern governance
          </p>
        </div>
      </div>
    </div>
  );
}
