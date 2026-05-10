'use client';

import { useEffect, useState, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import {
  Users, Zap, AlertCircle, TrendingUp,
  ArrowUpRight, Sparkles, Globe2, RefreshCw, Activity, BookOpen,
} from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalSampradayas: number;
  totalVerses: number;
  bannedUsers: number;
  recentUsers: Array<{ id: string; email: string; createdAt: string; isBanned: boolean; }>;
}

function AnimatedNumber({ value, delay = 0 }: { value: number; delay?: number }) {
  const [displayed, setDisplayed] = useState(0);
  const start = useRef<number>(0);
  useEffect(() => {
    const t = setTimeout(() => {
      const step = () => {
        const p = Math.min((Date.now() - start.current) / 1200, 1);
        setDisplayed(Math.round((1 - Math.pow(1 - p, 3)) * value));
        if (p < 1) requestAnimationFrame(step);
      };
      start.current = Date.now();
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return <>{displayed.toLocaleString()}</>;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function StatCard({ label, value, icon: Icon, trend, trendUp, delay, iconColor }: {
  label: string; value: number; icon: any; trend: string;
  trendUp: boolean; delay: number; iconColor: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="rounded-2xl p-5 transition-all duration-300 animate-slide-up relative overflow-hidden cursor-default"
      style={{
        animationDelay: `${delay}ms`,
        background: hov ? 'var(--surface-2)' : 'var(--surface)',
        border: hov
          ? `1px solid color-mix(in srgb, ${iconColor} 35%, transparent)`
          : '1px solid var(--border)',
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? `0 8px 28px color-mix(in srgb, ${iconColor} 18%, transparent)` : 'none',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full pointer-events-none transition-opacity duration-300"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${iconColor} 20%, transparent) 0%, transparent 70%)`, opacity: hov ? 1 : 0.4 }} />

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
          <p className="text-4xl font-black" style={{ color: 'var(--text)' }}>
            <AnimatedNumber value={value} delay={delay + 200} />
          </p>
          <div className="flex items-center gap-1 mt-2 text-xs font-semibold"
            style={{ color: trendUp ? '#4ade80' : '#f87171' }}>
            <TrendingUp size={11} style={{ transform: trendUp ? 'none' : 'scaleY(-1)' }} />
            <span>{trend} this month</span>
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300"
          style={{
            background: `color-mix(in srgb, ${iconColor} 15%, transparent)`,
            border: `1px solid color-mix(in srgb, ${iconColor} 25%, transparent)`,
            boxShadow: hov ? `0 0 16px color-mix(in srgb, ${iconColor} 30%, transparent)` : 'none',
          }}>
          <Icon size={19} style={{ color: iconColor }} />
        </div>
      </div>

      <div className="mt-4 progress-bar">
        <div className="progress-fill" style={{
          width: hov ? '100%' : '60%',
          background: `linear-gradient(90deg, ${iconColor}, color-mix(in srgb, ${iconColor} 60%, transparent))`,
        }} />
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, desc, href }: {
  icon: any; label: string; desc: string; href: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <a href={href} className="flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200"
      style={{
        background: hov ? 'var(--surface-2)' : 'var(--surface)',
        border: hov ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' : '1px solid var(--border)',
        textDecoration: 'none',
        transform: hov ? 'translateX(3px)' : 'none',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
        }}>
        <Icon size={15} style={{ color: 'var(--accent)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</p>
        <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{desc}</p>
      </div>
      <ArrowUpRight size={14} style={{ color: hov ? 'var(--accent)' : 'var(--muted)', transition: 'color 0.2s' }} />
    </a>
  );
}

export default function DashboardPage() {
  const [stats,      setStats]      = useState<DashboardStats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [mounted,    setMounted]    = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const r = await api.get('/admin/dashboard');
      setStats(r.data); setError('');
    } catch { setError('Failed to load dashboard data'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { setMounted(true); fetchData(); }, []);

  const statCards = stats ? [
    { label: 'Total Users',   value: stats.totalUsers,       icon: Users,       iconColor: '#60a5fa', trend: '+12%', trendUp: true,  delay: 0 },
    { label: 'Sampradayas',   value: stats.totalSampradayas, icon: Globe2,      iconColor: '#4ade80', trend: '+3%',  trendUp: true,  delay: 100 },
    { label: 'Sacred Verses', value: stats.totalVerses,      icon: Sparkles,    iconColor: '#fbbf24', trend: '+8%',  trendUp: true,  delay: 200 },
    { label: 'Banned Users',  value: stats.bannedUsers,      icon: AlertCircle, iconColor: '#f87171', trend: '-2%',  trendUp: false, delay: 300 },
  ] : [];

  const now = new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        {/* Header */}
        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className={`transition-all duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
            <h1 className="text-xl font-black" style={{ color: 'var(--text)' }}>Dashboard</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{now}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>
              <Activity size={11} className="animate-pulse" /> Live
            </div>
            <button onClick={() => fetchData(true)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}>
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-6">

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {loading
              ? [1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)
              : statCards.map(c => <StatCard key={c.label} {...c} />)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Recent users */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden animate-slide-up"
              style={{ animationDelay: '400ms', background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="px-6 py-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2.5">
                  <Users size={15} style={{ color: '#60a5fa' }} />
                  <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>Recent Users</span>
                  {stats?.recentUsers?.length ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                      {stats.recentUsers.length}
                    </span>
                  ) : null}
                </div>
                <a href="/users" className="text-xs font-semibold flex items-center gap-1 transition-colors duration-200"
                  style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                  View all <ArrowUpRight size={12} />
                </a>
              </div>

              {loading ? (
                <div className="p-5 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}</div>
              ) : error ? (
                <div className="p-10 flex flex-col items-center gap-3">
                  <AlertCircle size={24} style={{ color: '#f87171' }} />
                  <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
                  <button onClick={() => fetchData()} className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Retry</button>
                </div>
              ) : !stats?.recentUsers?.length ? (
                <div className="p-10 text-center text-sm" style={{ color: 'var(--muted)' }}>No users yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th className="table-header">User</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentUsers.map(user => (
                        <tr key={user.id} className="table-row">
                          <td className="table-cell">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{
                                  background: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                                  border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                                  color: 'var(--accent)',
                                }}>
                                {user.email[0].toUpperCase()}
                              </div>
                              <span className="font-medium text-sm" style={{ color: 'var(--text)' }}>{user.email}</span>
                            </div>
                          </td>
                          <td className="table-cell">
                            <span className={user.isBanned ? 'badge badge-red' : 'badge badge-green'}>
                              {user.isBanned ? '⛔ Banned' : '✓ Active'}
                            </span>
                          </td>
                          <td className="table-cell text-sm" style={{ color: 'var(--muted)' }}>
                            {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="animate-slide-up" style={{ animationDelay: '500ms' }}>
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="px-5 py-4 flex items-center gap-2.5"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <Zap size={15} style={{ color: '#fbbf24' }} />
                  <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>Quick Actions</span>
                </div>
                <div className="p-3 space-y-1.5">
                  <QuickAction icon={Sparkles} href="/verse-of-day" label="Generate Verse"  desc="AI-powered daily verse" />
                  <QuickAction icon={Users}    href="/users"        label="Manage Users"    desc="View & moderate" />
                  <QuickAction icon={BookOpen} href="/sampradayas"  label="Sampradayas"     desc="Manage traditions" />
                </div>

                {/* Mantra card */}
                <div className="mx-3 mb-3 mt-1 rounded-xl p-4"
                  style={{
                    background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
                  }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--accent)' }}>
                    Today's Wisdom
                  </p>
                  <p className="text-sm font-medium leading-relaxed gradient-text" style={{ fontFamily: 'serif' }}>
                    सर्वे भवन्तु सुखिनः
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>May all beings be happy</p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center pb-2">
            <p className="text-xs" style={{ color: 'var(--muted)', opacity: 0.4 }}>ॐ · HariHariBol Admin · 2026</p>
          </div>
        </div>
      </main>
    </div>
  );
}
