'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * State that is kept in localStorage. The first render always uses `initial` (so the server and the browser agree),
 * and the saved value replaces it right after. `ready` says that has happened.
 */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      // Unreadable: start again from the default.
    }
    setReady(true);
  }, [key]);

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      const resolved = typeof next === 'function' ? (next as (current: T) => T)(valueRef.current) : next;
      valueRef.current = resolved;
      setValue(resolved);
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Storage full or blocked: the value is kept for this page only.
      }
    },
    [key],
  );

  return [value, update, ready] as const;
}
