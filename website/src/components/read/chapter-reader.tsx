'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { VerseCard } from './verse-card';
import { StoryReader, StoryPartBar } from './story-reader';
import { usePrefs } from '@/lib/prefs/prefs-provider';
import { ReaderSettingsSheet } from './reader-settings';
import { useChapterPlayer } from './use-chapter-player';
import { api } from '@/lib/api/client';
import { currentSession } from '@/lib/auth/session-store';
import { saveResume } from '@/lib/resume';
import type { Verse } from '@/lib/types';

interface Props {
  verses: Verse[];
  bookSlug: string;
  bookTitle: string;
  cantoNumber: number | null;
  chapterNumber: number | null;
}

/** A chapter's verses with the toolbar above them, the chapter player, and the reader's place saved as they read. */
export function ChapterReader({ verses, bookSlug, bookTitle, cantoNumber, chapterNumber }: Props) {
  const [settings, setSettings] = useState(false);
  const { reader, setReader } = usePrefs();
  const player = useChapterPlayer(verses);
  const furthest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save the furthest verse that has been on screen: to the account if signed in, else to this browser.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const byNumber = new Map(verses.map((verse) => [verse.verseNumber, verse]));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const number = Number(entry.target.id.replace('v-', ''));
        if (number > furthest.current) furthest.current = number;
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const verse = byNumber.get(furthest.current);
        if (!verse) return;
        saveResume({ slug: bookSlug, title: bookTitle, cantoNumber, chapterNumber, verseNumber: verse.verseNumber });
        if (currentSession()) api('/progress', { method: 'PUT', auth: 'required', body: { verseId: verse.verseId } }).catch(() => undefined);
      }, 2500);
    }, { threshold: 0.6 });
    document.querySelectorAll('.verse-card, .story-verse').forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [verses, bookSlug, bookTitle, cantoNumber, chapterNumber, reader.mode, reader.storyPart]);

  return (
    <>
      <div className="reader-bar" role="toolbar" aria-label="Reading tools">
        {player.available && (
          <div className="player">
            <button className="icon-btn" onClick={() => player.skip(-1)} aria-label="Previous verse" disabled={player.index === null}><Icon name="left" /></button>
            <button className="btn btn-primary btn-sm" onClick={player.toggle}>
              <Icon name={player.playing ? 'pause' : 'play'} size={16} /> {player.playing ? 'Pause' : player.index === null ? 'Play chapter' : 'Resume'}
            </button>
            <button className="icon-btn" onClick={() => player.skip(1)} aria-label="Next verse" disabled={player.index === null}><Icon name="right" /></button>
          </div>
        )}
        <button className={reader.mode === 'story' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} aria-pressed={reader.mode === 'story'} onClick={() => setReader({ mode: reader.mode === 'story' ? 'verse' : 'story' })}><Icon name="book" size={16} /> Story</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setSettings(true)}><Icon name="text" size={16} /> Reading settings</button>
      </div>

      {reader.mode === 'story' ? (
        <>
          <StoryPartBar />
          <StoryReader verses={verses} activeIndex={player.playing ? player.index : null} onPlay={player.playAt} />
        </>
      ) : (
        <div className="verse-list">
          {verses.map((verse, index) => (
            <VerseCard key={verse.id} verse={verse} active={player.playing && player.index === index} />
          ))}
        </div>
      )}
      {settings && <ReaderSettingsSheet onClose={() => setSettings(false)} />}
    </>
  );
}
