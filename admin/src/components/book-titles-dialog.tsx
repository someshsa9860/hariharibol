import { useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { useResource, useResourceMutation } from '@/lib/use-resource';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/utils';

type Language = { code: string; nativeName: string; englishName: string; isRtl: boolean };
type Titles = Record<string, string>;
type Titled = { id: string; number: number; title: string; titleI18n: unknown };
type BookDetail = {
  id: string;
  title: string;
  titleI18n: unknown;
  cantos: Titled[];
  chapters: (Titled & { cantoNumber: number | null })[];
};

/** One title that can be translated: the book's, a canto's or a chapter's. */
type Row = { key: string; path: string; label: string; group: string; english: string; stored: Titles };

/** What the column holds, as plain `{ code: text }` — it is JSON, so anything could be in it. */
function titlesOf(value: unknown): Titles {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((e): e is [string, string] => typeof e[1] === 'string' && !!e[1].trim()));
}

/**
 * The English heading of a title. Usually the plain `title` column, but the Gita's
 * chapters keep the Sanskrit name there and Prabhupāda's English heading in the
 * map under `en`, which wins. `en` is never edited here, only carried through.
 */
const englishOf = (title: string, stored: Titles) => stored.en ?? title;

function rowsOf(book: BookDetail): Row[] {
  const base = `/api/admin/books/${book.id}`;
  const row = (key: string, path: string, label: string, group: string, item: { title: string; titleI18n: unknown }): Row => {
    const stored = titlesOf(item.titleI18n);
    return { key, path, label, group, english: englishOf(item.title, stored), stored };
  };

  return [
    row('book', base, 'Book', 'Book', book),
    ...book.cantos.map((c) => row(`canto:${c.id}`, `${base}/cantos/${c.id}`, `Canto ${c.number}`, 'Cantos', c)),
    ...book.chapters.map((c) =>
      row(`chapter:${c.id}`, `${base}/chapters/${c.id}`, `Chapter ${c.number}`, c.cantoNumber == null ? 'Chapters' : `Canto ${c.cantoNumber} chapters`, c)
    ),
  ];
}

const sameTitles = (a: Titles, b: Titles) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
};

/**
 * The title of a book, its cantos and its chapters in every reading language,
 * side by side with the English. A language is picked on the left; every title
 * is a box on the right. A blank box means "no title in this language" — the
 * app then shows the next language it reads, ending in English — so clearing a
 * box is how a wrong title is withdrawn.
 *
 * Edits are kept in the dialog until Save, which sends one request for each
 * title that changed (all its languages together).
 */
export function BookTitlesDialog({
  book,
  onClose,
  canWrite,
}: {
  book: { id: string; title: string } | null;
  onClose: () => void;
  canWrite: boolean;
}) {
  const mutate = useResourceMutation('books');
  const languages = useResource<Language[]>(['books', 'languages'], '/api/admin/books/languages', undefined, { enabled: !!book });
  const detail = useResource<BookDetail>(['books', 'titles', book?.id], `/api/admin/books/${book?.id}`, undefined, { enabled: !!book });

  const [picked, setPicked] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  // What has been typed and not saved, by `<row key>|<language>`.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const list = languages.data ?? [];
  const rows = detail.data ? rowsOf(detail.data) : [];
  const code = picked || list[0]?.code || '';
  const language = list.find((l) => l.code === code);

  const textOf = (row: Row, lang: string) => drafts[`${row.key}|${lang}`] ?? row.stored[lang] ?? '';

  /** The titles each changed row would hold after Save — only rows that differ from what is stored. */
  const changes = rows.flatMap((row) => {
    const next = { ...row.stored };
    for (const l of list) {
      const draft = drafts[`${row.key}|${l.code}`];
      if (draft === undefined) continue;
      if (draft.trim()) next[l.code] = draft.trim();
      else delete next[l.code];
    }
    return sameTitles(next, row.stored) ? [] : [{ row, next }];
  });

  const shown = onlyMissing ? rows.filter((r) => !textOf(r, code).trim()) : rows;

  async function save() {
    setError('');
    let saved = 0;
    for (const { row, next } of changes) {
      try {
        await mutate.mutateAsync({ path: row.path, method: 'patch', body: { titleI18n: next } });
        saved += 1;
      } catch (e) {
        const why = e instanceof ApiRequestError ? e.message : 'Could not save.';
        setError(`${saved} of ${changes.length} titles saved. ${why}`);
        return;
      }
    }
  }

  function close() {
    if (changes.length > 0 && !confirm('Close without saving your changes?')) return;
    setDrafts({});
    setError('');
    setPicked('');
    onClose();
  }

  return (
    <Dialog open={!!book} onOpenChange={(open) => !open && close()}>
      <DialogContent page className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            Titles — {book?.title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            The title of the book, each canto and each chapter in the language a reader has chosen to read in. Where a language has no
            title the app shows the next one it reads, ending in English. Seeded titles are AI-drafted and have not been read by a native
            speaker — correct them here. Phones that already hold the book get changed titles with its next export.
          </p>
        </DialogHeader>

        {detail.isLoading || languages.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
            <ul className="max-h-[55vh] space-y-1 overflow-y-auto pr-1">
              {list.map((l) => {
                const filled = rows.filter((r) => textOf(r, l.code).trim()).length;
                return (
                  <li key={l.code}>
                    <button
                      type="button"
                      onClick={() => setPicked(l.code)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent',
                        l.code === code && 'bg-accent font-medium'
                      )}
                    >
                      <span>
                        {l.nativeName}
                        <span className="ml-1.5 text-xs text-muted-foreground">{l.englishName}</span>
                      </span>
                      {filled === rows.length ? (
                        <Check className="h-4 w-4 text-success" aria-label="Complete" />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {filled}/{rows.length}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {language && (
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {language.nativeName} <span className="text-sm text-muted-foreground">({language.code})</span>
                  </p>
                  <Select className="w-44" value={onlyMissing ? 'missing' : 'all'} onChange={(e) => setOnlyMissing(e.target.value === 'missing')} aria-label="Which titles to show">
                    <option value="all">All titles</option>
                    <option value="missing">Only those without a title</option>
                  </Select>
                </div>

                <div className="max-h-[50vh] overflow-y-auto pr-1">
                  {shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Every title has one in this language.</p>}
                  {shown.map((row, i) => (
                    <div key={row.key}>
                      {(i === 0 || shown[i - 1].group !== row.group) && (
                        <p className="sticky top-0 bg-card pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.group}</p>
                      )}
                      <div className="grid items-center gap-2 border-b border-border py-1.5 md:grid-cols-[6rem_1fr_1fr]">
                        <span className="text-sm text-muted-foreground">{row.label}</span>
                        <span className="text-sm">{row.english}</span>
                        <Input
                          dir={language.isRtl ? 'rtl' : undefined}
                          value={textOf(row, code)}
                          placeholder={canWrite ? 'No title in this language' : '—'}
                          disabled={!canWrite}
                          aria-label={`${row.label} in ${language.englishName}`}
                          onChange={(e) => setDrafts({ ...drafts, [`${row.key}|${code}`]: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                {canWrite && (
                  <div className="flex items-center justify-between">
                    {changes.length > 0 ? <Badge variant="warning">{changes.length} changed, not saved</Badge> : <span />}
                    <Button onClick={save} disabled={changes.length === 0 || mutate.isPending}>
                      {mutate.isPending ? 'Saving…' : 'Save changes'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
