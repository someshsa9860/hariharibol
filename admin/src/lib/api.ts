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

// Refreshing is racy if two requests 401 at once — share one in-flight attempt
// rather than spending two refresh tokens for one moment of expiry.
let refreshing: Promise<Tokens | null> | null = null;

async function refreshTokens(): Promise<Tokens | null> {
  const current = loadTokens();
  if (!current) return null;

  if (!refreshing) {
    refreshing = fetch(`${API_URL}/api/app/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken, deviceId: 'admin-web' }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = await res.json();
        const tokens: Tokens = body.data.tokens;
        saveTokens(tokens);
        return tokens;
      })
      .catch(() => null)
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
    if (res.status === 401 && !retried && tokens) {
      const refreshed = await refreshTokens();
      if (refreshed) return request<T>(path, options, true);
      clearTokens();
      window.location.href = '/login';
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
