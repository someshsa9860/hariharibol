// A prayer's verses as one ordered list: the original in its own script and the English meaning beside it, add, reorder
// and remove. The list is saved whole (PUT /items/:id/verses) with the ids the server gave the verses already there, so a
// reordered verse keeps its translations; a verse taken out of the list takes its translations with it, which is why saving
// asks first. `VersesEditor` is the controlled list (a new prayer holds it in its own form); `SavedVersesEditor` is the one
// on an existing prayer, with its own Save.

import { useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, ClipboardPaste, Loader2, Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/input';
import { Problem, VERSE_FONT, message, useReportDirty, type Dirty } from '@/components/prayer-form-bits';
import { languageName, useSavePrayerVerses, type PrayerDetail, type PrayerVerse, type VerseInput } from '@/lib/prayers';

/** The most verses a prayer may have (the server refuses more). */
export const MAX_VERSES = 400;

/** A verse as the editor holds it: `key` is for React only, `id` is the server's (absent until the verse is saved). */
export type VerseRow = { key: string; id?: string; text: string; meaning: string };

let counter = 0;
const newKey = () => `new-${++counter}`;

export const blankRow = (): VerseRow => ({ key: newKey(), text: '', meaning: '' });

export const toRows = (verses: PrayerVerse[]): VerseRow[] => verses.map((v) => ({ key: v.id, id: v.id, text: v.text, meaning: v.meaning ?? '' }));

/** What is sent: the order is the array's, an `id` marks a verse that already exists. */
export const toInputs = (rows: VerseRow[]): VerseInput[] => rows.map((r) => ({ ...(r.id ? { id: r.id } : {}), text: r.text.trim(), meaning: r.meaning.trim() }));

/** What is wrong with the list, in words, or null. The API checks the same things again. */
export function versesProblem(rows: VerseRow[], published: boolean): string | null {
  if (rows.length > MAX_VERSES) return `A prayer has at most ${MAX_VERSES} verses.`;
  const empty = rows.findIndex((r) => !r.text.trim());
  if (empty >= 0) return `Verse ${empty + 1} has no text. Write it or remove it.`;
  if (published && rows.length === 0) return 'A published prayer needs at least one verse. Hold it back as a draft first.';
  return null;
}

// ── The list ──────────────────────────────────────────────────────────────────────────────────────────

export function VersesEditor({ rows, onChange, originalLanguage, disabled }: { rows: VerseRow[]; onChange: (rows: VerseRow[]) => void; originalLanguage: string; disabled?: boolean }) {
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const script = languageName(originalLanguage);

  const edit = (index: number, changes: Partial<VerseRow>) => onChange(rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...rows];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));

  // A pasted prayer arrives as blocks separated by a blank line; each block is a verse, its line breaks kept.
  const addPasted = () => {
    const blocks = pasted.split(/\r?\n\s*\r?\n/).map((b) => b.replace(/\s+$/g, '').replace(/^\s*\r?\n/, '')).filter((b) => b.trim());
    if (blocks.length === 0) return;
    onChange([...rows, ...blocks.map((text) => ({ ...blankRow(), text }))]);
    setPasted('');
    setPasting(false);
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">No verses yet.</p>}

      {rows.map((row, index) => (
        <div key={row.key} className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Verse {index + 1}</p>
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" aria-label={`Move verse ${index + 1} up`} onClick={() => move(index, -1)} disabled={disabled || index === 0}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Move verse ${index + 1} down`} onClick={() => move(index, 1)} disabled={disabled || index === rows.length - 1}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label={`Remove verse ${index + 1}`} onClick={() => remove(index)} disabled={disabled}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`prayer-verse-text-${row.key}`}>Original ({script})</Label>
              <Textarea
                id={`prayer-verse-text-${row.key}`}
                rows={4}
                value={row.text}
                onChange={(ev) => edit(index, { text: ev.target.value })}
                disabled={disabled}
                style={{ fontFamily: VERSE_FONT }}
                className="text-base leading-relaxed"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`prayer-verse-meaning-${row.key}`}>Meaning (English)</Label>
              <Textarea id={`prayer-verse-meaning-${row.key}`} rows={4} value={row.meaning} onChange={(ev) => edit(index, { meaning: ev.target.value })} disabled={disabled} />
            </div>
          </div>
        </div>
      ))}

      {pasting && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <Label htmlFor="prayer-verses-paste">Paste the prayer</Label>
          <Textarea id="prayer-verses-paste" rows={8} value={pasted} onChange={(ev) => setPasted(ev.target.value)} style={{ fontFamily: VERSE_FONT }} autoFocus />
          <p className="text-xs text-muted-foreground">A blank line starts the next verse; a line break inside a verse is kept as a line of it. The meanings are added afterwards, verse by verse.</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={addPasted} disabled={!pasted.trim()}>
              <Plus /> Add these verses
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPasting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, blankRow()])} disabled={disabled || rows.length >= MAX_VERSES}>
          <Plus /> Add a verse
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setPasting(true)} disabled={disabled || pasting}>
          <ClipboardPaste /> Paste several
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {rows.length} verse{rows.length === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}

