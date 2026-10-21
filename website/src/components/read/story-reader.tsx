'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Icon } from '@/components/ui/icon';
import { useToast } from '@/components/ui/toast';
import { useFavorite } from '@/lib/favorites';
import { verseCitation, verseRef } from '@/lib/format';
import { verseHref } from '@/lib/links';
import { usePrefs, type StoryPart } from '@/lib/prefs/prefs-provider';
import { copyText } from '@/lib/share';
import Link from 'next/link';
import type { Verse } from '@/lib/types';

const PARTS: { key: StoryPart; label: string }[] = [
  { key: 'sanskrit', label: 'Sanskrit' },
  { key: 'transliteration', label: 'Transliteration' },
  { key: 'meaning', label: 'Meaning' },
  { key: 'purport', label: 'Purport' },
];

function partText(verse: Verse, part: StoryPart): string {
  if (part === 'sanskrit') return verse.sanskrit ?? '';
  if (part === 'transliteration') return verse.transliteration ?? '';
  if (part === 'meaning') return (verse.translation?.meaning ?? '').replace(/^["“”']+|["“”']+$/g, '');
  return verse.translation?.purport ?? '';
}

/** Which part of each verse the story shows: Sanskrit, transliteration, meaning or purport. */
export function StoryPartBar() {
  const { reader, setReader } = usePrefs();
  return (
    <div className="story-parts" role="radiogroup" aria-label="What to read">
      {PARTS.map((part) => (
        <button key={part.key} role="radio" aria-checked={reader.storyPart === part.key} className={clsx('chip', reader.storyPart === part.key && 'on')} onClick={() => setReader({ storyPart: part.key })}>
          {part.label}
        </button>
      ))}
    </div>
  );
}

function StoryVerse({ verse, text, numbered, active, selected, onSelect, onPlay }: {
  verse: Verse; text: string; numbered: boolean; active: boolean; selected: boolean; onSelect: () => void; onPlay?: () => void;
}) {
  const toast = useToast();
  const { isFavorite, toggle } = useFavorite('verse', verse.id);
  const part = usePrefs().reader.storyPart;
  const paragraphs = text.split(/\n{2,}/);
  return (
    <span id={`v-${verse.verseNumber}`} className={clsx('story-verse', active && 'is-active', selected && 'is-selected', isFavorite && 'is-saved')}>
      <span className="story-hit" role="button" tabIndex={0} aria-expanded={selected} onClick={onSelect} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); } }}>
        {numbered && <sup className="story-no">{isFavorite && <Icon name="heart" size={10} solid />}{verse.verseNumber}</sup>}
        {paragraphs.map((para, i) => <span key={i} className={clsx('story-text', part === 'sanskrit' && 'deva')} lang={part === 'sanskrit' ? 'sa' : undefined}>{para} </span>)}
      </span>
      {selected && (
        <span className="story-actions" role="group" aria-label={`Verse ${verseRef(verse)}`}>
          {verse.audioUrl && onPlay && <button className="icon-btn" onClick={onPlay} aria-label="Listen from this verse"><Icon name="play" size={18} /></button>}
          <button className="icon-btn" onClick={toggle} aria-pressed={isFavorite} aria-label={isFavorite ? 'Remove from favourites' : 'Save to favourites'}><Icon name="heart" size={18} solid={isFavorite} /></button>
          <button className="icon-btn" aria-label="Copy this verse" onClick={async () => toast((await copyText(`${text}\n— ${verseCitation(verse)}`)) ? 'Verse copied' : 'Could not copy')}><Icon name="copy" size={18} /></button>
          <Link className="btn btn-quiet btn-sm" href={verseHref(verse.verseId)}>Open verse</Link>
        </span>
      )}
    </span>
  );
}

/** A chapter as running text: one part of every verse, a small number in front, no cards between them. */
export function StoryReader({ verses, activeIndex, onPlay }: { verses: Verse[]; activeIndex: number | null; onPlay: (index: number) => void }) {
  const { reader } = usePrefs();
  const [selected, setSelected] = useState<string | null>(null);
  const shown = verses.map((verse, index) => ({ verse, index, text: partText(verse, reader.storyPart) })).filter((item) => item.text.trim());

  if (shown.length === 0) return <p className="story-empty muted">This chapter has no {PARTS.find((p) => p.key === reader.storyPart)?.label.toLowerCase()} to read. Try another part above.</p>;
  return (
    <article className={clsx('story', `story-${reader.storyPart}`)} style={{ '--scale': reader.fontScale } as React.CSSProperties}>
      {shown.map(({ verse, index, text }) => (
        <StoryVerse key={verse.id} verse={verse} text={text} numbered={reader.storyNumbers} active={activeIndex === index} selected={selected === verse.id}
          onSelect={() => setSelected((current) => (current === verse.id ? null : verse.id))} onPlay={() => onPlay(index)} />
      ))}
    </article>
  );
}
