import { useEffect, useRef, useState } from 'react';
import { Crosshair, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { ACCEPT, probeMedia, uploadFile } from '@/lib/upload';

/** A whole mala on a recording, and the stretch of it that is chanting. */
export type MalaAudio = {
  path: string | null;
  /** Only for playing it back here — the API never stores a link. */
  url: string | null;
  startMs: number | null;
  endMs: number | null;
};

export const NO_MALA_AUDIO: MalaAudio = { path: null, url: null, startMs: null, endMs: null };

// A round is 108 beads — the same number the API counts a round by
// (BEADS_PER_ROUND in controllers/app/sadhana.js). The app divides the chanting
// stretch by it, so what is shown here is what a chant will be paced at.
const CHANTS_PER_MALA = 108;

/** Why this recording cannot be saved, or null when it can. */
export function malaAudioProblem(mala: MalaAudio): string | null {
  if (!mala.path) return null;
  if (mala.startMs == null || mala.endMs == null) return 'Set where the chanting starts and ends in the recording.';
  if (mala.endMs <= mala.startMs) return 'The chanting has to end after it starts.';
  return null;
}

const toSeconds = (ms: number | null) => (ms == null ? '' : String(Math.round(ms) / 1000));

const message = (error: unknown) =>
  error instanceof ApiRequestError || error instanceof Error ? error.message : 'The upload failed. Try again.';

/**
 * The mala recording of one mantra — optional. Staff upload one full mala, then
 * play it and mark where the chanting begins (after any opening prayer, such as
 * the Pancha-tattva mantra before the mahamantra) and where the last chant ends.
 * The app plays the recording and counts one chant per 1/108 of that stretch,
 * so the two marks are what makes the count land with the voice.
 */
export function MantraMalaAudio({
  value,
  onChange,
  disabled,
}: {
  value: MalaAudio;
  onChange: (value: MalaAudio) => void;
  disabled?: boolean;
}) {
  const player = useRef<HTMLAudioElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  // The recording's own length, read by the player once it has loaded.
  const [lengthMs, setLengthMs] = useState<number | null>(null);

  async function add(file: File) {
    setError('');
    setProgress(0);
    try {
      const [info, key] = await Promise.all([probeMedia(file, 'audio'), uploadFile('mantraMalaAudio', file, setProgress)]);
      // Start at the top and end at the end: right for a recording of nothing but
      // chanting, and a place to start narrowing from for one that is not.
      onChange({ path: key, url: URL.createObjectURL(file), startMs: 0, endMs: info.durationMs });
    } catch (e) {
      setError(message(e));
    } finally {
      setProgress(null);
    }
  }

  const here = () => Math.round((player.current?.currentTime ?? 0) * 1000);

  const problem = malaAudioProblem(value);
  const beyondEnd = value.endMs != null && lengthMs != null && value.endMs > lengthMs + 50;
  const chantMs = value.startMs != null && value.endMs != null && value.endMs > value.startMs ? (value.endMs - value.startMs) / CHANTS_PER_MALA : null;

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div>
        <Label>Mala recording (optional)</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">
          One whole mala of {CHANTS_PER_MALA} chants. The app plays it and counts along, one chant for every{' '}
          1/{CHANTS_PER_MALA} of the chanting stretch you mark below.
        </p>
      </div>

      {value.path && (
        <>
          {value.url ? (
            <audio ref={player} src={value.url} controls preload="metadata" className="w-full" onLoadedMetadata={(e) => setLengthMs(Math.round(e.currentTarget.duration * 1000))} />
          ) : (
            <p className="text-sm text-muted-foreground">Recording attached. It cannot be previewed until it is saved and reopened.</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <SecondsField
              label="Chanting starts (s)"
              ms={value.startMs}
              disabled={disabled}
              onChange={(startMs) => onChange({ ...value, startMs })}
              onUsePlayer={value.url ? () => onChange({ ...value, startMs: here() }) : undefined}
            />
            <SecondsField
              label="Chanting ends (s)"
              ms={value.endMs}
              disabled={disabled}
              onChange={(endMs) => onChange({ ...value, endMs })}
              onUsePlayer={value.url ? () => onChange({ ...value, endMs: here() }) : undefined}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {chantMs != null ? `One chant ≈ ${(chantMs / 1000).toFixed(2)} s.` : 'Mark both ends to see the pace of one chant.'} Pause the player on the first
            syllable and the last, then use “Use player”.
          </p>
          {beyondEnd && <p className="text-xs text-destructive">The end is past the end of the recording.</p>}
          {problem && <p className="text-xs text-destructive">{problem}</p>}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || progress !== null} onClick={() => picker.current?.click()}>
          {progress !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {progress !== null ? `Uploading ${Math.round(progress * 100)}%` : value.path ? 'Replace recording' : 'Upload recording'}
        </Button>
        {value.path && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(NO_MALA_AUDIO)}>
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        )}
        <input
          ref={picker}
          type="file"
          hidden
          accept={[...ACCEPT.mantraMalaAudio, '.mp3', '.m4a', '.aac', '.wav'].join(',')}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) add(file);
          }}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// Seconds with decimals, kept as the text being typed so "12." survives until
// the next digit, and committed as whole milliseconds.
function SecondsField({
  label,
  ms,
  disabled,
  onChange,
  onUsePlayer,
}: {
  label: string;
  ms: number | null;
  disabled?: boolean;
  onChange: (ms: number | null) => void;
  onUsePlayer?: () => void;
}) {
  const [text, setText] = useState(toSeconds(ms));

  // A change that did not come from typing here — the player button, a new file.
  useEffect(() => {
    const typed = text.trim() === '' ? null : Math.round(Number(text) * 1000);
    if (typed !== ms) setText(toSeconds(ms));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms]);

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex gap-1">
        <Input
          type="number"
          min={0}
          step={0.1}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            const seconds = e.target.value.trim() === '' ? null : Number(e.target.value);
            onChange(seconds == null || Number.isNaN(seconds) ? null : Math.max(0, Math.round(seconds * 1000)));
          }}
        />
        {onUsePlayer && (
          <Button type="button" variant="outline" size="icon" className="shrink-0" title="Use player position" aria-label="Use player position" disabled={disabled} onClick={onUsePlayer}>
            <Crosshair className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
