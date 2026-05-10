'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/lib/store';
import api from '@/lib/api';
import { Eye, EyeOff, ArrowRight, Shield, Zap, BarChart3, Users } from 'lucide-react';

/* ── Floating particle ─────────────────────────────────────── */
function Particle({ x, y, size, duration, delay, symbol }: {
  x: number; y: number; size: number; duration: number; delay: number; symbol: string;
}) {
  return (
    <div
      className="absolute select-none pointer-events-none animate-float"
      style={{
        left: `${x}%`, top: `${y}%`,
        fontSize: size,
        opacity: 0.08,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        color: '#FF6B2B',
        fontFamily: 'serif',
        filter: 'blur(0.5px)',
      }}
    >
      {symbol}
    </div>
  );
}

const PARTICLES = [
  { x: 8,  y: 12, size: 28, duration: 7,  delay: 0,   symbol: 'ॐ' },
  { x: 85, y: 8,  size: 18, duration: 9,  delay: 1.5, symbol: '卐' },
  { x: 20, y: 75, size: 22, duration: 8,  delay: 0.8, symbol: '🔱' },
  { x: 90, y: 65, size: 16, duration: 11, delay: 2.2, symbol: 'ॐ' },
  { x: 50, y: 88, size: 14, duration: 10, delay: 3,   symbol: '✦' },
  { x: 5,  y: 45, size: 12, duration: 12, delay: 1,   symbol: '✦' },
  { x: 75, y: 30, size: 20, duration: 7,  delay: 2.5, symbol: '卐' },
  { x: 38, y: 18, size: 10, duration: 13, delay: 0.5, symbol: '✦' },
];

const FEATURES = [
  { icon: Zap,      label: 'AI Verse Generation', desc: 'Gemini & OpenAI powered' },
  { icon: Users,    label: 'User Management',      desc: 'Moderate & analyze' },
  { icon: BarChart3,label: 'Live Analytics',       desc: 'Real-time insights' },
  { icon: Shield,   label: 'Secure Platform',      desc: 'JWT + HttpOnly cookies' },
];

const STATS = [
  { value: '18K+',  label: 'Sacred Verses' },
  { value: '∞',     label: 'Sampradayas' },
  { value: '1M+',   label: 'Devotees' },
];

/* ── Meteors ────────────────────────────────────────────── */
function Meteor({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute h-px"
      style={{
        ...style,
        background: 'linear-gradient(90deg, transparent, rgba(255,107,43,0.6), transparent)',
        boxShadow: '0 0 4px rgba(255,107,43,0.4)',
      }}
    />
  );
}

