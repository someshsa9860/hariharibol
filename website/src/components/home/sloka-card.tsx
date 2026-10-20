'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { useToast } from '@/components/ui/toast';
import { AudioButton } from '@/components/read/audio-button';
import { SITE_URL } from '@/lib/config';
import { verseCitation } from '@/lib/format';
import { verseHref, verseReadHref } from '@/lib/links';
import { share } from '@/lib/share';
import type { Verse } from '@/lib/types';

/** The verse of the day: the big card on Home. */
export function SlokaCard({ verse, label = 'Verse of the day' }: { verse: Verse; label?: string }) {
  const toast = useToast();
  const citation = verseCitation(verse);

  const onShare = async () => {
    const result = await share({
      title: citation,
      text: `${verse.sanskrit ?? ''}\n\n${verse.translation?.meaning ?? ''}\n— ${citation}`,
      url: `${SITE_URL}${verseHref(verse.verseId)}`,
    });
    if (result === 'copied') toast('Link copied');
    if (result === 'failed') toast('Could not share this verse');
  };

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
        <button className="btn btn-ghost btn-sm" onClick={onShare}><Icon name="share" size={16} /> Share</button>
      </div>
    </article>
  );
}
