import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, Music, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { COLOR_PREVIEW, type Overlay, type OverlayStyle, type ReelDoc } from '@/lib/reel-doc';
import { cn } from '@/lib/utils';

// The 9:16 frame the reel is composed on. Text boxes are absolutely positioned
// in percentages and sized in `cqw` (1% of the frame's width), which is exactly
// how the app lays them out — so what is placed here lands in the same spot on
// every phone.

const SNAP = 1.5; // % — how close to the centre line a box has to get to jump onto it
const MIN_WIDTH = 5;

// The app's own faces, as near as a browser gets: headings in its serif, verses
// and body on the platform font (Devanagari never takes the serif).
const FONT: Record<OverlayStyle, CSSProperties> = {
  body: { fontWeight: 500, lineHeight: 1.35 },
  heading: { fontWeight: 400, lineHeight: 1.2, fontFamily: 'Georgia, "Noto Serif", serif' },
  verse: { fontWeight: 500, lineHeight: 1.55 },
};

const SHADOW = {
  light: '0 1px 6px rgba(0,0,0,0.6)',
  dark: '0 1px 4px rgba(255,255,255,0.4)',
  accent: '0 1px 6px rgba(0,0,0,0.6)',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

type Drag = {
  id: string;
  mode: 'move' | 'width' | 'size';
  startX: number;
  startY: number;
  box: Pick<Overlay, 'x' | 'y' | 'width' | 'size'>;
  boxHeight: number; // % of frame height
  boxWidthPx: number;
};

type Props = {
  doc: ReelDoc;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<Overlay>) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onEditText: (id: string) => void;
  slide: number;
  onSlide: (index: number) => void;
  showGuides: boolean;
  snap: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
};

