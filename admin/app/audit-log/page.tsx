'use client';

import { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { ClipboardList, Clock, ChevronDown, Search, AlertCircle } from 'lucide-react';

interface AuditEntry {
  id: string;
  admin: { email: string };
  action: string;
  entityType: string;
  entityId: string;
  description?: string;
  timestamp: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

const ACTION_TYPES = [
  'BAN_USER', 'LIFT_BAN', 'APPROVE_MESSAGE', 'HIDE_MESSAGE',
  'ESCALATE_TO_BAN', 'UPDATE_VERSE', 'RESET_STRIKES',
  'SEND_NOTIFICATION', 'CREATE_CONTENT', 'DELETE_CONTENT',
];

const ENTITY_TYPES = ['User', 'Message', 'Verse', 'Ban', 'Notification', 'Mantra', 'Sampraday'];

type ActionCategory = 'CREATE' | 'UPDATE' | 'DELETE';

const CATEGORY_META: Record<ActionCategory, { color: string; bg: string; border: string }> = {
  CREATE: { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.25)' },
  UPDATE: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)' },
  DELETE: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
};

function getActionCategory(action: string): ActionCategory {
  const lower = action.toLowerCase();
  if (lower.includes('create') || lower.includes('send') || lower.includes('lift')) return 'CREATE';
  if (lower.includes('delete') || lower.includes('ban') || lower.includes('hide') || lower.includes('escalate')) return 'DELETE';
  return 'UPDATE';
}

function getActionDescription(entry: AuditEntry): string {
  if (entry.description) return entry.description;
  const map: Record<string, string> = {
    BAN_USER:          'User account suspended',
    LIFT_BAN:          'Ban lifted on user',
    APPROVE_MESSAGE:   'Message approved and restored',
    HIDE_MESSAGE:      'Message hidden from view',
    ESCALATE_TO_BAN:   'Escalated to account ban',
    UPDATE_VERSE:      'Verse content updated',
    RESET_STRIKES:     'User strike count reset',
    SEND_NOTIFICATION: 'Push notification dispatched',
    CREATE_CONTENT:    `${entry.entityType} created`,
    DELETE_CONTENT:    `${entry.entityType} deleted`,
  };
  return map[entry.action] ?? entry.action.replace(/_/g, ' ').toLowerCase();
}

function ActionBadge({ action }: { action: string }) {
  const cat = getActionCategory(action);
  const m = CATEGORY_META[cat];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider whitespace-nowrap"
        style={{ color: m.color, background: m.bg, border: `1px solid ${m.border}` }}>
        {cat}
      </span>
      <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: 'var(--muted)' }}>
        {action.replace(/_/g, ' ')}
      </span>
    </div>
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

const PAGE_SIZE = 50;

const selectStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 10,
  padding: '6px 10px',
  fontSize: 12,
  outline: 'none',
} as React.CSSProperties;

