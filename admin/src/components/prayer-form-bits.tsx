// Small pieces the prayer dialog and its two editors share, kept in their own file so the editors do not import the dialog
// (and the dialog its editors). Copied in spirit from etiquette-item-dialog.tsx, where the same four things are local.

import { useEffect } from 'react';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';

/** What the dialog hands its parts: "this part has (or no longer has) unsaved changes". Closing asks while any part does. */
export type Dirty = (key: string, dirty: boolean) => void;

export function useReportDirty(key: string, dirty: boolean, setDirty: Dirty) {
  useEffect(() => {
    setDirty(key, dirty);
    return () => setDirty(key, false);
  }, [key, dirty, setDirty]);
}

export const message = (err: unknown) => (err instanceof ApiRequestError ? err.message : 'The request did not go through.');

export function Problem({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

export function Counter({ value, max }: { value: string; max: number }) {
  return <span className={cn('text-[11px] tabular-nums', value.length > max * 0.95 ? 'text-amber-800 dark:text-amber-300' : 'text-muted-foreground')}>{value.length}/{max}</span>;
}

/** The font for a verse in its own script: the Indic system fonts the common desktops have, then whatever the browser picks. */
export const VERSE_FONT = '"Noto Sans Devanagari", "Noto Sans Bengali", "Noto Sans Gujarati", "Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Oriya", "Noto Sans Gurmukhi", system-ui, sans-serif';
