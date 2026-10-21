'use client';

// The browser's way to the API. Sends the bearer when there is a session, renews it when the API says it has lapsed,
// and tells the rest of the page when the session is over.

import { API_BASE, APP_VERSION } from '@/lib/config';
import { currentSession, deviceId, writeSession, type StoredSession } from '@/lib/auth/session-store';
import { ApiError, readEnvelope, withQuery, type Envelope, type Query } from './core';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Query;
  body?: unknown;
  /** `required`: sign-in needed. `optional`: send the bearer if there is one. `none`: never (sign-in, refresh). */
  auth?: 'required' | 'optional' | 'none';
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export function baseHeaders(): Record<string, string> {
  return { Accept: 'application/json', 'X-Platform': 'web', 'X-App-Version': APP_VERSION, 'X-Device-Id': deviceId() };
}

let refreshing: Promise<StoredSession | null> | null = null;

/** Exchanges the refresh token for a new pair. Only a 403 UNAUTHENTICATED answer ends the session. */
function refresh(): Promise<StoredSession | null> {
  refreshing ??= (async () => {
    const session = currentSession();
    if (!session) return null;
    try {
      const response = await fetch(`${API_BASE}/api/app/auth/refresh`, {
        method: 'POST',
        headers: { ...baseHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken, deviceId: deviceId() }),
      });
      const { data } = await readEnvelope<{ user?: StoredSession['user']; tokens: { accessToken: string; refreshToken: string } }>(response);
      const next = { accessToken: data.tokens.accessToken, refreshToken: data.tokens.refreshToken, user: data.user ?? session.user };
      writeSession(next);
      return next;
    } catch (error) {
      if (error instanceof ApiError && error.status === 403 && error.code === 'UNAUTHENTICATED') writeSession(null);
      return currentSession();
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { ...baseHeaders(), ...options.headers };
  if (options.body !== undefined && !(options.body instanceof Blob)) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}/api/app${withQuery(path, options.query)}`, {
    method: options.method ?? 'GET',
    headers,
    body:
      options.body === undefined ? undefined : options.body instanceof Blob ? options.body : JSON.stringify(options.body),
    signal: options.signal,
  });
}

/** Sends the request with the right bearer, renewing the session once if the API says it has lapsed. */
export async function rawRequest(path: string, options: RequestOptions = {}): Promise<Response> {
  const mode = options.auth ?? 'optional';
  let session = mode === 'none' ? null : currentSession();
  if (mode === 'required' && !session) throw new ApiError(403, 'UNAUTHENTICATED', 'Please sign in');

  let response: Response;
  try {
    response = await send(path, options, session?.accessToken ?? null);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK', 'No connection');
  }

  if (session && response.status === 403) {
    // 403 is also "signed in but not allowed", so look at the code before renewing anything.
    const code = await response.clone().json().then((body) => body?.error?.code, () => null);
    if (code === 'UNAUTHENTICATED') {
      session = await refresh();
      if (!session) return response;
      response = await send(path, options, session.accessToken);
    }
  }
  return response;
}

export async function apiEnvelope<T>(path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  return readEnvelope<T>(await rawRequest(path, options));
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiEnvelope<T>(path, options)).data;
}

/** The person-facing line for a failure. The site words these itself; the server's text is only a last resort. */
export function describeError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK') return 'You appear to be offline. Check your connection and try again.';
    if (error.status === 429) return 'Too many requests just now. Please wait a moment and try again.';
    if (error.status >= 500) return 'Our servers are having trouble. Please try again in a little while.';
    if (error.status < 500 && error.message && error.code !== 'REQUEST_FAILED') return error.message;
  }
  return fallback;
}

/** A public call to the website endpoints (`/api/web/*`) from the browser. */
export async function webApi<T>(path: string, query?: Query): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/web${withQuery(path, query)}`, { headers: baseHeaders() });
  } catch {
    throw new ApiError(0, 'NETWORK', 'No connection');
  }
  return (await readEnvelope<T>(response)).data;
}
