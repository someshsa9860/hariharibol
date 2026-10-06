import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Keyboard } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReelStage, type BoxMetrics } from '@/components/reel-stage';
import { ReelLayers } from '@/components/reel-layers';
import { ReelTextInspector } from '@/components/reel-text-inspector';
import { ReelMediaPanel } from '@/components/reel-media-panel';
import { VersePicker, type VerseInsert } from '@/components/verse-picker';
import {
  BIND_DEFAULTS,
  BIND_LABELS,
  MAX_OVERLAYS,
  OVERLAY_PRESETS,
  duplicateOverlay,
  newOverlay,
  readClipboard,
  writeClipboard,
  type Overlay,
  type OverlayBind,
  type ReelHistory,
} from '@/lib/reel-doc';

type Tab = 'text' | 'media' | 'details';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The editing surface — text layers on the left, the 9:16 frame in the middle,
 * Text / Media (/ Details) on the right — and everything that happens on it:
 * selecting and moving boxes, the keyboard, copy/paste, hide, the verse picker.
 *
 * It edits the document it is handed (`history`) and knows nothing about saving.
 * The reel editor wraps it with save / publish / delete; the recipe page wraps
 * it with "save as template". That is the whole difference between the two, so
 * the design tools cannot drift apart.
 *
 * Passing `verseTexts` puts it in *template* mode: boxes can be bound to a
 * verse field (they then show the sample verse's text and are filled from each
 * verse when reels are made), and the single-verse picker is not offered.
 */
