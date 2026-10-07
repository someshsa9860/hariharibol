import { useEffect, useState } from 'react';

// True once the page has scrolled further than `distance` pixels.
export function useScrolledPast(distance: number) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > distance);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [distance]);

  return scrolled;
}
