import { type InputHTMLAttributes, forwardRef, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// A native checkbox — the browser already gives us focus, keyboard and a11y —
// plus the `indeterminate` state a "select all on this page" header needs.
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { indeterminate?: boolean }>(
  ({ className, indeterminate, ...props }, ref) => {
    const inner = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (inner.current) inner.current.indeterminate = Boolean(indeterminate);
    }, [indeterminate]);

    return (
      <input
        type="checkbox"
        ref={(node) => {
          inner.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn('h-4 w-4 cursor-pointer rounded border-input accent-primary', className)}
        {...props}
      />
    );
  }
);
Checkbox.displayName = 'Checkbox';
