'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { CheckCircle, XCircle, MessageSquare, Clock, X } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  user: { email: string; name: string };
  group: { id: string; name: string };
  createdAt: string;
  isModerated: boolean;
  isFlagged: boolean;
}

const FILTERS = [
  { key: 'pending',  label: 'Pending',  color: '#fbbf24', glow: 'rgba(251,191,36,0.15)' },
  { key: 'approved', label: 'Approved', color: '#4ade80', glow: 'rgba(74,222,128,0.15)' },
  { key: 'rejected', label: 'Rejected', color: '#f87171', glow: 'rgba(248,113,113,0.15)' },
];

function Skeleton() {
  return <div className="skeleton h-32 rounded-2xl" />;
}

export default function ModerationPage() {
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('pending');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason,setRejectReason]= useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => { fetchMessages(); }, [filter]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/moderation/queue?status=${filter}`);
      setMessages(r.data || []);
    } catch { } finally { setLoading(false); }
  };

  const handleApprove = async (id: string) => {
    setActioningId(id);
    try { await api.post(`/admin/moderation/messages/${id}/approve`); fetchMessages(); }
    finally { setActioningId(null); }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return;
    setActioningId(id);
    try {
      await api.post(`/admin/moderation/messages/${id}/reject`, { reason: rejectReason });
      setRejectingId(null); setRejectReason(''); fetchMessages();
    } finally { setActioningId(null); }
  };

  const activeFilter = FILTERS.find(f => f.key === filter)!;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        {/* Header */}
        <header className="px-8 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <MessageSquare size={15} style={{ color: '#f87171' }} />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme">Moderation Queue</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Review and moderate user messages</p>
            </div>
          </div>

          {/* Count */}
          {!loading && (
            <div className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: `${activeFilter.glow}`, border: `1px solid ${activeFilter.color}30`, color: activeFilter.color }}>
              {messages.length} {activeFilter.label}
            </div>
          )}
        </header>

        <div className="p-8 max-w-4xl mx-auto space-y-6">

          {/* Filter tabs */}
          <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{
                  background: filter === f.key ? f.glow : 'transparent',
                  border: filter === f.key ? `1px solid ${f.color}30` : '1px solid transparent',
                  color: filter === f.key ? f.color : 'var(--muted)',
                  boxShadow: filter === f.key ? `0 0 12px ${f.glow}` : 'none',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          {loading ? (
            <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} />)}</div>
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
                <div key={msg.id}
                  className="rounded-2xl overflow-hidden transition-all duration-200 animate-slide-up"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--surface-2)',
                    animationDelay: `${i * 60}ms`,
                  }}>

                  {/* Card header */}
                  <div className="px-5 py-3.5 flex items-center justify-between"
                    style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, rgba(255,107,43,0.2), rgba(245,200,66,0.15))', color: 'var(--accent)', border: '1px solid rgba(255,107,43,0.2)' }}>
                        {msg.user.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-theme">{msg.user.email}</p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>in {msg.group.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                      <Clock size={11} />
                      {new Date(msg.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Message content */}
                  <div className="px-5 py-4">
                    <p className="text-sm leading-relaxed text-theme opacity-80">{msg.content}</p>
                  </div>

                  {/* Actions */}
                  {filter === 'pending' && (
                    <div className="px-5 pb-4">
                      {rejectingId === msg.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Reason for rejection…"
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleReject(msg.id)}
                            className="input-field text-xs py-2 flex-1"
                            autoFocus
                          />
                          <button onClick={() => handleReject(msg.id)} disabled={!rejectReason.trim() || actioningId === msg.id}
                            className="px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 disabled:opacity-40 flex-shrink-0"
                            style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                            {actioningId === msg.id ? '…' : 'Reject'}
                          </button>
                          <button onClick={() => { setRejectingId(null); setRejectReason(''); }}
                            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(msg.id)} disabled={actioningId === msg.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50"
                            style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.2)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.1)'; }}>
                            {actioningId === msg.id
                              ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                              : <CheckCircle size={14} />}
                            Approve
                          </button>
                          <button onClick={() => setRejectingId(msg.id)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                            style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.18)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)'; }}>
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