export function ReelStage({
  doc,
  selectedId,
  onSelect,
  onChange,
  onGestureStart,
  onGestureEnd,
  onEditText,
  slide,
  onSlide,
  showGuides,
  snap,
  videoRef,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const drag = useRef<Drag | null>(null);
  const [guides, setGuides] = useState({ v: false, h: false });

  const image = doc.mediaType === 'IMAGE' ? doc.images[Math.min(slide, doc.images.length - 1)] : undefined;

  // ── dragging ─────────────────────────────────────────────────────────────

  function begin(event: ReactPointerEvent<HTMLElement>, overlay: Overlay, mode: Drag['mode']) {
    event.preventDefault();
    event.stopPropagation();
    const frame = frameRef.current;
    const box = event.currentTarget.closest<HTMLElement>('[data-overlay]');
    if (!frame || !box) return;

    const frameRect = frame.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();

    onSelect(overlay.id);
    onGestureStart();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: overlay.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      box: { x: overlay.x, y: overlay.y, width: overlay.width, size: overlay.size },
      boxHeight: (boxRect.height / frameRect.height) * 100,
      boxWidthPx: boxRect.width,
    };
  }

  function move(event: ReactPointerEvent<HTMLElement>) {
    const current = drag.current;
    const frame = frameRef.current;
    if (!current || !frame) return;

    const rect = frame.getBoundingClientRect();
    const dx = ((event.clientX - current.startX) / rect.width) * 100;
    const dy = ((event.clientY - current.startY) / rect.height) * 100;
    const { box } = current;

    if (current.mode === 'width') {
      onChange(current.id, { width: round(clamp(box.width + dx, MIN_WIDTH, 100 - box.x)) });
      return;
    }

    if (current.mode === 'size') {
      const scale = 1 + (event.clientX - current.startX) / Math.max(current.boxWidthPx, 60);
      onChange(current.id, { size: round(clamp(box.size * scale, 1, 30)) });
      return;
    }

    let x = clamp(box.x + dx, 0, Math.max(0, 100 - box.width));
    let y = clamp(box.y + dy, 0, Math.max(0, 100 - current.boxHeight));
    const snapping = snap && !event.altKey;
    const centredX = snapping && Math.abs(x + box.width / 2 - 50) < SNAP;
    const centredY = snapping && Math.abs(y + current.boxHeight / 2 - 50) < SNAP;
    if (centredX) x = 50 - box.width / 2;
    if (centredY) y = 50 - current.boxHeight / 2;

    setGuides({ v: centredX, h: centredY });
    onChange(current.id, { x: round(x), y: round(y) });
  }

  function end() {
    if (!drag.current) return;
    drag.current = null;
    setGuides({ v: false, h: false });
    onGestureEnd();
  }

  // ── playback ─────────────────────────────────────────────────────────────

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [measured, setMeasured] = useState(0);
  const total = measured || (doc.durationMs ?? 0) / 1000;
  const playable = Boolean(doc.videoUrl || doc.audioUrl);
  // The video sets the clock when there is one; otherwise the audio does.
  const clockedByVideo = doc.mediaType === 'VIDEO' && Boolean(doc.videoUrl);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setMeasured(0);
  }, [doc.videoUrl, doc.audioUrl]);

  function toggle() {
    const elements = [videoRef.current, audioRef.current].filter((el): el is HTMLVideoElement | HTMLAudioElement => Boolean(el?.src));
    if (playing) {
      elements.forEach((el) => el.pause());
      setPlaying(false);
    } else {
      elements.forEach((el) => void el.play().catch(() => setPlaying(false)));
      setPlaying(true);
    }
  }

  function seek(seconds: number) {
    [videoRef.current, audioRef.current].forEach((el) => {
      if (el?.src) el.currentTime = seconds;
    });
    setTime(seconds);
  }

  // ── render ───────────────────────────────────────────────────────────────

  // Handles sit inside the box, so their pointer events bubble to its handlers.
  const layer = doc.overlays.map((overlay) => {
    const selected = overlay.id === selectedId;
    return (
      <div
        key={overlay.id}
        data-overlay
        onPointerDown={(e) => begin(e, overlay, 'move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={() => onEditText(overlay.id)}
        style={{
          left: `${overlay.x}%`,
          top: `${overlay.y}%`,
          width: `${overlay.width}%`,
          fontSize: `${overlay.size}cqw`,
          color: COLOR_PREVIEW[overlay.color],
          textAlign: overlay.align,
          textShadow: SHADOW[overlay.color],
          touchAction: 'none',
          ...FONT[overlay.style],
        }}
        className={cn(
          'absolute cursor-move select-none whitespace-pre-wrap break-words',
          selected ? 'outline outline-2 outline-sky-400' : 'hover:outline hover:outline-1 hover:outline-dashed hover:outline-white/70'
        )}
      >
        {overlay.text}
        {selected && (
          <>
            <span
              onPointerDown={(e) => begin(e, overlay, 'width')}
              title="Drag to change the width"
              className="absolute right-0 top-1/2 h-4 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-l-sm bg-sky-400"
            />
            <span
              onPointerDown={(e) => begin(e, overlay, 'size')}
              title="Drag to change the text size"
              className="absolute -bottom-2 right-0 h-3 w-3 cursor-nwse-resize rounded-full bg-sky-400"
            />
          </>
        )}
      </div>
    );
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={frameRef}
        onPointerDown={() => onSelect(null)}
        style={{ containerType: 'inline-size', height: 'clamp(340px, calc(100vh - 21rem), 700px)', aspectRatio: '9 / 16' }}
        className="relative overflow-hidden rounded-xl bg-neutral-900 shadow-lg ring-1 ring-border"
      >
        {doc.mediaType === 'VIDEO' && doc.videoUrl && (
          <video
            ref={videoRef}
            src={doc.videoUrl}
            poster={doc.thumbnailUrl ?? undefined}
            muted={Boolean(doc.audioUrl)}
            loop
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => setMeasured(e.currentTarget.duration)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onEnded={() => setPlaying(false)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {image && <img src={image.url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />}
        {doc.mediaType === 'AUDIO' && (
          <>
            {doc.thumbnailUrl && <img src={doc.thumbnailUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />}
            {!doc.thumbnailUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-neutral-800 to-neutral-950 text-neutral-500">
                <Music className="h-16 w-16" />
              </div>
            )}
          </>
        )}
        {!doc.videoUrl && !image && doc.mediaType !== 'AUDIO' && (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-neutral-500">
            {doc.mediaType === 'VIDEO' ? 'Upload a video in the Media tab' : 'Add images in the Media tab'}
          </div>
        )}

        {/* the app's own chrome: what a box placed here would sit under */}
        {showGuides && (
          <div className="pointer-events-none absolute inset-0 text-[10px] text-white/70">
            <div className="absolute inset-x-0 top-0 h-[8%] border-b border-dashed border-white/50 bg-white/10 px-2 pt-1">Status bar</div>
            <div className="absolute bottom-0 left-0 right-[18%] h-[24%] border-r border-t border-dashed border-white/50 bg-white/10 px-2 pt-1">
              Creator &amp; caption
            </div>
            <div className="absolute bottom-0 right-0 top-[40%] w-[18%] border-l border-dashed border-white/50 bg-white/10 px-1 pt-1 text-center">
              Buttons
            </div>
          </div>
        )}

        {layer}

        {guides.v && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-fuchsia-400" />}
        {guides.h && <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-fuchsia-400" />}
      </div>

      {doc.audioUrl && (
        <audio
          ref={audioRef}
          src={doc.audioUrl}
          loop={doc.mediaType !== 'AUDIO'}
          onLoadedMetadata={(e) => !clockedByVideo && setMeasured(e.currentTarget.duration)}
          onTimeUpdate={(e) => !clockedByVideo && setTime(e.currentTarget.currentTime)}
          onEnded={() => setPlaying(false)}
        />
      )}

      <div className="flex w-full max-w-[24rem] items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={toggle} disabled={!playable} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <input
          type="range"
          min={0}
          max={total || 1}
          step={0.05}
          value={Math.min(time, total || 1)}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!playable || !total}
          aria-label="Position"
          className="h-1 w-full cursor-pointer accent-primary disabled:opacity-40"
        />
        <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground">
          {fmt(time)} / {fmt(total)}
        </span>
      </div>

      {doc.mediaType === 'IMAGE' && doc.images.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSlide(Math.max(0, slide - 1))} disabled={slide <= 0} aria-label="Previous image">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          Image {Math.min(slide, doc.images.length - 1) + 1} of {doc.images.length}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSlide(Math.min(doc.images.length - 1, slide + 1))} disabled={slide >= doc.images.length - 1} aria-label="Next image">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
