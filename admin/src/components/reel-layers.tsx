import { AlertTriangle, ArrowDown, ArrowUp, BookOpen, ChevronDown, Copy, Eye, EyeOff, Heading, Plus, Quote, Trash2, Type } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { BoxMetrics } from '@/components/reel-stage';
import { Button } from '@/components/ui/button';
import { BIND_LABELS, MAX_OVERLAYS, type Overlay, type OverlayBind, type OverlayStyle, type OVERLAY_PRESETS } from '@/lib/reel-doc';
import { cn } from '@/lib/utils';

const ICON: Record<OverlayStyle, typeof Type> = { body: Type, heading: Heading, verse: Quote };

// The text boxes on the frame, top of the list = drawn last = in front.
export function ReelLayers({
  overlays,
  selectedId,
  onSelect,
  onAdd,
  onAddVerse,
  onAddBound,
  onDuplicate,
  onDelete,
  onMove,
  presets,
  hiddenIds,
  onToggleHidden,
  metrics,
}: {
  overlays: Overlay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (partial?: Partial<Overlay>) => void;
  presets: typeof OVERLAY_PRESETS;
  hiddenIds: Set<string>;
  onToggleHidden: (id: string) => void;
  metrics: Record<string, BoxMetrics>;
  /** Pick one verse from any book. Absent when making a template. */
  onAddVerse?: () => void;
  /** Add a box filled from a field of each verse. Present only when making a template. */
  onAddBound?: (bind: OverlayBind) => void;
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
        <div className="flex flex-1">
          <Button size="sm" className="flex-1 rounded-r-none" onClick={() => onAdd()} disabled={full}>
            <Plus className="h-4 w-4" />
            Text
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="rounded-l-none border-l border-primary-foreground/20 px-1.5" disabled={full} aria-label="Add a styled text box">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {presets.map((preset) => (
                <DropdownMenuItem key={preset.label} onSelect={() => onAdd(preset.overlay)} className="flex-col items-start gap-0">
                  <span className="font-medium">{preset.label}</span>
                  <span className="text-xs text-muted-foreground">{preset.hint}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {onAddVerse && (
          <Button size="sm" variant="outline" className="flex-1" onClick={onAddVerse} disabled={full}>
            <BookOpen className="h-4 w-4" />
            Verse
          </Button>
        )}
        {onAddBound && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="flex-1" disabled={full}>
                <BookOpen className="h-4 w-4" />
                Verse field
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(BIND_LABELS) as OverlayBind[]).map((bind) => (
                <DropdownMenuItem key={bind} onSelect={() => onAddBound(bind)}>
                  {BIND_LABELS[bind]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {overlays.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {onAddBound ? 'No text yet. Add a verse field — it is filled from each verse — or a fixed text box.' : 'No text yet. Add a text box, or pull in a verse from any book.'}
        </p>
      )}

      <ul className="space-y-1">
        {ordered.map((overlay, index) => {
          const Icon = ICON[overlay.style];
          const selected = overlay.id === selectedId;
          const hidden = hiddenIds.has(overlay.id);
          const under = metrics[overlay.id]?.under ?? [];
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
                {overlay.bind ? (
                  // The text is a different verse on every reel, so the row says what it is filled from.
                  <span className={cn('truncate font-medium text-primary', hidden && 'text-muted-foreground line-through')} title={overlay.text}>
                    Verse {BIND_LABELS[overlay.bind].toLowerCase()}
                  </span>
                ) : (
                  <span className={cn('truncate', hidden && 'text-muted-foreground line-through')}>{overlay.text.replace(/\s+/g, ' ')}</span>
                )}
                {under.length > 0 && (
                  <span title={`Sits under the app's ${under.join(' and ').toLowerCase()}`} className="shrink-0">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  </span>
                )}
              </button>
              <IconButton
                label={hidden ? 'Show while editing' : 'Hide while editing'}
                onClick={() => onToggleHidden(overlay.id)}
                className={cn('h-6 w-6', !hidden && !selected && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}
              >
                {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </IconButton>
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

      {hiddenIds.size > 0 && (
        <p className="text-xs text-muted-foreground">Hidden boxes are only hidden here — they are still saved and shown in the app.</p>
      )}
      {full && <p className="text-xs text-muted-foreground">A reel holds at most {MAX_OVERLAYS} text boxes.</p>}
    </div>
  );
}

function IconButton({ label, children, className, ...props }: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button type="button" variant="ghost" size="icon" className={cn('h-6 w-6', className)} title={label} aria-label={label} {...props}>
      {children}
    </Button>
  );
}
