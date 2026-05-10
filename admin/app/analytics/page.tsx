'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { TrendingUp, Users, Heart, Share2, BarChart3, Zap, Globe2 } from 'lucide-react';

interface AnalyticsMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalVerses: number;
  totalSampradayas: number;
  totalFollows: number;
  totalFavorites: number;
  averageSessionDuration: number;
}
interface EngagementData {
  totalSessions: number;
  totalFavorites: number;
  totalFollows: number;
  averageFavoritesPerUser: number;
  averageFollowsPerUser: number;
}
interface GrowthDataPoint { date: string; users: number; }

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton rounded-2xl ${className}`} />;
}

const PERIODS = [
  { key: 'day',   label: 'Today' },
  { key: 'week',  label: '7 Days' },
  { key: 'month', label: '30 Days' },
] as const;

export default function AnalyticsPage() {
  const [metrics,    setMetrics]    = useState<AnalyticsMetrics | null>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [growthData, setGrowthData] = useState<GrowthDataPoint[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [period,     setPeriod]     = useState<'day' | 'week' | 'month'>('month');

  useEffect(() => { fetchAnalytics(); }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
      const [m, e, g] = await Promise.all([
        api.get(`/admin/analytics/metrics?period=${period}`),
        api.get('/admin/analytics/engagement'),
        api.get(`/admin/analytics/user-growth?days=${days}`),
      ]);
      setMetrics(m.data);
      setEngagement(e.data);
      setGrowthData(g.data?.data || []);
    } catch { } finally { setLoading(false); }
  };

  const statCards = metrics ? [
    { icon: Users,      label: 'Total Users',   value: metrics.totalUsers,    sub: `${metrics.newUsersToday} new today`, color: '#60a5fa', glow: 'rgba(96,165,250,0.15)' },
    { icon: TrendingUp, label: 'Active Users',  value: metrics.activeUsers,   sub: `Last ${period}`,                    color: '#a78bfa', glow: 'rgba(167,139,250,0.15)' },
    { icon: Heart,      label: 'Favorites',     value: metrics.totalFavorites,sub: `${engagement?.averageFavoritesPerUser || 0} per user`, color: '#f87171', glow: 'rgba(248,113,113,0.15)' },
    { icon: Share2,     label: 'Total Follows', value: metrics.totalFollows,  sub: `${engagement?.averageFollowsPerUser || 0} per user`,   color: '#fbbf24', glow: 'rgba(251,191,36,0.15)' },
  ] : [];

  const maxGrowth = Math.max(...growthData.map(d => d.users), 1);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        {/* Header */}
        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <BarChart3 size={15} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Analytics</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Platform performance overview</p>
            </div>
          </div>

          {/* Period tabs */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-2)' }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                style={{
                  background: period === p.key ? 'rgba(167,139,250,0.15)' : 'transparent',
                  border: period === p.key ? '1px solid rgba(167,139,250,0.3)' : '1px solid transparent',
                  color: period === p.key ? '#a78bfa' : 'var(--muted)',
                }}>
                {p.label}
              </button>
            ))}
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-6">

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {loading
              ? [1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)
              : statCards.map(({ icon: Icon, label, value, sub, color, glow }, i) => (
                <div key={label}
                  className="rounded-2xl p-5 transition-all duration-300 animate-slide-up"
                  style={{
                    animationDelay: `${i * 80}ms`,
                    background: 'var(--surface)',
                    border: '1px solid var(--surface-2)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${color}30`;
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${glow}`;
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--surface-2)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    (e.currentTarget as HTMLElement).style.transform = 'none';
                  }}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${color}18`, border: `1px solid ${color}25` }}>
                      <Icon size={18} style={{ color }} />
                    </div>
                  </div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
                  <p className="text-3xl font-black text-theme">{(value || 0).toLocaleString()}</p>
                  <p className="text-xs mt-1" style={{ color: `${color}BB` }}>{sub}</p>
                </div>
              ))
            }
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Growth chart */}
            <div className="lg:col-span-2 rounded-2xl p-6 animate-slide-up"
              style={{ animationDelay: '350ms', background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp size={15} style={{ color: '#a78bfa' }} />
                <h3 className="font-bold text-theme text-sm">User Growth</h3>
                <span className="text-xs ml-1" style={{ color: 'var(--muted)' }}>— last {growthData.length} data points</span>
              </div>
              {loading ? (
                <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-6" />)}</div>
              ) : growthData.length === 0 ? (
                <div className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>No growth data yet</div>
              ) : (
                <div className="space-y-3">
                  {growthData.slice(-10).map((point, i) => (
                    <div key={point.date} className="flex items-center gap-4">
                      <span className="text-xs w-20 flex-shrink-0 text-right" style={{ color: 'var(--muted)' }}>
                        {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--border)' }}>
                        <div className="h-2 rounded-full transition-all duration-700"
                          style={{
                            width: `${(point.users / maxGrowth) * 100}%`,
                            background: 'linear-gradient(90deg, #a78bfa, var(--accent))',
                            animationDelay: `${400 + i * 50}ms`,
                          }} />
                      </div>
                      <span className="text-xs font-semibold w-10 text-right text-theme">{point.users}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Content stats */}
            <div className="space-y-4 animate-slide-up" style={{ animationDelay: '450ms' }}>
              {[
                { label: 'Sacred Verses',    value: metrics?.totalVerses,       color: '#fbbf24', icon: Zap },
                { label: 'Sampradayas',      value: metrics?.totalSampradayas,  color: '#4ade80', icon: Globe2 },
                { label: 'Engagement Rate',  value: metrics?.totalFavorites && metrics?.totalUsers
                    ? `${((metrics.totalFavorites / metrics.totalUsers) * 100).toFixed(1)}%`
                    : '0%',                                                      color: '#f87171', icon: Heart },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="rounded-2xl p-5 flex items-center gap-4"
                  style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}18`, border: `1px solid ${color}25` }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{label}</p>
                    {loading
                      ? <div className="skeleton h-7 w-16 mt-1" />
                      : <p className="text-2xl font-black mt-0.5" style={{ color }}>{typeof value === 'number' ? value.toLocaleString() : value}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Engagement table */}
          <div className="rounded-2xl overflow-hidden animate-slide-up"
            style={{ animationDelay: '550ms', background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            <div className="px-6 py-4 flex items-center gap-2"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <BarChart3 size={14} style={{ color: '#a78bfa' }} />
              <h3 className="font-bold text-theme text-sm">Engagement Breakdown</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-0">
              {[
                { label: 'Total Sessions',     value: engagement?.totalSessions,            color: '#60a5fa' },
                { label: 'Total Favorites',    value: engagement?.totalFavorites,            color: '#f87171' },
                { label: 'Total Follows',      value: engagement?.totalFollows,              color: '#fbbf24' },
                { label: 'Avg Fav / User',     value: engagement?.averageFavoritesPerUser,   color: '#a78bfa' },
                { label: 'Avg Follow / User',  value: engagement?.averageFollowsPerUser,     color: '#4ade80' },
              ].map(({ label, value, color }, i, arr) => (
                <div key={label} className="p-5 text-center"
                  style={{ borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>{label}</p>
                  {loading
                    ? <div className="skeleton h-8 w-12 mx-auto" />
                    : <p className="text-2xl font-black" style={{ color }}>{(value || 0).toLocaleString()}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
