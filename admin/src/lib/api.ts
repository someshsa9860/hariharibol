// Every backend response is `{success, data, meta?}` or `{success:false, error}`
// (backend/utils/respond.js) — one parser, used by every call the panel makes.
// Access/refresh tokens follow the same session shape the mobile app uses
// (backend/controllers/app/auth.js sessionPayload) since admins sign in
// through the same endpoint — there is no admin-specific auth.

const API_URL = import.meta.env.VITE_API_URL as string;

export type ApiError = { code: string; message: string; details?: unknown };

export class ApiRequestError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.code = error.code;
    this.status = status;
    this.details = error.details;
  }
}

export type Tokens = { accessToken: string; refreshToken: string; refreshExpiresAt: string };

const STORAGE_KEY = 'hhb_admin_tokens';

export function loadTokens(): Tokens | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: Tokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearTokens() {
  localStorage.removeItem(STORAGE_KEY);
}

// The backend answers "I do not know who you are" with 403 and the code
// UNAUTHENTICATED (backend/utils/errors.js). A 403 FORBIDDEN is a signed-in admin
// who lacks a permission — renewing the token would not change it.
const isUnauthenticated = (status: number, error?: ApiError) =>
  status === 403 && error?.code === 'UNAUTHENTICATED';

// What a refresh attempt came to. Only `rejected` — the server saying 403 — means
// the session is over; a network error, a 5xx or a 429 says nothing about it, and
// signing an admin out for one would throw away a perfectly good refresh token.
type Refresh = { kind: 'renewed'; tokens: Tokens } | { kind: 'rejected' } | { kind: 'unavailable' };

// Refreshing is racy if two requests are refused at once — share one in-flight
// attempt rather than spending two refresh tokens for one moment of expiry.
let refreshing: Promise<Refresh> | null = null;

async function refreshTokens(): Promise<Refresh> {
  const current = loadTokens();
  if (!current) return { kind: 'rejected' };

  if (!refreshing) {
    refreshing = fetch(`${API_URL}/api/app/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken, deviceId: 'admin-web' }),
    })
      .then(async (res): Promise<Refresh> => {
        if (res.status === 403) return { kind: 'rejected' };
        if (!res.ok) return { kind: 'unavailable' };
        const body = await res.json();
        const tokens: Tokens = body.data.tokens;
        saveTokens(tokens);
        return { kind: 'renewed', tokens };
      })
      .catch((): Refresh => ({ kind: 'unavailable' }))
      .finally(() => {
        refreshing = null;
      });
  }

  return refreshing;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
};

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export type Envelope<T> = { success: true; data: T; meta?: Record<string, unknown> };

async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<Envelope<T>> {
  const tokens = loadTokens();

  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) return { success: true, data: undefined as T };

  const body = await res.json();

  if (!res.ok || body.success === false) {
    // An expired access token, not a bad refresh token — rotate once and retry.
    if (isUnauthenticated(res.status, body.error) && !retried && tokens) {
      const refresh = await refreshTokens();
      if (refresh.kind === 'renewed') return request<T>(path, options, true);
      if (refresh.kind === 'rejected') {
        clearTokens();
        window.location.href = '/login';
      } else {
        // The session may well be fine; the server could not be asked. Keep it,
        // and report a failure that is not a 403 so no caller reads it as a sign-out.
        throw new ApiRequestError(503, {
          code: 'SESSION_CHECK_FAILED',
          message: 'Could not reach the server to renew your session. Try again in a moment.',
        });
      }
    }
    throw new ApiRequestError(res.status, body.error ?? { code: 'UNKNOWN', message: 'Request failed' });
  }

  return body as Envelope<T>;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
};

export { API_URL };
