'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { Bell, Send, Clock, Users, Globe2, CheckCircle, Eye, AlertCircle, ChevronDown } from 'lucide-react';

interface SentNotification {
  id: string;
  title: string;
  body: string;
  topic: string;
  sentAt: string;
  recipientCount: number;
  status: 'sent' | 'scheduled' | 'failed';
}

interface Sampraday {
  id: string;
  slug: string;
  nameKey: string;
}

export default function NotificationsPage() {
  const [topic,        setTopic]        = useState<string>('verse_of_day');
  const [form,         setForm]         = useState({ title: '', body: '', deepLink: '' });
  const [sending,      setSending]      = useState(false);
  const [sent,         setSent]         = useState(false);
  const [sendError,    setSendError]    = useState('');
  const [history,      setHistory]      = useState<SentNotification[]>([]);
  const [loadingHist,  setLoadingHist]  = useState(true);
  const [sampradayas,  setSampradayas]  = useState<Sampraday[]>([]);
  const [loadingSamp,  setLoadingSamp]  = useState(true);

  useEffect(() => {
    fetchSampradayas();
    fetchHistory();
  }, []);

  const fetchSampradayas = async () => {
    setLoadingSamp(true);
    try {
      const r = await api.get('/sampradayas?take=100');
      const list: Sampraday[] = Array.isArray(r.data)
        ? r.data
        : Array.isArray(r.data?.data)
          ? r.data.data
          : [];
      setSampradayas(list);
    } catch {
      setSampradayas([]);
    } finally {
      setLoadingSamp(false);
    }
  };

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
        deepLink: form.deepLink || undefined,
      });
      setSent(true);
      setForm({ title: '', body: '', deepLink: '' });
      fetchHistory();
      setTimeout(() => setSent(false), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to send notification';
      setSendError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSending(false);
    }
  };

  const audienceLabel = topic === 'verse_of_day'
    ? 'All Users'
    : sampradayas.find(s => `vod_${s.slug}` === topic)?.nameKey ?? topic;

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

            {/* Compose panel (3 cols) */}
            <div className="lg:col-span-3 space-y-5">
              <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <h2 className="text-sm font-bold text-theme mb-4">Compose Notification</h2>

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
                <div className="mb-4">
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

                {/* Deep link */}
                <div className="mb-5">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>
                    Deep Link <span className="font-normal opacity-60">(optional)</span>
                  </label>
                  <input
                    value={form.deepLink}
                    onChange={e => setForm(f => ({ ...f, deepLink: e.target.value }))}
                    placeholder="hhb://verse/123 or hhb://home"
                    className="input-field w-full"
                  />
                </div>

                {/* Topic / Audience */}
                <div className="mb-5">
                  <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Audience (FCM Topic)</label>

                  {/* All Users option */}
                  <button
                    onClick={() => setTopic('verse_of_day')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 mb-2"
                    style={{
                      background: topic === 'verse_of_day' ? 'rgba(251,191,36,0.08)' : 'var(--bg)',
                      border: topic === 'verse_of_day' ? '1px solid rgba(251,191,36,0.3)' : '1px solid var(--border)',
                    }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: topic === 'verse_of_day' ? 'rgba(251,191,36,0.15)' : 'var(--surface-2)' }}>
                      <Globe2 size={14} style={{ color: topic === 'verse_of_day' ? '#fbbf24' : 'var(--muted)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: topic === 'verse_of_day' ? '#fbbf24' : 'var(--text)' }}>All Users</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>Broadcast to every subscriber (topic: verse_of_day)</p>
                    </div>
                    <div className="ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: topic === 'verse_of_day' ? '#fbbf24' : 'var(--border)' }}>
                      {topic === 'verse_of_day' && <div className="w-2 h-2 rounded-full" style={{ background: '#fbbf24' }} />}
                    </div>
                  </button>

                  {/* Per-sampraday selector */}
                  {loadingSamp ? (
                    <div className="skeleton h-12 rounded-xl" />
                  ) : sampradayas.length > 0 && (
                    <div className="relative">
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{
                          background: topic !== 'verse_of_day' ? 'rgba(251,191,36,0.08)' : 'var(--bg)',
                          border: topic !== 'verse_of_day' ? '1px solid rgba(251,191,36,0.3)' : '1px solid var(--border)',
                        }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: topic !== 'verse_of_day' ? 'rgba(251,191,36,0.15)' : 'var(--surface-2)' }}>
                          <Users size={14} style={{ color: topic !== 'verse_of_day' ? '#fbbf24' : 'var(--muted)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold mb-0.5" style={{ color: topic !== 'verse_of_day' ? '#fbbf24' : 'var(--text)' }}>
                            Specific Sampraday
                          </p>
                          <div className="relative">
                            <select
                              value={topic !== 'verse_of_day' ? topic : ''}
                              onChange={e => setTopic(e.target.value || 'verse_of_day')}
                              className="w-full appearance-none text-xs pr-6 py-0.5 rounded-lg bg-transparent outline-none cursor-pointer"
                              style={{ color: 'var(--muted)', border: 'none' }}>
                              <option value="">— select a sampraday —</option>
                              {sampradayas.map(s => (
                                <option key={s.id} value={`vod_${s.slug}`}>{s.nameKey}</option>
                              ))}
                            </select>
                            <ChevronDown size={11} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
                          </div>
                        </div>
                        <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                          style={{ borderColor: topic !== 'verse_of_day' ? '#fbbf24' : 'var(--border)' }}>
                          {topic !== 'verse_of_day' && <div className="w-2 h-2 rounded-full" style={{ background: '#fbbf24' }} />}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Error */}
                {sendError && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4 text-xs"
                    style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171' }}>
                    <AlertCircle size={13} />
                    {sendError}
                  </div>
                )}

                {/* Send button */}
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

            {/* Preview + History (2 cols) */}
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
                  Sending to: <span style={{ color: '#fbbf24' }}>{audienceLabel}</span>
                </p>
              </div>

              {/* Sent history */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--surface-2)' }}>
                <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <Clock size={13} style={{ color: 'var(--muted)' }} />
                  <h3 className="text-xs font-bold text-theme">Recent Sends</h3>
                </div>
                {loadingHist ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
                  </div>
                ) : history.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <Bell size={24} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--muted)' }} />
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>No notifications sent yet</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {history.map(n => (
                      <div key={n.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-xs font-semibold text-theme leading-tight flex-1">{n.title}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold flex-shrink-0"
                            style={{
                              color: n.status === 'sent' ? '#4ade80' : n.status === 'scheduled' ? '#fbbf24' : '#f87171',
                              background: n.status === 'sent' ? 'rgba(74,222,128,0.1)' : n.status === 'scheduled' ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)',
                            }}>
                            {n.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] mb-2 line-clamp-1" style={{ color: 'var(--muted)' }}>{n.body}</p>
                        <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--muted)' }}>
                          <span className="flex items-center gap-1">
                            <Clock size={9} />
                            {new Date(n.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {n.recipientCount > 0 && (
                            <span className="flex items-center gap-1"><Users size={9} /> {n.recipientCount.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    ))}
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