export default function AuditLogPage() {
  const [entries,          setEntries]          = useState<AuditEntry[]>([]);
  const [total,            setTotal]            = useState(0);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [search,           setSearch]           = useState('');
  const [expanded,         setExpanded]         = useState<string | null>(null);
  const [page,             setPage]             = useState(0);
  const [filterAction,     setFilterAction]     = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterDateFrom,   setFilterDateFrom]   = useState('');
  const [filterDateTo,     setFilterDateTo]     = useState('');

  const fetchLog = useCallback(async (currentPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ skip: String(currentPage * PAGE_SIZE), take: String(PAGE_SIZE) });
      if (filterAction)     params.set('action', filterAction);
      if (filterEntityType) params.set('entityType', filterEntityType);
      if (filterDateFrom)   params.set('dateFrom', filterDateFrom);
      if (filterDateTo)     params.set('dateTo', filterDateTo);

      const r = await api.get(`/admin/audit-log?${params.toString()}`);
      setEntries(r.data?.data || []);
      setTotal(r.data?.total ?? 0);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load audit log. Please try again.');
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterEntityType, filterDateFrom, filterDateTo]);

  useEffect(() => { fetchLog(page); }, [fetchLog, page]);

  const applyFilter = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(0); };
  const clearFilters = () => { setFilterAction(''); setFilterEntityType(''); setFilterDateFrom(''); setFilterDateTo(''); setPage(0); };
  const hasFilters = filterAction || filterEntityType || filterDateFrom || filterDateTo;

  const filtered = entries.filter(e =>
    !search ||
    e.admin.email.toLowerCase().includes(search.toLowerCase()) ||
    e.action.toLowerCase().includes(search.toLowerCase()) ||
    e.entityType.toLowerCase().includes(search.toLowerCase()) ||
    e.entityId.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

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
          {!loading && !error && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa' }}>
              {total.toLocaleString()} entries
            </span>
          )}
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-5">

          {/* Filter bar */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex flex-wrap items-center gap-3">
              <select value={filterAction} onChange={e => applyFilter(setFilterAction)(e.target.value)} style={selectStyle}>
                <option value="">All actions</option>
                {ACTION_TYPES.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={filterEntityType} onChange={e => applyFilter(setFilterEntityType)(e.target.value)} style={selectStyle}>
                <option value="">All entity types</option>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="date" value={filterDateFrom}
                onChange={e => applyFilter(setFilterDateFrom)(e.target.value)}
                style={{ ...selectStyle, colorScheme: 'dark' }} />
              <input type="date" value={filterDateTo}
                onChange={e => applyFilter(setFilterDateTo)(e.target.value)}
                style={{ ...selectStyle, colorScheme: 'dark' }} />
              {hasFilters && (
                <button onClick={clearFilters}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                  Clear filters
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <Search size={13} style={{ color: 'var(--muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by admin, action, entity type or ID…"
                className="flex-1 bg-transparent text-sm outline-none text-theme placeholder:text-[var(--muted)]" />
              {search && <button onClick={() => setSearch('')} className="text-xs" style={{ color: 'var(--muted)' }}>Clear</button>}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0 }} />
              <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
              <button onClick={() => fetchLog(page)} className="ml-auto px-3 py-1 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
                Retry
              </button>
            </div>
          )}

          {!error && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
              <table className="w-full border-collapse">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Timestamp', 'Admin', 'Action Type', 'Resource', 'Resource ID', 'Description', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left"
                        style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? [1, 2, 3, 4, 5].map(i => (
                      <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="skeleton h-7 rounded-lg" /></td></tr>
                    ))
                    : filtered.length === 0
                      ? (
                        <tr><td colSpan={7} className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>
                          {search ? 'No entries match your search.' : 'No audit log entries found.'}
                        </td></tr>
                      )
                      : filtered.map((entry, i) => (
                        <>
                          <tr key={entry.id} className="cursor-pointer transition-all duration-150"
                            style={{ borderBottom: expanded === entry.id ? 'none' : (i < filtered.length - 1 ? '1px solid var(--border)' : 'none') }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                                <Clock size={10} />
                                {new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                  style={{ background: 'rgba(199,90,26,0.15)', color: 'var(--accent)' }}>
                                  {entry.admin.email[0].toUpperCase()}
                                </div>
                                <span className="text-xs text-theme">{entry.admin.email}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><ActionBadge action={entry.action} /></td>
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                                style={{ background: 'rgba(96,165,250,0.08)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.15)' }}>
                                {entry.entityType}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--muted)' }}>{entry.entityId}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted)', maxWidth: 200 }}>
                              <span className="line-clamp-1">{getActionDescription(entry)}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {(entry.before || entry.after) && (
                                <ChevronDown size={13} style={{
                                  color: 'var(--muted)',
                                  transform: expanded === entry.id ? 'rotate(180deg)' : 'none',
                                  transition: 'transform 0.2s',
                                }} />
                              )}
                            </td>
                          </tr>

                          {expanded === entry.id && (entry.before || entry.after) && (
                            <tr key={`${entry.id}-diff`}
                              style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                              <td colSpan={7} className="px-4 pb-4 pt-1">
                                <DiffView before={entry.before} after={entry.after} />
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                </tbody>
              </table>
            </div>
          )}

          {!error && totalPages > 1 && (
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
