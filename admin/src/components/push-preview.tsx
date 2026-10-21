import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PushPreviewProps = {
  title: string;
  body: string;
  imageUrl: string | null;
  style: 'auto' | 'picture' | 'text';
  buttons: string[];
};

// An approximation drawn in the page, not a screenshot of a phone: Android
// versions and iOS settings change the details, but the structure — a small
// thumbnail when collapsed, the whole text and the big picture when expanded,
// buttons last — is what each system does with these fields.

function Picture({ url, className }: { url: string; className: string }) {
  return <img src={url} alt="" className={cn('object-cover', className)} />;
}

function AndroidCard({ title, body, imageUrl, style, buttons, expanded }: PushPreviewProps & { expanded: boolean }) {
  const big = imageUrl && style !== 'text';
  return (
    <div className="w-full max-w-sm rounded-2xl bg-[#f1efe9] p-3 text-[#1c1b1a] shadow-sm dark:bg-[#2b2a28] dark:text-[#ece9e2]">
      <div className="flex items-center gap-1.5 text-[11px] text-[#5f5c56] dark:text-[#b8b4ab]">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#e8762d] text-white">
          <BellRing className="h-2.5 w-2.5" />
        </span>
        HariHariBol · now
      </div>
      <div className="mt-1.5 flex gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title || 'Title'}</p>
          <p className={cn('mt-0.5 text-[13px] text-[#4a4843] dark:text-[#cfcbc2]', !expanded && 'line-clamp-1', expanded && big && 'line-clamp-3')}>
            {body || 'Message'}
          </p>
        </div>
        {!expanded && big && <Picture url={imageUrl!} className="h-12 w-12 shrink-0 rounded-md" />}
      </div>
      {expanded && big && <Picture url={imageUrl!} className="mt-2 aspect-[2/1] w-full rounded-lg" />}
      {expanded && buttons.length > 0 && (
        <div className="mt-2 flex gap-4 border-t border-black/10 pt-2 text-xs font-semibold text-[#b4521a] dark:border-white/10 dark:text-[#f0a36c]">
          {buttons.map((label) => (
            <span key={label} className="uppercase">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function IosCard({ title, body, imageUrl, buttons, expanded }: PushPreviewProps & { expanded: boolean }) {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-[22px] bg-white/80 text-black shadow-sm ring-1 ring-black/5 dark:bg-[#3a3a3c]/90 dark:text-white dark:ring-white/10">
      <div className="p-3">
        <div className="flex gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[#e8762d] text-white">
            <BellRing className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[13px] font-semibold">{title || 'Title'}</p>
              <span className="shrink-0 text-[11px] text-black/50 dark:text-white/50">now</span>
            </div>
            <p className={cn('mt-0.5 text-[13px] leading-snug', !expanded && 'line-clamp-2')}>{body || 'Message'}</p>
          </div>
          {!expanded && imageUrl && <Picture url={imageUrl} className="h-9 w-9 shrink-0 rounded-md" />}
        </div>
      </div>
      {expanded && imageUrl && <Picture url={imageUrl} className="aspect-[16/10] w-full" />}
      {expanded && buttons.length > 0 && (
        <div className="grid divide-x divide-black/10 border-t border-black/10 text-center text-[13px] font-medium text-[#0a6fd8] dark:divide-white/10 dark:border-white/10 dark:text-[#4da3ff]" style={{ gridTemplateColumns: `repeat(${buttons.length}, 1fr)` }}>
          {buttons.map((label) => (
            <span key={label} className="py-2.5">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** How the push will look on Android and iOS, collapsed and expanded. */
export function PushPreview(props: PushPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">Preview</h3>
        <div className="flex gap-1">
          <Button size="sm" variant={expanded ? 'outline' : 'default'} onClick={() => setExpanded(false)}>
            Collapsed
          </Button>
          <Button size="sm" variant={expanded ? 'default' : 'outline'} onClick={() => setExpanded(true)}>
            Expanded
          </Button>
        </div>
      </div>
      <div className="space-y-4 rounded-lg bg-gradient-to-br from-slate-300 to-slate-400 p-4 dark:from-slate-700 dark:to-slate-900">
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-black/60 dark:text-white/60">Android</p>
          <AndroidCard {...props} expanded={expanded} />
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-black/60 dark:text-white/60">iPhone</p>
          <IosCard {...props} expanded={expanded} />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        An approximation. The system draws the real one, and what it shows depends on the phone, its version and the
        reader&apos;s settings.
      </p>
    </div>
  );
}
