'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import {
  BarChart3, TrendingUp, Users, Music, BookOpen,
  Flame, Heart, Activity,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

/* ─── Types ─────────────────────────────────────────────────────────── */
interface AnalyticsMetrics {
  dau: number; mau: number;
  totalChants: number; topVerse: string;
  totalUsers: number; newUsersToday: number;
  totalVerses: number; totalSampradayas: number;
  totalFavorites: number; totalFollows: number;
  averageSessionDuration: number;
}
interface DauPoint    { date: string; dau: number }
interface VerseBar    { name: string; views: number }
interface SampradBar  { name: string; followers: number }
interface ChantBar    { date: string; chants: number }
interface MantraRow   { name: string; chantCount: number }

/* ─── Mock data ──────────────────────────────────────────────────────── */
const MOCK_METRICS: AnalyticsMetrics = {
  dau: 1243, mau: 18920, totalChants: 82450, topVerse: 'BG 2.47',
  totalUsers: 18920, newUsersToday: 37, totalVerses: 512, totalSampradayas: 14,
  totalFavorites: 4310, totalFollows: 7820, averageSessionDuration: 4.2,
};
const mkDau = (): DauPoint[] => Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  dau: 800 + Math.floor(Math.random() * 700),
}));
const MOCK_DAU: DauPoint[]   = mkDau();
const MOCK_VERSES: VerseBar[] = [
  { name: 'BG 2.47', views: 4120 }, { name: 'BG 18.66', views: 3080 },
  { name: 'RV 1.1.1', views: 2430 }, { name: 'BG 9.22', views: 1890 }, { name: 'YS 1.2', views: 1340 },
];
const MOCK_SAMP: SampradBar[] = [
  { name: 'Vaishnavism', followers: 5210 }, { name: 'Shaivism', followers: 3840 },
  { name: 'Shaktism', followers: 2910 }, { name: 'Advaita', followers: 2140 }, { name: 'Nimbarka', followers: 980 },
];
const mkChants = (): ChantBar[] => Array.from({ length: 14 }, (_, i) => ({
  date: new Date(Date.now() - (13 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  chants: 2000 + Math.floor(Math.random() * 4000),
}));
const MOCK_CHANTS: ChantBar[] = mkChants();
const MOCK_MANTRAS: MantraRow[] = [
  { name: 'Gayatri Mantra',     chantCount: 14230 },
  { name: 'Om Namah Shivaya',   chantCount: 11840 },
  { name: 'Hare Krishna Maha',  chantCount: 9710 },
  { name: 'Mahamrityunjaya',    chantCount: 7320 },
  { name: 'Shri Ram Jai Ram',   chantCount: 6150 },
];

/* ─── Custom tooltip ─────────────────────────────────────────────────── */
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
      <p className="font-semibold mb-1 text-theme">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: <strong>{p.value?.toLocaleString()}</strong></p>
      ))}
    </div>
  );
}

const TABS = ['Engagement', 'Content', 'Chanting'] as const;
type Tab = typeof TABS[number];
const PERIODS = [{ key: 'day', label: 'Today' }, { key: 'week', label: '7 Days' }, { key: 'month', label: '30 Days' }] as const;

