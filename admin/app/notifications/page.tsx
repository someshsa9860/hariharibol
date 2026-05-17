'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Bell, Send, Clock, Users, CheckCircle, Eye, AlertCircle } from 'lucide-react';

interface SentNotification {
  id: string;
  title: string;
  body: string;
  topic: string;
  sentAt: string;
  recipientCount: number;
  status: 'sent' | 'scheduled' | 'failed';
}

const TOPICS = [
  { value: 'verse_of_day',   label: 'Verse of Day',   desc: 'All subscribed users' },
  { value: 'announcements',  label: 'Announcements',  desc: 'General announcements channel' },
];

const STATUS_META = {
  sent:      { color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  scheduled: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  failed:    { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
};

export default function NotificationsPage() {
  const [topic,       setTopic]       = useState<string>('verse_of_day');
  const [form,        setForm]        = useState({ title: '', body: '' });
  const [sending,     setSending]     = useState(false);
  const [sent,        setSent]        = useState(false);
  const [sendError,   setSendError]   = useState('');
  const [history,     setHistory]     = useState<SentNotification[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    setLoadingHist(true);
    try {
      const r = await api.get('/admin/notifications/history');
      setHistory(Array.isArray(r.data) ? r.data : []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHist(false);
    }
  };

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    setSending(true);
    setSendError('');
    try {
      await api.post('/admin/notifications/broadcast', {
        title: form.title,
        body: form.body,
        topic,
      });
      setSent(true);
      setForm({ title: '', body: '' });
      fetchHistory();
      setTimeout(() => setSent(false), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to send notification';
      setSendError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSending(false);
    }
  };

  const selectedTopic = TOPICS.find(t => t.value === topic);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">

        <header className="px-8 py-4 flex items-center gap-3 sticky top-0 z-10"
          style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <Bell size={15} style={{ color: '#fbbf24' }} />
          </div>
          <div>
            <h1 className="text-xl font-black text-theme">Push Notifications</h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Compose and send to FCM topic subscribers</p>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Compose panel */}
            <div className="lg:col-span-3 space-y-5">
              <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <h2 className="text-sm font-bold text-theme mb-5">Compose Notification</h2>

                {/* Topic select */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>
                    Topic <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      className="w-full appearance-none px-4 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}>
                      {TOPICS.map(t => (
                        <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: '#fbbf24' }}>
                      <Users size={13} />
                    </div>
                  </div>
                  {selectedTopic && (
                    <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
                      FCM topic: <span className="font-mono" style={{ color: '#fbbf24' }}>{topic}</span>
                    </p>
                  )}
                </div>

                {/* Title */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>
                    Title <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Verse of the Day"
                    className="input-field w-full"
                    maxLength={65}
                  />
                  <div className="text-right text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{form.title.length}/65</div>
                </div>

                {/* Body */}
                <div className="mb-5">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>
                    Body <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <textarea
                    value={form.body}
                    onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                    placeholder="Your notification message…"
                    rows={3}
                    className="input-field w-full resize-none"
                    maxLength={200}
                  />
                  <div className="text-right text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{form.body.length}/200</div>
                </div>

                {sendError && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-xs"
                    style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                    <AlertCircle size={13} />
                    {sendError}
                  </div>
                )}

                <button
                  onClick={handleSend}
                  disabled={sending || !form.title.trim() || !form.body.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-40"
                  style={{
                    background: sent
                      ? 'rgba(74,222,128,0.15)'
                      : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                    border: sent ? '1px solid rgba(74,222,128,0.3)' : 'none',
                    color: sent ? '#4ade80' : 'white',
                    boxShadow: sent ? 'none' : '0 4px 15px var(--accent-glow)',
                  }}>
                  {sending
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : sent
                      ? <><CheckCircle size={16} /> Sent!</>
                      : <><Send size={16} /> Send Now</>}
                </button>
              </div>
            </div>

            {/* Preview + History */}
            <div className="lg:col-span-2 space-y-5">

              {/* Preview */}
              <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Eye size={13} style={{ color: 'var(--muted)' }} />
                  <h3 className="text-xs font-bold text-theme uppercase tracking-wide">Preview</h3>
                </div>
                <div className="rounded-2xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}>
                      <span className="font-black" style={{ fontFamily: 'serif', color: 'white', fontSize: 16 }}>ॐ</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-bold text-theme">HariHariBol</p>
                        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>now</p>
                      </div>
                      <p className="text-xs font-semibold text-theme mb-0.5">
                        {form.title || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Notification title…</span>}
                      </p>
                      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                        {form.body || <span style={{ fontStyle: 'italic' }}>Notification body text…</span>}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] mt-2 text-center" style={{ color: 'var(--muted)' }}>
                  To: <span style={{ color: '#fbbf24' }}>{selectedTopic?.label ?? topic}</span>
                </p>
              </div>

              {/* History table */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <Clock size={13} style={{ color: 'var(--muted)' }} />
                  <h3 className="text-xs font-bold text-theme">Notification History</h3>
                </div>
                {loadingHist ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="skeleton h-8 rounded-lg" />)}
                  </div>
                ) : history.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <Bell size={24} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--muted)' }} />
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>No notifications sent yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Topic', 'Title', 'Sent At', 'Recipients'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left"
                              style={{ color: 'var(--muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((n, i) => {
                          const sm = STATUS_META[n.status] ?? STATUS_META.sent;
                          return (
                            <tr key={n.id}
                              style={{ borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                              <td className="px-4 py-3">
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
                                  style={{ background: sm.bg, color: sm.color }}>
                                  {n.topic?.replace(/_/g, '-') ?? '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-theme" style={{ maxWidth: 120 }}>
                                <span className="line-clamp-1">{n.title}</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                                {new Date(n.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>
                                {n.recipientCount > 0
                                  ? <span className="flex items-center gap-1"><Users size={10} /> {n.recipientCount.toLocaleString()}</span>
                                  : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
