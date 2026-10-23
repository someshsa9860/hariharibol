// Where a tap on a push can go, in the app's own words. The same list is in
// `backend/utils/push-rich.js` (which checks it) and the app reads the names in
// `app/lib/services/push_link.dart` — keep the three in step.

export type PushTarget = {
  key: string;
  label: string;
  params: { name: 'slug' | 'id' | 'book' | 'canto' | 'chapter' | 'verse'; label: string; required: boolean }[];
};

const p = (name: PushTarget['params'][number]['name'], label: string, required = true) => ({ name, label, required });

export const PUSH_TARGETS: PushTarget[] = [
  { key: 'home', label: 'Home', params: [] },
  { key: 'sakha', label: 'Ask Sakha', params: [] },
  { key: 'jap', label: 'Jap counter', params: [] },
  { key: 'chant', label: 'Chant counter', params: [] },
  { key: 'read', label: 'Read (library)', params: [] },
  { key: 'reels', label: 'Reels', params: [] },
  { key: 'routine', label: 'Routine', params: [] },
  { key: 'calendar', label: 'Hindu calendar', params: [] },
  { key: 'premium', label: 'Plans', params: [] },
  { key: 'refer', label: 'Refer and earn', params: [] },
  { key: 'search', label: 'Search', params: [] },
  { key: 'support', label: 'Help and feedback', params: [] },
  { key: 'ticket', label: 'A support ticket', params: [p('id', 'Ticket id')] },
  { key: 'mantra', label: 'A mantra', params: [p('slug', 'Mantra slug')] },
  { key: 'reel', label: 'A reel', params: [p('id', 'Reel id')] },
  {
    key: 'verse',
    label: 'A verse',
    params: [p('book', 'Book slug'), p('canto', 'Canto', false), p('chapter', 'Chapter'), p('verse', 'Verse', false)],
  },
];

export type PushLink = { target: string } & Partial<Record<'slug' | 'id' | 'book' | 'canto' | 'chapter' | 'verse', string>>;

/** The link, or null while it is unset or missing a value it needs. */
export function readyLink(link: PushLink | null): PushLink | null {
  if (!link?.target) return null;
  const target = PUSH_TARGETS.find((t) => t.key === link.target);
  if (!target) return null;
  const missing = target.params.some((param) => param.required && !link[param.name]?.trim());
  return missing ? null : link;
}
