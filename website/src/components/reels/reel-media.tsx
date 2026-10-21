/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { Overlay, Reel } from '@/lib/types';

const OVERLAY_FONT: Record<Overlay['style'], string> = { body: 'var(--sans)', heading: 'var(--serif)', verse: 'var(--deva)' };
const OVERLAY_COLOR: Record<Overlay['color'], string> = { light: '#ffffff', dark: '#1b1b1b', accent: '#f6c36b' };

/** Text an admin laid over the reel. Positions are percentages of the frame; sizes are a share of its width. */
export function Overlays({ overlays }: { overlays: Overlay[] }) {
  return (
    <>
      {overlays.map((overlay) => (
        <p
          key={overlay.id}
          className="reel-overlay"
          style={{
            left: `${overlay.x}%`, top: `${overlay.y}%`, width: `${overlay.width}%`,
            fontSize: `${overlay.size}cqw`, textAlign: overlay.align, color: OVERLAY_COLOR[overlay.color],
            fontFamily: OVERLAY_FONT[overlay.style], fontWeight: overlay.style === 'heading' ? 600 : 400,
          }}
        >
          {overlay.text}
        </p>
      ))}
    </>
  );
}

interface Props {
  reel: Reel;
  active: boolean;
  muted: boolean;
  paused: boolean;
  onProgress: (watchedMs: number, durationMs: number) => void;
}

/** The picture of a reel: a video, a slideshow of images, or a still with its recitation playing. */
export function ReelMedia({ reel, active, muted, paused, onProgress }: Props) {
  const video = useRef<HTMLVideoElement | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [slide, setSlide] = useState(0);
  const [progress, setProgress] = useState(0);
  const images = reel.media.length ? reel.media.map((m) => m.imageUrl) : reel.thumbnailUrl ? [reel.thumbnailUrl] : [];
  const watched = useRef(0);
  const report = useRef(onProgress);
  report.current = onProgress;

  // Play only the reel that is on screen.
  useEffect(() => {
    const play = active && !paused;
    const v = video.current;
    const a = audio.current;
    if (v) {
      v.muted = muted;
      if (play) v.play().catch(() => undefined);
      else v.pause();
    }
    if (a) {
      a.muted = muted;
      if (play) a.play().catch(() => undefined);
      else a.pause();
    }
    if (!active) { watched.current = 0; setProgress(0); setSlide(0); }
  }, [active, paused, muted]);

  // A slideshow turns its own pages.
  useEffect(() => {
    if (reel.mediaType === 'VIDEO' || images.length < 2 || !active || paused) return;
    const timer = setInterval(() => setSlide((s) => (s + 1) % images.length), 4500);
    return () => clearInterval(timer);
  }, [reel.mediaType, images.length, active, paused]);

  // Report how far the reader got, a moment after they leave.
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    return () => report.current(Math.max(watched.current, Date.now() - started), reel.durationMs ?? 0);
  }, [active, reel.durationMs]);

  const tick = (current: number, total: number) => {
    watched.current = Math.max(watched.current, current * 1000);
    setProgress(total > 0 ? current / total : 0);
  };

  return (
    <div className="reel-frame">
      {reel.mediaType === 'VIDEO' && reel.videoUrl ? (
        <video
          ref={video} src={reel.videoUrl} poster={reel.thumbnailUrl ?? undefined} loop playsInline muted={muted} preload={active ? 'auto' : 'metadata'}
          onTimeUpdate={(event) => tick(event.currentTarget.currentTime, event.currentTarget.duration)}
        />
      ) : (
        <div className="reel-stills">
          {images.map((src, index) => (
            <img key={src} src={src} alt="" className={clsx(index === slide && 'is-on')} loading={index === 0 ? 'eager' : 'lazy'} />
          ))}
          {images.length === 0 && <div className="reel-blank" />}
          {images.length > 1 && (
            <div className="reel-dots" aria-hidden="true">{images.map((_, i) => <i key={i} className={clsx(i === slide && 'is-on')} />)}</div>
          )}
        </div>
      )}
      {reel.mediaType !== 'VIDEO' && reel.audioUrl && (
        <audio ref={audio} src={reel.audioUrl} loop={reel.mediaType === 'IMAGE'} onTimeUpdate={(event) => tick(event.currentTarget.currentTime, event.currentTarget.duration)} preload={active ? 'auto' : 'none'} />
      )}
      {reel.mediaType === 'VIDEO' && reel.audioUrl && <audio ref={audio} src={reel.audioUrl} loop preload="none" />}
      <div className="reel-shade" />
      <Overlays overlays={reel.overlays} />
      <div className="reel-progress" aria-hidden="true"><i style={{ transform: `scaleX(${progress})` }} /></div>
    </div>
  );
}
