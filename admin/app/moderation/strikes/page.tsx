'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { AlertTriangle, Ban, MessageSquare, RotateCcw, Clock } from 'lucide-react';

interface StrikeUser {
  id: string;
  name: string;
  email: string;
  strikeCount: number;
  lastReason: string;
  lastStrikeAt: string;
}


export default function StrikesPage() {
  const [users,      setUsers]      = useState<StrikeUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [actioningId,setActioningId]= useState<string | null>(null);
  const [confirm,    setConfirm]    = useState<{ id: string; action: 'ban' | 'reset' } | null>(null);

  useEffect(() => { fetchStrikes(); }, []);

  const fetchStrikes = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get('/admin/moderation/strikes');
      setUsers(r.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load strike data';
      setError(msg);
      setUsers([]);
    } finally { setLoading(false); }
  };

  const doAction = async (id: string, action: 'ban' | 'reset') => {
    setActioningId(id); setConfirm(null);
    try {
      if (action === 'ban')   await api.post(`/admin/users/${id}/ban`, { reason: 'Repeated strikes' });
      if (action === 'reset') await api.post(`/admin/moderation/strikes/${id}/reset`);
      fetchStrikes();
    } catch { fetchStrikes(); }
    finally { setActioningId(null); }
  };

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
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertTriangle size={13} style={{ color: '#f87171' }} />
            </div>
            <h1 className="text-lg font-black text-theme">User Strikes</h1>
          </div>
          {!loading && (
            <span className="ml-auto px-3 py-1 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
              {users.length} users tracked
            </span>
          )}
        </header>

        <div className="p-8 max-w-5xl mx-auto">

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {/* Confirm dialog */}
          {confirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
              <div className="rounded-2xl p-6 w-80" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <h3 className="font-bold text-theme mb-2">
                  {confirm.action === 'ban' ? 'Confirm Ban' : 'Reset Strikes'}
                </h3>
                <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                  {confirm.action === 'ban'
                    ? 'This user will be banned and all their content hidden. This action requires an audit trail.'
                    : 'This will clear all strike records for this user. Only do this if strikes were applied in error.'}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => doAction(confirm.id, confirm.action)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold"
                    style={{
                      background: confirm.action === 'ban' ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)',
                      border: confirm.action === 'ban' ? '1px solid rgba(248,113,113,0.3)' : '1px solid rgba(74,222,128,0.3)',
                      color: confirm.action === 'ban' ? '#f87171' : '#4ade80',
                    }}>
                    {confirm.action === 'ban' ? 'Ban User' : 'Reset'}
                  </button>
                  <button onClick={() => setConfirm(null)}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['User', 'Email', 'Strikes', 'Last Reason', 'Date', 'Actions'].map(h => (
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
                    <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="skeleton h-8 rounded-lg" /></td></tr>
                  ))
                  : error
                  ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center">
                        <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: '#f87171' }} />
                        <p className="text-sm font-semibold text-theme mb-1">Failed to load strikes</p>
                        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{error}</p>
                        <button onClick={fetchStrikes}
                          className="px-4 py-1.5 rounded-xl text-xs font-semibold"
                          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
                          Retry
                        </button>
                      </td>
                    </tr>
                  )
                  : users.map((u, i) => (
                    <tr key={u.id} className="transition-all duration-150"
                      style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: 'rgba(199,90,26,0.12)', color: 'var(--accent)' }}>
                            {u.name[0]}
                          </div>
                          <span className="text-sm font-semibold text-theme">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: 'var(--muted)' }}>{u.email}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          {[...Array(Math.min(u.strikeCount, 5))].map((_, j) => (
                            <span key={j} className="w-2 h-2 rounded-full"
                              style={{ background: u.strikeCount >= 3 ? '#f87171' : '#fbbf24', display: 'inline-block' }} />
                          ))}
                          <span className="text-sm font-bold ml-1" style={{ color: u.strikeCount >= 3 ? '#f87171' : '#fbbf24' }}>
                            {u.strikeCount}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>{u.lastReason}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                          <Clock size={11} />
                          {new Date(u.lastStrikeAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setConfirm({ id: u.id, action: 'ban' })}
                            disabled={actioningId === u.id}
                            title="Ban user"
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-40"
                            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.2)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)'; }}>
                            <Ban size={12} />
                          </button>
                          <a href={`/moderation?user=${u.id}`} title="View messages"
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200"
                            style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}>
                            <MessageSquare size={12} />
                          </a>
                          <button onClick={() => setConfirm({ id: u.id, action: 'reset' })}
                            disabled={actioningId === u.id}
                            title="Reset strikes"
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 disabled:opacity-40"
                            style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.2)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.1)'; }}>
                            <RotateCcw size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
