import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

// An on/off switch. A real <button role="switch">, so the browser supplies focus and Space/Enter and a screen reader
// says "on" or "off"; name it with `aria-label` or `aria-labelledby`.
export const Switch = forwardRef<
  HTMLButtonElement,
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'role' | 'type'> & { checked: boolean; onCheckedChange: (checked: boolean) => void }
>(({ className, checked, onCheckedChange, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    className={cn(
      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent shadow-sm transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'disabled:cursor-not-allowed disabled:opacity-50',
      checked ? 'bg-primary' : 'bg-input',
      className
    )}
    {...props}
  >
    <span
      aria-hidden
      className={cn('pointer-events-none block h-5 w-5 rounded-full bg-background shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')}
    />
  </button>
));
Switch.displayName = 'Switch';
