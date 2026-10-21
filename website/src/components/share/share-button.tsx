'use client';

import { useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Icon } from '@/components/ui/icon';
import type { ShareTarget } from '@/lib/share-link';
import { verseHref } from '@/lib/links';
import { verseCitation } from '@/lib/format';
import type { Mantra, Verse } from '@/lib/types';

// The studio is large and only needed once someone taps Share, so it loads then.
const ShareStudio = dynamic(() => import('./share-studio').then((m) => m.ShareStudio), { ssr: false });

/** Every share entry point on the site goes through this: one button, one studio, one link scheme. */
export function ShareButton({ target, label, className = 'icon-btn', ariaLabel = 'Share' }: { target: ShareTarget; label?: ReactNode; className?: string; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)} aria-label={label ? undefined : ariaLabel} aria-haspopup="dialog">
        <Icon name="share" size={className.includes('btn-') ? 16 : undefined} />{label}
      </button>
      {open && <ShareStudio target={target} onClose={() => setOpen(false)} />}
    </>
  );
}

export function verseTarget(verse: Verse): ShareTarget {
  const citation = verseCitation(verse);
  return {
    type: 'VERSE',
    id: verse.verseId,
    title: citation,
    sanskrit: verse.sanskrit,
    transliteration: verse.transliteration,
    translation: verse.translation?.meaning ?? null,
    reference: citation,
    path: verseHref(verse.verseId),
  };
}

export function mantraTarget(mantra: Mantra): ShareTarget {
  return {
    type: 'MANTRA',
    id: mantra.slug,
    title: mantra.name,
    sanskrit: mantra.text,
    transliteration: mantra.transliteration,
    translation: mantra.meaning ?? mantra.description,
    reference: mantra.name,
    path: `/jap/${mantra.slug}`,
  };
}
