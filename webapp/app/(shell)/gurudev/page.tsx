'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAppStore } from '@/lib/store';

interface Message { role: 'user' | 'assistant'; text: string; }

const SUGGESTED = [
  'What is the meaning of dharma?',
  'How can I overcome attachment?',
  'Explain the concept of karma',
  'What is moksha?',
];

const DEVANAGARI_RE = /[ऀ-ॿ]/;

function parseMessage(text: string): { type: 'text' | 'verse'; content: string }[] {
  const lines = text.split('\n');
  const segs: { type: 'text' | 'verse'; content: string }[] = [];
  for (const line of lines) {
    const type = DEVANAGARI_RE.test(line) && line.trim().length > 3 ? 'verse' : 'text';
    const last = segs[segs.length - 1];
    if (last && last.type === type) {
      last.content += '\n' + line;
    } else {
      segs.push({ type, content: line });
    }
  }
  return segs;
}

function LotusAvatar() {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #E8A0A0, #7B1C1C)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
    }}>🪷</div>
  );
}

function SuggestedPill({ label, onClick, small }: { label: string; onClick: () => void; small?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: small ? '5px 12px' : '8px 16px',
        borderRadius: 9999, fontSize: small ? '0.72rem' : '0.8rem',
        border: '1.5px solid #FF6B00',
        background: hovered ? '#FF6B00' : 'transparent',
        color: hovered ? '#fff' : 'var(--text)',
        cursor: 'pointer', transition: 'all 0.18s', whiteSpace: 'nowrap',
      }}
    >{label}</button>
  );
}

function GoldInput({ value, onChange, onSend }: { value: string; onChange: (v: string) => void; onSend: () => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      style={{
        flex: 1, padding: '10px 18px', borderRadius: 24,
        border: `1.5px solid ${focused ? '#D4A055' : 'var(--border-2)'}`,
        boxShadow: focused ? '0 0 0 3px rgba(212,160,85,0.22)' : 'none',
        background: 'rgba(251,247,239,0.9)',
        color: 'var(--text)', fontSize: '0.875rem', outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      placeholder="Ask a spiritual question…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
    />
  );
}

export default function GuruDevPage() {
  const user = useAppStore((s) => s.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await api.post('/chatbot/message', { message: msg });
      const reply = res.data?.response || res.data?.message || 'I am here to guide you on your spiritual path.';
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Forgive me — I am temporarily unavailable. Please try again shortly.' }]);
    } finally {
      setLoading(false);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Gradient sacred header */}
      <div style={{
        background: 'linear-gradient(135deg, #006B6B, #2D5A27)',
        padding: '0.875rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '1rem',
        flexShrink: 0, boxShadow: '0 4px 20px rgba(0,107,107,0.3)',
      }}>
        <Link href="/" style={{ color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <ArrowLeft size={20} />
        </Link>

        {/* Om avatar in gold circle */}
        <div style={{
          width: 46, height: 46, borderRadius: '50%',
          background: 'linear-gradient(135deg, #D4A055, #B07830)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', fontFamily: '"Noto Sans Devanagari", serif', color: '#fff',
          boxShadow: '0 0 0 3px rgba(212,160,85,0.35)',
        }}>ॐ</div>

        <div>
          <h1 style={{
            fontFamily: '"Playfair Display", Georgia, serif',
            color: '#fff', fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.2, margin: 0,
          }}>GuruDev</h1>
          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.72rem', margin: 0, letterSpacing: '0.03em' }}>
            AI Spiritual Guide
          </p>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 5px #4ade80' }} />
          <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.7rem' }}>Online</span>
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', paddingBottom: '5.5rem' }}>
        {isEmpty ? (
          /* Empty state */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: '58vh', textAlign: 'center', gap: '1.5rem',
          }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: 'linear-gradient(135deg, #006B6B, #2D5A27)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.8rem', fontFamily: '"Noto Sans Devanagari", serif', color: '#fff',
              boxShadow: '0 8px 32px rgba(0,107,107,0.28)',
            }} className="animate-float">ॐ</div>

            <div>
              <h2 style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem',
              }}>Ask GuruDev anything about dharma</h2>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', maxWidth: 300, lineHeight: 1.6, margin: '0 auto' }}>
                Drawing from Vedic wisdom to illuminate your spiritual path
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 440 }}>
              {SUGGESTED.map((q) => (
                <SuggestedPill key={q} label={q} onClick={() => send(q)} />
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 680, margin: '0 auto' }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end', gap: 10,
              }}>
                {m.role === 'assistant' && <LotusAvatar />}

                <div style={{
                  maxWidth: '78%',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg, #FF6B00, #7B1C1C)'
                    : '#C4A882',
                  color: m.role === 'user' ? '#fff' : '#1A1410',
                  borderRadius: m.role === 'user' ? '20px 20px 4px 20px' : '4px 20px 20px 20px',
                  padding: '11px 15px', fontSize: '0.875rem', lineHeight: 1.7,
                  boxShadow: m.role === 'user'
                    ? '0 4px 16px rgba(255,107,0,0.22)'
                    : '0 2px 8px rgba(0,0,0,0.08)',
                }}>
                  {m.role === 'assistant'
                    ? parseMessage(m.text).map((seg, si) =>
                        seg.type === 'verse' ? (
                          /* Verse citation card */
                          <div key={si} style={{
                            margin: '8px 0', padding: '10px 14px',
                            borderLeft: '4px solid #FF6B00',
                            background: 'rgba(255,255,255,0.45)',
                            borderRadius: '0 8px 8px 0',
                          }}>
                            <p style={{
                              fontFamily: '"Noto Sans Devanagari", serif',
                              fontSize: '0.95rem', lineHeight: 2, margin: 0,
                              color: '#1A1410', whiteSpace: 'pre-line',
                            }}>{seg.content.trim()}</p>
                          </div>
                        ) : seg.content.trim() ? (
                          <p key={si} style={{ margin: si === 0 ? 0 : '6px 0 0' }}>{seg.content.trim()}</p>
                        ) : null
                      )
                    : <p style={{ margin: 0 }}>{m.text}</p>
                  }
                </div>
              </div>
            ))}

            {/* Typing indicator — three dots in peacock color */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <LotusAvatar />
                <div style={{
                  padding: '14px 18px', borderRadius: '4px 20px 20px 20px',
                  background: '#C4A882', display: 'flex', gap: 5, alignItems: 'center',
                }}>
                  {[0, 150, 300].map((delay, i) => (
                    <span key={i} style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#006B6B',
                      display: 'inline-block',
                      animation: `gurudev-bounce 1.2s ease-in-out ${delay}ms infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* Quick reply pills */}
            {!loading && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {SUGGESTED.slice(0, 2).map((q) => (
                  <SuggestedPill key={q} label={q} onClick={() => send(q)} small />
                ))}
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar — glass bg, gold focus ring, saffron send */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '0.75rem 1rem 1rem',
        backdropFilter: 'blur(16px)',
        background: 'rgba(251,247,239,0.88)',
        borderTop: '1px solid var(--border)',
      }}>
        {!user && (
          <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted)', marginBottom: 6 }}>
            Sign in to save your conversation history
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, maxWidth: 680, margin: '0 auto', alignItems: 'center' }}>
          <GoldInput value={input} onChange={setInput} onSend={send} />
          <button onClick={() => send()} disabled={!input.trim() || loading} style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none',
            cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
            background: input.trim() && !loading ? '#FF6B00' : 'var(--border)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s', flexShrink: 0,
          }}>
            <Send size={16} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes gurudev-bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%            { transform: translateY(-7px); }
        }
      `}</style>
    </div>
  );
}
