import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityAudit, type AuditScope } from '@/components/entity-audit';

export { JsonValue } from '@/components/json-value';

export type DetailField = { label: string; value: ReactNode; full?: boolean };

/**
 * The "view details" screen every table row opens into. It is a full page, not a pop-up: it fills the working area
 * beside the sidebar, has a Back button, and the browser's Back button closes it too. It keeps the name and props
 * the old dialog had, so a section only says what to show — plus `audit`, the kind(s) of record whose history belongs
 * on the page, which adds the audit trail for that row at the bottom (for people allowed to read the audit log).
 *
 * Sections with a lot to show get a route of their own instead (see routes/user-detail.tsx).
 */
export function DetailDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  children,
  audit,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  fields?: DetailField[];
  children?: ReactNode;
  audit?: AuditScope;
  actions?: ReactNode;
}) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const pushed = useRef(false);
  // Callers pass a fresh arrow every render; effects must depend on `open` alone or they would run again each time.
  const change = useRef(onOpenChange);
  change.current = onOpenChange;

  useEffect(() => {
    setRoot(document.getElementById('detail-root'));
  }, [open]);

  // One history step while open, so the browser's Back closes the page instead of leaving the section.
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ detail: true }, '');
    pushed.current = true;
    const onPop = () => {
      pushed.current = false;
      change.current(false);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Closed from the page's own button: take the step we added back off.
      if (pushed.current) {
        pushed.current = false;
        window.history.back();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && change.current(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open || !root) return null;

  return createPortal(
    <div className="min-h-full bg-background p-6">
      <div className="mx-auto max-w-5xl">
        <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => onOpenChange(false)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {fields && fields.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-lg border bg-card p-5 text-sm">
            {fields.map((f, i) => (
              <div className="contents" key={i}>
                <dt className="whitespace-nowrap pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                <dd className={f.full ? 'col-span-2' : 'break-words'}>{f.value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
        {audit && <EntityAudit scope={audit} />}
      </div>
    </div>,
    root
  );
}
