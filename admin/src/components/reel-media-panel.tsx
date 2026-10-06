import { useRef, useState, type DragEvent, type ReactNode, type RefObject } from 'react';
import { ArrowDown, ArrowUp, Camera, Film, ImagePlus, Loader2, Music, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { ACCEPT, probeMedia, uploadFile, type UploadKind } from '@/lib/upload';
import { ApiRequestError } from '@/lib/api';
import type { ReelDoc } from '@/lib/reel-doc';
import { cn } from '@/lib/utils';

type Slot = 'video' | 'images' | 'audio' | 'thumbnail';
type Progress = { name: string; fraction: number };

const MAX_IMAGES = 20;

const message = (error: unknown) =>
  error instanceof ApiRequestError || error instanceof Error ? error.message : 'The upload failed. Try again.';

// Uploads for the reel. Each file goes to storage first and the reel only ever
// keeps the key it got back; the blob: URL is just so the frame can show it
// straight away instead of waiting for a signed link.
export function ReelMediaPanel({
  doc,
  set,
  videoRef,
  slide,
}: {
  doc: ReelDoc;
  /** The slideshow image on the frame right now. */
  slide: number;
  set: (fn: (doc: ReelDoc) => ReelDoc, key?: string) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const [progress, setProgress] = useState<Partial<Record<Slot, Progress>>>({});
  const [error, setError] = useState('');

  async function upload(slot: Slot, kind: UploadKind, file: File) {
    setError('');
    setProgress((p) => ({ ...p, [slot]: { name: file.name, fraction: 0 } }));
    try {
      return await uploadFile(kind, file, (fraction) => setProgress((p) => ({ ...p, [slot]: { name: file.name, fraction } })));
    } finally {
      setProgress((p) => ({ ...p, [slot]: undefined }));
    }
  }

  async function addVideo(file: File) {
    try {
      const [info, key] = await Promise.all([probeMedia(file, 'video'), upload('video', 'reelVideo', file)]);
      set((d) => ({ ...d, videoPath: key, videoUrl: URL.createObjectURL(file), ...info }));
      // The browser's decoder is a fair stand-in for the phone's: a file it cannot
      // open (HEVC, an odd MOV) is likely to be a black screen in the app too.
      if (info.durationMs === null) setError(`"${file.name}" was uploaded, but this browser could not read it. Check that it plays in the preview — re-export as H.264 MP4 if not.`);
    } catch (e) {
      setError(message(e));
    }
  }

  async function addImages(files: File[]) {
    const room = MAX_IMAGES - doc.images.length;
    if (files.length > room) setError(`A slideshow holds at most ${MAX_IMAGES} images — the first ${room} were used.`);
    for (const file of files.slice(0, room)) {
      try {
        const key = await upload('images', 'reelImage', file);
        set((d) => ({ ...d, images: [...d.images, { path: key, url: URL.createObjectURL(file) }] }));
      } catch (e) {
        setError(message(e));
        break;
      }
    }
  }

  async function addAudio(file: File) {
    try {
      const [info, key] = await Promise.all([probeMedia(file, 'audio'), upload('audio', 'reelAudio', file)]);
      if (info.durationMs === null) setError(`"${file.name}" was uploaded, but this browser could not read it. Check that it plays in the preview.`);
      // On a video the video already sets the length; on an audio reel this is the length.
      set((d) => ({
        ...d,
        audioPath: key,
        audioUrl: URL.createObjectURL(file),
        durationMs: d.mediaType === 'AUDIO' ? info.durationMs : d.durationMs,
      }));
    } catch (e) {
      setError(message(e));
    }
  }

  async function addThumbnail(file: File) {
    try {
      const key = await upload('thumbnail', 'reelThumbnail', file);
      set((d) => ({ ...d, thumbnailPath: key, thumbnailUrl: URL.createObjectURL(file) }));
    } catch (e) {
      setError(message(e));
    }
  }

  async function useFrame() {
    if (!doc.videoUrl) return;
    setError('');
    try {
      const blob = await captureFrame(doc.videoUrl, videoRef.current?.currentTime ?? 0);
      await addThumbnail(new File([blob], 'frame.jpg', { type: 'image/jpeg' }));
    } catch (e) {
      setError(
        e instanceof DOMException || e instanceof TypeError
          ? "Couldn't read a frame from this video. The storage bucket has to allow this site (CORS) — or upload a thumbnail image instead."
          : message(e)
      );
    }
  }

  const moveImage = (index: number, direction: 1 | -1) =>
    set((d) => {
      const images = [...d.images];
      const target = index + direction;
      if (target < 0 || target >= images.length) return d;
      [images[index], images[target]] = [images[target], images[index]];
      return { ...d, images };
    });

  const isAudioReel = doc.mediaType === 'AUDIO';
  const shown = doc.mediaType === 'IMAGE' ? doc.images[Math.min(slide, doc.images.length - 1)] : undefined;

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="flex items-start justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setError('')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {doc.mediaType === 'VIDEO' && (
        <Section title="Video" hint="MP4 or MOV, H.264. Portrait 9:16 fills the frame.">
          {doc.videoPath ? (
            <FileRow
              icon={<Film className="h-4 w-4" />}
              title="Video attached"
              detail={[
                doc.durationMs != null && formatDuration(doc.durationMs),
                doc.width && doc.height && `${doc.width}×${doc.height}`,
              ]
                .filter(Boolean)
                .join(' · ')}
              onRemove={() => set((d) => ({ ...d, videoPath: null, videoUrl: null, durationMs: null, width: null, height: null }))}
            />
          ) : null}
          <Picker kind="reelVideo" busy={progress.video} onFiles={(files) => addVideo(files[0])}>
            {doc.videoPath ? 'Replace video' : 'Upload a video'}
          </Picker>
          {doc.width && doc.height && doc.width / doc.height > 0.7 && (
            <p className="text-xs text-amber-600">This video is not portrait — it will be cropped to fill the frame.</p>
          )}
        </Section>
      )}

      {doc.mediaType === 'IMAGE' && (
        <Section title={`Images (${doc.images.length}/${MAX_IMAGES})`} hint="Shown in this order. Reorder with the arrows.">
          <ul className="space-y-1.5">
            {doc.images.map((image, index) => (
              <li key={image.path} className="flex items-center gap-2 rounded-md border border-border p-1.5">
                <img src={image.url} alt="" className="h-12 w-8 shrink-0 rounded object-cover" />
                <span className="flex-1 text-sm text-muted-foreground">Image {index + 1}</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Move up" disabled={index === 0} onClick={() => moveImage(index, -1)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Move down" disabled={index === doc.images.length - 1} onClick={() => moveImage(index, 1)}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove image" onClick={() => set((d) => ({ ...d, images: d.images.filter((i) => i.path !== image.path) }))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
          <Picker kind="reelImage" multiple busy={progress.images} disabled={doc.images.length >= MAX_IMAGES} onFiles={addImages} icon={<ImagePlus className="h-4 w-4" />}>
            Add images
          </Picker>
        </Section>
      )}

      <Section
        title={isAudioReel ? 'Audio' : 'Background music'}
        hint={isAudioReel ? 'The recitation or narration this reel plays. Required.' : 'Optional. Plays under the reel and loops.'}
      >
        {doc.audioPath && (
          <FileRow
            icon={<Music className="h-4 w-4" />}
            title="Audio attached"
            detail={isAudioReel && doc.durationMs != null ? formatDuration(doc.durationMs) : ''}
            onRemove={() => set((d) => ({ ...d, audioPath: null, audioUrl: null, durationMs: d.mediaType === 'AUDIO' ? null : d.durationMs }))}
          />
        )}
        <Picker kind="reelAudio" busy={progress.audio} onFiles={(files) => addAudio(files[0])} icon={<Music className="h-4 w-4" />}>
          {doc.audioPath ? 'Replace audio' : 'Upload audio'}
        </Picker>
      </Section>

      <Section title="Thumbnail" hint="Shown in grids and before the reel loads.">
        {doc.thumbnailUrl && (
          <div className="flex items-center gap-3">
            <img src={doc.thumbnailUrl} alt="Thumbnail" className="h-24 w-[3.375rem] rounded-md border border-border object-cover" />
            <Button type="button" variant="ghost" size="sm" onClick={() => set((d) => ({ ...d, thumbnailPath: null, thumbnailUrl: null }))}>
              <Trash2 className="h-4 w-4" />
              Remove
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Picker kind="reelThumbnail" busy={progress.thumbnail} onFiles={(files) => addThumbnail(files[0])}>
            {doc.thumbnailPath ? 'Replace image' : 'Upload image'}
          </Picker>
          {doc.mediaType === 'VIDEO' && doc.videoUrl && (
            <Button type="button" variant="outline" size="sm" onClick={useFrame} disabled={Boolean(progress.thumbnail)}>
              <Camera className="h-4 w-4" />
              Use current frame
            </Button>
          )}
          {shown && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={doc.thumbnailPath === shown.path}
              onClick={() => set((d) => ({ ...d, thumbnailPath: shown.path, thumbnailUrl: shown.url }))}
            >
              Use image {Math.min(slide, doc.images.length - 1) + 1}
            </Button>
          )}
        </div>
      </Section>
    </div>
  );
}

// ── pieces ─────────────────────────────────────────────────────────────────

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <Label>{title}</Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function FileRow({ icon, title, detail, onRemove }: { icon: ReactNode; title: string; detail: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// A button that opens the file dialog and is also a drop target.
function Picker({
  kind,
  multiple,
  busy,
  disabled,
  icon,
  onFiles,
  children,
}: {
  kind: UploadKind;
  multiple?: boolean;
  busy?: Progress;
  disabled?: boolean;
  icon?: ReactNode;
  onFiles: (files: File[]) => void;
  children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length) onFiles(files);
    if (input.current) input.current.value = ''; // so choosing the same file again still fires
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (!disabled && !busy) take(event.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn('rounded-md border border-dashed px-3 py-3 text-center transition-colors', over ? 'border-primary bg-accent' : 'border-border')}
    >
      <input ref={input} type="file" hidden multiple={multiple} accept={ACCEPT[kind].join(',')} onChange={(e) => take(e.target.files)} />
      {busy ? (
        <div className="space-y-1.5">
          <p className="flex items-center justify-center gap-2 truncate text-sm">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            <span className="truncate">{busy.name}</span>
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(busy.fraction * 100)}%` }} />
          </div>
        </div>
      ) : (
        <>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
            {icon ?? <Upload className="h-4 w-4" />}
            {children}
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">or drop a file here</p>
        </>
      )}
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

const formatDuration = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

/** A JPEG of the video at `seconds`. Reads through its own element so the preview player is left alone. */
async function captureFrame(url: string, seconds: number): Promise<Blob> {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.preload = 'auto';
  video.src = url;

  const once = (event: string) =>
    new Promise<void>((resolve, reject) => {
      video.addEventListener(event, () => resolve(), { once: true });
      video.addEventListener('error', () => reject(new TypeError('The video could not be loaded')), { once: true });
    });

  await once('loadeddata');
  video.currentTime = Math.min(seconds, video.duration || seconds);
  await once('seeked');

  const scale = Math.min(1, 720 / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);

  // toBlob throws a SecurityError here if the video was served without CORS.
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new TypeError('No frame'))), 'image/jpeg', 0.9)
  );
}
