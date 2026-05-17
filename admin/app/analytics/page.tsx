'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import {
  BarChart3, TrendingUp, Users, Music, BookOpen,
  Flame, Activity, AlertCircle, Download, Globe2, Clock,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

interface AnalyticsMetrics {
  dau: number;
  mau: number;
  totalChants: number;
  topVerse: string;
  totalUsers: number;
  newUsersToday: number;
  totalVerses: number;
  totalSampradayas: number;
  totalFavorites: number;
  totalFollows: number;
  averageSessionDuration: number;
}
interface DauPoint       { date: string; dau: number }
interface VerseBar       { name: string; views: number }
interface SampradBar     { name: string; followers: number }
interface ChantBar       { date: string; chants: number }
interface MantraRow      { name: string; chantCount: number }
interface FeatureAdoption { feature: string; pct: number }
interface LangDist       { name: string; value: number }

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(secs: number): string {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
      <p className="font-semibold mb-1 text-theme">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={p.name ?? i} style={{ color: p.color ?? p.fill }}>{p.name}: <strong>{p.value?.toLocaleString()}</strong></p>
      ))}
    </div>
  );
}

const PIE_COLORS = ['#C75A1A', '#f97316', '#fbbf24', '#4ade80', '#60a5fa', '#a78bfa', '#f87171', '#fb923c'];

const TABS = ['Engagement', 'Content', 'Chanting'] as const;
type Tab = typeof TABS[number];

const PERIODS = [
  { key: '7d',  label: '7d',  apiVal: 'week'    },
  { key: '30d', label: '30d', apiVal: 'month'   },
  { key: '90d', label: '90d', apiVal: 'quarter' },
] as const;
type Period = '7d' | '30d' | '90d';

