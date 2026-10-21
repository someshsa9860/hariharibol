'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import type { StudioContent } from '@/lib/studio/design';

// The studio is heavy and only wanted on demand, so it is not part of the page's first load.
const ShareStudio = dynamic(() => import('./share-studio').then((m) => m.ShareStudio), { ssr: false });

/** One share button for every verse, mantra and reel: opens the same studio with the right content. */
export function ShareButton({ content, label = 'Share', className = 'btn btn-ghost btn-sm', iconOnly = false, onShared }: { content: StudioContent; label?: string; className?: string; iconOnly?: boolean; onShared?: (how: 'IMAGE' | 'LINK' | 'TEXT') => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={iconOnly ? `${label} — open the share studio` : undefined}>
        <Icon name="share" size={iconOnly ? 20 : 16} />{!iconOnly && ` ${label}`}
      </button>
      {open && <ShareStudio content={content} onClose={() => setOpen(false)} onShared={onShared} />}
    </>
  );
}
