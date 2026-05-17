'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Send,
  ChevronLeft,
  ChevronRight,
  Clock,
  Shield,
} from 'lucide-react';
import api from '@/lib/api';
import { useAppStore } from '@/lib/store';

type Group = {
  id: string;
  name: string;
  description?: string;
  sampradayaName?: string;
  memberCount: number;
};

type Message = {
  id: string;
  content: string;
  createdAt: string;
  status?: 'approved' | 'pending' | 'rejected';
  sender: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
};

type Member = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  role?: string;
};

function Avatar({
  name,
  url,
  size = 36,
}: {
  name: string;
  url?: string;
  size?: number;
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--gradient-gold)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.38,
        fontFamily: 'Playfair Display, serif',
        flexShrink: 0,
      }}
    >
      {initials || '🙏'}
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function MessageBubble({
  msg,
  isOwn,
  showDate,
}: {
  msg: Message;
  isOwn: boolean;
  showDate: boolean;
}) {
  const isPending = msg.status === 'pending';

  return (
    <>
      {showDate && (
        <div className="flex justify-center my-4">
          <span
            className="text-xs px-3 py-1 rounded-full font-semibold"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--muted)',
              border: '1px solid var(--border)',
            }}
          >
            {formatDate(msg.createdAt)}
          </span>
        </div>
      )}

      <div
        className={`flex gap-2.5 mb-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
        style={{ opacity: isPending ? 0.6 : 1 }}
      >
        {!isOwn && (
          <Avatar name={msg.sender.displayName} url={msg.sender.avatarUrl} size={32} />
        )}

        <div
          style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 3 }}
          className={isOwn ? 'items-end' : 'items-start'}
        >
          {!isOwn && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--peacock)',
                paddingLeft: 4,
              }}
            >
              {msg.sender.displayName}
            </span>
          )}

          <div
            style={{
              padding: '10px 14px',
              borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: isOwn
                ? 'var(--saffron)'
                : 'linear-gradient(135deg, rgba(196,168,130,0.18), rgba(196,168,130,0.28))',
              color: isOwn ? '#fff' : 'var(--text)',
              border: isOwn ? 'none' : '1px solid rgba(196,168,130,0.3)',
              fontSize: 14,
              lineHeight: 1.6,
              wordBreak: 'break-word',
            }}
          >
            {msg.content}
          </div>

          <div className="flex items-center gap-1.5" style={{ paddingLeft: isOwn ? 0 : 4 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>
              {formatTime(msg.createdAt)}
            </span>
            {isPending && (
              <span
                className="flex items-center gap-1"
                style={{
                  fontSize: 10,
                  color: 'var(--sandstone)',
                  background: 'rgba(196,168,130,0.18)',
                  border: '1px solid rgba(196,168,130,0.3)',
                  padding: '1px 6px',
                  borderRadius: 20,
                  fontWeight: 600,
                }}
              >
                <Shield size={9} /> Awaiting review
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const currentUser = useAppStore((s) => s.user);

  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const r = await api.get(`/groups/${id}/messages?take=100`);
      const msgs: Message[] = r.data?.data || r.data || [];
      setMessages(msgs);
    } catch {}
  }, [id]);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      api
        .get(`/groups/${id}`)
        .then((r) => setGroup(r.data?.data || r.data))
        .catch(() => {}),
      api
        .get(`/groups/${id}/members?take=50`)
        .then((r) => setMembers(r.data?.data || r.data || []))
        .catch(() => {}),
    ]).finally(() => setLoadingGroup(false));

    fetchMessages().finally(() => setLoadingMessages(false));

    pollingRef.current = setInterval(fetchMessages, 10000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [id, fetchMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      content: text,
      createdAt: new Date().toISOString(),
      status: 'pending',
      sender: {
        id: currentUser?.id || 'me',
        displayName: currentUser?.displayName || 'You',
        avatarUrl: currentUser?.avatarUrl,
      },
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput('');
    setSending(true);

    try {
      const r = await api.post(`/groups/${id}/messages`, { content: text });
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? r.data : m))
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const isOwnMessage = (msg: Message) =>
    currentUser?.id && msg.sender.id === currentUser.id;

  const shouldShowDate = (msg: Message, idx: number) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    return (
      new Date(msg.createdAt).toDateString() !==
      new Date(prev.createdAt).toDateString()
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      {/* Group header */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--peacock) 0%, var(--forest) 100%)',
          padding: '14px 16px',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -20,
            left: -20,
            width: 70,
            height: 70,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            pointerEvents: 'none',
          }}
        />

        <div className="flex items-center gap-3" style={{ position: 'relative' }}>
          <Link
            href="/groups"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.15)',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={18} style={{ color: '#fff' }} />
          </Link>

          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Users size={20} style={{ color: '#fff' }} />
          </div>

          <div className="flex-1 min-w-0">
            {loadingGroup ? (
              <>
                <div
                  className="h-4 rounded w-32 mb-1.5"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                />
                <div
                  className="h-3 rounded w-20"
                  style={{ background: 'rgba(255,255,255,0.12)' }}
                />
              </>
            ) : (
              <>
                <h1
                  className="font-bold truncate"
                  style={{
                    fontFamily: 'Playfair Display, serif',
                    fontSize: '1rem',
                    color: '#fff',
                    lineHeight: 1.2,
                  }}
                >
                  {group?.name || 'Group'}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {group?.sampradayaName && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.75)',
                        background: 'rgba(255,255,255,0.15)',
                        padding: '1px 7px',
                        borderRadius: 20,
                      }}
                    >
                      {group.sampradayaName}
                    </span>
                  )}
                  <span
                    className="flex items-center gap-1"
                    style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)' }}
                  >
                    <Users size={10} />
                    {group?.memberCount?.toLocaleString() ?? '—'} members
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Members toggle */}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 10,
              background: sidebarOpen ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.15)',
              flexShrink: 0,
              cursor: 'pointer',
              border: 'none',
            }}
            aria-label="Toggle member list"
          >
            <Users size={16} style={{ color: '#fff' }} />
          </button>
        </div>
      </div>

      {/* Main area: messages + optional member sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Messages pane */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Scrollable messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 16px 8px',
            }}
          >
            {loadingMessages ? (
              <div className="space-y-4 pt-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex gap-2.5 animate-pulse ${i % 3 === 0 ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'var(--surface-2)',
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        width: `${40 + (i % 4) * 10}%`,
                        height: 44 + (i % 3) * 12,
                        borderRadius: 16,
                        background: 'var(--surface-2)',
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    background: 'var(--gradient-sacred)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Users size={28} style={{ color: '#fff' }} />
                </div>
                <p
                  className="font-bold text-base mb-1"
                  style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text)' }}
                >
                  No messages yet
                </p>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Be the first to share wisdom
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isOwn={!!isOwnMessage(msg)}
                    showDate={shouldShowDate(msg, idx)}
                  />
                ))}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input bar */}
          <form
            onSubmit={handleSend}
            style={{
              padding: '10px 12px',
              borderTop: '1px solid var(--border)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              background: 'color-mix(in srgb, var(--bg-2) 88%, transparent)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
              flexShrink: 0,
            }}
          >
            <Avatar
              name={currentUser?.displayName || 'You'}
              url={currentUser?.avatarUrl}
              size={32}
            />
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                background: 'var(--surface)',
                border: '1.5px solid var(--border-2)',
                borderRadius: 22,
                padding: '0 14px',
                minHeight: 44,
                gap: 6,
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Share your wisdom…"
                maxLength={1000}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  fontSize: 14,
                  color: 'var(--text)',
                  lineHeight: 1.5,
                  padding: '10px 0',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || sending}
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: input.trim() && !sending ? 'var(--saffron)' : 'var(--surface-2)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
              aria-label="Send message"
            >
              <Send
                size={17}
                style={{
                  color: input.trim() && !sending ? '#fff' : 'var(--muted)',
                  transition: 'color 0.2s',
                }}
              />
            </button>
          </form>
        </div>

        {/* Member list sidebar */}
        {sidebarOpen && (
          <div
            style={{
              width: 220,
              borderLeft: '1px solid var(--border)',
              background: 'var(--bg-2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}
              >
                Members ({members.length})
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  padding: 2,
                  display: 'flex',
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
              {members.length === 0 ? (
                <p
                  className="text-xs text-center py-8"
                  style={{ color: 'var(--muted)' }}
                >
                  No members found
                </p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 rounded-xl p-2 mb-1"
                    style={{ transition: 'background 0.15s' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--surface-2)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <Avatar name={m.displayName} url={m.avatarUrl} size={28} />
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--text)',
                        }}
                      >
                        {m.displayName}
                      </p>
                      {m.role && (
                        <p style={{ fontSize: 10, color: 'var(--muted)' }}>{m.role}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
