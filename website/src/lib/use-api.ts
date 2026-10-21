'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type RequestOptions } from '@/lib/api/client';

export interface Fetched<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
  setData: (next: T | null | ((current: T | null) => T | null)) => void;
}

/** Loads `path` when the component appears (and when `path` or `enabled` change). `null` as the path means "not yet". */
export function useApi<T>(path: string | null, options?: RequestOptions): Fetched<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [tick, setTick] = useState(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api<T>(path, { ...optionsRef.current, signal: controller.signal })
      .then((result) => setData(result))
      .catch((failure) => {
        if (!(failure instanceof DOMException && failure.name === 'AbortError')) setError(failure);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, error, loading, reload, setData };
}
