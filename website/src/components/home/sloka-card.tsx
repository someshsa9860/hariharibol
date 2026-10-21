'use client';

import Link from 'next/link';
import { ShareButton } from '@/components/share/share-button';
import { Icon } from '@/components/ui/icon';
import { AudioButton } from '@/components/read/audio-button';
import { verseCitation } from '@/lib/format';
import { verseReadHref } from '@/lib/links';
import type { Verse } from '@/lib/types';

/** The verse of the day: the big card on Home. */
export function SlokaCard({ verse, label = 'Verse of the day' }: { verse: Verse; label?: string }) {
  const citation = verseCitation(verse);

  return (
    <article className="sloka-card">
      <div className="sloka-card-top">
        <span className="eyebrow">{label}</span>
        <span className="sloka-ref">{citation}</span>
      </div>
      {verse.sanskrit && <p className="sloka-sanskrit deva" lang="sa">{verse.sanskrit}</p>}
      {verse.translation?.meaning && <p className="sloka-meaning">{verse.translation.meaning}</p>}
      <div className="sloka-actions">
        <Link href={verseReadHref(verse)} className="btn btn-primary btn-sm">Read in context <Icon name="arrow" size={16} /></Link>
        {verse.audioUrl && <AudioButton src={verse.audioUrl} label="Listen" />}
        <ShareButton content={{ kind: 'SHLOKA', targetId: verse.verseId, title: citation, sanskrit: verse.sanskrit, transliteration: verse.transliteration, meaning: verse.translation?.meaning ?? null }} />
      </div>
    </article>
  );
}
