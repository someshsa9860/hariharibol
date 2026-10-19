// What the client and the server fetcher share: the API's envelope and its errors.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Envelope<T> {
  data: T;
  meta?: { page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean; [key: string]: unknown };
}

export type Query = Record<string, string | number | boolean | undefined | null>;

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}${path.includes('?') ? '&' : '?'}${text}` : path;
}

/** Turns a response into its envelope, or throws the API's own error. */
export async function readEnvelope<T>(response: Response): Promise<Envelope<T>> {
  if (response.status === 204) return { data: null as T };
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON: a proxy's error page, or an empty body.
  }
  const json = body as { success?: boolean; data?: T; meta?: Envelope<T>['meta']; error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null;
  if (!response.ok || !json || json.success === false) {
    throw new ApiError(
      response.status,
      json?.error?.code ?? 'REQUEST_FAILED',
      json?.error?.message ?? `Request failed (${response.status})`,
      json?.error?.details,
    );
  }
  return { data: json.data as T, meta: json.meta };
}
