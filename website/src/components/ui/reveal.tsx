'use client';

import clsx from 'clsx';
import type { ElementType, ReactNode } from 'react';
import { useInView } from '@/lib/use-in-view';

/** Fades its children in as they scroll into view. Readable without JavaScript (see `.reveal` in base.css). */
export function Reveal({
  children, className, delay = 0, as: Tag = 'div',
}: { children: ReactNode; className?: string; delay?: number; as?: ElementType }) {
  const [ref, seen] = useInView<HTMLElement>();
  return (
    <Tag ref={ref} className={clsx('reveal', seen && 'is-in', className)} style={{ '--delay': `${delay}ms` } as React.CSSProperties}>
      {children}
    </Tag>
  );
}
