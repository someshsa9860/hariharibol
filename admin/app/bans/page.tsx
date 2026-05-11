'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Ban, Clock, Bot, User, ShieldOff, ChevronDown } from 'lucide-react';

interface BanRecord {
  id: string;
  type: 'EMAIL' | 'DEVICE' | 'IP';
  maskedValue: string;
  reason: string;
  triggeredBy: 'AI' | 'ADMIN';
  triggeredByEmail?: string;
  createdAt: string;
  status: 'active' | 'lifted';
  cascadeSize: number;
}

const MOCK_BANS: BanRecord[] = [
  { id: 'b1', type: 'EMAIL',  maskedValue: 'an***@example.com',    reason: 'Repeated hate speech across 4 groups', triggeredBy: 'ADMIN', triggeredByEmail: 'admin@hhb.com', createdAt: new Date(Date.now()-86400000).toISOString(),   status: 'active', cascadeSize: 3 },
  { id: 'b2', type: 'DEVICE', maskedValue: 'dev_***a7f3',          reason: 'AI detected coordinated spam campaign', triggeredBy: 'AI',    createdAt: new Date(Date.now()-172800000).toISOString(),  status: 'active', cascadeSize: 7 },
  { id: 'b3', type: 'IP',     maskedValue: '192.168.***.***',       reason: 'Mass account creation from single IP', triggeredBy: 'AI',    createdAt: new Date(Date.now()-259200000).toISOString(),  status: 'active', cascadeSize: 12 },
  { id: 'b4', type: 'EMAIL',  maskedValue: 'sp***@gmail.com',       reason: 'Commercial spam in sacred content groups', triggeredBy: 'ADMIN', triggeredByEmail: 'mod@hhb.com', createdAt: new Date(Date.now()-604800000).toISOString(), status: 'lifted', cascadeSize: 1 },
  { id: 'b5', type: 'DEVICE', maskedValue: 'dev_***b9c2',          reason: 'Impersonation of spiritual teachers', triggeredBy: 'ADMIN', triggeredByEmail: 'admin@hhb.com', createdAt: new Date(Date.now()-1209600000).toISOString(), status: 'active', cascadeSize: 2 },
];

const TYPE_META = {
  EMAIL:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)' },
  DEVICE: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
  IP:     { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)' },
};

function TypeBadge({ type }: { type: BanRecord['type'] }) {
  const m = TYPE_META[type];
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider"
      style={{ color: m.color, background: m.bg, border: `1px solid ${m.border}` }}>
      {type}
    </span>
  );
}

function TriggerBadge({ by, email }: { by: 'AI' | 'ADMIN'; email?: string }) {
  const isAI = by === 'AI';
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
        {isAI ? 'AI Auto' : (email || 'Admin')}
      </span>
    </div>
  );
}

export default function BansPage() {
  const [bans,      setBans]      = useState<BanRecord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<'all' | 'active' | 'lifted'>('all');
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [lifting,   setLifting]   = useState<string | null>(null);

  useEffect(() => { fetchBans(); }, []);

  const fetchBans = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/bans');
      setBans(r.data || []);
    } catch { setBans(MOCK_BANS); }
    finally { setLoading(false); }
  };

  const liftBan = async (id: string) => {
    setLifting(id);
    try { await api.post(`/admin/bans/${id}/lift`); fetchBans(); }
    catch { fetchBans(); }
    finally { setLifting(null); }
  };

  const visible = filter === 'all' ? bans : bans.filter(b => b.status === filter);

  const counts = { active: bans.filter(b => b.status === 'active').length, lifted: bans.filter(b => b.status === 'lifted').length };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
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
          <div className="flex items-center gap-2">
            {[
              { key: 'all',    label: 'All',    color: 'var(--muted)', count: bans.length },
              { key: 'active', label: 'Active', color: '#f87171',      count: counts.active },
              { key: 'lifted', label: 'Lifted', color: '#4ade80',      count: counts.lifted },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key as typeof filter)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                style={{
                  background: filter === f.key ? `${f.color}18` : 'transparent',
                  border: filter === f.key ? `1px solid ${f.color}30` : '1px solid var(--border)',
                  color: filter === f.key ? f.color : 'var(--muted)',
                }}>
                {f.label}
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                  style={{ background: filter === f.key ? `${f.color}20` : 'var(--surface-2)' }}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
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
                        <td className="px-5 py-4 font-mono text-xs" style={{ color: 'var(--text)' }}>{ban.maskedValue}</td>
                        <td className="px-5 py-4 max-w-xs">
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>{ban.reason}</span>
                        </td>
                        <td className="px-5 py-4"><TriggerBadge by={ban.triggeredBy} email={ban.triggeredByEmail} /></td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                            <Clock size={11} />
                            {new Date(ban.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                            style={{
                              color: ban.status === 'active' ? '#f87171' : '#4ade80',
                              background: ban.status === 'active' ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.12)',
                              border: ban.status === 'active' ? '1px solid rgba(248,113,113,0.25)' : '1px solid rgba(74,222,128,0.25)',
                            }}>
                            {ban.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: ban.cascadeSize > 5 ? '#f87171' : 'var(--text)' }}>
                            {ban.cascadeSize}
                            {ban.cascadeSize > 1 && <span className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}>accts</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                            {ban.status === 'active' && (
                              <button onClick={() => liftBan(ban.id)} disabled={lifting === ban.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-40"
                                style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.2)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.1)'; }}>
                                <ShieldOff size={11} /> Lift
                              </button>
                            )}
                            <ChevronDown size={13} style={{ color: 'var(--muted)', transform: expanded === ban.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                          </div>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {expanded === ban.id && (
                        <tr key={`${ban.id}-exp`} style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td colSpan={8} className="px-5 pb-4">
                            <div className="rounded-xl px-4 py-3 text-xs space-y-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                              <div className="flex gap-3"><span style={{ color: 'var(--muted)', minWidth: 80 }}>Ban ID</span><span className="font-mono text-theme">{ban.id}</span></div>
                              <div className="flex gap-3"><span style={{ color: 'var(--muted)', minWidth: 80 }}>Full Reason</span><span className="text-theme">{ban.reason}</span></div>
                              <div className="flex gap-3"><span style={{ color: 'var(--muted)', minWidth: 80 }}>Cascade</span><span className="text-theme">{ban.cascadeSize} account(s) affected</span></div>
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
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>No {filter === 'all' ? '' : filter} ban records exist</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
