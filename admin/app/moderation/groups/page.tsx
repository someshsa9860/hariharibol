'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Users, MessageSquare, TrendingDown, ArrowUpDown, AlertTriangle } from 'lucide-react';

interface GroupStats {
  id: string;
  name: string;
  sampradaya: string;
  memberCount: number;
  messages24h: number;
  hiddenRate: number;
  flaggedUsers: number;
}


type SortKey = 'hiddenRate' | 'messages24h' | 'memberCount' | 'flaggedUsers';

function rateColor(rate: number) {
  if (rate >= 30) return '#f87171';
  if (rate >= 15) return '#fbbf24';
  return '#4ade80';
}

export default function GroupOversightPage() {
  const [groups,  setGroups]  = useState<GroupStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('hiddenRate');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => { fetchGroups(); }, []);

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get('/admin/moderation/groups');
      setGroups(r.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load group data';
      setError(msg);
      setGroups([]);
    } finally { setLoading(false); }
  };

  const sorted = [...groups].sort((a, b) =>
    sortAsc ? (a[sortKey] as number) - (b[sortKey] as number) : (b[sortKey] as number) - (a[sortKey] as number)
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
  };

  const ThCol = ({ label, k }: { label: string; k: SortKey }) => (
    <th className="px-5 py-3 text-left cursor-pointer select-none"
      onClick={() => toggleSort(k)}
      style={{ color: sortKey === k ? 'var(--accent)' : 'var(--muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown size={10} style={{ opacity: sortKey === k ? 1 : 0.4 }} />
      </div>
    </th>
  );

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        <header className="px-8 py-4 flex items-center gap-3 sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <a href="/moderation" className="text-xs font-semibold" style={{ color: 'var(--muted)', textDecoration: 'none' }}>Moderation</a>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <Users size={13} style={{ color: '#fbbf24' }} />
            </div>
            <h1 className="text-lg font-black text-theme">Group Oversight</h1>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
              {error}
            </div>
          )}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="px-5 py-3 text-left" style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Group</th>
                  <th className="px-5 py-3 text-left" style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Sampradaya</th>
                  <ThCol label="Members"     k="memberCount" />
                  <ThCol label="Msgs 24h"    k="messages24h" />
                  <ThCol label="Hidden Rate" k="hiddenRate" />
                  <ThCol label="Flagged"     k="flaggedUsers" />
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [1, 2, 3, 4, 5].map(i => (
                    <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="skeleton h-8 rounded-lg" /></td></tr>
                  ))
                  : error
                  ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center">
                        <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: '#f87171' }} />
                        <p className="text-sm font-semibold text-theme mb-1">Failed to load groups</p>
                        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{error}</p>
                        <button onClick={fetchGroups}
                          className="px-4 py-1.5 rounded-xl text-xs font-semibold"
                          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
                          Retry
                        </button>
                      </td>
                    </tr>
                  )
                  : sorted.map((g, i) => (
                    <tr key={g.id} className="transition-all duration-150"
                      style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                            style={{ background: 'rgba(199,90,26,0.12)', color: 'var(--accent)' }}>
                            {g.name[0]}
                          </div>
                          <span className="text-sm font-semibold text-theme">{g.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.2)' }}>
                          {g.sampradaya}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text)' }}>
                          <Users size={12} style={{ color: 'var(--muted)' }} />
                          {g.memberCount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text)' }}>
                          <MessageSquare size={12} style={{ color: 'var(--muted)' }} />
                          {g.messages24h}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                            <div className="h-1.5 rounded-full" style={{ width: `${Math.min(g.hiddenRate, 100)}%`, background: rateColor(g.hiddenRate) }} />
                          </div>
                          <span className="text-sm font-semibold" style={{ color: rateColor(g.hiddenRate) }}>{g.hiddenRate.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          {g.flaggedUsers > 0 && <AlertTriangle size={12} style={{ color: g.flaggedUsers >= 5 ? '#f87171' : '#fbbf24' }} />}
                          <span className="text-sm font-semibold" style={{ color: g.flaggedUsers >= 5 ? '#f87171' : 'var(--text)' }}>
                            {g.flaggedUsers}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <a href={`/moderation?group=${g.id}`}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}>
                          Review
                        </a>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Heat legend */}
          <div className="mt-4 flex items-center gap-4 text-xs" style={{ color: 'var(--muted)' }}>
            <TrendingDown size={12} />
            <span>Hidden rate:</span>
            {[{ label: '< 15% — healthy', color: '#4ade80' }, { label: '15-30% — watch', color: '#fbbf24' }, { label: '> 30% — critical', color: '#f87171' }].map(l => (
              <span key={l.color} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color, display: 'inline-block' }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
