'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { claimAudio, releaseAudio } from '@/lib/audio-bus';
import type { Verse } from '@/lib/types';

/** Plays a chapter's recitations one after another, reporting which verse is sounding so the page can follow it. */
export function useChapterPlayer(verses: Verse[]) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const indexRef = useRef(0);
  const versesRef = useRef(verses);
  versesRef.current = verses;

  const playableFrom = useCallback((start: number) => {
    for (let i = start; i < versesRef.current.length; i += 1) if (versesRef.current[i].audioUrl) return i;
    return -1;
  }, []);

  const start = useCallback((from: number) => {
    const target = playableFrom(from);
    if (target < 0) {
      setPlaying(false);
      setIndex(null);
      return;
    }
    if (!audio.current) {
      const element = new Audio();
      element.onended = () => startRef.current(indexRef.current + 1);
      element.onerror = () => startRef.current(indexRef.current + 1);
      audio.current = element;
    }
    const element = audio.current;
    indexRef.current = target;
    element.src = versesRef.current[target].audioUrl as string;
    claimAudio(element);
    setIndex(target);
    element.play().then(() => setPlaying(true), () => setPlaying(false));
    document.getElementById(`v-${versesRef.current[target].verseNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [playableFrom]);

  const startRef = useRef(start);
  startRef.current = start;

  const toggle = useCallback(() => {
    const element = audio.current;
    if (playing && element) {
      element.pause();
      setPlaying(false);
    } else if (element && index !== null && element.src) {
      claimAudio(element);
      element.play().then(() => setPlaying(true), () => setPlaying(false));
    } else {
      start(0);
    }
  }, [index, playing, start]);

  const skip = useCallback((step: 1 | -1) => {
    const base = index === null ? 0 : index + step;
    if (step === -1) {
      for (let i = Math.max(0, base); i >= 0; i -= 1) if (versesRef.current[i]?.audioUrl) return start(i);
    } else start(Math.max(0, base));
  }, [index, start]);

  useEffect(() => () => {
    if (!audio.current) return;
    audio.current.pause();
    releaseAudio(audio.current);
  }, []);

  const available = verses.some((verse) => verse.audioUrl);
  return { available, playing, index, toggle, skip };
}