export default function LoginPage() {
  const router   = useRouter();
  const setAdmin = useAdminStore((state) => state.setAdmin);
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [mounted,      setMounted]      = useState(false);
  const [activeFeature,setActiveFeature]= useState(0);

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setActiveFeature(f => (f + 1) % FEATURES.length), 3000);
    return () => clearInterval(t);
  }, []);

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
    <div className="min-h-screen flex overflow-hidden" style={{ background: '#080609' }}>

      {/* ── LEFT PANEL ───────────────────────────────────── */}
      <div className="hidden lg:flex w-[52%] relative flex-col justify-between p-14 overflow-hidden">

        {/* Deep background */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 30% 50%, rgba(139,62,186,0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(255,107,43,0.1) 0%, transparent 50%), #080609',
        }} />

        {/* Grid lines */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        {/* Glow orbs */}
        <div className="orb w-96 h-96 -top-20 -left-20 animate-pulse-glow"
          style={{ background: 'radial-gradient(circle, rgba(139,62,186,0.18) 0%, transparent 70%)' }} />
        <div className="orb w-80 h-80 bottom-0 right-0 animate-float-slow"
          style={{ background: 'radial-gradient(circle, rgba(255,107,43,0.12) 0%, transparent 70%)' }} />
        <div className="orb w-64 h-64 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ background: 'radial-gradient(circle, rgba(245,200,66,0.06) 0%, transparent 70%)' }} />

        {/* Sacred geometry rings */}
        <div className="absolute top-1/2 left-[38%] -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] sacred-ring opacity-40" />
        <div className="absolute top-1/2 left-[38%] -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sacred-ring-reverse opacity-30" />
        <div className="absolute top-1/2 left-[38%] -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] sacred-ring opacity-50" />

        {/* Floating Sanskrit symbols */}
        {mounted && PARTICLES.map((p, i) => <Particle key={i} {...p} />)}

        {/* Meteors */}
        {mounted && [
          { top: '20%', left: '10%', width: '80px', transform: 'rotate(-35deg)', animationDelay: '0s', animationDuration: '4s' },
          { top: '50%', left: '60%', width: '60px', transform: 'rotate(-35deg)', animationDelay: '2s', animationDuration: '5s' },
          { top: '70%', left: '20%', width: '100px', transform: 'rotate(-35deg)', animationDelay: '1s', animationDuration: '6s' },
        ].map((m, i) => <Meteor key={i} style={{ ...m, position: 'absolute' }} />)}

        {/* Logo */}
        <div className={`relative z-10 flex items-center gap-3 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <div className="relative w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #FF6B2B, #F5C842)', boxShadow: '0 4px 20px rgba(255,107,43,0.4)' }}>
            <span className="text-[#0D0A0E] font-black text-xl" style={{ fontFamily: 'serif' }}>ॐ</span>
          </div>
          <div>
            <p className="font-bold text-white text-base leading-tight tracking-wide">HariHariBol</p>
            <p className="text-[11px] font-medium tracking-[0.15em] uppercase" style={{ color: '#9B8FA8' }}>Admin Console</p>
          </div>
        </div>

        {/* Center hero */}
        <div className="relative z-10">
          {/* Om symbol */}
          <div
            className={`text-[140px] leading-none font-black mb-6 transition-all duration-1000 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
            style={{
              fontFamily: 'serif',
              background: 'linear-gradient(135deg, #FF6B2B 0%, #F5C842 60%, #ffffff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 40px rgba(255,107,43,0.3))',
            }}
          >
            ॐ
          </div>

          <h1 className={`text-5xl font-black leading-[1.1] mb-4 text-white transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            Manage the<br />
            <span style={{
              background: 'linear-gradient(135deg, #FF6B2B 0%, #F5C842 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Spiritual Universe
            </span>
          </h1>
          <p className={`text-base leading-relaxed max-w-sm transition-all duration-700 delay-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
            style={{ color: '#9B8FA8' }}>
            AI-powered content platform. Govern ancient wisdom with modern intelligence.
          </p>

          {/* Live feature ticker */}
          <div className={`mt-8 transition-all duration-700 delay-400 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 py-3 border-b transition-all duration-500"
                  style={{
                    borderColor: i === activeFeature ? 'rgba(255,107,43,0.3)' : 'rgba(255,255,255,0.04)',
                    opacity: i === activeFeature ? 1 : 0.3,
                    transform: i === activeFeature ? 'translateX(6px)' : 'translateX(0)',
                  }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: i === activeFeature ? 'rgba(255,107,43,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${i === activeFeature ? 'rgba(255,107,43,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                    <Icon size={14} style={{ color: i === activeFeature ? '#FF6B2B' : '#9B8FA8' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{f.label}</p>
                    <p className="text-xs" style={{ color: '#9B8FA8' }}>{f.desc}</p>
                  </div>
                  {i === activeFeature && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse-glow"
                      style={{ background: '#FF6B2B', boxShadow: '0 0 8px #FF6B2B' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats row */}
        <div className={`relative z-10 flex gap-8 transition-all duration-700 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-black" style={{
                background: 'linear-gradient(135deg, #FF6B2B, #F5C842)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>{value}</p>
              <p className="text-xs font-medium mt-0.5 uppercase tracking-wider" style={{ color: '#9B8FA8' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative" style={{ background: '#0D0A0E' }}>

        {/* Subtle top border glow */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,107,43,0.4), transparent)' }} />

        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="orb w-72 h-72 top-1/4 left-1/2 -translate-x-1/2"
            style={{ background: 'radial-gradient(circle, rgba(255,107,43,0.06) 0%, transparent 70%)' }} />
        </div>

        <div className={`w-full max-w-md relative z-10 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, #FF6B2B, #F5C842)', boxShadow: '0 8px 30px rgba(255,107,43,0.4)' }}>
              <span className="text-[#0D0A0E] text-3xl font-black" style={{ fontFamily: 'serif' }}>ॐ</span>
            </div>
            <h1 className="text-2xl font-bold text-white">HariHariBol</h1>
            <p className="text-sm mt-1" style={{ color: '#9B8FA8' }}>Admin Console</p>
          </div>

          {/* Card */}
          <div className="rounded-3xl p-8" style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 25px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
          }}>

            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5"
                style={{
                  background: 'rgba(255,107,43,0.1)',
                  border: '1px solid rgba(255,107,43,0.25)',
                  color: '#FF6B2B',
                }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#FF6B2B' }} />
                Secure Admin Access
              </div>
              <h2 className="text-3xl font-black text-white mb-1.5">Welcome back</h2>
              <p className="text-sm" style={{ color: '#9B8FA8' }}>Sign in to your admin console</p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 flex items-start gap-3 p-4 rounded-xl text-sm"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: '#f87171',
                }}>
                <span className="mt-0.5 flex-shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-white">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="admin@hariharibol.com"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-white">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field pr-11"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200"
                    style={{ color: '#9B8FA8' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#FF6B2B')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#9B8FA8')}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-base transition-all duration-300 flex items-center justify-center gap-2"
                style={{
                  background: loading
                    ? 'rgba(255,107,43,0.4)'
                    : 'linear-gradient(135deg, #FF6B2B 0%, #F5C842 100%)',
                  color: '#0D0A0E',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(255,107,43,0.4)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={e => {
                  if (!loading) (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 30px rgba(255,107,43,0.6)';
                }}
                onMouseLeave={e => {
                  if (!loading) (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(255,107,43,0.4)';
                }}
              >
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

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#9B8FA8' }}>
                Protected
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* Feature pills */}
            <div className="grid grid-cols-2 gap-2">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#9B8FA8' }}>
                  <Icon size={11} style={{ color: '#FF6B2B' }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: 'rgba(155,143,168,0.5)' }}>
            © 2026 HariHariBol · Eternal wisdom, modern governance
          </p>
        </div>
      </div>
    </div>
  );
}