export function ReelDesigner({
  history,
  canWrite,
  initialTab = 'text',
  verseTexts,
  details,
  onSave,
  onReloadMedia,
}: {
  history: ReelHistory;
  canWrite: boolean;
  initialTab?: Tab;
  verseTexts?: Record<OverlayBind, string>;
  /** The Details tab, when the host has one. Gets a way to open the verse picker. */
  details?: (api: { openVersePicker: () => void }) => ReactNode;
  /** Ctrl/⌘ S. The host decides whether there is anything to save. */
  onSave?: () => void;
  onReloadMedia?: () => Promise<void>;
}) {
  const { doc, set, undo, redo, beginGesture, endGesture } = history;
  const templateMode = Boolean(verseTexts);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [slide, setSlide] = useState(0);
  const [showGuides, setShowGuides] = useState(false);
  const [snap, setSnap] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [metrics, setMetrics] = useState<Record<string, BoxMetrics>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Switching a reel's type drops its media, so the slide index means nothing.
  useEffect(() => setSlide(0), [doc.mediaType]);

  // What the frame, the list and the inspector show: a bound box wears the
  // sample verse's text. The document itself keeps its own text — that is what
  // gets saved.
  const shown = useMemo(
    () => (verseTexts ? { ...doc, overlays: doc.overlays.map((o) => (o.bind ? { ...o, text: verseTexts[o.bind] || o.text } : o)) } : doc),
    [doc, verseTexts]
  );
  const selected = shown.overlays.find((overlay) => overlay.id === selectedId) ?? null;

  // ── text boxes ───────────────────────────────────────────────────────────

  const patchOverlay = (id: string, patch: Partial<Overlay>, key?: string) =>
    set((d) => ({ ...d, overlays: d.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)) }), key);

  function focusText() {
    setTab('text');
    // The Text tab may have just mounted; wait for its textarea.
    setTimeout(() => {
      textRef.current?.focus();
      textRef.current?.select();
    }, 50);
  }

  function addOverlay(partial: Partial<Overlay> = {}) {
    if (doc.overlays.length >= MAX_OVERLAYS) {
      setNotice(`A reel holds at most ${MAX_OVERLAYS} text boxes.`);
      return null;
    }
    setNotice('');
    const overlay = newOverlay(doc.overlays, partial);
    set((d) => ({ ...d, overlays: [...d.overlays, overlay] }));
    setSelectedId(overlay.id);
    return overlay;
  }

  function addText(partial: Partial<Overlay> = {}) {
    if (addOverlay(partial)) focusText();
  }

  function addBound(bind: OverlayBind) {
    addOverlay({ ...BIND_DEFAULTS[bind], bind, text: verseTexts?.[bind] || BIND_LABELS[bind] });
    setTab('text');
  }

  function toggleHidden(id: string) {
    setHiddenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function removeOverlay(id: string) {
    set((d) => ({ ...d, overlays: d.overlays.filter((o) => o.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  function copyOverlay(id: string) {
    const source = doc.overlays.find((o) => o.id === id);
    if (!source || doc.overlays.length >= MAX_OVERLAYS) return;
    const copy = duplicateOverlay(source);
    set((d) => ({ ...d, overlays: [...d.overlays, copy] }));
    setSelectedId(copy.id);
  }

  function paste() {
    const copied = readClipboard();
    if (!copied) return;
    // A bound box only means something where there is a verse to fill it from.
    const { bind, ...plain } = copied;
    addOverlay(duplicateOverlay(templateMode && bind ? copied : plain));
  }

  // Later in the list is drawn on top, so "forward" is +1.
  function moveOverlay(id: string, direction: 1 | -1) {
    set((d) => {
      const from = d.overlays.findIndex((o) => o.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= d.overlays.length) return d;
      const overlays = [...d.overlays];
      [overlays[from], overlays[to]] = [overlays[to], overlays[from]];
      return { ...d, overlays };
    });
  }

  // One undo step per click: the text box and the verse link go in together.
  function insertVerse(insert: VerseInsert) {
    const translation = insert.kind === 'translation';
    const overlay = insert.text
      ? newOverlay(doc.overlays, {
          text: insert.text.slice(0, 2000),
          style: translation ? 'body' : 'verse',
          size: translation ? 4 : 4.5,
          x: 8,
          width: 84,
          source: { verseId: insert.verse.verseId, label: insert.verse.label },
        })
      : null;

    if (overlay && doc.overlays.length >= MAX_OVERLAYS) {
      setNotice(`A reel holds at most ${MAX_OVERLAYS} text boxes.`);
      return;
    }

    set((d) => ({
      ...d,
      verse: insert.link ? insert.verse : d.verse,
      overlays: overlay ? [...d.overlays, overlay] : d.overlays,
    }));
    if (overlay) setSelectedId(overlay.id);
  }

  // ── keyboard ─────────────────────────────────────────────────────────────
  // Registered on every render so the handler always sees the current document.

  useEffect(() => {
    if (!canWrite) return;

    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (pickerOpen || target?.closest('input, textarea, select, [contenteditable], [role="dialog"], [role="menu"]')) return;

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === 's') {
        event.preventDefault();
        onSave?.();
      } else if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (mod && key === 'y') {
        event.preventDefault();
        redo();
      } else if (mod && key === 'd' && selected) {
        event.preventDefault();
        copyOverlay(selected.id);
      } else if (mod && key === 'c' && selected) {
        // Through localStorage, so a box can be carried to another reel. Not
        // prevented: any page text that is selected still copies as usual.
        writeClipboard(doc.overlays.find((o) => o.id === selected.id) ?? selected);
      } else if (mod && key === 'v' && readClipboard()) {
        event.preventDefault();
        paste();
      } else if (!mod && key === 'h' && selected) {
        toggleHidden(selected.id);
      } else if (!mod && event.key === '?') {
        setHelpOpen(true);
      } else if (!mod && selected) {
        const step = event.shiftKey ? 5 : 1;
        const nudge = (dx: number, dy: number) => {
          event.preventDefault();
          patchOverlay(
            selected.id,
            { x: clamp(selected.x + dx, 0, Math.max(0, 100 - selected.width)), y: clamp(selected.y + dy, 0, 95) },
            `${selected.id}:nudge`
          );
        };
        if (event.key === 'ArrowLeft') nudge(-step, 0);
        else if (event.key === 'ArrowRight') nudge(step, 0);
        else if (event.key === 'ArrowUp') nudge(0, -step);
        else if (event.key === 'ArrowDown') nudge(0, step);
        else if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
          removeOverlay(selected.id);
        } else if (event.key === 'Escape') setSelectedId(null);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)_24rem]">
      <aside>
        <fieldset disabled={!canWrite} className="min-w-0">
          <h3 className="mb-3 text-sm font-semibold">Text on the frame</h3>
          <ReelLayers
            overlays={shown.overlays}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setTab('text');
            }}
            onAdd={addText}
            onAddVerse={templateMode ? undefined : () => setPickerOpen(true)}
            onAddBound={templateMode ? addBound : undefined}
            onDuplicate={copyOverlay}
            onDelete={removeOverlay}
            onMove={moveOverlay}
            presets={OVERLAY_PRESETS}
            hiddenIds={hiddenIds}
            onToggleHidden={toggleHidden}
            metrics={metrics}
          />
          {notice && <p className="mt-2 text-xs text-destructive">{notice}</p>}
        </fieldset>
      </aside>

      <section className="flex min-w-0 flex-col items-center gap-3 lg:sticky lg:top-0 lg:self-start">
        <ReelStage
          doc={shown}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={canWrite ? (id, patch) => patchOverlay(id, patch) : () => undefined}
          onGestureStart={canWrite ? beginGesture : () => undefined}
          onGestureEnd={canWrite ? endGesture : () => undefined}
          onEditText={(id) => {
            setSelectedId(id);
            focusText();
          }}
          slide={slide}
          onSlide={setSlide}
          showGuides={showGuides}
          snap={snap}
          videoRef={videoRef}
          hiddenIds={hiddenIds}
          metrics={metrics}
          onMeasure={setMetrics}
          onReloadMedia={onReloadMedia}
        />
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} />
            Show app overlays
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={snap} onChange={(e) => setSnap(e.target.checked)} />
            Snap to centre
          </label>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground" onClick={() => setHelpOpen(true)} title="Keyboard shortcuts (?)">
            <Keyboard className="h-4 w-4" />
            Shortcuts
          </Button>
        </div>
      </section>

      <aside className="min-w-0">
        <fieldset disabled={!canWrite} className="min-w-0">
          <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
            <TabsList className="w-full">
              <TabsTrigger value="text" className="flex-1 justify-center">
                Text
              </TabsTrigger>
              <TabsTrigger value="media" className="flex-1 justify-center">
                Media
              </TabsTrigger>
              {details && (
                <TabsTrigger value="details" className="flex-1 justify-center">
                  Details
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="text">
              <ReelTextInspector
                overlay={selected}
                metrics={selected ? metrics[selected.id] : undefined}
                bindable={templateMode}
                onChange={patchOverlay}
                onDuplicate={copyOverlay}
                onDelete={removeOverlay}
                textRef={textRef}
              />
            </TabsContent>
            <TabsContent value="media">
              <ReelMediaPanel doc={doc} set={set} videoRef={videoRef} slide={slide} />
            </TabsContent>
            {details && <TabsContent value="details">{details({ openVersePicker: () => setPickerOpen(true) })}</TabsContent>}
          </Tabs>
        </fieldset>
      </aside>

      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
      {!templateMode && <VersePicker open={pickerOpen} onOpenChange={setPickerOpen} onInsert={insertVerse} />}
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / pause the preview'],
  ['M', 'Mute / unmute the preview'],
  ['← →', 'Seek 1s (Shift: 5s) — when no text box is selected'],
  ['← → ↑ ↓', 'Nudge the selected box 1% (Shift: 5%)'],
  ['Alt while dragging', 'Skip snapping'],
  ['Ctrl/⌘ Z', 'Undo'],
  ['Ctrl/⌘ Shift Z, Ctrl/⌘ Y', 'Redo'],
  ['Ctrl/⌘ S', 'Save'],
  ['Ctrl/⌘ D', 'Duplicate the selected box'],
  ['Ctrl/⌘ C, Ctrl/⌘ V', 'Copy a box, paste it here or into another reel'],
  ['H', 'Hide / show the selected box while editing'],
  ['Delete', 'Delete the selected box'],
  ['Esc', 'Deselect'],
  ['Double-click a box', 'Edit its text'],
];

function ShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys} className="contents">
              <dt className="font-mono text-xs font-medium">{keys}</dt>
              <dd className="text-muted-foreground">{what}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
