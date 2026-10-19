'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, rawRequest } from '@/lib/api/client';
import { ApiError, readEnvelope } from '@/lib/api/core';
import { readEvents } from '@/lib/sse';
import type { ChatMessage, Conversation, Credits } from '@/lib/types';
import { problemFor, type ChatProblem } from './chat-problems';

export type Action =
  | { type: 'page'; page: string }
  | { type: 'mantra'; slug: string; title: string }
  | { type: 'verse'; bookSlug: string; canto: number | null; chapter: number; verse: number; title: string };

export interface Line extends ChatMessage {
  streaming?: boolean;
  action?: Action | null;
  problem?: (ChatProblem & { code: string }) | null;
}

interface Status { description: string; credits: Credits; limits: { maxInputChars: number; maxMessages: number } }

let tempId = 0;
const temp = () => `tmp-${Date.now()}-${tempId++}`;

/** Everything the chat screen does: load the one conversation, stream replies, stop, answer again, clear. */
export function useSakha() {
  const [status, setStatus] = useState<Status | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const convo = useRef<Conversation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [st, current] = await Promise.all([
        api<Status>('/chat/status', { auth: 'required' }),
        api<Conversation | null>('/chat/current', { auth: 'required' }),
      ]);
      setStatus(st);
      convo.current = current;
      setConversation(current);
      setLines(current?.messages ?? []);
    } catch {
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); return () => abort.current?.abort(); }, [load]);

  const patchLast = (fn: (line: Line) => Line) => setLines((list) => (list.length ? [...list.slice(0, -1), fn(list[list.length - 1])] : list));

  /** Runs one streamed exchange against `path` and folds its events into the screen. */
  const stream = useCallback(async (path: string, body: unknown) => {
    const controller = new AbortController();
    abort.current = controller;
    setSending(true);
    let assistantId = '';
    try {
      const response = await rawRequest(path, { method: 'POST', body, auth: 'required', signal: controller.signal, headers: { Accept: 'text/event-stream' } });
      if (!response.ok) await readEnvelope(response); // throws the API's own error
      await readEvents(response, (event, data) => {
        const d = data as Record<string, unknown>;
        if (event === 'meta') {
          assistantId = String(d.assistantMessageId);
          if (d.conversation) { convo.current = { ...(convo.current as Conversation), ...(d.conversation as Conversation) }; setConversation(convo.current); }
          setLines((list) => list.map((l) => (l.id.startsWith('tmp-u') && d.userMessage ? { ...(d.userMessage as ChatMessage) } : l.id.startsWith('tmp-a') ? { ...l, id: assistantId } : l)));
        } else if (event === 'delta') {
          patchLast((l) => ({ ...l, content: l.content + String(d.text ?? '') }));
        } else if (event === 'action') {
          patchLast((l) => ({ ...l, action: d as unknown as Action }));
        } else if (event === 'done') {
          if (d.credits) setStatus((s) => (s ? { ...s, credits: d.credits as Credits } : s));
          if (d.conversation) { convo.current = { ...(convo.current as Conversation), ...(d.conversation as Conversation) }; setConversation(convo.current); }
          patchLast((l) => ({ ...(d.message as ChatMessage), streaming: false, action: l.action }));
        } else if (event === 'error') {
          const code = String(d.code ?? 'SERVER_ERROR');
          patchLast((l) => (l.content ? { ...l, streaming: false, status: 'PARTIAL', problem: { ...problemFor(code), code } } : { ...l, streaming: false, problem: { ...problemFor(code), code } }));
          if (code === 'CREDITS_EXHAUSTED') void api<Status>('/chat/status', { auth: 'required' }).then(setStatus).catch(() => undefined);
        }
      });
      // A stream that ends with no `done` or `error` was cut off.
      patchLast((l) => (l.streaming ? { ...l, streaming: false, status: l.content ? 'STOPPED' : l.status } : l));
    } catch (failure) {
      if (controller.signal.aborted) {
        patchLast((l) => ({ ...l, streaming: false, status: 'STOPPED' }));
      } else {
        const code = failure instanceof ApiError ? failure.code : 'NETWORK';
        const problem = { ...problemFor(code === 'NETWORK' ? 'NETWORK' : code), code };
        // The reply never started: drop the empty bubble and show the problem under the question.
        setLines((list) => {
          const last = list[list.length - 1];
          if (last?.role === 'assistant' && !last.content) return [...list.slice(0, -1), { ...last, streaming: false, problem }];
          return list;
        });
        if (code === 'CREDITS_EXHAUSTED') void api<Status>('/chat/status', { auth: 'required' }).then(setStatus).catch(() => undefined);
      }
    } finally {
      setSending(false);
      abort.current = null;
    }
  }, []);

  const send = useCallback(async (content: string, imageKey?: string, imageUrl?: string) => {
    if (sending) return;
    let current = convo.current;
    try {
      if (!current) {
        current = await api<Conversation>('/chat/conversations', { method: 'POST', auth: 'required', body: {} });
        convo.current = current;
        setConversation(current);
      }
    } catch (failure) {
      setLines((list) => [...list, { id: temp(), seq: 0, role: 'assistant', content: '', imageUrl: null, status: 'ERROR', createdAt: new Date().toISOString(), problem: { ...problemFor(failure instanceof ApiError ? failure.code : 'NETWORK'), code: 'X' } }]);
      return;
    }
    const now = new Date().toISOString();
    setLines((list) => [
      ...list.filter((l) => !l.problem || l.role !== 'assistant' || l.content), // an old failed attempt is replaced
      { id: `tmp-u${temp()}`, seq: 0, role: 'user', content, imageUrl: imageUrl ?? null, status: 'COMPLETE', createdAt: now },
      { id: `tmp-a${temp()}`, seq: 0, role: 'assistant', content: '', imageUrl: null, status: 'PARTIAL', createdAt: now, streaming: true },
    ]);
    await stream(`/chat/conversations/${current.id}/messages`, { content, imageKey });
  }, [sending, stream]);

  const regenerate = useCallback(async () => {
    const current = convo.current;
    if (!current || sending) return;
    setLines((list) => {
      const trimmed = list[list.length - 1]?.role === 'assistant' ? list.slice(0, -1) : list;
      return [...trimmed, { id: `tmp-a${temp()}`, seq: 0, role: 'assistant', content: '', imageUrl: null, status: 'PARTIAL', createdAt: new Date().toISOString(), streaming: true }];
    });
    await stream(`/chat/conversations/${current.id}/regenerate`, {});
  }, [sending, stream]);

  const stop = useCallback(() => abort.current?.abort(), []);

  const clear = useCallback(async () => {
    await api('/chat/conversations', { method: 'DELETE', auth: 'required' });
    convo.current = null;
    setConversation(null);
    setLines([]);
    void api<Status>('/chat/status', { auth: 'required' }).then(setStatus).catch(() => undefined);
  }, []);

  const startNew = useCallback(async () => {
    const current = convo.current;
    if (!current) return;
    const next = await api<Conversation>(`/chat/conversations/${current.id}/continue`, { method: 'POST', auth: 'required' });
    convo.current = next;
    setConversation(next);
    setLines([]);
  }, []);

  return { status, conversation, lines, loading, loadError, sending, load, send, regenerate, stop, clear, startNew, setLines };
}
