'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import TopBar from '@/components/TopBar';
import { useAppStore } from '@/lib/store';

interface Message { role: 'user' | 'assistant'; text: string; }

const WELCOME: Message = {
  role: 'assistant',
  text: 'Hare Krishna! I am GuruDev, your spiritual guide. Ask me anything about Vedic philosophy, sacred texts, or your spiritual practice. 🙏',
};

export default function GuruDevPage() {
  const user = useAppStore((s) => s.user);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await api.post('/chatbot/message', { message: text });
      const reply = res.data?.response || res.data?.message || 'I am here to guide you on your spiritual path.';
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Forgive me — I am temporarily unavailable. Please try again shortly.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: 'var(--bg)', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TopBar title="GuruDev" />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1"
                style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}>
                <Sparkles size={14} />
              </div>
            )}
            <div
              className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
              style={{
                background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full flex items-center justify-center mr-2"
              style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}>
              <Sparkles size={14} />
            </div>
            <div className="px-4 py-3 rounded-2xl" style={{ background: 'var(--surface-2)' }}>
              <div className="flex gap-1">
                {[0, 0.15, 0.3].map((d, i) => (
                  <span key={i} className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: 'var(--muted)', animationDelay: `${d}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="fixed bottom-14 left-0 right-0 md:relative md:bottom-0 p-4"
        style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
        {!user && (
          <p className="text-xs text-center mb-2" style={{ color: 'var(--muted)' }}>
            Sign in to save your conversation history
          </p>
        )}
        <div className="flex gap-2 max-w-xl mx-auto">
          <input
            className="input-field flex-1 text-sm"
            placeholder="Ask a spiritual question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button onClick={send} disabled={!input.trim() || loading} className="btn-primary px-4 py-2 rounded-xl">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
