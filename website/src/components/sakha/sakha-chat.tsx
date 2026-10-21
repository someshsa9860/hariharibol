'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { Sheet } from '@/components/ui/sheet';
import { Spinner, ErrorState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth/auth-provider';
import { describeError } from '@/lib/api/client';
import { Composer } from './composer';
import { CreditMeter } from './credit-meter';
import { MessageBubble } from './message-bubble';
import { useSakha } from './use-sakha';

const STARTERS = [
  { icon: 'book', text: 'What is the meaning of Bhagavad Gita 2.47?' },
  { icon: 'chant', text: 'Help me begin chanting — I have only five minutes a day.' },
  { icon: 'heart', text: 'I feel restless and distracted. What can I do?' },
  { icon: 'sakha', text: 'Tell me a short story from the Bhagavatam.' },
] as const;

const QUICK = ['Tell me more', 'Give me a simple practice', 'Share a verse for this'];

export function SakhaChat() {
  const { user } = useAuth();
  const toast = useToast();
  const chat = useSakha();
  const [confirmClear, setConfirmClear] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // Follow the reply as it is written, unless the reader has scrolled up to read.
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [chat.lines]);

  if (chat.loading) return <div className="center-state"><Spinner /></div>;
  if (chat.loadError || !chat.status) return <ErrorState message="Sakha could not be reached right now." onRetry={chat.load} />;

  const { status, lines, conversation } = chat;
  const credits = status.credits;
  const unavailable = credits.enabled === false;
  const blocked = unavailable || credits.exhausted;
  const last = lines[lines.length - 1];
  const lastUser = [...lines].reverse().find((l) => l.role === 'user');
  const limitReached = conversation?.limitReached;
  const first = (user?.name ?? '').split(' ')[0];

  const doClear = async () => {
    try { await chat.clear(); setConfirmClear(false); toast('Your chat was cleared'); }
    catch (failure) { toast(describeError(failure)); }
  };

  return (
    <div className="sakha">
      <header className="sakha-head">
        <div className="sakha-title">
          <span className="sakha-badge" aria-hidden="true"><Icon name="sakha" size={20} /></span>
          <div><h1>Ask Sakha</h1><small className="muted">A devotional friend</small></div>
        </div>
        <CreditMeter credits={credits} />
        <button className="icon-btn" aria-label="Clear this chat" disabled={chat.sending || lines.length === 0} onClick={() => setConfirmClear(true)}><Icon name="trash" /></button>
      </header>

      <div className="sakha-scroll" ref={scroller} onScroll={(event) => { const el = event.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {lines.length === 0 ? (
          <div className="welcome enter">
            <span className="welcome-art" aria-hidden="true"><Icon name="sakha" size={34} /></span>
            <h2>Hari Bol{first ? `, ${first}` : ''}!</h2>
            <p className="muted">{status.description}</p>
            <div className="starter-grid">
              {STARTERS.map((s) => (
                <button key={s.text} className="starter card card-hover" disabled={blocked || chat.sending} onClick={() => chat.send(s.text)}>
                  <Icon name={s.icon} size={20} /><span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="thread" aria-live="polite">
            {lines.map((line, index) => (
              <MessageBubble key={line.id} line={line} isLast={index === lines.length - 1} canRegenerate={!chat.sending && !blocked} onRegenerate={chat.regenerate} onRetry={() => (line.role === 'assistant' && lastUser ? chat.regenerate() : undefined)} />
            ))}
            {!chat.sending && last?.role === 'assistant' && last.content && !last.problem && !blocked && !limitReached && (
              <div className="quick-replies">{QUICK.map((q) => <button key={q} className="chip" onClick={() => chat.send(q)}>{q}</button>)}</div>
            )}
          </div>
        )}
      </div>

      {(unavailable || credits.exhausted) && (
        <div className="upgrade card">
          <div>
            <strong>{unavailable ? 'Sakha is part of the paid plans' : 'You have used your replies for now'}</strong>
            <p className="muted">{unavailable ? 'Choose a plan to talk with Sakha — from ₹49 a month.' : credits.limitedBy === 'daily' ? 'Today’s replies refill at midnight.' : 'They renew with your plan.'}</p>
          </div>
          {(unavailable || credits.canUpgrade) && <Link href="/plans" className="btn btn-primary btn-sm">See plans</Link>}
        </div>
      )}

      {limitReached && (
        <div className="upgrade card">
          <div><strong>This chat has grown long</strong><p className="muted">Start a new one and Sakha will remember where you were.</p></div>
          <button className="btn btn-primary btn-sm" onClick={() => chat.startNew().catch((f) => toast(describeError(f)))}>New chat</button>
        </div>
      )}

      <Composer
        disabled={blocked || Boolean(limitReached)} sending={chat.sending} maxChars={status.limits.maxInputChars || 4000} allowImage
        onSend={chat.send} onStop={chat.stop}
      />

      {confirmClear && (
        <Sheet title="Clear this chat?" onClose={() => setConfirmClear(false)}>
          <p className="muted">This removes the conversation, the pictures you shared, and what Sakha remembered from it. Replies already used are not given back.</p>
          <div className="confirm-row">
            <button className="btn btn-ghost" onClick={() => setConfirmClear(false)}>Keep it</button>
            <button className="btn btn-danger" onClick={doClear}>Clear chat</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
