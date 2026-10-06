import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type DetailField = { label: string; value: ReactNode; full?: boolean };

/**
 * The generic "view details" dialog every datatable row opens into — a plain
 * label/value list. Pages that need something richer (verses, with its
 * Sanskrit block and translation cards) render their own dialog instead of
 * reaching for this.
 */
export function DetailDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  fields?: DetailField[];
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </DialogHeader>
        {fields && fields.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
            {fields.map((f, i) => (
              <div className="contents" key={i}>
                <dt className="whitespace-nowrap pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {f.label}
                </dt>
                <dd className={f.full ? 'col-span-2' : 'break-words'}>{f.value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Pretty-prints a JSON-ish value (audit diffs, webhook payloads, notification data) for a DetailField. */
export function JsonValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <pre className="max-h-48 overflow-auto rounded-md bg-muted/60 p-2.5 text-xs">{JSON.stringify(value, null, 2)}</pre>
  );
}
