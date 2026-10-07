import { useEffect, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes } from 'react';
import clsx from 'clsx';

type RevealProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'article' | 'blockquote';
  // Milliseconds to wait before fading in, so a row of cards arrives one by one.
  delay?: number;
};

// Fades its content in the first time it scrolls into view. The hidden state
// is only applied once the `js` class is on <html> (see index.html), so the
// page is fully readable without JavaScript.
export function Reveal({ as = 'div', delay, className, style, ...rest }: RevealProps) {
  const Tag = as as ElementType; // a union of tag names confuses the ref's type
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      {...rest}
      ref={ref}
      className={clsx(className, 'reveal', visible && 'is-visible')}
      style={delay ? ({ ...style, '--d': `${delay}ms` } as CSSProperties) : style}
    />
  );
}
