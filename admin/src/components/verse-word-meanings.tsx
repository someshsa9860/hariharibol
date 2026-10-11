import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api';
import { useResourceMutation } from '@/lib/use-resource';

/** One word of the verse and what it means, as the API stores it. */
type Entry = { word: string | null; meaning: string };

/** The same, as it is being typed: a blank word is '' here and null once saved. */
type Row = { key: number; word: string; meaning: string };

function entriesFrom(value: unknown): Entry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Entry[] => {
    if (!item || typeof item !== 'object') return [];
    const { word, meaning, raw } = item as Record<string, unknown>;
    // An older import kept a verse's whole word-for-word as one unsplit string.
    if (typeof raw === 'string') return [{ word: null, meaning: raw }];
    return [{ word: typeof word === 'string' ? word : null, meaning: typeof meaning === 'string' ? meaning : '' }];
  });
}

/** What gets sent: trimmed, a blank word as null, and rows with nothing in them left out. */
const toBody = (list: Entry[]): Entry[] =>
  list.map((r) => ({ word: r.word?.trim() || null, meaning: r.meaning.trim() })).filter((r) => r.word || r.meaning);

/**
 * A verse's word-for-word as rows of word and meaning, in the order the words stand
 * in the verse: edit either, add a row, remove one, move one up or down. Saving
 * replaces the whole list, which is what the API's `wordMeanings` does.
 *
 * The rows are started from `value` once — mount it with `key={verseId}` so opening
 * another verse starts over.
 */
export function VerseWordMeanings({ verseId, value, canWrite }: { verseId: string; value: unknown; canWrite: boolean }) {
  const mutate = useResourceMutation('verse');
  const nextKey = useRef(0);
  const toRows = (entries: Entry[]): Row[] => entries.map((e) => ({ key: nextKey.current++, word: e.word ?? '', meaning: e.meaning }));

  const [saved, setSaved] = useState(() => entriesFrom(value));
  const [rows, setRows] = useState(() => toRows(saved));
  const [error, setError] = useState('');

  const body = toBody(rows);
  const dirty = JSON.stringify(body) !== JSON.stringify(toBody(saved));
  // A word with nothing said about it: the API refuses it, so say which row.
  const incomplete = rows.findIndex((r) => r.word.trim() && !r.meaning.trim());

  const edit = (key: number, patch: Partial<Pick<Row, 'word' | 'meaning'>>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const move = (from: number, by: number) =>
    setRows((rs) => {
      const to = from + by;
      if (to < 0 || to >= rs.length) return rs;
      const next = [...rs];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });

  const remove = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));
  const add = () => setRows((rs) => [...rs, { key: nextKey.current++, word: '', meaning: '' }]);

  async function save() {
    setError('');
    try {
      const res = await mutate.mutateAsync({ path: `/api/admin/verses/${verseId}`, method: 'patch', body: { wordMeanings: body } });
      const next = entriesFrom((res.data as { wordMeanings?: unknown }).wordMeanings);
      setSaved(next);
      setRows(toRows(next));
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Could not save the word meanings.');
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Word meanings ({body.length})</p>

      {rows.length === 0 && <p className="text-muted-foreground">None yet.</p>}

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={row.key} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
            <Input
              aria-label={`Word ${i + 1}`}
              placeholder="Word"
              value={row.word}
              disabled={!canWrite}
              onChange={(e) => edit(row.key, { word: e.target.value })}
            />
            <Textarea
              aria-label={`Meaning ${i + 1}`}
              placeholder="Meaning"
              rows={1}
              className="field-sizing-content min-h-9 py-1.5"
              value={row.meaning}
              disabled={!canWrite}
              onChange={(e) => edit(row.key, { meaning: e.target.value })}
            />
            {canWrite && (
              <div className="flex items-start gap-0.5">
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Move row ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Move row ${i + 1} down`}
                  disabled={i === rows.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Remove row ${i + 1}`} onClick={() => remove(row.key)}>
                  <Trash2 />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canWrite && (
        <div className="mt-3 space-y-2">
          {incomplete >= 0 && <p className="text-xs text-destructive">Row {incomplete + 1} has a word but no meaning.</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={add}>
              <Plus />
              Add a word
            </Button>
            <div className="flex-1" />
            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRows(toRows(saved));
                  setError('');
                }}
              >
                Discard changes
              </Button>
            )}
            <Button size="sm" disabled={!dirty || incomplete >= 0 || mutate.isPending} onClick={save}>
              {mutate.isPending ? 'Saving…' : 'Save word meanings'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
