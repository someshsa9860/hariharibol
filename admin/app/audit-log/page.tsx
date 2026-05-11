'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { ClipboardList, Clock, ChevronDown, Search } from 'lucide-react';

interface AuditEntry {
  id: string;
  admin: { email: string };
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

const MOCK_AUDIT: AuditEntry[] = [
  { id: 'a1', admin: { email: 'admin@hhb.com' }, action: 'BAN_USER',        entityType: 'User',       entityId: 'u-abc123', timestamp: new Date(Date.now()-600000).toISOString(),   before: { status: 'active' }, after: { status: 'banned', reason: 'Repeated hate speech' } },
  { id: 'a2', admin: { email: 'admin@hhb.com' }, action: 'APPROVE_MESSAGE', entityType: 'Message',    entityId: 'msg-def', timestamp: new Date(Date.now()-1800000).toISOString(),  before: { status: 'pending' }, after: { status: 'approved' } },
  { id: 'a3', admin: { email: 'mod@hhb.com'   }, action: 'HIDE_MESSAGE',    entityType: 'Message',    entityId: 'msg-ghi', timestamp: new Date(Date.now()-3600000).toISOString(),  before: { isHidden: false }, after: { isHidden: true } },
  { id: 'a4', admin: { email: 'admin@hhb.com' }, action: 'UPDATE_VERSE',    entityType: 'Verse',      entityId: 'v-jkl456', timestamp: new Date(Date.now()-7200000).toISOString(),  before: { text: 'Old text' }, after: { text: 'Updated Sanskrit text' } },
  { id: 'a5', admin: { email: 'admin@hhb.com' }, action: 'LIFT_BAN',        entityType: 'Ban',        entityId: 'ban-mno', timestamp: new Date(Date.now()-86400000).toISOString(), before: { status: 'active' }, after: { status: 'lifted' } },
  { id: 'a6', admin: { email: 'mod@hhb.com'   }, action: 'RESET_STRIKES',   entityType: 'User',       entityId: 'u-pqr789', timestamp: new Date(Date.now()-172800000).toISOString(),before: { strikeCount: 3 }, after: { strikeCount: 0 } },
  { id: 'a7', admin: { email: 'admin@hhb.com' }, action: 'SEND_NOTIFICATION',entityType: 'Notification',entityId: 'notif-stu',timestamp: new Date(Date.now()-259200000).toISOString(),before: {}, after: { title: 'Verse of Day', audience: 'all' } },
];

const ACTION_META: Record<string, { color: string; bg: string; border: string }> = {
  BAN_USER:          { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
  LIFT_BAN:          { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.25)' },
  APPROVE_MESSAGE:   { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.25)' },
  HIDE_MESSAGE:      { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)' },
  ESCALATE_TO_BAN:   { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
  UPDATE_VERSE:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)' },
  RESET_STRIKES:     { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)' },
  SEND_NOTIFICATION: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)' },
  CREATE_CONTENT:    { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
  DELETE_CONTENT:    { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
};

function ActionBadge({ action }: { action: string }) {
  const m = ACTION_META[action] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)' };
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider whitespace-nowrap"
      style={{ color: m.color, background: m.bg, border: `1px solid ${m.border}` }}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

function DiffView({ before, after }: { before?: Record<string, unknown>; after?: Record<string, unknown> }) {
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  return (
    <div className="rounded-xl overflow-hidden text-xs" style={{ border: '1px solid var(--border)' }}>
      <div className="grid grid-cols-2">
        <div className="px-3 py-2 font-semibold" style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>Before</div>
        <div className="px-3 py-2 font-semibold" style={{ background: 'rgba(74,222,128,0.08)', color: '#4ade80', borderBottom: '1px solid var(--border)' }}>After</div>
      </div>
      {keys.map((k, i) => (
        <div key={k} className="grid grid-cols-2" style={{ borderBottom: i < keys.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <div className="px-3 py-2 font-mono" style={{ borderRight: '1px solid var(--border)', background: 'rgba(248,113,113,0.04)', color: 'var(--text)' }}>
            <span style={{ color: 'var(--muted)', marginRight: 6 }}>{k}:</span>
            {before?.[k] !== undefined ? String(before[k]) : <span style={{ opacity: 0.4, fontStyle: 'italic' }}>—</span>}
          </div>
          <div className="px-3 py-2 font-mono" style={{ background: 'rgba(74,222,128,0.04)', color: 'var(--text)' }}>
            <span style={{ color: 'var(--muted)', marginRight: 6 }}>{k}:</span>
            {after?.[k] !== undefined ? String(after[k]) : <span style={{ opacity: 0.4, fontStyle: 'italic' }}>—</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AuditLogPage() {
  const [entries,   setEntries]   = useState<AuditEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [page,      setPage]      = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => { fetchLog(); }, []);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const r = await api.get('/admin/audit-log');
      setEntries(r.data || []);
    } catch { setEntries(MOCK_AUDIT); }
    finally { setLoading(false); }
  };

  const filtered = entries.filter(e =>
    !search ||
    e.admin.email.toLowerCase().includes(search.toLowerCase()) ||
    e.action.toLowerCase().includes(search.toLowerCase()) ||
    e.entityType.toLowerCase().includes(search.toLowerCase()) ||
    e.entityId.toLowerCase().includes(search.toLowerCase())
  );

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <ClipboardList size={15} style={{ color: '#60a5fa' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Audit Log</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>All admin actions with change history</p>
            </div>
          </div>
          {!loading && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>
              {filtered.length} entries
            </span>
          )}
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-5">

          {/* Search bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <Search size={14} style={{ color: 'var(--muted)' }} />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search by admin, action, entity type or ID…"
              className="flex-1 bg-transparent text-sm outline-none text-theme placeholder:text-[var(--muted)]" />
            {search && (
              <button onClick={() => setSearch('')} className="text-xs" style={{ color: 'var(--muted)' }}>Clear</button>
            )}
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Admin', 'Action', 'Entity', 'Entity ID', 'Timestamp', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left"
                      style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [1, 2, 3, 4, 5].map(i => (
                    <tr key={i}><td colSpan={6} className="px-5 py-3"><div className="skeleton h-7 rounded-lg" /></td></tr>
                  ))
                  : paged.length === 0
                    ? (
                      <tr><td colSpan={6} className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>
                        No entries match your search.
                      </td></tr>
                    )
                    : paged.map((entry, i) => (
                      <>
                        <tr key={entry.id} className="cursor-pointer transition-all duration-150"
                          style={{ borderBottom: expanded === entry.id ? 'none' : (i < paged.length - 1 ? '1px solid var(--border)' : 'none') }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                style={{ background: 'rgba(199,90,26,0.15)', color: 'var(--accent)' }}>
                                {entry.admin.email[0].toUpperCase()}
                              </div>
                              <span className="text-xs text-theme">{entry.admin.email}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4"><ActionBadge action={entry.action} /></td>
                          <td className="px-5 py-4">
                            <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                              style={{ background: 'rgba(96,165,250,0.08)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.15)' }}>
                              {entry.entityType}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-mono text-xs" style={{ color: 'var(--muted)' }}>{entry.entityId}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                              <Clock size={10} />
                              {new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {(entry.before || entry.after) && (
                              <ChevronDown size={13} style={{
                                color: 'var(--muted)',
                                transform: expanded === entry.id ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.2s',
                              }} />
                            )}
                          </td>
                        </tr>

                        {/* Diff row */}
                        {expanded === entry.id && (entry.before || entry.after) && (
                          <tr key={`${entry.id}-diff`}
                            style={{ borderBottom: i < paged.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td colSpan={6} className="px-5 pb-4 pt-1">
                              <DiffView before={entry.before} after={entry.after} />
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-40"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                Previous
              </button>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-40"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                Next
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
