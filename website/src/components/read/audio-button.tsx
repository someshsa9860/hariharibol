'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Icon } from '@/components/ui/icon';
import { claimAudio, releaseAudio } from '@/lib/audio-bus';


/** Plays a verse's recitation. `compact` is a round icon button for a verse card. */
export function AudioButton({ src, label = 'Listen', compact, onEnded }: { src: string; label?: string; compact?: boolean; onEnded?: () => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');

  useEffect(() => () => {
    if (!audio.current) return;
    audio.current.pause();
    releaseAudio(audio.current);
  }, []);

  const toggle = async () => {
    if (!audio.current) {
      const element = new Audio(src);
      element.preload = 'none';
      element.onended = () => { setState('idle'); onEnded?.(); };
      element.onpause = () => setState((current) => (current === 'playing' ? 'idle' : current));
      element.onerror = () => setState('error');
      audio.current = element;
    }
    const element = audio.current;
    if (state === 'playing') return element.pause();
    claimAudio(element);
    setState('loading');
    try {
      await element.play();
      setState('playing');
    } catch {
      setState('error');
    }
  };

  const icon = state === 'playing' ? 'pause' : state === 'error' ? 'refresh' : 'volume';
  const text = state === 'error' ? 'Couldn’t play' : state === 'playing' ? 'Pause' : label;

  return compact ? (
    <button className={clsx('icon-btn', state === 'playing' && 'is-playing')} onClick={toggle} aria-label={text} aria-pressed={state === 'playing'}>
      {state === 'loading' ? <span className="spinner" /> : <Icon name={icon} />}
    </button>
  ) : (
    <button className="btn btn-ghost btn-sm" onClick={toggle} aria-pressed={state === 'playing'}>
      {state === 'loading' ? <span className="spinner" /> : <Icon name={icon} size={16} />} {text}
    </button>
  );
}
