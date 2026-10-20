import 'server-only';
import { SERVER_API_BASE } from '@/lib/config';
import { ApiError, readEnvelope, withQuery, type Envelope, type Query } from './core';

interface Options {
  query?: Query;
  /** Seconds the Next data cache may serve the answer. Public content changes rarely; the default is a minute. */
  revalidate?: number;
  /** The reader's reading language, for endpoints that accept `Accept-Language`. */
  language?: string;
}

/** A public GET from the server. Never carries a person's token — pages rendered here are the same for everyone. */
export async function serverGetEnvelope<T>(path: string, options: Options = {}): Promise<Envelope<T>> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Platform': 'web' };
  if (options.language) headers['Accept-Language'] = options.language;
  let response: Response;
  try {
    response = await fetch(`${SERVER_API_BASE}${withQuery(path, options.query)}`, {
      headers,
      next: { revalidate: options.revalidate ?? 60 },
    });
  } catch {
    throw new ApiError(503, 'API_UNREACHABLE', 'The library could not be reached');
  }
  return readEnvelope<T>(response);
}

export async function serverGet<T>(path: string, options: Options = {}): Promise<T> {
  return (await serverGetEnvelope<T>(path, options)).data;
}

/** Like `serverGet`, but a missing thing is `null` rather than an error — for pages that call `notFound()`. */
export async function serverGetOrNull<T>(path: string, options: Options = {}): Promise<T | null> {
  try {
    return await serverGet<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
}