// ── On an existing prayer ──────────────────────────────────────────────────────────────────────────

/** The list on a saved prayer, with its own Save. Keep it mounted for the life of the dialog: its edits are its own state. */
export function SavedVersesEditor({ prayer, setDirty }: { prayer: PrayerDetail; setDirty: Dirty }) {
  const save = useSavePrayerVerses(prayer.id);
  const [base, setBase] = useState<VerseRow[]>(() => toRows(prayer.verses));
  const [rows, setRows] = useState<VerseRow[]>(base);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = JSON.stringify(toInputs(rows)) !== JSON.stringify(toInputs(base));
  useReportDirty('verses', dirty, setDirty);
  const invalid = versesProblem(rows, prayer.status === 'PUBLISHED');

  // Anything written in another language hangs off a verse's id, so a removed verse takes it along.
  const hasTranslations = prayer.languages.some((l) => l.texts > 0 || l.meanings > 0);
  const kept = new Set(rows.map((r) => r.id).filter(Boolean));
  const removed = base.filter((r) => r.id && !kept.has(r.id)).length;
  const textChanged = rows.some((r) => {
    const before = base.find((b) => b.id && b.id === r.id);
    return !!before && before.text.trim() !== r.text.trim();
  });

  const submit = () => {
    if (removed > 0 && hasTranslations && !confirm(`Remove ${removed} verse${removed === 1 ? '' : 's'}? What was written for ${removed === 1 ? 'it' : 'them'} in other languages is deleted with ${removed === 1 ? 'it' : 'them'}.`)) return;
    setProblem(null);
    setSaved(false);
    save.mutate(toInputs(rows), {
      onSuccess: (list) => {
        const next = toRows(list);
        setBase(next);
        setRows(next);
        setSaved(true);
      },
      onError: (err) => setProblem(message(err)),
    });
  };

  return (
    <div className="space-y-4">
      <VersesEditor rows={rows} onChange={setRows} originalLanguage={prayer.originalLanguage} disabled={save.isPending} />
      {textChanged && hasTranslations && (
        <p className="text-xs text-amber-800 dark:text-amber-300">A verse whose original you changed will show “Out of date” on the languages that have it written out, until a run or you write it again.</p>
      )}
      <Problem>{problem}</Problem>
      <div className="flex items-center justify-end gap-3">
        {saved && !dirty && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        {dirty && invalid && <p className="text-xs text-muted-foreground">{invalid}</p>}
        {dirty && (
          <Button variant="outline" onClick={() => setRows(base)} disabled={save.isPending}>
            <Undo2 /> Discard
          </Button>
        )}
        <Button onClick={submit} disabled={save.isPending || !dirty || !!invalid}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save verses
        </Button>
      </div>
    </div>
  );
}
