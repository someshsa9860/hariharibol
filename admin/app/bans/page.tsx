'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Ban, Clock, Bot, User, ShieldOff, ChevronDown, AlertCircle } from 'lucide-react';

interface BanRecord {
  id: string;
  type: string;
  value: string;
  reason: string;
  triggeredBy: string;
  adminId: string | null;
  isActive: boolean;
  createdAt: string;
  cascadeChain: string[];
}

function maskValue(type: string, value: string): string {
  if (type === 'email') {
    const atIdx = value.indexOf('@');
    if (atIdx < 0) return value;
    const local = value.slice(0, atIdx);
    const domain = value.slice(atIdx);
    return (local.length > 2 ? local.slice(0, 2) + '***' : '***') + domain;
  }
  if (type === 'device') {
    return value.length > 4 ? `dev_***${value.slice(-4)}` : 'dev_***';
  }
  if (type === 'ip') {
    const parts = value.split('.');
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.***. ***` : value;
  }
  return value;
}

const TYPE_META: Record<string, { color: string; bg: string; border: string }> = {
  email:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)' },
  device: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
  ip:     { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)' },
};

function TypeBadge({ type }: { type: string }) {
  const m = TYPE_META[type] ?? TYPE_META.email;
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider"
      style={{ color: m.color, background: m.bg, border: `1px solid ${m.border}` }}>
      {type.toUpperCase()}
    </span>
  );
}

function TriggerBadge({ by }: { by: string }) {
  const isAI = by === 'ai';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
        style={{
          background: isAI ? 'rgba(167,139,250,0.15)' : 'rgba(199,90,26,0.15)',
          border: isAI ? '1px solid rgba(167,139,250,0.25)' : '1px solid rgba(199,90,26,0.25)',
        }}>
        {isAI ? <Bot size={11} style={{ color: '#a78bfa' }} /> : <User size={11} style={{ color: 'var(--accent)' }} />}
      </div>
      <span className="text-xs font-semibold" style={{ color: isAI ? '#a78bfa' : 'var(--accent)' }}>
        {isAI ? 'AI Auto' : 'Admin'}
      </span>
    </div>
  );
}

type StatusFilter = 'all' | 'active' | 'lifted';
type TypeFilter   = 'all' | 'email' | 'device' | 'ip';

export default function BansPage() {
  const [bans,       setBans]       = useState<BanRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [filter,     setFilter]     = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [lifting,    setLifting]    = useState<string | null>(null);

  useEffect(() => { fetchBans(); }, []);

  const fetchBans = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get('/bans/history', { params: { take: 200 } });
      const payload = r.data;
      setBans(Array.isArray(payload) ? payload : (payload?.data ?? []));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to load bans');
      setBans([]);
    } finally {
      setLoading(false);
    }
  };

  const liftBan = async (id: string) => {
    const reason = window.prompt('Reason for lifting this ban:');
    if (reason === null) return;
    setLifting(id);
    setError(null);
    try {
      await api.delete(`/bans/${id}`, { data: { reason: reason.trim() || 'Lifted by admin' } });
      setBans(prev => prev.map(b => b.id === id ? { ...b, isActive: false } : b));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Failed to lift ban');
    } finally {
      setLifting(null);
    }
  };

  const visible = bans.filter(b => {
    const statusOk = filter === 'all' || (filter === 'active' ? b.isActive : !b.isActive);
    const typeOk   = typeFilter === 'all' || b.type === typeFilter;
    return statusOk && typeOk;
  });

  const counts = {
    active: bans.filter(b => b.isActive).length,
    lifted: bans.filter(b => !b.isActive).length,
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10 flex-wrap gap-3"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <Ban size={15} style={{ color: '#f87171' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Bans</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Email, device, and IP-level enforcement</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status filter */}
            {([
              { key: 'all',    label: 'All',    color: 'var(--muted)', count: bans.length },
              { key: 'active', label: 'Active', color: '#f87171',      count: counts.active },
              { key: 'lifted', label: 'Lifted', color: '#4ade80',      count: counts.lifted },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                style={{
                  background: filter === f.key ? `${f.color}18` : 'transparent',
                  border:     filter === f.key ? `1px solid ${f.color}30` : '1px solid var(--border)',
                  color:      filter === f.key ? f.color : 'var(--muted)',
                }}>
                {f.label}
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                  style={{ background: filter === f.key ? `${f.color}20` : 'var(--surface-2)' }}>
                  {f.count}
                </span>
              </button>
            ))}

            <div className="w-px h-5" style={{ background: 'var(--border)' }} />

            {/* Type filter */}
            {([
              { key: 'all',    label: 'All Types' },
              { key: 'email',  label: 'Email'     },
              { key: 'device', label: 'Device'    },
              { key: 'ip',     label: 'IP'        },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setTypeFilter(f.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                style={{
                  background: typeFilter === f.key ? 'rgba(199,90,26,0.12)' : 'transparent',
                  border:     typeFilter === f.key ? '1px solid rgba(199,90,26,0.3)' : '1px solid var(--border)',
                  color:      typeFilter === f.key ? 'var(--accent)' : 'var(--muted)',
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          {error && (
            <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Type', 'Masked Value', 'Reason', 'Triggered By', 'Date', 'Status', 'Cascade', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left"
                      style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [1, 2, 3].map(i => (
                    <tr key={i}><td colSpan={8} className="px-5 py-4"><div className="skeleton h-8 rounded-lg" /></td></tr>
                  ))
                  : visible.map((ban, i) => (
                    <>
                      <tr key={ban.id} className="transition-all duration-150 cursor-pointer"
                        style={{ borderBottom: expanded === ban.id ? 'none' : (i < visible.length - 1 ? '1px solid var(--border)' : 'none') }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        onClick={() => setExpanded(expanded === ban.id ? null : ban.id)}>

                        <td className="px-5 py-4"><TypeBadge type={ban.type} /></td>
                        <td className="px-5 py-4 font-mono text-xs" style={{ color: 'var(--text)' }}>
                          {maskValue(ban.type, ban.value)}
                        </td>
                        <td className="px-5 py-4 max-w-xs">
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>{ban.reason}</span>
                        </td>
                        <td className="px-5 py-4"><TriggerBadge by={ban.triggeredBy} /></td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                            <Clock size={11} />
                            {new Date(ban.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                            style={{
                              color:      ban.isActive ? '#f87171' : '#4ade80',
                              background: ban.isActive ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.12)',
                              border:     ban.isActive ? '1px solid rgba(248,113,113,0.25)' : '1px solid rgba(74,222,128,0.25)',
                            }}>
                            {ban.isActive ? 'ACTIVE' : 'LIFTED'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 text-sm font-semibold"
                            style={{ color: ban.cascadeChain.length > 5 ? '#f87171' : 'var(--text)' }}>
                            {ban.cascadeChain.length}
                            {ban.cascadeChain.length > 1 && (
                              <span className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}>accts</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                            {ban.isActive && (
                              <button onClick={() => liftBan(ban.id)} disabled={lifting === ban.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-40"
                                style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.2)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.1)'; }}>
                                <ShieldOff size={11} /> Lift
                              </button>
                            )}
                            <ChevronDown size={13} style={{
                              color: 'var(--muted)',
                              transform: expanded === ban.id ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.2s',
                            }} />
                          </div>
                        </td>
                      </tr>

                      {expanded === ban.id && (
                        <tr key={`${ban.id}-exp`} style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td colSpan={8} className="px-5 pb-4">
                            <div className="rounded-xl px-4 py-3 text-xs space-y-1.5"
                              style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                              <div className="flex gap-3">
                                <span style={{ color: 'var(--muted)', minWidth: 80 }}>Ban ID</span>
                                <span className="font-mono text-theme">{ban.id}</span>
                              </div>
                              <div className="flex gap-3">
                                <span style={{ color: 'var(--muted)', minWidth: 80 }}>Full Reason</span>
                                <span className="text-theme">{ban.reason}</span>
                              </div>
                              <div className="flex gap-3">
                                <span style={{ color: 'var(--muted)', minWidth: 80 }}>Cascade</span>
                                <span className="text-theme">{ban.cascadeChain.length} account(s) affected</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
              </tbody>
            </table>

            {!loading && visible.length === 0 && (
              <div className="py-16 text-center">
                <Ban size={32} className="mx-auto mb-3" style={{ color: 'rgba(155,143,168,0.3)' }} />
                <p className="text-sm font-semibold text-theme">No bans found</p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                  No {filter === 'all' ? '' : filter} ban records exist
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
