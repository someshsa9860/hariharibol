'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/** A button that opens a small panel under it; clicking elsewhere or pressing Escape closes it. */
export function Popover({ trigger, label, children }: { trigger: ReactNode; label: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="popover" ref={root}>
      <button className="icon-btn" aria-label={label} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((value) => !value)}>
        {trigger}
      </button>
      {open && <div className="popover-panel">{children(() => setOpen(false))}</div>}
    </div>
  );
}
