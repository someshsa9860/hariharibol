import type { RefObject } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Copy, MoveHorizontal, MoveVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  COLOR_LABELS,
  COLOR_PREVIEW,
  STYLE_LABELS,
  type Overlay,
  type OverlayAlign,
  type OverlayColor,
  type OverlayStyle,
} from '@/lib/reel-doc';
import { cn } from '@/lib/utils';

const ALIGNS: { value: OverlayAlign; icon: typeof AlignLeft; label: string }[] = [
  { value: 'left', icon: AlignLeft, label: 'Align left' },
  { value: 'center', icon: AlignCenter, label: 'Align centre' },
  { value: 'right', icon: AlignRight, label: 'Align right' },
];

// Everything about the selected text box. Text and sliders pass a coalesce key so
// a burst of typing or one slider drag is one undo step, not fifty.
export function ReelTextInspector({
  overlay,
  onChange,
  onDuplicate,
  onDelete,
  textRef,
}: {
  overlay: Overlay | null;
  onChange: (id: string, patch: Partial<Overlay>, key?: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  textRef: RefObject<HTMLTextAreaElement | null>;
}) {
  if (!overlay) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        Select a text box on the frame or in the list to edit it.
      </p>
    );
  }

  const change = (patch: Partial<Overlay>, key?: string) => onChange(overlay.id, patch, key ? `${overlay.id}:${key}` : undefined);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="overlay-text">Text</Label>
        <Textarea
          id="overlay-text"
          ref={textRef}
          className="mt-1.5 min-h-24"
          value={overlay.text}
          onChange={(e) => change({ text: e.target.value }, 'text')}
          maxLength={2000}
        />
        {overlay.source && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline">{overlay.source.label}</Badge>
            copied from a verse — edits here do not change the verse.
          </p>
        )}
        {!overlay.text.trim() && <p className="mt-1 text-xs text-destructive">Empty text is dropped when you save.</p>}
      </div>

      <Field label="Style">
        <Segmented
          value={overlay.style}
          options={(Object.keys(STYLE_LABELS) as OverlayStyle[]).map((value) => ({ value, label: STYLE_LABELS[value] }))}
          onChange={(style) => change({ style })}
        />
      </Field>

      <Field label="Colour">
        <div className="flex gap-2">
          {(Object.keys(COLOR_LABELS) as OverlayColor[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => change({ color: value })}
              aria-pressed={overlay.color === value}
              title={COLOR_LABELS[value]}
              className={cn(
                'flex h-8 flex-1 items-center justify-center gap-2 rounded-md border text-xs transition-colors',
                overlay.color === value ? 'border-primary bg-accent' : 'border-input hover:bg-muted'
              )}
            >
              <span className="h-3.5 w-3.5 rounded-full border border-border" style={{ background: COLOR_PREVIEW[value] }} />
              {COLOR_LABELS[value]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Alignment">
        <div className="flex gap-1">
          {ALIGNS.map(({ value, icon: Icon, label }) => (
            <Button
              key={value}
              type="button"
              variant={overlay.align === value ? 'secondary' : 'outline'}
              size="icon"
              className="h-8 flex-1"
              aria-label={label}
              aria-pressed={overlay.align === value}
              onClick={() => change({ align: value })}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </Field>

      <Slider label="Size" value={overlay.size} min={1} max={30} step={0.5} onChange={(size) => change({ size }, 'size')} />
      <Slider
        label="Width"
        value={overlay.width}
        min={5}
        max={100}
        step={1}
        // Keep the box on the frame when it is widened past the right edge.
        onChange={(width) => change({ width, x: Math.min(overlay.x, 100 - width) }, 'width')}
      />

      <div className="grid grid-cols-2 gap-3">
        <Slider label="Left" value={overlay.x} min={0} max={Math.max(0, 100 - overlay.width)} step={0.5} onChange={(x) => change({ x }, 'x')} />
        <Slider label="Top" value={overlay.y} min={0} max={95} step={0.5} onChange={(y) => change({ y }, 'y')} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => change({ x: Math.round((50 - overlay.width / 2) * 100) / 100 })}>
          <MoveHorizontal className="h-4 w-4" />
          Centre across
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => change({ y: 40 })}>
          <MoveVertical className="h-4 w-4" />
          Middle
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onDuplicate(overlay.id)}>
          <Copy className="h-4 w-4" />
          Duplicate
        </Button>
        <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={() => onDelete(overlay.id)}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Drag the box on the frame to move it; drag the side handle for width, the corner for size. Arrow keys nudge (Shift for 5%). Hold Alt to skip snapping.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-md bg-muted p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded px-3 py-1 text-sm font-medium transition-colors',
            value === option.value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-xs text-muted-foreground">{Math.round(value * 10) / 10}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(value, max)}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="h-1.5 w-full cursor-pointer accent-primary"
      />
    </div>
  );
}
