import { ArrowDown, ArrowUp, BookOpen, Copy, Heading, Plus, Quote, Trash2, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_OVERLAYS, type Overlay, type OverlayStyle } from '@/lib/reel-doc';
import { cn } from '@/lib/utils';

const ICON: Record<OverlayStyle, typeof Type> = { body: Type, heading: Heading, verse: Quote };

// The text boxes on the frame, top of the list = drawn last = in front.
export function ReelLayers({
  overlays,
  selectedId,
  onSelect,
  onAdd,
  onAddVerse,
  onDuplicate,
  onDelete,
  onMove,
}: {
  overlays: Overlay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onAddVerse: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** +1 brings the box forward, −1 sends it back. */
  onMove: (id: string, direction: 1 | -1) => void;
}) {
  const full = overlays.length >= MAX_OVERLAYS;
  // Front-most first, like every design tool's layer list.
  const ordered = [...overlays].reverse();

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={onAdd} disabled={full}>
          <Plus className="h-4 w-4" />
          Text
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={onAddVerse} disabled={full}>
          <BookOpen className="h-4 w-4" />
          Verse
        </Button>
      </div>

      {overlays.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No text yet. Add a text box, or pull in a verse from any book.
        </p>
      )}

      <ul className="space-y-1">
        {ordered.map((overlay, index) => {
          const Icon = ICON[overlay.style];
          const selected = overlay.id === selectedId;
          return (
            <li
              key={overlay.id}
              className={cn(
                'group flex items-center gap-1 rounded-md border px-2 py-1.5 text-sm',
                selected ? 'border-primary bg-accent' : 'border-transparent hover:bg-muted'
              )}
            >
              <button type="button" onClick={() => onSelect(overlay.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{overlay.text.replace(/\s+/g, ' ')}</span>
              </button>
              <div className={cn('flex shrink-0', !selected && 'opacity-0 group-hover:opacity-100 focus-within:opacity-100')}>
                <IconButton label="Bring forward" onClick={() => onMove(overlay.id, 1)} disabled={index === 0}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Send back" onClick={() => onMove(overlay.id, -1)} disabled={index === ordered.length - 1}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Duplicate" onClick={() => onDuplicate(overlay.id)} disabled={full}>
                  <Copy className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Delete" onClick={() => onDelete(overlay.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ul>

      {full && <p className="text-xs text-muted-foreground">A reel holds at most {MAX_OVERLAYS} text boxes.</p>}
    </div>
  );
}

function IconButton({ label, children, ...props }: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" title={label} aria-label={label} {...props}>
      {children}
    </Button>
  );
}
