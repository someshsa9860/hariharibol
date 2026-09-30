import { useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { useResource } from '@/lib/use-resource';
import { useAuth } from '@/lib/auth';
import type { ReelDoc } from '@/lib/reel-doc';

export type Creator = { id: string; displayName: string; isVerified: boolean; reelCount: number; isOfficial: boolean };
type Named = { id: string; name: string };
type Language = { code: string; englishName: string };

const SAMPRADAYAS = ['vaishnav', 'shaiva', 'shakta', 'smarta'];
const FALLBACK_LANGUAGES: Language[] = [
  { code: 'sa', englishName: 'Sanskrit' },
  { code: 'en', englishName: 'English' },
  { code: 'hi', englishName: 'Hindi' },
  { code: 'mr', englishName: 'Marathi' },
];
const MAX_CAPTION = 2200;

// Everything about the reel that is not on the frame: who it is published as,
// its caption and tags, and what it is about.
export function ReelDetailsPanel({
  doc,
  creators,
  set,
  onPickVerse,
}: {
  doc: ReelDoc;
  creators: Creator[];
  set: (fn: (doc: ReelDoc) => ReelDoc, key?: string) => void;
  onPickVerse: () => void;
}) {
  const { hasPermission } = useAuth();
  const [tagDraft, setTagDraft] = useState('');

  // These lists sit behind other permissions; an editor without them still gets
  // a working form, just without that dropdown.
  const canDeity = hasPermission('reference.manage');
  const canMantra = hasPermission('mantra.read');
  const deities = useResource<Named[]>(['reel-deities'], '/api/admin/reference/deities', { page: 1, pageSize: 100 }, { enabled: canDeity });
  const mantras = useResource<Named[]>(['reel-mantras'], '/api/admin/mantras', { page: 1, pageSize: 100, sort: 'name' }, { enabled: canMantra });
  const languageQuery = useResource<Language[]>(['reel-languages'], '/api/admin/reference/languages', { page: 1, pageSize: 100 }, { enabled: canDeity });
  const languages = languageQuery.data?.length ? languageQuery.data : FALLBACK_LANGUAGES;

  const field = <K extends keyof ReelDoc>(key: K, value: ReelDoc[K], coalesce = '') => set((d) => ({ ...d, [key]: value }), coalesce);

  function addTags(raw: string) {
    const added = raw
      .split(/[,\n]/)
      .map((t) => t.trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean);
    if (added.length) set((d) => ({ ...d, tags: [...new Set([...d.tags, ...added])].slice(0, 30) }));
    setTagDraft('');
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="reel-creator">Published as</Label>
        <Select id="reel-creator" className="w-full" value={doc.creatorId} onChange={(e) => field('creatorId', e.target.value)}>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName}
              {c.isOfficial ? ' (official)' : ''}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">Only approved creators can be chosen — the feed hides reels from anyone else.</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="reel-caption">Caption</Label>
          <span className="text-xs text-muted-foreground">
            {doc.caption.length}/{MAX_CAPTION}
          </span>
        </div>
        <Textarea
          id="reel-caption"
          className="min-h-24"
          maxLength={MAX_CAPTION}
          value={doc.caption}
          onChange={(e) => field('caption', e.target.value, 'caption')}
          placeholder="Shown under the reel in the feed"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reel-tags">Tags</Label>
        {doc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {doc.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                #{tag}
                <button type="button" aria-label={`Remove ${tag}`} onClick={() => set((d) => ({ ...d, tags: d.tags.filter((t) => t !== tag) }))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <Input
          id="reel-tags"
          value={tagDraft}
          placeholder="Type a tag, press Enter"
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTags(tagDraft);
            }
          }}
          onBlur={() => addTags(tagDraft)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="reel-language">Language</Label>
          <Select id="reel-language" className="w-full" value={doc.languageCode} onChange={(e) => field('languageCode', e.target.value)}>
            <option value="">Not specified</option>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.englishName}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reel-sampradaya">Sampradaya</Label>
          <Input id="reel-sampradaya" list="reel-sampradayas" value={doc.sampradaya} onChange={(e) => field('sampradaya', e.target.value.toLowerCase(), 'sampradaya')} />
          <datalist id="reel-sampradayas">
            {SAMPRADAYAS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Verse</Label>
        {doc.verse ? (
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{doc.verse.label}</span>
            <Button type="button" variant="ghost" size="sm" onClick={onPickVerse}>
              Change
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Unlink verse" onClick={() => set((d) => ({ ...d, verse: null }))}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="w-full" onClick={onPickVerse}>
            <BookOpen className="h-4 w-4" />
            Link a verse
          </Button>
        )}
      </div>

      {canMantra && (
        <div className="space-y-1.5">
          <Label htmlFor="reel-mantra">Mantra</Label>
          <Select id="reel-mantra" className="w-full" value={doc.mantraId} onChange={(e) => field('mantraId', e.target.value)}>
            <option value="">None</option>
            {mantras.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {canDeity && (
        <div className="space-y-1.5">
          <Label htmlFor="reel-deity">Deity</Label>
          <Select id="reel-deity" className="w-full" value={doc.deityId} onChange={(e) => field('deityId', e.target.value)}>
            <option value="">None</option>
            {deities.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
