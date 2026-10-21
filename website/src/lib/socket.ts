'use client';

// The live channel from the API's websocket container. One socket for the page, opened when the first listener
// subscribes and closed a moment after the last one leaves. It is one-way — the server sends `{event, payload}` and
// everything the page *does* is an ordinary API call. A dropped connection is reopened with a growing wait; a refused
// token (close code 4001) is renewed through the API's normal refresh first.

import { WS_URL } from '@/lib/config';
import { currentSession } from '@/lib/auth/session-store';
import { rawRequest } from '@/lib/api/client';

type Handler = (payload: unknown) => void;

const PING_MS = 25_000;
const LINGER_MS = 1_000;
const handlers = new Map<string, Set<Handler>>();

let socket: WebSocket | null = null;
let listeners = 0;
let attempts = 0;
let retry: ReturnType<typeof setTimeout> | null = null;
let ping: ReturnType<typeof setInterval> | null = null;
let linger: ReturnType<typeof setTimeout> | null = null;

function clearTimers() {
  if (retry) clearTimeout(retry);
  if (ping) clearInterval(ping);
  retry = null;
  ping = null;
}

function open() {
  const session = currentSession();
  if (!WS_URL || !session || socket || listeners === 0) return;

  const next = new WebSocket(`${WS_URL}?token=${encodeURIComponent(session.accessToken)}`);
  socket = next;

  next.onopen = () => {
    attempts = 0;
    ping = setInterval(() => next.readyState === WebSocket.OPEN && next.send(JSON.stringify({ type: 'ping' })), PING_MS);
  };
  next.onmessage = (message) => {
    try {
      const { event, payload } = JSON.parse(String(message.data)) as { event: string; payload: unknown };
      handlers.get(event)?.forEach((handler) => handler(payload));
    } catch {
      /* ignore a frame that is not ours */
    }
  };
  next.onclose = async (closed) => {
    clearTimers();
    if (socket === next) socket = null;
    if (listeners === 0) return;
    // An expired token: any authenticated call renews it, then the next attempt carries the new one.
    if (closed.code === 4001) await rawRequest('/groups', { auth: 'required' }).catch(() => undefined);
    attempts += 1;
    retry = setTimeout(open, Math.min(30_000, 1_000 * 2 ** Math.min(attempts, 5)));
  };
}

/** Listens for server events by name; the returned function stops listening. */
export function onSocketEvent(event: string, handler: Handler): () => void {
  if (linger) clearTimeout(linger);
  linger = null;
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler);
  listeners += 1;
  open();

  return () => {
    handlers.get(event)?.delete(handler);
    listeners -= 1;
    if (listeners > 0) return;
    linger = setTimeout(() => {
      clearTimers();
      socket?.close();
      socket = null;
    }, LINGER_MS);
  };
}
