import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Music, Pause, Play, RefreshCw, Volume2, VolumeX } from 'lucide-react';
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

/** The parts of the frame the app draws its own chrome over, in % of the frame. */
export type SafeArea = { label: string; x: number; y: number; w: number; h: number };
export const SAFE_AREAS: SafeArea[] = [
  { label: 'Status bar', x: 0, y: 0, w: 100, h: 8 },
  { label: 'Creator & caption', x: 0, y: 76, w: 82, h: 24 },
  { label: 'Buttons', x: 82, y: 40, w: 18, h: 60 },
];

/** What the frame measured about a box: its height (% of the frame) and the chrome it sits under. */
export type BoxMetrics = { height: number; under: string[] };

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
  /** Boxes hidden while editing. Still saved — hiding is only for seeing what is underneath. */
  hiddenIds?: Set<string>;
  metrics?: Record<string, BoxMetrics>;
  onMeasure?: (metrics: Record<string, BoxMetrics>) => void;
  /** Fetch fresh signed links after one has expired. */
  onReloadMedia?: () => Promise<void>;
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
  hiddenIds,
  metrics,
  onMeasure,
  onReloadMedia,
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
  // One element keeps the clock — the video when there is one, otherwise the
  // audio — and the play button follows that element's own play/pause events
  // rather than guessing, so it cannot drift from what is actually playing.
  // Background music under a video loops on its own length; it is put back in
  // step with the video whenever the video is started, seeked or loops.

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [time, setTime] = useState(0);
  const [measured, setMeasured] = useState(0);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState<'video' | 'audio' | null>(null);
  const lastTime = useRef(0);

  const total = measured || (doc.durationMs ?? 0) / 1000;
  // The video sets the clock when there is one; otherwise the audio does.
  const clockedByVideo = doc.mediaType === 'VIDEO' && Boolean(doc.videoUrl);
  const playable = Boolean(clockedByVideo || doc.audioUrl);

  const clock = (): HTMLMediaElement | null => (clockedByVideo ? videoRef.current : audioRef.current);
  const elements = () =>
    [videoRef.current, audioRef.current].filter((el): el is HTMLVideoElement | HTMLAudioElement => Boolean(el?.getAttribute('src')));

  // A new file in either slot stops everything and starts from the top — the
  // element whose source changed has already been reset by the browser, the
  // other one has not.
  useEffect(() => {
    [videoRef.current, audioRef.current].forEach((el) => {
      if (!el) return;
      el.pause();
      if (el.readyState > 0) el.currentTime = 0;
    });
    const current = clockedByVideo ? videoRef.current : audioRef.current;
    setMeasured(current && current.readyState > 0 ? finite(current.duration) : 0);
    setPlaying(false);
    setBuffering(false);
    setTime(0);
    setFailed(null);
    lastTime.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.videoUrl, doc.audioUrl, doc.mediaType]);

  /** Put the music where the video is, wrapped to the music's own length. */
  function syncMusic() {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!clockedByVideo || !video || !audio?.getAttribute('src')) return;
    const length = finite(audio.duration);
    if (length > 0) audio.currentTime = video.currentTime % length;
  }

  async function play() {
    const els = elements();
    if (!els.length) return;
    syncMusic();
    try {
      await Promise.all(els.map((el) => el.play()));
    } catch (error) {
      // One element refusing (a dead link, an unsupported codec) must not leave
      // the other playing on its own.
      els.forEach((el) => el.pause());
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(clockedByVideo ? 'video' : 'audio');
    }
  }

  function pause() {
    elements().forEach((el) => el.pause());
  }

  function toggle() {
    if (playing) pause();
    else void play();
  }

  function seek(seconds: number) {
    const el = clock();
    if (!el) return;
    const to = clamp(seconds, 0, total || 0);
    el.currentTime = to;
    lastTime.current = to;
    syncMusic();
    setTime(to);
  }

  function onClockTime(el: HTMLMediaElement) {
    const now = el.currentTime;
    // A looping video jumped back to the start: bring the music with it.
    if (clockedByVideo && now < lastTime.current - 0.5) syncMusic();
    lastTime.current = now;
    setTime(now);
  }

  // Space plays and pauses; with nothing selected the arrows seek and M mutes.
  // Buttons are skipped, or Space on a focused button would toggle twice.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('textarea, select, button, a, [contenteditable], [role="dialog"], [role="menu"]')) return;
      // The position slider is the one input that should still hear Space and M
      // (just after seeking is exactly when you want to play); it keeps its own arrows.
      const slider = target instanceof HTMLInputElement && target.type === 'range';
      if (target?.closest('input') && !slider) return;

      if (event.key === ' ' && playable) {
        event.preventDefault();
        toggle();
      } else if (event.key.toLowerCase() === 'm' && playable) {
        setMuted((m) => !m);
      } else if (!slider && !selectedId && playable && total && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        const step = event.shiftKey ? 5 : 1;
        seek(time + (event.key === 'ArrowLeft' ? -step : step));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── measuring ────────────────────────────────────────────────────────────
  // A box's height is whatever its text wraps to, so only the laid-out frame
  // knows it. Measured after every render and reported only when it changes:
  // the inspector uses it to place a box, and both panels use it to warn when
  // a box sits under the app's own chrome.

  const reported = useRef('');
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || !onMeasure || !frame.clientHeight) return;
    const metrics: Record<string, BoxMetrics> = {};
    frame.querySelectorAll<HTMLElement>('[data-overlay]').forEach((el) => {
      const overlay = doc.overlays.find((o) => o.id === el.dataset.overlay);
      if (!overlay) return;
      const height = round((el.offsetHeight / frame.clientHeight) * 100);
      metrics[overlay.id] = { height, under: SAFE_AREAS.filter((area) => overlaps(overlay, height, area)).map((area) => area.label) };
    });
    const key = JSON.stringify(metrics);
    if (key === reported.current) return;
    reported.current = key;
    onMeasure(metrics);
  });

  // ── render ───────────────────────────────────────────────────────────────

  // Handles sit inside the box, so their pointer events bubble to its handlers.
  const layer = doc.overlays.map((overlay) => {
    if (hiddenIds?.has(overlay.id)) return null;
    const selected = overlay.id === selectedId;
    const underChrome = Boolean(metrics?.[overlay.id]?.under.length);
    return (
      <div
        key={overlay.id}
        data-overlay={overlay.id}
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
          selected
            ? 'outline outline-2 outline-sky-400'
            : underChrome && showGuides
              ? 'outline outline-1 outline-dashed outline-amber-400'
              : 'hover:outline hover:outline-1 hover:outline-dashed hover:outline-white/70'
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
            // Background music replaces the video's own sound, as in the app.
            muted={muted || Boolean(doc.audioUrl)}
            loop
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => setMeasured(finite(e.currentTarget.duration))}
            onDurationChange={(e) => setMeasured(finite(e.currentTarget.duration))}
            onTimeUpdate={(e) => onClockTime(e.currentTarget)}
            onPlay={() => setPlaying(true)}
            onPause={() => {
              setPlaying(false);
              audioRef.current?.pause();
            }}
            onWaiting={() => setBuffering(true)}
            onPlaying={() => setBuffering(false)}
            onCanPlay={() => setBuffering(false)}
            onError={() => setFailed('video')}
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
            {SAFE_AREAS.map((area) => (
              <div
                key={area.label}
                style={{ left: `${area.x}%`, top: `${area.y}%`, width: `${area.w}%`, height: `${area.h}%` }}
                className="absolute border border-dashed border-white/50 bg-white/10 px-1 pt-1 text-center"
              >
                {area.label}
              </div>
            ))}
          </div>
        )}

        {layer}

        {guides.v && <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-fuchsia-400" />}
        {guides.h && <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-fuchsia-400" />}

        {buffering && playing && !failed && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/80" />
          </div>
        )}

        {failed && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute inset-x-3 top-3 rounded-md bg-black/80 p-3 text-center text-xs text-white"
          >
            <p className="flex items-center justify-center gap-1.5 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              {failed === 'video' ? 'The video would not play.' : 'The audio would not play.'}
            </p>
            <p className="mt-1 text-white/70">Its link may have expired, or the browser cannot decode the file.</p>
            {onReloadMedia && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-2 h-7"
                onClick={async () => {
                  setFailed(null);
                  await onReloadMedia();
                  // A link that comes back unchanged does not reload by itself.
                  [videoRef.current, audioRef.current].forEach((el) => el?.load());
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reload media
              </Button>
            )}
          </div>
        )}
      </div>

      {doc.audioUrl && (
        <audio
          ref={audioRef}
          src={doc.audioUrl}
          muted={muted}
          // Music loops under a longer video or slideshow; the recitation on an audio reel plays once.
          loop={doc.mediaType !== 'AUDIO'}
          preload="metadata"
          onLoadedMetadata={(e) => {
            if (!clockedByVideo) setMeasured(finite(e.currentTarget.duration));
            else syncMusic();
          }}
          onDurationChange={(e) => !clockedByVideo && setMeasured(finite(e.currentTarget.duration))}
          onTimeUpdate={(e) => !clockedByVideo && onClockTime(e.currentTarget)}
          onPlay={() => !clockedByVideo && setPlaying(true)}
          onPause={() => !clockedByVideo && setPlaying(false)}
          onWaiting={() => !clockedByVideo && setBuffering(true)}
          onPlaying={() => setBuffering(false)}
          onCanPlay={() => !clockedByVideo && setBuffering(false)}
          onError={() => setFailed('audio')}
        />
      )}

      <div className="flex w-full max-w-[24rem] items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={toggle}
          disabled={!playable}
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
        >
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
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setMuted((m) => !m)}
          disabled={!playable}
          aria-label={muted ? 'Unmute preview' : 'Mute preview'}
          aria-pressed={muted}
          title={muted ? 'Unmute (M)' : 'Mute (M)'}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
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

// Some streams report an endless duration until they have been read through.
const finite = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

function overlaps(overlay: Overlay, height: number, area: SafeArea) {
  const inset = 0.5; // % — touching an edge is not sitting under it
  return (
    overlay.x + inset < area.x + area.w &&
    overlay.x + overlay.width - inset > area.x &&
    overlay.y + inset < area.y + area.h &&
    overlay.y + height - inset > area.y
  );
}

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
