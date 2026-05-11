'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import {
  CheckCircle, EyeOff, ShieldAlert, MessageSquare,
  Clock, Filter, RefreshCw, ChevronDown,
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

const VERDICT_META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  SAFE:           { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)',  label: 'SAFE' },
  DISRESPECTFUL:  { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)', label: 'DISRESPECTFUL' },
  SPAM:           { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',  label: 'SPAM' },
  HATE_SPEECH:    { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.3)', label: 'HATE SPEECH' },
};

const STATUS_FILTERS = [
  { key: 'pending',   label: 'Pending',   color: '#fbbf24' },
  { key: 'approved',  label: 'Approved',  color: '#4ade80' },
  { key: 'hidden',    label: 'Hidden',    color: '#94a3b8' },
  { key: 'escalated', label: 'Escalated', color: '#f87171' },
];

const MOCK_MESSAGES: ModerationMessage[] = [
  {
    id: '1', content: 'This verse has no meaning and your interpretation is completely wrong!',
    user: { id: 'u1', email: 'angry.user@example.com', name: 'Angry User' },
    group: { id: 'g1', name: 'Bhagavad Gita Study', sampradaya: 'Vaishnavism' },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    aiVerdict: 'DISRESPECTFUL', aiReason: 'Contains dismissive and offensive language toward spiritual teachings.', aiConfidence: 91,
    status: 'pending',
  },
  {
    id: '2', content: 'Buy cheap rudrakshas here!! Click link in bio for 50% OFF 🙏',
    user: { id: 'u2', email: 'spammer@example.com', name: 'Spam Bot' },
    group: { id: 'g2', name: 'Mantra Chanting Circle', sampradaya: 'Shaivism' },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    aiVerdict: 'SPAM', aiReason: 'Promotional content with commercial links detected.', aiConfidence: 98,
    status: 'pending',
  },
  {
    id: '3', content: 'Could someone explain the deeper meaning of the Gayatri Mantra? I am just beginning my journey.',
    user: { id: 'u3', email: 'seeker@example.com', name: 'New Seeker' },
    group: { id: 'g1', name: 'Bhagavad Gita Study', sampradaya: 'Vaishnavism' },
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    aiVerdict: 'SAFE', aiReason: 'Genuine spiritual inquiry with respectful tone.', aiConfidence: 99,
    status: 'pending',
  },
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
  const [messages,   setMessages]   = useState<ModerationMessage[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('pending');
  const [actioningId,setActioningId]= useState<string | null>(null);
  const [expanded,   setExpanded]   = useState<string | null>(null);

  useEffect(() => { fetchMessages(); }, [filter]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/moderation/queue?status=${filter}`);
      setMessages(r.data || []);
    } catch {
      setMessages(MOCK_MESSAGES.filter(m => m.status === filter));
    } finally { setLoading(false); }
  };

  const act = async (id: string, endpoint: string, body?: object) => {
    setActioningId(id);
    try { await api.post(endpoint, body); fetchMessages(); }
    catch { fetchMessages(); }
    finally { setActioningId(null); }
  };

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

          {/* Quick-nav sub-pages */}
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

          {loading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-36 rounded-2xl" />
            ))}</div>
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
                  style={{ animationDelay: `${i * 60}ms`, background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>

                  {/* Card header */}
                  <div className="px-5 py-3.5 flex items-center justify-between"
                    style={{ borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3">
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

                    {/* AI analysis row */}
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

                    {/* Expanded meta */}
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
                      <button onClick={() => act(msg.id, `/admin/moderation/messages/${msg.id}/approve`)}
                        disabled={actioningId === msg.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                        style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.1)'; }}>
                        <CheckCircle size={13} /> Approve & Restore
                      </button>
                      <button onClick={() => act(msg.id, `/admin/moderation/messages/${msg.id}/hide`)}
                        disabled={actioningId === msg.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                        style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(148,163,184,0.1)'; }}>
                        <EyeOff size={13} /> Confirm Hide
                      </button>
                      <button onClick={() => act(msg.id, `/admin/moderation/messages/${msg.id}/escalate`)}
                        disabled={actioningId === msg.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                        style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)'; }}>
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
    </div>
  );
}
