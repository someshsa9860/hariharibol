'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import {
  CheckCircle, EyeOff, ShieldAlert, MessageSquare,
  Clock, Filter, RefreshCw, ChevronDown, Square, CheckSquare, X,
} from 'lucide-react';

interface ModerationMessage {
  id: string;
  content: string;
  user: { id: string; email: string; name: string };
  group: { id: string; name: string; sampradaya?: string };
  createdAt: string;
  aiVerdict?: 'SAFE' | 'DISRESPECTFUL' | 'SPAM' | 'HATE_SPEECH';
  aiReason?: string;
  aiConfidence?: number;
  status: 'pending' | 'approved' | 'hidden' | 'escalated';
}

interface ConfirmState {
  ids: string[];
  userIds: string[];
  action: 'approve' | 'reject' | 'ban';
  label: string;
}

const VERDICT_META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  SAFE:          { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)',  label: 'SAFE' },
  DISRESPECTFUL: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', label: 'DISRESPECTFUL' },
  SPAM:          { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',  label: 'SPAM' },
  HATE_SPEECH:   { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.3)', label: 'HATE SPEECH' },
};

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  pending:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  label: 'Pending' },
  approved:  { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  label: 'Approved' },
  hidden:    { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Rejected' },
  escalated: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', label: 'Escalated' },
};

const STATUS_FILTERS = [
  { key: 'pending',   label: 'Pending',   color: '#fbbf24' },
  { key: 'approved',  label: 'Approved',  color: '#4ade80' },
  { key: 'hidden',    label: 'Rejected',  color: '#f87171' },
  { key: 'escalated', label: 'Escalated', color: '#f87171' },
];

function VerdictBadge({ verdict }: { verdict?: string }) {
  if (!verdict) return null;
  const meta = VERDICT_META[verdict] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)', label: verdict };
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: status };
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide"
      style={{ color: meta.color, background: meta.bg }}>
      {meta.label}
    </span>
  );
}