export default function AnalyticsPage() {
  const [metrics,  setMetrics]  = useState<AnalyticsMetrics | null>(null);
  const [dauData,  setDauData]  = useState<DauPoint[]>([]);
  const [verses,   setVerses]   = useState<VerseBar[]>([]);
  const [samp,     setSamp]     = useState<SampradBar[]>([]);
  const [chants,   setChants]   = useState<ChantBar[]>([]);
  const [mantras,  setMantras]  = useState<MantraRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [period,   setPeriod]   = useState<'day' | 'week' | 'month'>('month');
  const [tab,      setTab]      = useState<Tab>('Engagement');

  useEffect(() => { fetchAll(); }, [period]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [m, d, v, s, c, mt] = await Promise.all([
        api.get(`/admin/analytics/metrics?period=${period}`),
        api.get(`/admin/analytics/dau?days=30`),
        api.get('/admin/analytics/top-verses'),
        api.get('/admin/analytics/top-sampradayas'),
        api.get('/admin/analytics/chants?days=14'),
        api.get('/admin/analytics/top-mantras'),
      ]);
      setMetrics(m.data); setDauData(d.data?.data || []); setVerses(v.data?.data || []);
      setSamp(s.data?.data || []); setChants(c.data?.data || []); setMantras(mt.data?.data || []);
    } catch {
      setMetrics(MOCK_METRICS); setDauData(MOCK_DAU); setVerses(MOCK_VERSES);
      setSamp(MOCK_SAMP); setChants(MOCK_CHANTS); setMantras(MOCK_MANTRAS);
    } finally { setLoading(false); }
  };

  const statCards = metrics ? [
    { icon: Activity,  label: 'DAU',         value: metrics.dau,         sub: 'Daily active users', color: '#60a5fa', glow: 'rgba(96,165,250,0.15)' },
    { icon: Users,     label: 'MAU',         value: metrics.mau,         sub: 'Monthly active users', color: '#a78bfa', glow: 'rgba(167,139,250,0.15)' },
    { icon: Flame,     label: 'Total Chants',value: metrics.totalChants, sub: 'All time chanting logs', color: '#fb923c', glow: 'rgba(251,146,60,0.15)' },
    { icon: BookOpen,  label: 'Top Verse',   value: metrics.topVerse,    sub: 'Most viewed today', color: '#fbbf24', glow: 'rgba(251,191,36,0.15)', isStr: true },
  ] : [];

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

          {/* ── Engagement tab ── */}
          {tab === 'Engagement' && (
            <div className="rounded-2xl p-6 animate-slide-up"
              style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp size={14} style={{ color: '#60a5fa' }} />
                <h3 className="font-bold text-theme text-sm">Daily Active Users — Last 30 Days</h3>
              </div>
              {loading
                ? <div className="skeleton h-64 rounded-xl" />
                : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={dauData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false}
                        interval={4} />
                      <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<ChartTip />} />
                      <Line type="monotone" dataKey="dau" name="DAU" stroke="#60a5fa" strokeWidth={2.5}
                        dot={false} activeDot={{ r: 5, fill: '#60a5fa' }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
            </div>
          )}

          {/* ── Content tab ── */}
          {tab === 'Content' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
              <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <div className="flex items-center gap-2 mb-6">
                  <BookOpen size={14} style={{ color: '#fbbf24' }} />
                  <h3 className="font-bold text-theme text-sm">Top Verses by Views</h3>
                </div>
                {loading
                  ? <div className="skeleton h-52 rounded-xl" />
                  : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={verses} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={65} />
                        <Tooltip content={<ChartTip />} />
                        <Bar dataKey="views" name="Views" fill="#fbbf24" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
              </div>
              <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <div className="flex items-center gap-2 mb-6">
                  <Heart size={14} style={{ color: '#f87171' }} />
                  <h3 className="font-bold text-theme text-sm">Top Sampradayas by Followers</h3>
                </div>
                {loading
                  ? <div className="skeleton h-52 rounded-xl" />
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

          {/* ── Chanting tab ── */}
          {tab === 'Chanting' && (
            <div className="space-y-6 animate-slide-up">
              <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <div className="flex items-center gap-2 mb-6">
                  <Flame size={14} style={{ color: '#fb923c' }} />
                  <h3 className="font-bold text-theme text-sm">Daily Chants — Last 14 Days</h3>
                </div>
                {loading
                  ? <div className="skeleton h-52 rounded-xl" />
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

              {/* Top mantras table */}
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
                      : mantras.map((m, i) => {
                        const maxCount = mantras[0]?.chantCount || 1;
                        const pct = ((m.chantCount / mantras.reduce((a, b) => a + b.chantCount, 0)) * 100).toFixed(1);
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
