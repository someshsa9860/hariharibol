'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Ban, CheckCircle, Users, Search, X, Download, AlertTriangle } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string;
  isBanned: boolean;
  bannedReason: string | null;
  createdAt: string;
  lastActiveAt?: string;
}

type BanDuration = 'permanent' | '1d' | '7d' | '30d';

const BAN_DURATION_LABELS: Record<BanDuration, string> = {
  permanent: 'Permanent',
  '1d': '1 Day',
  '7d': '7 Days',
  '30d': '30 Days',
};

function Skeleton() {
  return <div className="skeleton h-14 rounded-xl" />;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', boxShadow: '0 25px 80px rgba(0,0,0,0.6)' }}>
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--surface-2)', background: 'var(--surface)' }}>
          <h2 className="font-bold text-theme text-sm">{title}</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}>
            <X size={15} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function UserAvatar({ user }: { user: User }) {
  if (user.avatarUrl) {
    return (
      <img src={user.avatarUrl} alt={user.name ?? user.email}
        className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
        style={{ border: `1px solid ${user.isBanned ? 'rgba(248,113,113,0.25)' : 'rgba(255,107,43,0.2)'}` }}
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
      style={{
        background: user.isBanned
          ? 'rgba(248,113,113,0.12)'
          : 'linear-gradient(135deg, rgba(255,107,43,0.2), rgba(245,200,66,0.15))',
        border: `1px solid ${user.isBanned ? 'rgba(248,113,113,0.2)' : 'rgba(255,107,43,0.2)'}`,
        color: user.isBanned ? '#f87171' : 'var(--accent)',
      }}>
      {(user.name || user.email)[0].toUpperCase()}
    </div>
  );
}

function formatRelative(dateStr?: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function exportToCSV(users: User[]) {
  const headers = ['Name', 'Email', 'Status', 'Joined', 'Last Active', 'Ban Reason'];
  const rows = users.map(u => [
    u.name ?? '',
    u.email,
    u.isBanned ? 'Banned' : 'Active',
    new Date(u.createdAt).toLocaleDateString(),
    u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : '',
    u.bannedReason ?? '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function UsersPage() {
  const [users,       setUsers]       = useState<User[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Ban modal state
  const [banTarget,   setBanTarget]   = useState<User | null>(null);
  const [banReason,   setBanReason]   = useState('');
  const [banDuration, setBanDuration] = useState<BanDuration>('permanent');

  // Unban confirmation state
  const [unbanTarget, setUnbanTarget] = useState<User | null>(null);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const r = await api.get('/admin/users');
      setUsers(r.data || []);
    } catch { } finally { setLoading(false); }
  };

  const handleBan = async () => {
    if (!banTarget || !banReason.trim()) return;
    setActioningId(banTarget.id);
    try {
      await api.post(`/admin/users/${banTarget.id}/ban`, { reason: banReason, duration: banDuration });
      setBanTarget(null);
      setBanReason('');
      setBanDuration('permanent');
      fetchUsers();
    } finally { setActioningId(null); }
  };

  const handleUnban = async () => {
    if (!unbanTarget) return;
    setActioningId(unbanTarget.id);
    try {
      await api.post(`/admin/users/${unbanTarget.id}/unban`);
      setUnbanTarget(null);
      fetchUsers();
    } finally { setActioningId(null); }
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
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80' }}>
              {activeCount} Active
            </div>
            <div className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
              {bannedCount} Banned
            </div>
            <button
              onClick={() => exportToCSV(filtered)}
              disabled={filtered.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}>
              <Download size={14} /> Export CSV
            </button>
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
              placeholder="Search by name or email…"
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
            <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="font-bold text-theme text-sm">All Users</span>
              {!loading && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
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
                      <th className="table-header">Last Active</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(user => (
                      <tr key={user.id} className="table-row">
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={user} />
                            <div>
                              <p className="font-semibold text-sm text-theme">
                                {user.name || <span style={{ color: 'var(--muted)' }}>—</span>}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--muted)' }}>{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="table-cell text-sm" style={{ color: 'var(--muted)' }}>
                          {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="table-cell text-sm" style={{ color: 'var(--muted)' }}>
                          {formatRelative(user.lastActiveAt)}
                        </td>
                        <td className="table-cell">
                          <div>
                            <span className={user.isBanned ? 'badge badge-red' : 'badge badge-green'}>
                              {user.isBanned ? '⛔ Banned' : '✓ Active'}
                            </span>
                            {user.isBanned && user.bannedReason && (
                              <p className="text-[10px] mt-1 truncate max-w-[140px]" style={{ color: '#f87171', opacity: 0.75 }}>
                                {user.bannedReason}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="table-cell">
                          {user.isBanned ? (
                            <button
                              onClick={() => setUnbanTarget(user)}
                              disabled={actioningId === user.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                              style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8' }}>
                              <CheckCircle size={12} /> Unban
                            </button>
                          ) : (
                            <button
                              onClick={() => setBanTarget(user)}
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

        {/* Ban Modal */}
        {banTarget && (
          <Modal title={`Ban ${banTarget.name || banTarget.email}`} onClose={() => { setBanTarget(null); setBanReason(''); setBanDuration('permanent'); }}>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
                <AlertTriangle size={16} style={{ color: '#f87171', flexShrink: 0 }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#f87171' }}>{banTarget.email}</p>
                  {banTarget.name && <p className="text-xs" style={{ color: 'var(--muted)' }}>{banTarget.name}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                  Duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(BAN_DURATION_LABELS) as [BanDuration, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBanDuration(val)}
                      className="py-2 px-3 rounded-xl text-xs font-semibold transition-all duration-150"
                      style={{
                        background: banDuration === val ? 'rgba(248,113,113,0.15)' : 'var(--surface)',
                        border: banDuration === val ? '1px solid rgba(248,113,113,0.35)' : '1px solid var(--surface-2)',
                        color: banDuration === val ? '#f87171' : 'var(--muted)',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                  Reason <span className="normal-case font-normal">(required)</span>
                </label>
                <textarea
                  placeholder="Describe why this user is being banned…"
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  rows={3}
                  className="input-field text-sm resize-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleBan}
                  disabled={!banReason.trim() || actioningId === banTarget.id}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
                  style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171' }}>
                  {actioningId === banTarget.id
                    ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : <Ban size={14} />}
                  Confirm Ban
                </button>
                <button
                  onClick={() => { setBanTarget(null); setBanReason(''); setBanDuration('permanent'); }}
                  className="btn-secondary py-2.5 px-5 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Unban Confirmation Modal */}
        {unbanTarget && (
          <Modal title="Confirm Unban" onClose={() => setUnbanTarget(null)}>
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)' }}>
                <CheckCircle size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#38bdf8' }}>{unbanTarget.email}</p>
                  {unbanTarget.name && <p className="text-xs" style={{ color: 'var(--muted)' }}>{unbanTarget.name}</p>}
                </div>
              </div>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                This will restore full access to the platform for this user. Are you sure?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleUnban}
                  disabled={actioningId === unbanTarget.id}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-40"
                  style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8' }}>
                  {actioningId === unbanTarget.id
                    ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : <CheckCircle size={14} />}
                  Yes, Unban User
                </button>
                <button onClick={() => setUnbanTarget(null)} className="btn-secondary py-2.5 px-5 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
}
