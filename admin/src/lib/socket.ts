// The live channel from the backend's websocket container (backend/websocket/index.js).
//
// One socket for the whole panel, shared by every page that listens, opened when the first listener
// mounts and closed a moment after the last one leaves. It is one-way: the server sends
// `{event, payload, at}` and nothing the page does goes through it — writes are ordinary API calls.
//
// What keeps it dependable:
//   - A dropped connection is reopened with a growing wait (1 s … 30 s), for as long as anything listens.
//   - A refused token (close code 4001) is renewed through the API's normal refresh and tried again.
//   - Whatever was missed while it was down is the page's to refetch: `useOnReconnect` says when.
//   - Pages must also work without it — `useSocketStatus()` says when to fall back to polling.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { API_URL, api, loadTokens } from './api';

export type SocketStatus = 'connecting' | 'live' | 'offline';

function socketUrl() {
  const set = import.meta.env.VITE_WS_URL;
  if (set) return set;
  const url = new URL(API_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  // Locally the socket container has its own port; behind nginx, /ws is served on the API's host.
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') url.port = '4001';
  url.pathname = '/ws';
  return url.toString();
}

const URL_BASE = socketUrl();
const PING_MS = 25_000;
const LINGER_MS = 1_000;

type Handler = (payload: unknown) => void;

let socket: WebSocket | null = null;
let status: SocketStatus = 'offline';
let users = 0;
let attempts = 0;
let everConnected = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

const handlers = new Map<string, Set<Handler>>();
const statusListeners = new Set<() => void>();
const reconnectListeners = new Set<() => void>();

function setStatus(next: SocketStatus) {
  if (next === status) return;
  status = next;
  statusListeners.forEach((listener) => listener());
}

function stopTimers() {
  if (retryTimer) clearTimeout(retryTimer);
  if (pingTimer) clearInterval(pingTimer);
  retryTimer = null;
  pingTimer = null;
}

function scheduleOpen(afterMs: number) {
  if (retryTimer || users === 0) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    open();
  }, afterMs);
}

function waitFor(attempt: number) {
  const base = Math.min(30_000, 1_000 * 2 ** attempt);
  return base / 2 + Math.random() * (base / 2);
}

function open() {
  if (socket || users === 0) return;
  const tokens = loadTokens();
  if (!tokens) {
    setStatus('offline');
    return;
  }

  setStatus('connecting');
  const ws = new WebSocket(`${URL_BASE}?token=${encodeURIComponent(tokens.accessToken)}`);
  socket = ws;

  ws.onmessage = (message) => {
    let frame: { event?: string; payload?: unknown };
    try {
      frame = JSON.parse(String(message.data));
    } catch {
      return;
    }
    if (!frame.event) return;

    if (frame.event === 'connected') {
      // The server accepts the upgrade and only then checks the token, so "live" is this message, not onopen.
      attempts = 0;
      setStatus('live');
      if (everConnected) reconnectListeners.forEach((listener) => listener());
      everConnected = true;
      return;
    }
    handlers.get(frame.event)?.forEach((handler) => handler(frame.payload));
  };

  ws.onopen = () => {
    pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, PING_MS);
  };

  ws.onclose = (event) => {
    if (socket === ws) socket = null;
    stopTimers();
    setStatus('offline');
    if (users === 0) return;

    // 4003: this account may not use the socket at all — retrying cannot help.
    if (event.code === 4003) return;

    if (event.code === 4001) {
      // An expired access token. Any API call renews it on the way; then try again at once (once).
      const renew = attempts === 0 ? api.get('/api/admin/me').catch(() => null) : Promise.resolve(null);
      attempts += 1;
      void renew.then(() => scheduleOpen(attempts <= 1 ? 0 : waitFor(attempts)));
      return;
    }

    scheduleOpen(waitFor(attempts));
    attempts += 1;
  };

  ws.onerror = () => {
    // onclose follows and does the work.
  };
}

function retain() {
  users += 1;
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  open();

  return () => {
    users -= 1;
    if (users > 0) return;
    // Strict mode (and a quick route change) unmounts and remounts at once; do not tear the socket down for that.
    closeTimer = setTimeout(() => {
      closeTimer = null;
      if (users > 0) return;
      stopTimers();
      socket?.close(1000, 'No listeners');
      socket = null;
      setStatus('offline');
    }, LINGER_MS);
  };
}

/** Calls `handler` for every `event` the server sends, for as long as the component is mounted. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    const release = retain();
    const listener: Handler = (payload) => latest.current(payload as T);
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(listener);
    return () => {
      handlers.get(event)?.delete(listener);
      release();
    };
  }, [event]);
}

/** Whether the socket is open right now; pages poll while it is not. */
export function useSocketStatus(): SocketStatus {
  useEffect(() => retain(), []);
  return useSyncExternalStore(
    (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    () => status
  );
}

/** Calls `handler` each time the socket comes back after being lost — the moment to refetch what was missed. */
export function useOnReconnect(handler: () => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });

  useEffect(() => {
    const listener = () => latest.current();
    reconnectListeners.add(listener);
    return () => {
      reconnectListeners.delete(listener);
    };
  }, []);
}
