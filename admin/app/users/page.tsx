'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Ban, CheckCircle, Users, Search, X } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string | null;
  isBanned: boolean;
  bannedReason: string | null;
  createdAt: string;
  lastActiveAt: string;
}

function Skeleton() {
  return <div className="skeleton h-14 rounded-xl" />;
}

export default function UsersPage() {
  const [users,      setUsers]      = useState<User[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [banningId,  setBanningId]  = useState<string | null>(null);
  const [banReason,  setBanReason]  = useState('');
  const [actioningId,setActioningId]= useState<string | null>(null);
  const [search,     setSearch]     = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const r = await api.get('/admin/users');
      setUsers(r.data || []);
    } catch { } finally { setLoading(false); }
  };

  const handleBan = async (userId: string) => {
    if (!banReason.trim()) return;
    setActioningId(userId);
    try {
      await api.post(`/admin/users/${userId}/ban`, { reason: banReason });
      setBanningId(null); setBanReason(''); fetchUsers();
    } finally { setActioningId(null); }
  };

  const handleUnban = async (userId: string) => {
    setActioningId(userId);
    try { await api.post(`/admin/users/${userId}/unban`); fetchUsers(); }
    finally { setActioningId(null); }
  };

  const filtered    = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = users.filter(u => !u.isBanned).length;
  const bannedCount = users.filter(u => u.isBanned).length;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        {/* Header */}
        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)' }}>
              <Users size={15} style={{ color: '#38bdf8' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">User Management</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Moderate and manage devotees</p>
            </div>
          </div>

          {/* Mini stats */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>
              {activeCount} Active
            </div>
            <div className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
              {bannedCount} Banned
            </div>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-5">

          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by email or name…"
              className="input-field pl-10 pr-10"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--muted)' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="font-bold text-theme text-sm">All Users</span>
              {!loading && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}>
                  {filtered.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-5 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} />)}</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Users size={32} className="mx-auto mb-3" style={{ color: 'rgba(155,143,168,0.3)' }} />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  {search ? 'No users match your search' : 'No users yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="table-header">User</th>
                      <th className="table-header">Joined</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((user) => (
                      <tr key={user.id} className="table-row">
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                              style={{
                                background: user.isBanned
                                  ? 'rgba(248,113,113,0.12)'
                                  : 'linear-gradient(135deg, rgba(255,107,43,0.2), rgba(245,200,66,0.15))',
                                border: `1px solid ${user.isBanned ? 'rgba(248,113,113,0.2)' : 'rgba(255,107,43,0.2)'}`,
                                color: user.isBanned ? '#f87171' : 'var(--accent)',
                              }}>
                              {user.email[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-theme">{user.email}</p>
                              {user.name && <p className="text-xs" style={{ color: 'var(--muted)' }}>{user.name}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="table-cell text-sm" style={{ color: 'var(--muted)' }}>
                          {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="table-cell">
                          <span className={user.isBanned ? 'badge badge-red' : 'badge badge-green'}>
                            {user.isBanned ? '⛔ Banned' : '✓ Active'}
                          </span>
                        </td>
                        <td className="table-cell">
                          {user.isBanned ? (
                            <div className="space-y-1.5">
                              {user.bannedReason && (
                                <p className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(248,113,113,0.06)', color: '#f87171' }}>
                                  {user.bannedReason}
                                </p>
                              )}
                              <button onClick={() => handleUnban(user.id)} disabled={actioningId === user.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                                style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8' }}>
                                {actioningId === user.id
                                  ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                                  : <CheckCircle size={12} />}
                                Unban
                              </button>
                            </div>
                          ) : banningId === user.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Reason for ban…"
                                value={banReason}
                                onChange={e => setBanReason(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleBan(user.id)}
                                className="input-field text-xs py-1.5 px-3"
                                autoFocus
                              />
                              <button onClick={() => handleBan(user.id)} disabled={!banReason.trim() || actioningId === user.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 disabled:opacity-40 flex-shrink-0"
                                style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                                {actioningId === user.id ? '…' : 'Confirm'}
                              </button>
                              <button onClick={() => { setBanningId(null); setBanReason(''); }}
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setBanningId(user.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)', color: '#f87171' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.18)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)'; }}>
                              <Ban size={12} /> Ban
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