export default function AnalyticsPage() {
  const [metrics,  setMetrics]  = useState<AnalyticsMetrics | null>(null);
  const [dauData,  setDauData]  = useState<DauPoint[]>([]);
  const [verses,   setVerses]   = useState<VerseBar[]>([]);
  const [samp,     setSamp]     = useState<SampradBar[]>([]);
  const [chants,   setChants]   = useState<ChantBar[]>([]);
  const [mantras,  setMantras]  = useState<MantraRow[]>([]);
  const [features, setFeatures] = useState<FeatureAdoption[]>([]);
  const [langDist, setLangDist] = useState<LangDist[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [period,   setPeriod]   = useState<Period>('30d');
  const [tab,      setTab]      = useState<Tab>('Engagement');

  useEffect(() => { fetchAll(); }, [period]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    const apiVal = PERIODS.find(p => p.key === period)?.apiVal ?? 'month';
    try {
      const [m, d, v, s, c, mt, fa, ld] = await Promise.all([
        api.get(`/admin/analytics/metrics?period=${apiVal}`),
        api.get('/admin/analytics/dau?days=30'),
        api.get('/admin/analytics/top-verses'),
        api.get('/admin/analytics/top-sampradayas'),
        api.get('/admin/analytics/chants?days=14'),
        api.get('/admin/analytics/top-mantras'),
        api.get('/admin/analytics/feature-adoption').catch(() => ({ data: null })),
        api.get('/admin/analytics/language-distribution').catch(() => ({ data: null })),
      ]);

      setMetrics(m.data as AnalyticsMetrics);
      setDauData((d.data?.data ?? []).map((p: any) => ({ date: fmtDate(p.date), dau: p.dau })));
      setVerses(v.data?.data ?? []);
      setSamp(s.data?.data ?? []);
      setChants((c.data?.data ?? []).map((p: any) => ({ date: fmtDate(p.date), chants: p.chants })));
      setMantras(mt.data?.data ?? []);
      setFeatures(fa.data?.data ?? []);
      setLangDist(ld.data?.data ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!metrics) return;
    const rows: (string | number)[][] = [
      ['Metric', 'Value'],
      ['DAU', metrics.dau],
      ['MAU', metrics.mau],
      ['Total Sessions', metrics.totalChants],
      ['Avg Session Duration (s)', metrics.averageSessionDuration],
      ['Total Users', metrics.totalUsers],
      ['New Users Today', metrics.newUsersToday],
      ['Total Verses', metrics.totalVerses],
      ['Total Sampradayas', metrics.totalSampradayas],
      ['Total Favorites', metrics.totalFavorites],
      ['Total Follows', metrics.totalFollows],
      [],
      ['Top Verses', ''],
      ['Name', 'Views'],
      ...verses.map(v => [v.name, v.views]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const statCards = metrics ? [
    { icon: Activity,  label: 'DAU',            value: metrics.dau,                                    sub: 'Daily active users',    color: '#60a5fa', glow: 'rgba(96,165,250,0.15)' },
    { icon: Users,     label: 'MAU',            value: metrics.mau,                                    sub: 'Monthly active users',  color: '#a78bfa', glow: 'rgba(167,139,250,0.15)' },
    { icon: BarChart3, label: 'Total Sessions', value: metrics.totalChants,                            sub: 'All-time app sessions', color: '#fb923c', glow: 'rgba(251,146,60,0.15)' },
    { icon: Clock,     label: 'Avg Session',    value: formatDuration(metrics.averageSessionDuration), sub: 'Average session length', color: '#4ade80', glow: 'rgba(74,222,128,0.15)', isStr: true },
  ] : [];

  if (error && !loading) {
    return (
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <header className="px-8 py-4 flex items-center gap-3 sticky top-0 z-10"
            style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}>
              <BarChart3 size={15} style={{ color: '#a78bfa' }} />
            </div>
            <h1 className="text-xl font-black text-theme">Analytics</h1>
          </header>
          <div className="p-8 flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
            <div className="flex flex-col items-center gap-4 p-8 rounded-2xl max-w-md w-full"
              style={{ background: 'var(--surface)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertCircle size={40} style={{ color: '#f87171' }} />
              <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>{error}</p>
              <button onClick={fetchAll}
                className="px-5 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}>
                Retry
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

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
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Platform performance &amp; engagement</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportCSV}
              disabled={!metrics || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-40"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}>
              <Download size={12} /> Export CSV
            </button>
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
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-6">

          {/* KPI cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {loading
              ? [1, 2, 3, 4].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)
              : statCards.map(({ icon: Icon, label, value, sub, color, glow, isStr }, i) => (
                <div key={label}
                  className="rounded-2xl p-5 transition-all duration-300 animate-slide-up"
                  style={{ animationDelay: `${i * 80}ms`, background: 'var(--surface)', border: '1px solid var(--surface-2)' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = `${color}35`;
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px ${glow}`;
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--surface-2)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    (e.currentTarget as HTMLElement).style.transform = 'none';
                  }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${color}18`, border: `1px solid ${color}25` }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted)' }}>{label}</p>
                  <p className="text-2xl font-black text-theme">{isStr ? value : (value as number)?.toLocaleString()}</p>
                  <p className="text-xs mt-1" style={{ color: `${color}BB` }}>{sub}</p>
                </div>
              ))}
          </div>

          {/* Tab bar */}
          <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
                style={{
                  background: tab === t ? 'rgba(167,139,250,0.12)' : 'transparent',
                  border: tab === t ? '1px solid rgba(167,139,250,0.25)' : '1px solid transparent',
                  color: tab === t ? '#a78bfa' : 'var(--muted)',
                }}>
                {t}
              </button>
            ))}
          </div>

          {/* Engagement tab */}
          {tab === 'Engagement' && (
            <div className="rounded-2xl p-6 animate-slide-up"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp size={14} style={{ color: '#60a5fa' }} />
                <h3 className="font-bold text-theme text-sm">Daily Active Users — Last 30 Days</h3>
              </div>
              {loading
                ? <div className="skeleton h-64 rounded-xl" />
                : dauData.length === 0
                  ? <p className="text-sm text-center py-16" style={{ color: 'var(--muted)' }}>No activity data available yet.</p>
                  : (
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={dauData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                        <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                        <Tooltip content={<ChartTip />} />
                        <Line type="monotone" dataKey="dau" name="DAU" stroke="#60a5fa" strokeWidth={2.5}
                          dot={false} activeDot={{ r: 5, fill: '#60a5fa' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
            </div>
          )}

          {/* Content tab */}
          {tab === 'Content' && (
            <div className="space-y-6 animate-slide-up">

              {/* Top Verses table */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <BookOpen size={14} style={{ color: '#fbbf24' }} />
                  <h3 className="font-bold text-theme text-sm">Top Verses by Views</h3>
                </div>
                {loading
                  ? <div className="p-5"><div className="skeleton h-40 rounded-xl" /></div>
                  : verses.length === 0
                    ? <p className="text-sm text-center py-12" style={{ color: 'var(--muted)' }}>No verse data available yet.</p>
                    : (
                      <table className="w-full border-collapse">
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            {['#', 'Verse', 'Views'].map(h => (
                              <th key={h} className="px-5 py-3 text-left"
                                style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {verses.map((v, i) => (
                            <tr key={v.name} className="transition-colors duration-150"
                              style={{ borderBottom: i < verses.length - 1 ? '1px solid var(--border)' : 'none' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                              <td className="px-5 py-4">
                                <span className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-xs font-bold"
                                  style={{
                                    background: i === 0 ? 'rgba(199,90,26,0.2)' : i === 1 ? 'rgba(199,90,26,0.12)' : 'rgba(199,90,26,0.07)',
                                    color: '#C75A1A',
                                    border: i < 3 ? '1px solid rgba(199,90,26,0.25)' : '1px solid transparent',
                                  }}>
                                  {i + 1}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-sm font-semibold text-theme">{v.name}</td>
                              <td className="px-5 py-4 text-sm font-bold" style={{ color: '#fbbf24' }}>{v.views?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
              </div>

              {/* Feature Adoption + Language Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                  <div className="flex items-center gap-2 mb-6">
                    <Activity size={14} style={{ color: '#a78bfa' }} />
                    <h3 className="font-bold text-theme text-sm">Feature Adoption</h3>
                  </div>
                  {loading
                    ? <div className="skeleton h-52 rounded-xl" />
                    : features.length === 0
                      ? <p className="text-sm text-center py-16" style={{ color: 'var(--muted)' }}>No adoption data available.</p>
                      : (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={features} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="feature" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} width={38} unit="%" />
                            <Tooltip content={<ChartTip />} />
                            <Bar dataKey="pct" name="Adoption %" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                </div>

                <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                  <div className="flex items-center gap-2 mb-6">
                    <Globe2 size={14} style={{ color: '#60a5fa' }} />
                    <h3 className="font-bold text-theme text-sm">Language Distribution</h3>
                  </div>
                  {loading
                    ? <div className="skeleton h-52 rounded-xl" />
                    : langDist.length === 0
                      ? <p className="text-sm text-center py-16" style={{ color: 'var(--muted)' }}>No language data available.</p>
                      : (
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={langDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                              dataKey="value" nameKey="name" paddingAngle={3}>
                              {langDist.map((_, i) => (
                                <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                </div>
              </div>

              {/* Top Sampradayas */}
              <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <div className="flex items-center gap-2 mb-6">
                  <Users size={14} style={{ color: '#f87171' }} />
                  <h3 className="font-bold text-theme text-sm">Top Sampradayas by Followers</h3>
                </div>
                {loading
                  ? <div className="skeleton h-52 rounded-xl" />
                  : samp.length === 0
                    ? <p className="text-sm text-center py-16" style={{ color: 'var(--muted)' }}>No sampraday data available yet.</p>
                    : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={samp} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                          <Tooltip content={<ChartTip />} />
                          <Bar dataKey="followers" name="Followers" fill="#f87171" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
              </div>
            </div>
          )}

          {/* Chanting tab */}
          {tab === 'Chanting' && (
            <div className="space-y-6 animate-slide-up">
              <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <div className="flex items-center gap-2 mb-6">
                  <Flame size={14} style={{ color: '#fb923c' }} />
                  <h3 className="font-bold text-theme text-sm">Daily Chants — Last 14 Days</h3>
                </div>
                {loading
                  ? <div className="skeleton h-52 rounded-xl" />
                  : chants.length === 0
                    ? <p className="text-sm text-center py-16" style={{ color: 'var(--muted)' }}>No chanting data available yet.</p>
                    : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chants} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                          <Tooltip content={<ChartTip />} />
                          <Bar dataKey="chants" name="Chants" fill="#fb923c" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
              </div>

              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <Music size={14} style={{ color: '#a78bfa' }} />
                  <h3 className="font-bold text-theme text-sm">Top Mantras by Chant Count</h3>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['#', 'Mantra', 'Chant Count', 'Share'].map(h => (
                        <th key={h} className="px-5 py-3 text-left"
                          style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? [1,2,3].map(i => <tr key={i}><td colSpan={4} className="px-5 py-4"><div className="skeleton h-7 rounded-lg" /></td></tr>)
                      : mantras.length === 0
                        ? <tr><td colSpan={4} className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>No mantra chanting data yet.</td></tr>
                        : mantras.map((m, i) => {
                          const maxCount = mantras[0]?.chantCount || 1;
                          const totalCount = mantras.reduce((a, b) => a + b.chantCount, 0);
                          const pct = totalCount > 0 ? ((m.chantCount / totalCount) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={m.name} className="transition-all duration-150"
                              style={{ borderBottom: i < mantras.length - 1 ? '1px solid var(--border)' : 'none' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                              <td className="px-5 py-4">
                                <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                                  style={{ background: i === 0 ? 'rgba(251,191,36,0.15)' : 'var(--bg)', color: i === 0 ? '#fbbf24' : 'var(--muted)', display: 'inline-flex' }}>
                                  {i + 1}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-sm font-semibold text-theme">{m.name}</td>
                              <td className="px-5 py-4 text-sm font-bold" style={{ color: '#fb923c' }}>{m.chantCount.toLocaleString()}</td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                                    <div className="h-1.5 rounded-full" style={{ width: `${(m.chantCount / maxCount) * 100}%`, background: '#a78bfa' }} />
                                  </div>
                                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
