'use client';

import { useEffect, useRef, useState } from 'react';

/** True once the element has come into view (and stays true). Without IntersectionObserver it is true at once. */
export function useInView<T extends Element>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSeen(true);
        observer.disconnect();
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px', ...options });
    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return [ref, seen] as const;
}
