import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { ACCEPT, uploadFile, type UploadKind } from '@/lib/upload';
import { cn } from '@/lib/utils';

const message = (error: unknown) =>
  error instanceof ApiRequestError || error instanceof Error ? error.message : 'The upload failed. Try again.';

/**
 * One optional picture on a reference row (a deity's list picture, its full-screen
 * one). The file goes to storage first; the row only keeps the key it gets back,
 * and the preview is the file itself until the page next loads a signed link.
 *
 * `ratio` is only the shape of the preview box — the file is not cropped.
 */
export function ImageUploadField({
  label,
  hint,
  kind,
  ratio,
  previewUrl,
  hasImage,
  onUploaded,
  onRemoved,
  onBusyChange,
}: {
  label: string;
  hint: string;
  kind: UploadKind;
  ratio: string; // CSS aspect-ratio, e.g. "1 / 1" or "9 / 16"
  previewUrl: string | null;
  hasImage: boolean;
  onUploaded: (key: string, localUrl: string) => void;
  onRemoved: () => void;
  /** Says when a file is on its way, so a form can hold its Save until the key is back. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function add(file: File) {
    setError('');
    setProgress(0);
    onBusyChange?.(true);
    try {
      const key = await uploadFile(kind, file, setProgress);
      onUploaded(key, URL.createObjectURL(file));
    } catch (e) {
      setError(message(e));
    } finally {
      setProgress(null);
      onBusyChange?.(false);
    }
  }

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex items-start gap-3">
        <div
          className={cn(
            'flex w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground',
            !hasImage && 'border-dashed'
          )}
          style={{ aspectRatio: ratio }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-5 w-5" aria-hidden />
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{hint}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={progress !== null} onClick={() => picker.current?.click()}>
              {progress !== null ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {Math.round(progress * 100)}%
                </>
              ) : hasImage ? (
                'Replace'
              ) : (
                'Upload'
              )}
            </Button>
            {hasImage && progress === null && (
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onRemoved}>
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
      <input
        ref={picker}
        type="file"
        accept={ACCEPT[kind].join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void add(file);
        }}
      />
    </div>
  );
}