function ConfidencePip({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#f87171' : pct >= 70 ? '#fbbf24' : '#4ade80';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-semibold" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function ModerationPage() {
  const [messages,    setMessages]    = useState<ModerationMessage[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [filter,      setFilter]      = useState('pending');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [confirm,     setConfirm]     = useState<ConfirmState | null>(null);

  useEffect(() => {
    fetchMessages();
    setSelected(new Set());
  }, [filter]);

  const fetchMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get(`/admin/moderation/queue?status=${filter}`);
      setMessages(r.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load moderation queue';
      setError(msg);
      setMessages([]);
    } finally { setLoading(false); }
  };

  const executeAction = async (state: ConfirmState) => {
    setConfirm(null);
    setActioningId(state.ids.length === 1 ? state.ids[0] : 'bulk');
    try {
      await Promise.all(state.ids.map((id, i) => {
        if (state.action === 'approve') return api.post(`/admin/moderation/${id}/approve`);
        if (state.action === 'reject')  return api.post(`/admin/moderation/${id}/reject`);
        return api.post(`/admin/users/${state.userIds[i]}/ban`, { reason: 'Escalated from moderation queue' });
      }));
      setSelected(new Set());
      fetchMessages();
    } catch { fetchMessages(); }
    finally { setActioningId(null); }
  };

  const requestAction = (ids: string[], userIds: string[], action: 'approve' | 'reject' | 'ban') => {
    const labels = { approve: 'Approve', reject: 'Reject', ban: 'Escalate to Ban' };
    setConfirm({ ids, userIds, action, label: labels[action] });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === messages.length) setSelected(new Set());
    else setSelected(new Set(messages.map(m => m.id)));
  };

  const selectedMessages = messages.filter(m => selected.has(m.id));
  const activeFilter = STATUS_FILTERS.find(f => f.key === filter)!;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <MessageSquare size={15} style={{ color: '#f87171' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Moderation Queue</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>AI-assisted message review</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              <span className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: `${activeFilter.color}18`, border: `1px solid ${activeFilter.color}30`, color: activeFilter.color }}>
                {messages.length} {activeFilter.label}
              </span>
            )}
            <button onClick={fetchMessages}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
              <RefreshCw size={13} />
            </button>
          </div>
        </header>

        <div className="p-8 max-w-4xl mx-auto space-y-5">

          {/* Filter tabs */}
          <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            {STATUS_FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
                style={{
                  background: filter === f.key ? `${f.color}18` : 'transparent',
                  border: filter === f.key ? `1px solid ${f.color}30` : '1px solid transparent',
                  color: filter === f.key ? f.color : 'var(--muted)',
                }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Quick-nav */}
          <div className="flex gap-2">
            {[
              { href: '/moderation/groups', label: 'Group Oversight', icon: Filter },
              { href: '/moderation/strikes', label: 'User Strikes', icon: ShieldAlert },
            ].map(({ href, label, icon: Icon }) => (
              <a key={href} href={href}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', textDecoration: 'none' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}>
                <Icon size={13} /> {label}
              </a>
            ))}
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && filter === 'pending' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl animate-slide-up"
              style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)' }}>
              <span className="text-xs font-semibold" style={{ color: '#a78bfa' }}>{selected.size} selected</span>
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => requestAction(
                    selectedMessages.map(m => m.id),
                    selectedMessages.map(m => m.user.id),
                    'approve'
                  )}
                  disabled={!!actioningId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}>
                  <CheckCircle size={12} /> Bulk Approve
                </button>
                <button
                  onClick={() => requestAction(
                    selectedMessages.map(m => m.id),
                    selectedMessages.map(m => m.user.id),
                    'reject'
                  )}
                  disabled={!!actioningId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
                  <EyeOff size={12} /> Bulk Reject
                </button>
                <button onClick={() => setSelected(new Set())}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Select-all row */}
          {!loading && messages.length > 0 && filter === 'pending' && (
            <div className="flex items-center gap-2 px-1">
              <button onClick={toggleAll} className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                {selected.size === messages.length
                  ? <CheckSquare size={15} style={{ color: '#a78bfa' }} />
                  : <Square size={15} />}
                {selected.size === messages.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-36 rounded-2xl" />
            ))}</div>
          ) : error ? (
            <div className="py-16 text-center rounded-2xl"
              style={{ background: 'var(--surface)', border: '1px solid rgba(248,113,113,0.3)' }}>
              <ShieldAlert size={32} className="mx-auto mb-3" style={{ color: '#f87171' }} />
              <p className="font-semibold text-theme mb-1">Failed to load queue</p>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{error}</p>
              <button onClick={fetchMessages}
                className="px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
                Retry
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-20 text-center rounded-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <MessageSquare size={36} className="mx-auto mb-3" style={{ color: 'rgba(155,143,168,0.3)' }} />
              <p className="font-semibold text-theme mb-1">All clear</p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No {filter} messages to review</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={msg.id} className="rounded-2xl overflow-hidden transition-all duration-200 animate-slide-up"
                  style={{
                    animationDelay: `${i * 60}ms`,
                    background: 'var(--surface)',
                    border: selected.has(msg.id)
                      ? '1px solid rgba(167,139,250,0.4)'
                      : '1px solid var(--surface-2)',
                  }}>

                  {/* Card header */}
                  <div className="px-5 py-3.5 flex items-center justify-between"
                    style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3">
                      {filter === 'pending' && (
                        <button onClick={() => toggleSelect(msg.id)} className="flex-shrink-0">
                          {selected.has(msg.id)
                            ? <CheckSquare size={16} style={{ color: '#a78bfa' }} />
                            : <Square size={16} style={{ color: 'var(--muted)' }} />}
                        </button>
                      )}
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,rgba(255,107,43,0.2),rgba(245,200,66,0.15))', color: 'var(--accent)', border: '1px solid rgba(255,107,43,0.2)' }}>
                        {(msg.user.name || msg.user.email)[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-theme">{msg.user.name || msg.user.email}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          {msg.user.email} · <span style={{ color: 'var(--accent)' }}>{msg.group.name}</span>
                          {msg.group.sampradaya && <span style={{ color: 'var(--muted)' }}> ({msg.group.sampradaya})</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={msg.status} />
                      <VerdictBadge verdict={msg.aiVerdict} />
                      <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                        <Clock size={11} />
                        {new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-5 py-4">
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text)', opacity: 0.85 }}>{msg.content}</p>

                    {(msg.aiReason || msg.aiConfidence) && (
                      <div className="mt-3 pt-3 flex items-start gap-3" style={{ borderTop: '1px solid var(--border)' }}>
                        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)' }}>
                          <ShieldAlert size={11} style={{ color: '#a78bfa' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{msg.aiReason}</p>
                          {msg.aiConfidence !== undefined && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-[10px]" style={{ color: 'var(--muted)', opacity: 0.7 }}>Confidence</span>
                              <ConfidencePip pct={msg.aiConfidence} />
                            </div>
                          )}
                        </div>
                        <button onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
                          className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold"
                          style={{ color: 'var(--muted)' }}>
                          Details <ChevronDown size={11} style={{ transform: expanded === msg.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>
                      </div>
                    )}

                    {expanded === msg.id && (
                      <div className="mt-3 px-3 py-2 rounded-xl text-xs space-y-1" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <div className="flex gap-2"><span style={{ color: 'var(--muted)' }}>Message ID:</span><span className="font-mono text-theme">{msg.id}</span></div>
                        <div className="flex gap-2"><span style={{ color: 'var(--muted)' }}>User ID:</span><span className="font-mono text-theme">{msg.user.id}</span></div>
                        <div className="flex gap-2"><span style={{ color: 'var(--muted)' }}>Group ID:</span><span className="font-mono text-theme">{msg.group.id}</span></div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {filter === 'pending' && (
                    <div className="px-5 pb-4 flex gap-2">
                      <button
                        onClick={() => requestAction([msg.id], [msg.user.id], 'approve')}
                        disabled={!!actioningId}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                        style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.1)'; }}>
                        <CheckCircle size={13} /> Approve
                      </button>
                      <button
                        onClick={() => requestAction([msg.id], [msg.user.id], 'reject')}
                        disabled={!!actioningId}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                        style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)'; }}>
                        <EyeOff size={13} /> Reject
                      </button>
                      <button
                        onClick={() => requestAction([msg.id], [msg.user.id], 'ban')}
                        disabled={!!actioningId}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                        style={{ background: 'rgba(192,132,252,0.1)', border: '1px solid rgba(192,132,252,0.25)', color: '#c084fc' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(192,132,252,0.2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(192,132,252,0.1)'; }}>
                        <ShieldAlert size={13} /> Escalate to Ban
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirm(null); }}>
          <div className="rounded-2xl p-6 max-w-sm w-full mx-4 animate-slide-up"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <h3 className="font-bold text-theme mb-2">Confirm: {confirm.label}</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
              {confirm.ids.length === 1
                ? `This will ${confirm.action} the selected message.`
                : `This will ${confirm.action} ${confirm.ids.length} messages at once.`}
              {' '}This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                Cancel
              </button>
              <button onClick={() => executeAction(confirm)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: confirm.action === 'approve' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                  border: confirm.action === 'approve' ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(248,113,113,0.3)',
                  color: confirm.action === 'approve' ? '#4ade80' : '#f87171',
                }}>
                Confirm {confirm.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
